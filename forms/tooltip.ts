/**
 * Tooltip Form — an element said beside something pointed at.
 *
 * "tooltip is a form an element can be in." Hovering the text, after 300ms a
 * tooltip; after 1s more, the expanded tooltip; a click takes Window Form.
 * "ITS A NEW ELEMENT EVERY FUCKING TIME": each hover makes one, and the text
 * and whatever holds it are never touched.
 *
 * The element is born into this form, so abandoning it (Morph Axioma) is the
 * element going: a tooltip nobody clicked leaves nothing behind. Clicked, it is
 * the same element that takes the window and keeps the content it grew into.
 */

import { type Element, DEFAULT_COLOR, DEFAULT_TEXT_COLOR, MIN_WINDOW_WIDTH, TITLE_BAR_HEIGHT, CANVAS_ELEMENT_CONTENT_PADDING } from '../element';
import { setForm, getForm, setElementId, getElementId, setSymbol, setLastSize } from '../dataset';
import { wearIdentity } from '../paint';
import { createSymbolSpan } from '../symbol-span';
import { stashContent } from '../content/stash';
import { morphDotToWindow } from '../window/window';
import { tray } from '../tray/tray';

export interface TooltipTiming {
    /** Hover in ms before the tooltip is said (default 300). */
    delay?: number;
    /** Hover in ms after the tooltip is said before it grows into the bigger picture (default 1000). */
    expandAfter?: number;
    /** Ms between the pointer leaving and the tooltip going, so it can cross onto the tooltip (default 120). */
    grace?: number;
}

const TOOLTIP_Z_INDEX = '10005';

/** The tooltip itself: a new element each time, in tooltip form, beside the anchor. */
function sayBeside(anchor: HTMLElement, item: Element): HTMLElement {
    const element = document.createElement('div');
    element.className = 'tooltip';
    setElementId(element, item.id);
    setSymbol(element, item.symbol);
    setForm(element, 'tooltip');

    element.style.position = 'fixed';
    element.style.zIndex = TOOLTIP_Z_INDEX;
    element.style.backgroundColor = item.color ?? DEFAULT_COLOR;
    element.style.color = item.textColor ?? DEFAULT_TEXT_COLOR;
    // Said, not yet something to act on: the pointer passes through until it grows.
    element.style.pointerEvents = 'none';
    wearIdentity(element, item);

    const said = document.createElement('div');
    said.className = 'tooltip-said';
    said.style.display = 'flex';
    said.style.gap = '6px';
    said.style.alignItems = 'center';
    if (item.symbol) said.appendChild(createSymbolSpan(item.symbol));
    const title = document.createElement('span');
    title.textContent = item.title;
    said.appendChild(title);
    element.appendChild(said);

    document.body.appendChild(element);
    place(element, anchor);
    return element;
}

/** Below the anchor, on the screen. */
function place(element: HTMLElement, anchor: HTMLElement): void {
    const at = anchor.getBoundingClientRect();
    const size = element.getBoundingClientRect();
    const left = Math.max(4, Math.min(at.left, window.innerWidth - size.width - 4));
    const below = at.bottom + 4;
    const top = below + size.height > window.innerHeight ? at.top - size.height - 4 : below;
    element.style.left = `${left}px`;
    element.style.top = `${Math.max(4, top)}px`;
}

/** The bigger picture: the element's content, below what the tooltip said. */
function grow(element: HTMLElement, anchor: HTMLElement, item: Element): void {
    const area = document.createElement('div');
    area.className = 'content-area';
    area.appendChild(item.renderContent());
    element.appendChild(area);
    element.dataset.expanded = 'true';
    // Grown, it is something to act on.
    element.style.pointerEvents = 'auto';
    element.style.cursor = 'pointer';
    place(element, anchor);
}

/** A click takes Window Form: the same element, keeping the content it grew into. */
function toWindow(element: HTMLElement, item: Element): void {
    // What the tooltip said is the window's title bar now; the body goes with it.
    element.querySelector('.tooltip-said')?.remove();
    const area = element.querySelector('.content-area') as HTMLElement | null;
    // A window measures its content; this one is here to be measured, in the
    // padding a window's body has (content/render.ts), under its title bar.
    if (area) area.style.padding = `${CANVAS_ELEMENT_CONTENT_PADDING}px`;
    const border = element.offsetHeight - element.clientHeight;
    setLastSize(
        element,
        Math.max(MIN_WINDOW_WIDTH, element.offsetWidth),
        (area?.offsetHeight ?? 0) + parseInt(TITLE_BAR_HEIGHT) + border,
    );
    stashContent(element);
    element.style.pointerEvents = '';
    element.style.cursor = '';
    delete element.dataset.expanded;
    element.classList.remove('tooltip');

    morphDotToWindow(
        element,
        item,
        (id, el) => {
            if (getElementId(el) !== id) {
                throw new Error(`AXIOM VIOLATION: Element for ${id} is not the tooltip that became it`);
            }
        },
        () => {},
        // A window born from a tooltip rests where every window rests.
        (el, it) => tray.adopt(el, it),
    );
}

/**
 * Hovering `anchor` says a new element beside it, made by `make` each time.
 * Returns what takes the behavior off the anchor again.
 */
export function tooltipFrom(anchor: HTMLElement, make: () => Element, timing: TooltipTiming = {}): () => void {
    const delay = timing.delay ?? 300;
    const expandAfter = timing.expandAfter ?? 1000;
    const grace = timing.grace ?? 120;

    let saying: ReturnType<typeof setTimeout> | null = null;
    let growing: ReturnType<typeof setTimeout> | null = null;
    let going: ReturnType<typeof setTimeout> | null = null;
    let current: { element: HTMLElement; item: Element } | null = null;
    let onTooltip = false;
    let onAnchor = false;

    const stop = (t: ReturnType<typeof setTimeout> | null) => { if (t) clearTimeout(t); };

    // Abandoned: the element born into tooltip form goes, unless it became a window.
    const abandon = () => {
        stop(saying); stop(growing);
        saying = null; growing = null;
        if (current && getForm(current.element) === 'tooltip') current.element.remove();
        current = null;
    };

    const maybeGo = () => {
        stop(going);
        going = setTimeout(() => {
            going = null;
            if (!onAnchor && !onTooltip) abandon();
        }, grace);
    };

    const enterAnchor = () => {
        onAnchor = true;
        stop(going);
        if (current || saying) return;
        saying = setTimeout(() => {
            saying = null;
            const item = make();
            const element = sayBeside(anchor, item);
            current = { element, item };

            element.addEventListener('pointerenter', () => { onTooltip = true; stop(going); });
            element.addEventListener('pointerleave', () => {
                onTooltip = false;
                if (current?.element === element) maybeGo();
            });
            element.addEventListener('click', () => {
                if (element.dataset.expanded !== 'true' || getForm(element) !== 'tooltip') return;
                // Committed: it is no longer this anchor's to take away.
                current = null;
                onTooltip = false;
                toWindow(element, item);
            });

            growing = setTimeout(() => {
                growing = null;
                if (current?.element === element) grow(element, anchor, item);
            }, expandAfter);
        }, delay);
    };

    const leaveAnchor = () => {
        onAnchor = false;
        maybeGo();
    };

    anchor.addEventListener('pointerenter', enterAnchor);
    anchor.addEventListener('pointerleave', leaveAnchor);

    return () => {
        anchor.removeEventListener('pointerenter', enterAnchor);
        anchor.removeEventListener('pointerleave', leaveAnchor);
        stop(going);
        abandon();
    };
}
