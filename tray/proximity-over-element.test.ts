/**
 * The tray does not reach out over an open element under the pointer.
 *
 * The tray sits above every window, and its dots grow toward a pointer near
 * them. A window by the right edge had its Minimize under the tray: going for
 * it brought the pointer near the dots, they grew over it, and the press opened
 * a dot. A pointer on an open element is on that element, not reaching for the
 * tray: the dots stay at rest until it leaves.
 *
 * Personas:
 * - Tim: Happy path — a pointer on a window leaves the dots at rest; on a dot, they grow
 * - Spike: Edge cases — a dot is an element too, and does not count; the page behind does not either
 * - Jenny: Complex scenarios — leaving the window for the tray, the dots grow again; a dot already grown over a
 *   window's control, the pointer landing on it: the window under it is where the pointer is
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { Proximity } from './proximity';
import type { Element } from '../element';

const realRAF = globalThis.requestAnimationFrame;
const realCAF = globalThis.cancelAnimationFrame;

beforeAll(() => {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 1; }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
});

afterAll(() => {
    globalThis.requestAnimationFrame = realRAF;
    globalThis.cancelAnimationFrame = realCAF;
});

afterEach(() => {
    document.body.innerHTML = '';
});

const NO_ITEMS = new Map<string, Element>();

/** A tray of one dot, and a window beside it. Rects are all zero here: pointer 0,0 is on the dot. */
function trayAndWindow(): { container: HTMLElement; dot: HTMLElement; win: HTMLElement } {
    const container = document.createElement('div');
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.dataset.elementId = 'helium';
    container.appendChild(dot);
    const win = document.createElement('div');
    win.dataset.elementId = 'lithium';
    win.dataset.form = 'window';
    win.innerHTML = '<button aria-label="Minimize"></button>';
    document.body.append(win, container);
    return { container, dot, win };
}

function moveOn(target: EventTarget): void {
    target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 0, clientY: 0 }));
}

describe('Tim: where the pointer is', () => {
    test('on a window\'s Minimize, the dots stay at rest', () => {
        const proximity = new Proximity();
        const { container, dot, win } = trayAndWindow();

        moveOn(win.querySelector('button')!);
        proximity.updateProximity(container, NO_ITEMS, false);

        expect(dot.style.width).toBe('10px');
    });

    test('on a dot, the dots grow', () => {
        const proximity = new Proximity();
        const { container, dot } = trayAndWindow();

        moveOn(dot);
        proximity.updateProximity(container, NO_ITEMS, false);

        expect(dot.style.width).toBe('220px');
    });
});

describe('Spike: what is not an open element', () => {
    test('the page behind, near the tray, lets the dots grow', () => {
        const proximity = new Proximity();
        const { container, dot } = trayAndWindow();

        moveOn(document.body);
        proximity.updateProximity(container, NO_ITEMS, false);

        expect(dot.style.width).toBe('220px');
    });
});

// QNTX opens its canvas as the workspace at start: the whole viewport is an element under the tray.
// It is what everything stands on, not a window the dots could cover.
describe('Spike: the ground is not an open element', () => {
    const had = (document as unknown as { elementsFromPoint?: unknown }).elementsFromPoint;
    afterEach(() => { (document as unknown as { elementsFromPoint?: unknown }).elementsFromPoint = had; });

    for (const form of ['workspace', 'canvasExpanded']) {
        test(`on the ${form}, near the tray, the dots grow`, () => {
            const proximity = new Proximity();
            const { container, dot, win } = trayAndWindow();
            win.dataset.form = form;

            moveOn(win);
            proximity.updateProximity(container, NO_ITEMS, false);

            expect(dot.style.width).toBe('220px');
        });

        test(`a dot over the ${form} grows`, () => {
            const proximity = new Proximity();
            const { container, dot, win } = trayAndWindow();
            win.dataset.form = form;
            (document as unknown as { elementsFromPoint: () => globalThis.Element[] }).elementsFromPoint =
                () => [dot, container, win, document.body];

            moveOn(dot);
            proximity.updateProximity(container, NO_ITEMS, false);

            expect(dot.style.width).toBe('220px');
        });
    }

    test('an element placed on the canvas is open: on it, the dots stay at rest', () => {
        const proximity = new Proximity();
        const { container, dot, win } = trayAndWindow();
        win.dataset.form = 'workspace';
        const placed = document.createElement('div');
        placed.dataset.elementId = 'beryllium';
        placed.dataset.form = 'canvasPlaced';
        win.appendChild(placed);

        moveOn(placed);
        proximity.updateProximity(container, NO_ITEMS, false);

        expect(dot.style.width).toBe('10px');
    });
});

describe('Jenny: leaving the window for the tray', () => {
    test('the dots grow again', () => {
        const proximity = new Proximity();
        const { container, dot, win } = trayAndWindow();

        moveOn(win);
        proximity.updateProximity(container, NO_ITEMS, false);
        moveOn(dot);
        proximity.updateProximity(container, NO_ITEMS, false);

        expect(dot.style.width).toBe('220px');
    });
});

// Seen in button.browser.ts, 1 run in 10: a window opened out of the tray stands by it, the dots had grown
// toward the pointer on its way, and one lay over the window's ↓. The pointer landed on the dot, so it was
// on no open element, so the dots stayed grown: the window's ↓ could not be pressed.
describe('Jenny: a dot already grown over a window\'s control', () => {
    const had = (document as unknown as { elementsFromPoint?: unknown }).elementsFromPoint;
    afterEach(() => { (document as unknown as { elementsFromPoint?: unknown }).elementsFromPoint = had; });

    /** What a browser says lies under the pointer, top first. */
    const under = (...nodes: globalThis.Element[]) => {
        (document as unknown as { elementsFromPoint: () => globalThis.Element[] }).elementsFromPoint = () => nodes;
    };

    test('the pointer is on the window under it: the dots go back to rest', () => {
        const proximity = new Proximity();
        const { container, dot, win } = trayAndWindow();
        const control = win.querySelector('button')!;

        under(dot, control, win, document.body);
        moveOn(dot);
        proximity.updateProximity(container, NO_ITEMS, false);

        expect(dot.style.width).toBe('10px');
    });

    test('with only the page under the dot, the pointer is reaching for the tray: the dots grow', () => {
        const proximity = new Proximity();
        const { container, dot } = trayAndWindow();

        under(dot, container, document.body);
        moveOn(dot);
        proximity.updateProximity(container, NO_ITEMS, false);

        expect(dot.style.width).toBe('220px');
    });

    // Mousemove fires at display rate: the stack is asked for only when a dot is what the pointer is on,
    // the one case the top alone cannot answer.
    test('off the dots, what the pointer is on answers alone: nothing under it is asked for', () => {
        new Proximity();
        const { win } = trayAndWindow();
        let asked = 0;
        (document as unknown as { elementsFromPoint: () => globalThis.Element[] }).elementsFromPoint = () => { asked++; return []; };

        moveOn(win.querySelector('button')!);
        moveOn(document.body);

        expect(asked).toBe(0);
    });
});
