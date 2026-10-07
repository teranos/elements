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
 * "A transparent hole 🕳️": it goes through what holds the button, so what is
 * behind that shows where the button was.
 */

import { type Element } from '../element';
import { getRestDuration, MIN_WINDOW_WIDTH, CANVAS_ELEMENT_CONTENT_PADDING } from '../element';
import { setForm, getForm, setElementId, getElementId, getLastSize, setLastSize } from '../dataset';
import { stashContent, restoreContent, hasStash } from '../content/stash';
import { holdBody } from '../content/body';
import { watchScroll } from '../content/scroll';
import { createSymbolSpan } from '../symbol-span';
import { removeRestSymbol } from '../tray/rest-symbol';
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
    /** Ms a click on the gap waits for a second one before it locates (default 300). */
    between?: number;
}

/** How long a locating blink takes, both blinks. */
const BLINK_MS = 320;

function boxOf(el: HTMLElement): TooltipBox {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
}

// What a hole is cut with, each written with and without the prefix WebKit still wants.
const MASK = ['mask-image', 'mask-size', 'mask-position', 'mask-repeat', 'mask-composite'];

/** Whether something is painted, so a hole in it is something to see through. */
function hasSurface(el: HTMLElement): boolean {
    const style = window.getComputedStyle(el);
    const color = style.backgroundColor;
    const painted = color !== '' && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)';
    const image = style.backgroundImage;
    return painted || (image !== '' && image !== 'none');
}

/**
 * Cuts the hole through the nearest thing holding the gap that has a surface,
 * the page itself aside. Returns what closes it again.
 */
