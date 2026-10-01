/**
 * Button Form — an element resting as a button, in a place of its own.
 *
 * "It really feels like a button. Until you click it and your entire
 * conceptual model of what UI could be shatters." No intermediary stage and no
 * hover expand: a click takes Window Form, and it is the same element.
 *
 * Where it was "becomes a transparent hole, a gap. Click once on the gap to
 * locate, and click twice on the gap to bring the button back from anywhere it
 * is to its original button position." Locating "moves it out of the tray if
 * in it, or does slight fast blink twice on borders and titlebar". The window
 * has a down arrow, which takes it back to its place as well.
 *
 * The gap is a hole, not an element: it carries no id and no form, so the
 * element it stands open for is still exactly one DOM element (Element Axioma).
 */

import { type Element } from '../element';
import { getRestDuration } from '../element';
import { setForm, getForm, setElementId, getElementId } from '../dataset';
import { beginMorphToButton, cancelMorph, type TooltipBox } from '../morph-transaction';
import { morphDotToWindow, leaveWindow } from '../window/window';
import { leavePanel } from './panel';
import { tray } from '../tray/tray';
import { raise } from '../window/z-order';
import { setHome } from './home';
import { getLogger, getLogSegment } from '../config';

export interface ButtonOptions {
    /** The host's button class, so it looks like every other button on the page. */
    className?: string;
    /** Ms a click on the gap waits for a second one before it locates (default 250). */
    between?: number;
}

/** How long a locating blink takes, both blinks. */
const BLINK_MS = 320;

function boxOf(el: HTMLElement): TooltipBox {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
}

/** "slight fast blink twice on borders and titlebar". */
function blink(element: HTMLElement): void {
    if (typeof element.animate !== 'function') return;
    const border = window.getComputedStyle(element).borderColor || 'currentColor';
    element.animate(
        [border, 'transparent', border, 'transparent', border].map((borderColor) => ({ borderColor })),
        { duration: BLINK_MS, easing: 'linear' },
    );
    const titleBar = element.querySelector<HTMLElement>('.title-bar');
    titleBar?.animate(
        ['1', '0.4', '1', '0.4', '1'].map((opacity) => ({ opacity })),
        { duration: BLINK_MS, easing: 'linear' },
    );
}

/**
 * An element in button form. The host puts it where a button goes; everything
 * after that is the element's.
 */
export function buttonFrom(item: Element, options: ButtonOptions = {}): HTMLElement {
    const log = getLogger();
    const seg = getLogSegment();
    const className = options.className ?? '';
    const between = options.between ?? 250;

    const element = document.createElement('div');
    setElementId(element, item.id);

    let gap: HTMLElement | null = null;
    let locating: ReturnType<typeof setTimeout> | null = null;
    // On its way back: not yet a button, no longer anything else.
    let returning = false;

    /** What a button is: its label, its role, the host's class. Nothing else. */
    const rest = () => {
        element.style.cssText = '';
        element.className = className;
        element.textContent = item.title;
        element.setAttribute('role', 'button');
        element.tabIndex = 0;
        setForm(element, 'button');
    };

    const verify = (id: string, el: HTMLElement) => {
        if (getElementId(el) !== id) {
            throw new Error(`AXIOM VIOLATION: Element for ${id} is not the button that became it`);
        }
    };

    const open = () => {
        if (getForm(element) !== 'button' || returning) return;
        const at = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        // The hole it leaves: its size and its place in the flow, and nothing to see.
        gap = document.createElement('div');
        gap.className = 'button-gap';
        gap.style.display = style.display === 'inline' || !style.display ? 'inline-block' : style.display;
        gap.style.boxSizing = 'border-box';
        gap.style.width = `${at.width}px`;
        gap.style.height = `${at.height}px`;
        gap.style.margin = style.margin;
        gap.style.verticalAlign = style.verticalAlign;
        gap.style.flexShrink = '0';
        gap.style.background = 'transparent';
        gap.style.cursor = 'pointer';
        // Two taps are two taps, not a zoom.
        gap.style.touchAction = 'manipulation';
        gap.addEventListener('click', onGap);

        // Where it is stays where the road starts, once the gap takes its place.
        element.style.position = 'fixed';
        element.style.left = `${at.left}px`;
        element.style.top = `${at.top}px`;
        element.style.width = `${at.width}px`;
        element.style.height = `${at.height}px`;
        element.before(gap);
        // What the button said is not the window's: the title bar says it now.
        element.textContent = '';
        element.removeAttribute('role');
        element.removeAttribute('tabindex');

        morphDotToWindow(element, item, verify, () => {}, (el, it) => tray.adopt(el, it));
    };

    const locate = () => {
        const form = getForm(element);
        if (form === 'dot') {
            tray.open(item.id);
            return;
        }
        if (form !== 'window' && form !== 'panel') return;
        if (form === 'window') raise(element);
        blink(element);
    };

    const comeBack = () => {
        if (!gap || returning) return;
        const form = getForm(element);
        let from: TooltipBox;
        cancelMorph(element);
        if (form === 'window') {
            const r = leaveWindow(element);
            from = { x: r.left, y: r.top, width: r.width, height: r.height };
        } else if (form === 'panel') {
            const r = leavePanel(element);
            from = { x: r.left, y: r.top, width: r.width, height: r.height };
        } else if (form === 'dot') {
            from = boxOf(element);
            // Out of the tray, and no longer the tray's.
            tray.remove(item.id);
        } else {
            return;
        }

        returning = true;
        const to = boxOf(gap);
        element.style.cssText = '';
        element.className = className;
        element.style.position = 'fixed';
        element.style.boxSizing = 'border-box';
        element.style.left = `${from.x}px`;
        element.style.top = `${from.y}px`;
        element.style.width = `${from.width}px`;
        element.style.height = `${from.height}px`;
        if (!element.isConnected) document.body.appendChild(element);
        raise(element);
        setForm(element, 'button');

        beginMorphToButton(element, from, to, getRestDuration())
            .then(() => {
                returning = false;
                rest();
                gap?.replaceWith(element);
                gap = null;
            })
            .catch((err: unknown) => {
                returning = false;
                log.warn(seg, `[Button ${item.id}] The road back to its place was abandoned: ${err instanceof Error ? err.message : String(err)}`);
            });
    };

    // One click locates, two bring it back: the first of two waits to see.
    function onGap(e: MouseEvent): void {
        if (locating) clearTimeout(locating);
        locating = null;
        if (e.detail >= 2) {
            comeBack();
            return;
        }
        locating = setTimeout(() => {
            locating = null;
            locate();
        }, between);
    }

    element.addEventListener('click', () => open());
    element.addEventListener('keydown', (e: KeyboardEvent) => {
        if (getForm(element) !== 'button') return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        open();
    });

    setHome(element, comeBack);
    rest();
    return element;
}
