/**
 * One scrollbar, the package's (#2).
 *
 * "i want one cemtrally managed elements owned scrollbar and they the elements
 * are only allowed to use that one" — "there should not be a system one".
 *
 * Inside an element no system scrollbar is drawn: which one a window got was
 * decided by the platform and the pointer, not the package. The element's
 * scroller (content/scroll.ts) shows the package's bar instead, one per element,
 * drawn here and nowhere else. It is a sign of where the scroller is, unseen by
 * a screen reader, and a mouse can drag it.
 */

const RULE_ID = 'elements-scrollbar';

// An element in any form but a dot: a dot scrolls nothing.
const ELEMENT = '[data-element-id]:not(.dot)';

/** px: the bar's width, its distance from the edge, and the least it is long. */
const WIDTH = 4;
const INSET = 2;
const SHORTEST = 24;

// Layered and important, as the text rule (text.ts): a host's stylesheet does not bring a system bar back.
// scrollbar-width is Firefox, Chrome 121 and Safari 18.2; ::-webkit-scrollbar is what Safari had before.
const RULE = `@layer elements {
${ELEMENT}, ${ELEMENT} * { scrollbar-width: none !important; }
${ELEMENT}::-webkit-scrollbar, ${ELEMENT} *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
${ELEMENT} > [data-scrollbar] {
    position: absolute !important;
    right: ${INSET}px !important;
    width: ${WIDTH}px !important;
    border-radius: ${WIDTH / 2}px !important;
    background: currentColor !important;
    opacity: 0.35;
    z-index: 2;
    touch-action: none;
}
${ELEMENT} > [data-scrollbar]:hover, ${ELEMENT} > [data-scrollbar][data-dragging] { opacity: 0.6; }
}`;

interface Bar {
    thumb: HTMLElement;
    scroller: HTMLElement;
    abort: AbortController;
    resize: ResizeObserver | null;
}

const held = new WeakMap<HTMLElement, Bar>();

function holdRule(): void {
    if (document.getElementById(RULE_ID)) return;
    const style = document.createElement('style');
    style.id = RULE_ID;
    style.textContent = RULE;
    document.head.appendChild(style);
}

/**
 * This element's bar shows where its scroller is. One bar per element (Element
 * Axioma): holding again follows the scroller it is given now.
 */
export function holdScrollbar(element: HTMLElement, scroller: HTMLElement): void {
    holdRule();
    const bar = held.get(element);
    if (bar && bar.scroller === scroller && bar.thumb.parentElement === element) {
        place(bar);
        return;
    }
    dropScrollbar(element);

    const thumb = document.createElement('div');
    thumb.dataset.scrollbar = scroller.dataset.scroller ?? '';
    thumb.setAttribute('aria-hidden', 'true');
    element.appendChild(thumb);

    const next: Bar = { thumb, scroller, abort: new AbortController(), resize: null };
    const { signal } = next.abort;
    scroller.addEventListener('scroll', () => place(next), { passive: true, signal });
    if (typeof ResizeObserver === 'function') {
        next.resize = new ResizeObserver(() => place(next));
        next.resize.observe(scroller);
        for (const child of Array.from(scroller.children)) next.resize.observe(child);
    }
    drag(next, signal);
    held.set(element, next);
    place(next);
}

/** The element has no scroller now: no bar. */
export function dropScrollbar(element: HTMLElement): void {
    const bar = held.get(element);
    if (!bar) return;
    bar.abort.abort();
    bar.resize?.disconnect();
    bar.thumb.remove();
    held.delete(element);
}

/** The bar's length is the share of the content in sight; its place, how far down the scroller is. */
function place(bar: Bar): void {
    const { thumb, scroller } = bar;
    const seen = scroller.clientHeight;
    const whole = scroller.scrollHeight;
    if (whole <= seen + 1) {
        thumb.style.display = 'none';
        return;
    }
    thumb.style.display = '';
    const length = Math.max(SHORTEST, (seen * seen) / whole);
    const share = scroller.scrollTop / (whole - seen);
    const top = topOf(scroller, thumb.parentElement as HTMLElement) + share * (seen - length);
    thumb.style.height = `${length}px`;
    thumb.style.top = `${top}px`;
}

/** Where the scroller's top is inside the element's box, in px. */
function topOf(scroller: HTMLElement, element: HTMLElement): number {
    return scroller.getBoundingClientRect().top - element.getBoundingClientRect().top - element.clientTop;
}

/** A mouse holding the bar scrolls the scroller as far as the bar is moved. */
function drag(bar: Bar, signal: AbortSignal): void {
    const { thumb, scroller } = bar;
    thumb.addEventListener('pointerdown', (down) => {
        if (down.button !== 0) return;
        down.preventDefault();
        const startY = down.clientY;
        const startTop = scroller.scrollTop;
        const length = thumb.getBoundingClientRect().height;
        const travel = scroller.clientHeight - length;
        const whole = scroller.scrollHeight - scroller.clientHeight;
        thumb.dataset.dragging = '';
        thumb.setPointerCapture?.(down.pointerId);
        const moving = new AbortController();
        const stop = () => {
            moving.abort();
            delete thumb.dataset.dragging;
        };
        thumb.addEventListener('pointermove', (move) => {
            if (travel <= 0) return;
            scroller.scrollTop = startTop + ((move.clientY - startY) / travel) * whole;
        }, { signal: moving.signal });
        thumb.addEventListener('pointerup', stop, { signal: moving.signal });
        thumb.addEventListener('pointercancel', stop, { signal: moving.signal });
        signal.addEventListener('abort', stop, { signal: moving.signal });
    }, { signal });
}
