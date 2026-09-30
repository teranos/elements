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

import { type Element, DEFAULT_COLOR, DEFAULT_TEXT_COLOR, MIN_WINDOW_WIDTH, TITLE_BAR_HEIGHT, CANVAS_ELEMENT_CONTENT_PADDING, getTooltipDuration } from '../element';
import { beginMorphToTooltip, beginMorphToAnchor, cancelMorph, type TooltipBox } from '../morph-transaction';
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
    /** On touch, ms a tapped tooltip stays for the next tap before it goes (default 1400). */
    linger?: number;
}

const TOOLTIP_Z_INDEX = '10005';

function boxOf(el: HTMLElement): TooltipBox {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
}

/**
 * While the box moves, what it says keeps the width it will have, so the words
 * are uncovered rather than rewrapped at every frame. Returns what lets go.
 */
function holdWhileMoving(element: HTMLElement): () => void {
    const held = Array.from(element.children) as HTMLElement[];
    for (const child of held) child.style.width = `${child.getBoundingClientRect().width}px`;
    element.style.overflow = 'hidden';
    return () => {
        for (const child of held) child.style.width = '';
        element.style.overflow = '';
    };
}

// What lets go of the hold a road is keeping, so a road stopped midway can let go at once.
const holding = new WeakMap<HTMLElement, () => void>();

/** Moves the element along a road, holding what it says; the road may be abandoned. */
function travel(element: HTMLElement, road: () => Promise<void>): Promise<void> {
    holding.get(element)?.();
    const hold = holdWhileMoving(element);
    let held = true;
    const letGo = () => {
        if (!held) return;
        held = false;
        hold();
        if (holding.get(element) === letGo) holding.delete(element);
    };
    holding.set(element, letGo);
    return road().then(letGo, (err: unknown) => {
        letGo();
        throw err;
    });
}

/** Stops whatever road the element is on, where it is, and lets go of what it held. */
function halt(element: HTMLElement): void {
    cancelMorph(element);
    holding.get(element)?.();
}

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
    // A finger resting on it is not selecting it.
    element.style.userSelect = 'none';
    element.style.setProperty('-webkit-user-select', 'none');
    element.style.setProperty('-webkit-touch-callout', 'none');
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
    // "it grows out of its place" (VISION.md): out of the text, unseen at first.
    const to = boxOf(element);
    travel(element, () => beginMorphToTooltip(element, boxOf(anchor), to, getTooltipDuration(), '0'))
        .catch(() => { /* a road abandoned for another: the element takes that one */ });
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
    // From wherever it is now, even partway out of the text; where it ends is
    // measured with no road running, or the road would be measured instead.
    const from = boxOf(element);
    halt(element);
    const area = document.createElement('div');
    area.className = 'content-area';
    area.appendChild(item.renderContent());
    element.appendChild(area);
    element.dataset.expanded = 'true';
    // Grown, it is something to act on.
    element.style.pointerEvents = 'auto';
    element.style.cursor = 'pointer';
    place(element, anchor);
    const to = boxOf(element);
    travel(element, () => beginMorphToTooltip(element, from, to, getTooltipDuration()))
        .catch(() => { /* a road abandoned for another: the element takes that one */ });
}

