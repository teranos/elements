// A window is as big as what it holds, until a person says otherwise.
// "windows should by default fit to content, windows should be resizable and scroll would happen then"

// Personas:
// - Tim: the corner is there, and dragging it sizes the window
// - Spike: the floor, a second setup, a corner taken away

// - Jenny: the size a person gave survives, and a drag reflows from it

import { describe, test, expect, beforeEach } from 'bun:test';
import { setupWindowResize, teardownWindowResize } from './resize';
import { getLastSize } from '../dataset';
import { MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT } from '../element';

type Win = { MouseEvent: typeof MouseEvent };
const W = () => globalThis.window as unknown as Win & Window;

beforeEach(() => {
    document.body.innerHTML = '';
});

// The DOM here lays nothing out, so the box a window measures is given.
function windowEl(width = 400, height = 300): HTMLElement {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.width = 'fit-content';
    el.style.height = 'fit-content';
    el.getBoundingClientRect = () => ({
        x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height,
        toJSON: () => ({}),
    }) as DOMRect;
    document.body.appendChild(el);
    return el;
}

function corners(el: HTMLElement): HTMLElement[] {
    return Array.from(el.querySelectorAll(':scope > .resize-handle')) as HTMLElement[];
}

function press(handle: HTMLElement, x: number, y: number): void {
    handle.dispatchEvent(new (W().MouseEvent)('mousedown', { clientX: x, clientY: y, bubbles: true }));
}

function move(x: number, y: number): void {
    W().dispatchEvent(new (W().MouseEvent)('mousemove', { clientX: x, clientY: y }));
}

function release(): void {
    W().dispatchEvent(new (W().MouseEvent)('mouseup', {}));
}

describe('Tim: the corner sizes the window', () => {
    test('a window carries one corner', () => {
        const el = windowEl();
        setupWindowResize(el);

        expect(corners(el).length).toBe(1);
    });

    test('dragging the corner writes the size the person dragged to', () => {
        const el = windowEl(400, 300);
        setupWindowResize(el);

        press(corners(el)[0], 400, 300);
        move(520, 360);
        release();

        expect(el.style.width).toBe('520px');
        expect(el.style.height).toBe('360px');
    });

    // "i expect all windows to have a resize handler from now on"
    test('the corner can be seen and grabbed without a host stylesheet', () => {
        const el = windowEl();
        setupWindowResize(el);
        const corner = corners(el)[0];

        expect(corner.style.position).toBe('absolute');
        expect(corner.style.right).toBe('0px');
        expect(corner.style.bottom).toBe('0px');
        expect(corner.style.width).not.toBe('');
        expect(corner.style.height).not.toBe('');
        expect(corner.style.cursor).toBe('nwse-resize');
    });

    test('a window nobody resized stays the size of what it holds', () => {
        const el = windowEl();
        setupWindowResize(el);

        expect(el.style.width).toBe('fit-content');
        expect(el.style.height).toBe('fit-content');
        expect(getLastSize(el)).toBeNull();
    });
});

describe('Spike: the floor, and a corner set up or taken away', () => {
    test('dragged smaller than a window can be, it stops at the floor', () => {
        const el = windowEl(400, 300);
        setupWindowResize(el);

        press(corners(el)[0], 400, 300);
        move(0, 0);
        release();

        expect(el.style.width).toBe(`${MIN_WINDOW_WIDTH}px`);
        expect(el.style.height).toBe(`${MIN_WINDOW_HEIGHT}px`);
    });

    test('setting up twice is one corner', () => {
        const el = windowEl();
        setupWindowResize(el);
        setupWindowResize(el);

        expect(corners(el).length).toBe(1);
    });

    test('taken away, the corner leaves with its listeners', () => {
        const el = windowEl(400, 300);
        setupWindowResize(el);
        const handle = corners(el)[0];

        teardownWindowResize(el);
        press(handle, 400, 300);
        move(520, 360);
        release();

        expect(corners(el).length).toBe(0);
        expect(el.style.width).toBe('fit-content');
    });

    test('a mouse let go stops sizing', () => {
        const el = windowEl(400, 300);
        setupWindowResize(el);

        press(corners(el)[0], 400, 300);
        move(500, 350);
        release();
        move(700, 600);

        expect(el.style.width).toBe('500px');
        expect(el.style.height).toBe('350px');
    });
});

// "its more axiom respecting if we try to retain size it had"
describe('Jenny: the size a person gave is kept', () => {
    test('the element remembers the size it was given', () => {
        const el = windowEl(400, 300);
        setupWindowResize(el);

        press(corners(el)[0], 400, 300);
        move(520, 360);
        release();

        expect(getLastSize(el)).toEqual({ width: 520, height: 360 });
    });

    // window/drag.ts reflows from the natural width, not the width on screen.
    test('a drag after a resize reflows from the resized width', () => {
        const el = windowEl(400, 300);
        setupWindowResize(el);

        press(corners(el)[0], 400, 300);
        move(640, 300);
        release();

        expect((el as unknown as Record<string, number>).__elementNaturalWidth).toBe(640);
    });
});
