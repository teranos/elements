/**
 * A thumb browsing the tray sees, before it lets go, which dot it will open.
 *
 * Released, a touch browse opens the dot nearest the thumb (touch-browse.ts).
 * While the thumb moves, every dot near it is drawn fully grown and alike, so
 * which one that is was seen only once it opened. Now that dot is drawn
 * brighter and a tenth bigger than the rest. The bigger is drawn, not laid
 * out: no dot moves for it.
 *
 * Apple Human Interface Guidelines, Feedback (not re-verified against Apple's
 * site): people should be able to tell what an action will do before they take it.
 *
 * Personas:
 * - Tim: Happy path — the dot nearest the thumb is marked, and it is the one that opens
 * - Spike: Edge cases — a mouse marks nothing; nothing near enough, nothing marked
 * - Jenny: Complex scenarios — the mark follows the thumb; released, it is gone before the dot opens
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Proximity } from './proximity';
import { setupTouchBrowse, findPeakedElement, type TouchBrowseHost } from './touch-browse';
import type { Element } from '../element';

const realRAF = globalThis.requestAnimationFrame;
const realCAF = globalThis.cancelAnimationFrame;

beforeAll(() => {
    // Frames run at once, so a test reads what a frame drew.
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 1; }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
});

afterAll(() => {
    globalThis.requestAnimationFrame = realRAF;
    globalThis.cancelAnimationFrame = realCAF;
});

// A column of dots at the right of the screen, 20px tall, 22px apart.
const RIGHT = window.innerWidth - 4;
const LEFT = RIGHT - 20;
const NAMES = ['He', 'Li', 'Be', 'Ne', 'Na'];
const rowTop = (i: number) => 100 + i * 22;
const rowMiddle = (i: number) => rowTop(i) + 10;

let proximity: Proximity;
let container: HTMLElement;
let items: Map<string, Element>;
let dots: HTMLElement[];

/** A frame, as the tray draws one for each move of the pointer. */
function draw(): void {
    proximity.updateProximity(container, items, false);
}

/** The names of the dots drawn marked. */
const aimed = () => dots.filter((dot) => dot.style.transform.includes('scale')).map((dot) => dot.dataset.elementId);

beforeEach(() => {
    document.body.innerHTML = '';
    proximity = new Proximity();
    container = document.createElement('div');
    items = new Map();
    dots = NAMES.map((name, i) => {
        const dot = document.createElement('div');
        dot.className = 'dot';
        dot.dataset.elementId = name;
        // As the tray lays it out: a grown dot widens leftwards from the tray's edge.
        dot.getBoundingClientRect = () => {
            const width = parseFloat(dot.style.width) || 20;
            return {
                x: RIGHT - width, y: rowTop(i), left: RIGHT - width, top: rowTop(i), right: RIGHT, bottom: rowTop(i) + 20,
                width, height: 20, toJSON() {},
            } as DOMRect;
        };
        items.set(name, { id: name, title: name, symbol: name });
        container.appendChild(dot);
        return dot;
    });
    document.body.appendChild(container);
});

describe('Tim: the dot that will open is marked', () => {
    test('of the dots grown around the thumb, the nearest is brighter and a tenth bigger', () => {
        proximity.isTouchBrowsing = true;
        proximity.setPointerPosition(LEFT - 5, rowMiddle(1));
        draw();

        expect(aimed()).toEqual(['Li']);
        expect(dots[1]!.style.transform).toBe('scale(1.1)');
        expect(dots[1]!.style.filter).toBe('brightness(1.2)');
        // Drawn bigger, not laid out bigger: its row stays the resting height.
        expect(dots[1]!.style.height).toBe(dots[0]!.style.height);
        expect(dots[0]!.style.filter).toBe('');
    });

    test('the dot marked is the dot a release opens', () => {
        proximity.isTouchBrowsing = true;
        proximity.setPointerPosition(LEFT - 5, rowMiddle(3) + 4);
        draw();

        const host = { indicatorContainer: container, proximity, items } as unknown as TouchBrowseHost;
        expect(aimed()).toHaveLength(1);
        expect(findPeakedElement(host)?.element.dataset.elementId).toBe(aimed()[0]!);
    });
});

describe('Spike: when nothing is marked', () => {
    test('a mouse marks nothing: what it clicks is what is under it', () => {
        proximity.setPointerPosition(LEFT - 5, rowMiddle(1));
        draw();

        expect(aimed()).toEqual([]);
    });

    test('a thumb too far from every dot marks none, as a release there opens none', () => {
        proximity.isTouchBrowsing = true;
        proximity.setPointerPosition(LEFT - 200, rowMiddle(2));
        draw();

        expect(aimed()).toEqual([]);
        const host = { indicatorContainer: container, proximity, items } as unknown as TouchBrowseHost;
        expect(findPeakedElement(host)).toBeNull();
    });
});

describe('Jenny: the thumb moves, and lets go', () => {
    test('the mark follows the thumb from one dot to the next', () => {
        proximity.isTouchBrowsing = true;
        proximity.setPointerPosition(LEFT - 5, rowMiddle(1));
        draw();
        proximity.setPointerPosition(LEFT - 5, rowMiddle(2));
        draw();

        expect(aimed()).toEqual(['Be']);
        expect(dots[1]!.style.transform).toBe('');
        expect(dots[1]!.style.filter).toBe('');
    });

    test('released, the mark is gone before the dot opens', () => {
        let opened: { element: HTMLElement; transform: string; filter: string } | null = null;
        setupTouchBrowse({
            element: container,
            indicatorContainer: container,
            proximity,
            items,
            updateProximity: draw,
            morphElement: (element) => { opened = { element, transform: element.style.transform, filter: element.style.filter }; },
        });
        container.getBoundingClientRect = () => ({
            x: LEFT, y: rowTop(0), left: LEFT, top: rowTop(0), right: LEFT + 20, bottom: rowTop(4) + 20,
            width: 20, height: rowTop(4) + 20 - rowTop(0), toJSON() {},
        }) as DOMRect;

        const touch = (type: string, y?: number) => {
            const e = new (window as any).Event(type, { bubbles: true, cancelable: true });
            Object.defineProperty(e, 'touches', { value: y === undefined ? [] : [{ clientX: LEFT - 5, clientY: y }] });
            document.body.dispatchEvent(e);
        };
        touch('touchstart', rowMiddle(0));
        touch('touchmove', rowMiddle(2));
        expect(aimed()).toEqual(['Be']);
        touch('touchend');

        expect(opened!.element.dataset.elementId).toBe('Be');
        expect(opened!.transform).toBe('');
        expect(opened!.filter).toBe('');
    });
});
