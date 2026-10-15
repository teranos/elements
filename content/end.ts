/**
 * An element that opens at its end.
 *
 * "claude element should not start at top when opening requiring user to scroll
 * down every single time" (#40). An element saying `opensAt: 'end'` is opened
 * scrolled to what was said last, in whichever scroller is its own (content/scroll.ts),
 * and follows what is said after while it is at the end. Scrolled up, the person is
 * left reading.
 */

/** px: this near the end is at the end, for a scroller whose height is not a whole pixel. */
const AT_END = 2;

interface Following {
    at: boolean;
    stop: () => void;
}

const following = new WeakMap<HTMLElement, Following>();

/** The element's own scroller: the one its host declared, or the body the package gave it. */
function scrollerOf(element: HTMLElement): HTMLElement | null {
    return element.querySelector<HTMLElement>('[data-scroller="declared"]')
        ?? element.querySelector<HTMLElement>(':scope > [data-scroller="body"]');
}

function toEnd(element: HTMLElement): void {
    const scroller = scrollerOf(element);
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
}

/** Open this element at its end, and follow what is said after while it is there. */
export function openAtEnd(element: HTMLElement): void {
    following.get(element)?.stop();
    const state: Following = { at: true, stop: () => {} };
    const onScroll = (event: Event) => {
        const scroller = scrollerOf(element);
        if (event.target !== scroller || !scroller) return;
        state.at = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= AT_END;
    };
    // Scroll does not bubble: it is heard on the way down.
    element.addEventListener('scroll', onScroll, { capture: true });
    const observer = typeof MutationObserver === 'function'
        ? new MutationObserver(() => { if (state.at) toEnd(element); })
        : null;
    observer?.observe(element, { childList: true, subtree: true, characterData: true });
    state.stop = () => {
        element.removeEventListener('scroll', onScroll, { capture: true });
        observer?.disconnect();
        following.delete(element);
    };
    following.set(element, state);
    toEnd(element);
    // Laid out on the next frame, the end is further down than it was when opened.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => { if (state.at) toEnd(element); });
}

/** Leaving its form, it no longer follows. */
export function stopFollowing(element: HTMLElement): void {
    following.get(element)?.stop();
}
