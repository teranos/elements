// Overlay Form — an element resting over one other element.
//
// "IF THERE ARE MESSAGES PENDING TO BE SENT, AS A COLLECTED BATCH, I SEE IT BOTTOM LEFTSIDE. SLIGHTLY TRANSPARENT. AND I CAN MOVE IT UP IF IT WANT TO."
// "IF I PRESS ON IT, IT OPENS UP FULLSCREEN."
// "FOR THE OVERLAID ELEMENT, ITS LIKE A WINDOW ELEMENT, BUT THIS PROBABLY REQUIRES A CHANGE TO THE ELEMENTS PACKAGE ITSELF"
// "THE OVERLAY IS A NEW ELEMENT FORM"
// "AND IS ALAYS ASSOCIATED WITH ONE OTHER ELEMENT"
//
// It rests inside the element it is over, so it goes where that element goes:
// moved with it, stashed with it for the tray, back with it. A drag moves it,
// no further than that element. A press takes Panel Form, the same element,
// and every way out of the panel brings it back to where it rested: an overlay
// is never in the tray (forms/home.ts).

import { type Element, getRestDuration, CANVAS_ELEMENT_CONTENT_PADDING } from '../element';
import { setForm, getForm, setElementId, getElementId } from '../dataset';
import { stashContent, restoreContent, hasStash } from '../content/stash';
import { holdBody } from '../content/body';
import { watchScroll } from '../content/scroll';
import { disarmContentWatch } from '../content/watch';
import { createSymbolSpan } from '../symbol-span';
import { beginMorphToButton, cancelMorph, type TooltipBox } from '../morph-transaction';
import { leaveWindow } from '../window/window';
import { morphDotToPanel, leavePanel } from './panel';
import { tray } from '../tray/tray';
import { raise } from '../window/z-order';
import { setHome, clearHome } from './home';
import { AX } from './ax';
import { getLogger, getLogSegment } from '../config';

/**
 * How much of its ground shows while it rests: slightly transparent. The ground's,
 * not the element's: an element let through whole blurs nothing behind it, and
 * what it says stays whole.
 */
export const OVERLAY_OPACITY = 0.88;
/** How far from the bottom left of its element it first rests, in px. */
export const OVERLAY_INSET = 8;
/** What it stands on at rest: the press's ground (forms/ax.ts), let through a little. */
const GROUND = `rgba(25, 25, 30, ${OVERLAY_OPACITY})`;
/** How far a press may move and still be a press, in px. */
const SLOP = 4;

export interface OverlayOptions {
    /** The one other element it is over, for its whole life. */
    over: HTMLElement;
    /** The host's class, so it looks as the host draws it. */
    className?: string;
    /**
     * Where it first rests, in px from its element's bottom left: above a chat's
     * field, say. Left out, it is OVERLAY_INSET from each. A person moves it from there.
     */
    at?: { left?: number; bottom?: number };
}

export interface OverlayHandle {
    /** The one element, in whatever form it is in. */
    element: HTMLElement;
    /** Changes what it says, at rest and as its title. */
    says(text: string): void;
    /** Takes it away for good, from wherever it is. What its item does when closed is done then. */
    away(): void;
    /** Brings it back inside its element, where that element changed size under it. */
    fit(): void;
}