function pierce(gap: HTMLElement, at: TooltipBox): () => void {
    let surface = gap.parentElement;
    while (surface && surface !== document.body && !hasSurface(surface)) surface = surface.parentElement;
    if (!surface || surface === document.body) return () => {};
    const held = surface;
    const was = new Map<string, string>();
    for (const name of MASK) {
        was.set(name, held.style.getPropertyValue(name));
        was.set(`-webkit-${name}`, held.style.getPropertyValue(`-webkit-${name}`));
    }
    const box = held.getBoundingClientRect();
    const cut: Record<string, string> = {
        'mask-image': 'linear-gradient(#000, #000), linear-gradient(#000, #000)',
        'mask-size': `100% 100%, ${at.width}px ${at.height}px`,
        'mask-position': `0px 0px, ${at.x - box.left}px ${at.y - box.top}px`,
        'mask-repeat': 'no-repeat',
        'mask-composite': 'exclude',
    };
    for (const name of MASK) {
        held.style.setProperty(name, cut[name]!);
        // WebKit's composite says it in its own words.
        held.style.setProperty(`-webkit-${name}`, name === 'mask-composite' ? 'xor' : cut[name]!);
    }
    return () => {
        for (const [name, value] of was) {
            if (value === '') held.style.removeProperty(name);
            else held.style.setProperty(name, value);
        }
    };
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
    // A double tap is slower than a double click.
    const between = options.between ?? 300;

    const element = document.createElement('div');
    setElementId(element, item.id);

    // What it says, one node for its whole life: the button's words, then the
    // window's title, then the button's words again (Element Axioma).
    const label = document.createElement('span');
    label.className = 'button-label';
    label.textContent = item.title;

    let gap: HTMLElement | null = null;
    let close: () => void = () => {};
    let locating: ReturnType<typeof setTimeout> | null = null;
    // On its way back: not yet a button, no longer anything else.
    let returning = false;

    /** What a button is: its label, its role, the host's class. Nothing else. */
    const rest = () => {
        element.style.cssText = '';
        element.className = className;
        // The body it had as a window waits for the next one; the words stay out.
        label.remove();
        label.style.flex = '';
        if (element.firstChild) stashContent(element);
        element.appendChild(label);
        element.setAttribute('role', 'button');
        element.tabIndex = 0;
        setForm(element, 'button');
    };

    const verify = (id: string, el: HTMLElement) => {
        if (getElementId(el) !== id) {
            throw new Error(`AXIOM VIOLATION: Element for ${id} is not the button that became it`);
        }
    };

    /** Its title bar, saying what the button said. */
    const titleBarOf = (): HTMLElement => {
        const bar = Array.from(element.children).find((c) => c.classList.contains('title-bar')) as HTMLElement | undefined;
        if (bar) return bar;
        const made = document.createElement('div');
        made.className = 'title-bar';
        if (item.symbol) made.appendChild(createSymbolSpan(item.symbol));
        element.insertBefore(made, element.firstChild);
        return made;
    };

    /**
     * The window it is becoming, around the words it already says: the body it
     * had, or its first one. It travels with the element from the first frame.
     */
    const carry = () => {
        label.remove();
        if (hasStash(element)) restoreContent(element);
        const bar = titleBarOf();
        const symbol = bar.querySelector(':scope > .symbol');
        bar.insertBefore(label, symbol ? symbol.nextSibling : bar.firstChild);
        label.style.flex = '1';
        if (!Array.from(element.children).some((c) => c !== bar)) {
            const area = document.createElement('div');
            area.className = 'content-area';
            area.style.padding = `${CANVAS_ELEMENT_CONTENT_PADDING}px`;
            holdBody(area);
            area.appendChild(item.renderContent());
            element.appendChild(area);
        }
        watchScroll(element, item.title);
        // Laid out as a window is while it travels: a column that clips.
        element.style.display = 'flex';
        element.style.flexDirection = 'column';
        element.style.overflow = 'hidden';
        element.style.padding = '0';
    };

    /** The size the window will be, measured off what it carries, so nothing is drawn twice. */
    const measure = (border: { across: number; down: number }) => {
        if (getLastSize(element)) return;
        const measurer = document.createElement('div');
        measurer.style.position = 'fixed';
        measurer.style.left = '-99999px';
        measurer.style.top = '0';
        measurer.style.visibility = 'hidden';
        const children = Array.from(element.children);
        measurer.append(...children);
        document.body.appendChild(measurer);
        // Rounded up: text a fraction of a pixel wider than its box wraps.
        const box = measurer.getBoundingClientRect();
        const width = Math.ceil(Math.max(box.width, measurer.scrollWidth));
        const height = Math.ceil(Math.max(box.height, measurer.scrollHeight));
        element.append(...children);
        measurer.remove();
        setLastSize(element, Math.max(MIN_WINDOW_WIDTH, width + border.across), height + border.down);
    };

    const open = () => {
        if (getForm(element) !== 'button' || returning) return;
        const at = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const border = {
            across: (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0),
            down: (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0),
        };

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
        // Onto the page first: inside a holder that is a containing block (a
        // transform, a filter), fixed is measured from the holder, and the first
        // frame would put it somewhere it never was.
        element.before(gap);
        document.body.appendChild(element);
        element.style.position = 'fixed';
        element.style.left = `${at.left}px`;
        element.style.top = `${at.top}px`;
        element.style.width = `${at.width}px`;
        element.style.height = `${at.height}px`;
        close = pierce(gap, { x: at.left, y: at.top, width: at.width, height: at.height });
        // What the button said is the window's title now, and it never left.
        carry();
        measure(border);
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
            removeRestSymbol(element);
        } else {
            return;
        }
        // Opened out of the tray, the tray still answers its press: let go of it
        // first, or the press that brings it back opens it again.
        if (tray.has(item.id)) tray.remove(item.id);

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
        // It goes back saying what it says, its body with it.
        if (hasStash(element)) restoreContent(element);
        element.style.display = 'flex';
        element.style.flexDirection = 'column';
        element.style.overflow = 'hidden';
        if (!element.isConnected) document.body.appendChild(element);
        raise(element);
        setForm(element, 'button');

        beginMorphToButton(element, from, to, getRestDuration())
            .then(() => {
                returning = false;
                rest();
                gap?.replaceWith(element);
                gap = null;
                close();
                close = () => {};
            })
            .catch((err: unknown) => {
                returning = false;
                log.warn(seg, `[Button ${item.id}] The road back to its place was abandoned: ${err instanceof Error ? err.message : String(err)}`);
            });
    };

    // One click locates, two bring it back: the first of two waits to see.
    function onGap(e: MouseEvent): void {
        // A second press while the first still waits is the second of two, as a
        // finger taps it: a phone numbers every tap the first.
        const second = locating !== null || e.detail >= 2;
        if (locating) clearTimeout(locating);
        locating = null;
        if (second) {
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