/** Left: back into the text it was said from, the same road driven backwards, and gone. */
function unsay(element: HTMLElement, anchor: HTMLElement): void {
    element.style.pointerEvents = 'none';
    const gone = () => element.remove();
    travel(element, () => beginMorphToAnchor(element, boxOf(element), boxOf(anchor), getTooltipDuration()))
        .then(gone, gone);
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
 *
 * A finger does not hover: "The tap should just open the tooltip, and the
 * tooltip should linger for 1.4 sec. Tap again within those 1.4 sec and it
 * expands, tap again and you get your window."
 *
 * Returns what takes the behavior off the anchor again.
 */
export function tooltipFrom(anchor: HTMLElement, make: () => Element, timing: TooltipTiming = {}): () => void {
    const delay = timing.delay ?? 300;
    const expandAfter = timing.expandAfter ?? 1000;
    const grace = timing.grace ?? 120;
    const linger = timing.linger ?? 1400;

    let saying: ReturnType<typeof setTimeout> | null = null;
    let growing: ReturnType<typeof setTimeout> | null = null;
    let going: ReturnType<typeof setTimeout> | null = null;
    let lingering: ReturnType<typeof setTimeout> | null = null;
    let current: { element: HTMLElement; item: Element } | null = null;
    let onTooltip = false;
    let onAnchor = false;
    // What pressed last: a tap is a click that a finger made.
    let finger = false;

    const stop = (t: ReturnType<typeof setTimeout> | null) => { if (t) clearTimeout(t); };
    const isTouch = (e: Event) => (e as PointerEvent).pointerType === 'touch';

    // Resting a finger on the text is not selecting it.
    anchor.style.userSelect = 'none';
    anchor.style.setProperty('-webkit-user-select', 'none');
    anchor.style.setProperty('-webkit-touch-callout', 'none');

    // Abandoned: the element born into tooltip form goes, unless it became a window.
    const abandon = () => {
        stop(saying); stop(growing); stop(lingering);
        saying = null; growing = null; lingering = null;
        if (current && getForm(current.element) === 'tooltip') unsay(current.element, anchor);
        current = null;
    };

    const maybeGo = () => {
        stop(going);
        going = setTimeout(() => {
            going = null;
            if (!onAnchor && !onTooltip) abandon();
        }, grace);
    };

    const commit = () => {
        if (!current) return;
        const { element, item } = current;
        // Committed: it is no longer this anchor's to take away.
        current = null;
        onTooltip = false;
        stop(lingering);
        lingering = null;
        toWindow(element, item);
    };

    const say = (): HTMLElement => {
        const item = make();
        const element = sayBeside(anchor, item);
        current = { element, item };

        element.addEventListener('pointerenter', (e) => { if (isTouch(e)) return; onTooltip = true; stop(going); });
        element.addEventListener('pointerleave', (e) => {
            if (isTouch(e)) return;
            onTooltip = false;
            if (current?.element === element) maybeGo();
        });
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            if (current?.element !== element || getForm(element) !== 'tooltip') return;
            if (finger) { tapped(); return; }
            if (element.dataset.expanded === 'true') commit();
        });
        return element;
    };

    // One tap moves it one step: said, grown, window.
    const tapped = () => {
        stop(going); stop(saying); stop(growing);
        going = null; saying = null; growing = null;
        if (!current) {
            const element = say();
            // Tapped, it is something to tap again.
            element.style.pointerEvents = 'auto';
            lingering = setTimeout(() => {
                lingering = null;
                if (current?.element === element && element.dataset.expanded !== 'true') abandon();
            }, linger);
            return;
        }
        if (current.element.dataset.expanded !== 'true') {
            stop(lingering);
            lingering = null;
            grow(current.element, anchor, current.item);
            return;
        }
        commit();
    };

    const enterAnchor = (e: Event) => {
        if (isTouch(e)) return;
        onAnchor = true;
        stop(going);
        if (current || saying) return;
        saying = setTimeout(() => {
            saying = null;
            const element = say();
            growing = setTimeout(() => {
                growing = null;
                if (current?.element === element) grow(element, anchor, current.item);
            }, expandAfter);
        }, delay);
    };

    const leaveAnchor = (e: Event) => {
        if (isTouch(e)) return;
        onAnchor = false;
        maybeGo();
    };

    const clickAnchor = () => {
        if (finger) tapped();
    };

    // Which pointer pressed, anywhere; a finger pressing elsewhere lets it go.
    const pressed = (e: Event) => {
        finger = isTouch(e);
        if (!finger || !current) return;
        const target = e.target as Node | null;
        if (target && (anchor.contains(target) || current.element.contains(target))) return;
        abandon();
    };

    anchor.addEventListener('pointerenter', enterAnchor);
    anchor.addEventListener('pointerleave', leaveAnchor);
    anchor.addEventListener('click', clickAnchor);
    document.addEventListener('pointerdown', pressed, true);

    return () => {
        anchor.removeEventListener('pointerenter', enterAnchor);
        anchor.removeEventListener('pointerleave', leaveAnchor);
        anchor.removeEventListener('click', clickAnchor);
        document.removeEventListener('pointerdown', pressed, true);
        stop(going);
        abandon();
    };
}