/** An element in overlay form, over the one element the host names. */
export function overlayFrom(item: Element, options: OverlayOptions): OverlayHandle {
    const log = getLogger();
    const seg = getLogSegment();
    const over = options.over;
    const className = options.className ?? '';
    if (!getElementId(over)) {
        throw new Error(`An overlay is over one other element, and what ${item.id} was given carries no data-element-id`);
    }

    const element = document.createElement('div');
    setElementId(element, item.id);
    // As a panel it has no close button: closed there, it would be gone with its place still held.
    // Its host takes it away (away), and what the item does when closed is done then.
    const shown: Element = { ...item, onClose: undefined };

    // What it says, one node for its whole life: at rest, then the panel's
    // title, then at rest again (Element Axioma).
    const label = document.createElement('span');
    label.className = 'overlay-label';
    label.textContent = item.title;

    // Where it rests in its element, from that element's bottom left.
    const place = { left: options.at?.left ?? OVERLAY_INSET, bottom: options.at?.bottom ?? OVERLAY_INSET };
    // The size it rests at, as it was last drawn there.
    let size = { width: 0, height: 0 };
    // On its way back: not yet at rest, no longer anything else.
    let returning = false;
    let gone = false;

    const stand = () => {
        element.style.left = `${place.left}px`;
        element.style.bottom = `${place.bottom}px`;
    };

    /** How big its element is drawn for how big it is laid out: a canvas zoomed draws it another size. */
    const scale = (): number => {
        const drawn = over.getBoundingClientRect().width;
        return over.offsetWidth > 0 && drawn > 0 ? drawn / over.offsetWidth : 1;
    };

    /** Held inside its element, once both can be measured: where a host put it, and after its element changed size. */
    const fit = () => {
        if (gone || getForm(element) !== 'overlay' || returning || element.parentElement !== over) return;
        const held = over.getBoundingClientRect();
        const mine = element.getBoundingClientRect();
        if (held.width <= 0 || mine.width <= 0) return;
        const by = scale();
        place.left = Math.max(0, Math.min(place.left, (held.width - mine.width) / by));
        place.bottom = Math.max(0, Math.min(place.bottom, (held.height - mine.height) / by));
        stand();
    };

    /** What an overlay is at rest: what it says, over its element, slightly transparent. */
    const rest = () => {
        element.style.cssText = '';
        element.className = className;
        label.remove();
        label.style.flex = '';
        if (element.firstChild) stashContent(element);
        element.appendChild(label);
        element.setAttribute('role', 'button');
        element.tabIndex = 0;
        setForm(element, 'overlay');
        element.style.position = 'absolute';
        element.style.zIndex = '1';
        element.style.cursor = 'pointer';
        // A finger on it moves it, not the page.
        element.style.touchAction = 'none';
        element.style.userSelect = 'none';
        element.style.setProperty('-webkit-user-select', 'none');
        element.style.boxSizing = 'border-box';
        element.style.maxWidth = '100%';
        // The package's own look, as a press wears it (forms/ax.ts).
        element.style.background = GROUND;
        // What is behind it shows as light and shade, not as words under its own. WebKit blurs
        // nothing for an element inside one that blurs (a canvas-placed one): there the ground alone carries it.
        element.style.setProperty('backdrop-filter', 'blur(6px)');
        element.style.setProperty('-webkit-backdrop-filter', 'blur(6px)');
        element.style.color = AX.ink;
        element.style.outline = `1px solid ${AX.frame}`;
        element.style.borderRadius = '2px';
        element.style.padding = '6px 10px';
        stand();
        // It is measured from the element it is over.
        if (window.getComputedStyle(over).position === 'static') over.style.position = 'relative';
        if (element.parentElement !== over) over.appendChild(element);
        fit();
    };

    const verify = (id: string, el: HTMLElement) => {
        if (getElementId(el) !== id) {
            throw new Error(`AXIOM VIOLATION: Element for ${id} is not the overlay that became it`);
        }
    };

    const titleBarOf = (): HTMLElement => {
        const bar = Array.from(element.children).find((c) => c.classList.contains('title-bar')) as HTMLElement | undefined;
        if (bar) return bar;
        const made = document.createElement('div');
        made.className = 'title-bar';
        if (item.symbol) made.appendChild(createSymbolSpan(item.symbol));
        element.insertBefore(made, element.firstChild);
        return made;
    };

    /** The panel it is becoming, around the words it already says: the body it had, or its first one. */
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
        element.style.display = 'flex';
        element.style.flexDirection = 'column';
        element.style.overflow = 'hidden';
        element.style.padding = '0';
    };

    const open = () => {
        if (gone || getForm(element) !== 'overlay' || returning) return;
        const at = element.getBoundingClientRect();
        size = { width: at.width, height: at.height };
        // Onto the page first: inside its element, fixed is measured from that element.
        document.body.appendChild(element);
        element.style.cssText = '';
        element.style.position = 'fixed';
        element.style.boxSizing = 'border-box';
        element.style.left = `${at.left}px`;
        element.style.top = `${at.top}px`;
        element.style.width = `${at.width}px`;
        element.style.height = `${at.height}px`;
        try {
            carry();
            element.removeAttribute('role');
            element.removeAttribute('tabindex');
            // A road abandoned puts it back at rest, unless it is already on its way there: it has no dot to be.
            morphDotToPanel(element, shown, verify, () => {}, () => { if (!gone && !returning) rest(); });
        } catch (err: unknown) {
            // What it holds did not draw, or the road did not begin: it is at rest, where a press finds it again.
            log.error(seg, `[Overlay ${item.id}] It did not open: ${err instanceof Error ? err.message : String(err)}`);
            cancelMorph(element);
            rest();
        }
    };

    const comeBack = () => {
        if (gone || returning) return;
        const form = getForm(element);
        let from: TooltipBox;
        cancelMorph(element);
        if (form === 'panel') {
            const r = leavePanel(element);
            from = { x: r.left, y: r.top, width: r.width, height: r.height };
        } else if (form === 'window') {
            const r = leaveWindow(element);
            from = { x: r.left, y: r.top, width: r.width, height: r.height };
        } else {
            return;
        }
        if (tray.has(item.id)) tray.remove(item.id);

        // Its element is not on the page: it waits there, at rest, for it to come back.
        if (!over.isConnected) {
            rest();
            return;
        }

        returning = true;
        const held = over.getBoundingClientRect();
        const to: TooltipBox = {
            x: held.left + place.left * scale(),
            y: held.bottom - place.bottom * scale() - size.height,
            width: size.width,
            height: size.height,
        };
        element.style.cssText = '';
        element.className = className;
        element.style.position = 'fixed';
        element.style.boxSizing = 'border-box';
        element.style.left = `${from.x}px`;
        element.style.top = `${from.y}px`;
        element.style.width = `${from.width}px`;
        element.style.height = `${from.height}px`;
        if (hasStash(element)) restoreContent(element);
        element.style.display = 'flex';
        element.style.flexDirection = 'column';
        element.style.overflow = 'hidden';
        if (!element.isConnected) document.body.appendChild(element);
        raise(element);
        setForm(element, 'overlay');

        beginMorphToButton(element, from, to, getRestDuration())
            .then(() => {
                returning = false;
                if (!gone) rest();
            })
            .catch((err: unknown) => {
                returning = false;
                log.warn(seg, `[Overlay ${item.id}] The road back over its element was abandoned: ${err instanceof Error ? err.message : String(err)}`);
            });
    };

    // A drag moves it; a press that stayed where it was opens it.
    let pressedAt: { x: number; y: number; left: number; bottom: number } | null = null;
    let moved = false;
    const resting = () => !gone && getForm(element) === 'overlay' && !returning;
    // What is pressed on it is its own, and never its element's to drag or press.
    const own = (e: Event) => { if (resting()) e.stopPropagation(); };
    // And a mouse dragging it selects nothing behind it.
    element.addEventListener('mousedown', (e: Event) => { if (resting()) { e.stopPropagation(); e.preventDefault(); } });
    element.addEventListener('touchstart', own, { passive: true });

    element.addEventListener('pointerdown', (e: Event) => {
        if (!resting()) return;
        e.stopPropagation();
        const p = e as PointerEvent;
        pressedAt = { x: p.clientX, y: p.clientY, left: place.left, bottom: place.bottom };
        moved = false;
        try { element.setPointerCapture?.(p.pointerId); } catch { /* a press with no pointer to hold */ }
    });
    element.addEventListener('pointermove', (e: Event) => {
        if (!pressedAt || !resting()) return;
        const p = e as PointerEvent;
        const dx = p.clientX - pressedAt.x;
        const dy = p.clientY - pressedAt.y;
        if (!moved && Math.abs(dx) <= SLOP && Math.abs(dy) <= SLOP) return;
        moved = true;
        const held = over.getBoundingClientRect();
        const mine = element.getBoundingClientRect();
        // What the finger moved on screen, in its element's own measure.
        const by = scale();
        place.left = Math.max(0, Math.min(pressedAt.left + dx / by, (held.width - mine.width) / by));
        place.bottom = Math.max(0, Math.min(pressedAt.bottom - dy / by, (held.height - mine.height) / by));
        stand();
    });
    const letGo = (e: Event) => {
        if (!pressedAt) return;
        e.stopPropagation();
        pressedAt = null;
    };
    element.addEventListener('pointerup', letGo);
    element.addEventListener('pointercancel', (e: Event) => { letGo(e); moved = false; });

    element.addEventListener('click', (e: Event) => {
        if (!resting()) return;
        e.stopPropagation();
        // The click a drag ends with moved it, and opens nothing.
        if (moved) { moved = false; return; }
        open();
    });
    element.addEventListener('keydown', (e: KeyboardEvent) => {
        if (!resting()) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        open();
    });

    // Its place is the only place it rests: minimized, swiped away or left by Escape, it comes back here.
    setHome(element, comeBack, true);
    rest();
    // Its element made smaller under it, it is brought back inside.
    const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(() => fit()) : null;
    resized?.observe(over);

    return {
        element,
        says: (text: string) => { label.textContent = text; },
        away: () => {
            if (gone) return;
            gone = true;
            cancelMorph(element);
            const form = getForm(element);
            if (form === 'panel') leavePanel(element);
            else if (form === 'window') leaveWindow(element);
            if (tray.has(item.id)) tray.remove(item.id);
            disarmContentWatch(element);
            clearHome(element);
            resized?.disconnect();
            element.remove();
            try { item.onClose?.(); } catch (err: unknown) {
                log.error(seg, `[Overlay ${item.id}] Error in onClose: ${err instanceof Error ? err.message : String(err)}`);
            }
        },
        fit,
    };
}
