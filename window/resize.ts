/**
 * Window Resize — the one way a window takes a size it was not measured to.
 *
 * An element never declares its size; a person dragging this corner gives one.
 */

import { MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT } from '../element';
import { setLastSize } from '../dataset';
import { setNaturalWidth } from './drag';
import { createCorner } from '../corner';

const RESIZE_KEY = '__elementWindowResize';

interface ResizeState {
    handle: HTMLElement;
    setup: AbortController;
    sizing: AbortController | null;
}

// Once a person gives a window a size, what it holds fills it, whatever size its host drew it.
// Written important: a host's fixed size does not leave it small inside a window dragged big.
const FILLS: Record<string, string> = {
    width: '100%', 'max-width': '100%', 'min-width': '0',
    height: 'auto', 'max-height': 'none', 'min-height': '100%',
    'box-sizing': 'border-box',
};

/**
 * "want to be able to rezise it and have it actually respect my resize, horizontally
 * and vertically" (#40). What the window holds fills the body, both ways, from now on.
 */
export function fillWithContent(windowElement: HTMLElement): void {
    const body = windowElement.querySelector<HTMLElement>(':scope > [data-scroller="body"]');
    const content = body?.firstElementChild;
    if (!(content instanceof HTMLElement)) return;
    for (const [name, value] of Object.entries(FILLS)) content.style.setProperty(name, value, 'important');
    content.dataset.fills = '';
}

/** Out of a window, what it held is the size its host draws it again. */
export function stopFilling(windowElement: HTMLElement): void {
    const content = windowElement.querySelector<HTMLElement>(':scope > [data-scroller="body"] > [data-fills]');
    if (!content) return;
    for (const name of Object.keys(FILLS)) content.style.removeProperty(name);
    delete content.dataset.fills;
}

export function setupWindowResize(windowElement: HTMLElement): void {
    // A reopened window is one element (Element Axioma): one corner, not two.
    teardownWindowResize(windowElement);

    const handle = createCorner();
    windowElement.appendChild(handle);

    const state: ResizeState = { handle, setup: new AbortController(), sizing: null };
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    const size = (x: number, y: number) => {
        const width = Math.max(MIN_WINDOW_WIDTH, startWidth + x - startX);
        const height = Math.max(MIN_WINDOW_HEIGHT, startHeight + y - startY);
        windowElement.style.width = `${width}px`;
        windowElement.style.height = `${height}px`;
        // A drag against an edge reflows from this width now (window/drag.ts).
        setNaturalWidth(windowElement, width);
    };

    const stop = () => {
        if (!state.sizing) return;
        state.sizing.abort();
        state.sizing = null;
        document.body.style.cursor = '';
        setLastSize(windowElement, parseFloat(windowElement.style.width), parseFloat(windowElement.style.height));
    };

    const start = (x: number, y: number) => {
        fillWithContent(windowElement);
        const rect = windowElement.getBoundingClientRect();
        startX = x;
        startY = y;
        startWidth = rect.width;
        startHeight = rect.height;
        document.body.style.cursor = 'nwse-resize';

        state.sizing = new AbortController();
        const signal = state.sizing.signal;
        window.addEventListener('mousemove', (e: MouseEvent) => size(e.clientX, e.clientY), { signal });
        window.addEventListener('mouseup', stop, { signal });
        window.addEventListener('touchmove', (e: TouchEvent) => {
            if (!e.touches[0]) return;
            e.preventDefault();
            size(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false, signal });
        window.addEventListener('touchend', stop, { signal });
    };

    handle.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault();
        start(e.clientX, e.clientY);
    }, { signal: state.setup.signal });
    handle.addEventListener('touchstart', (e: TouchEvent) => {
        if (!e.touches[0]) return;
        e.preventDefault();
        start(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false, signal: state.setup.signal });

    (windowElement as unknown as Record<string, ResizeState>)[RESIZE_KEY] = state;
}

export function teardownWindowResize(windowElement: HTMLElement): void {
    const held = windowElement as unknown as Record<string, ResizeState | undefined>;
    const state = held[RESIZE_KEY];
    if (!state) return;
    state.sizing?.abort();
    state.setup.abort();
    state.handle.remove();
    document.body.style.cursor = '';
    delete held[RESIZE_KEY];
}
