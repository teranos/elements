/**
 * The safe area (Apple Human Interface Guidelines, Layout): "place foreground
 * elements like interactive controls within the safe area".
 *
 * Personas:
 * - Tim: Happy path — a window kept inside the area a phone leaves free
 * - Spike: Edge cases — no insets at all, and an area smaller than the window
 * - Jenny: Complex scenarios — the page's own insets, as the browser reports them
 */

import { describe, test, expect } from 'bun:test';
import { clampToViewport } from './window/placement';
import { safeArea, safeAreaInsets } from './safe-area';

// An iPhone 15 held upright: the status bar and Dynamic Island above, the home indicator below.
const PHONE = { x: 0, y: 59, width: 393, height: 852 - 59 - 34 };

describe('Tim: a window stays where it can be pressed', () => {
    test('a window asked to sit at the very top is moved below the status bar', () => {
        const box = clampToViewport({ x: 20, y: 0, width: 200, height: 100 }, PHONE);
        expect(box.y).toBe(59);
    });

    test('a window asked to sit at the very bottom stays above the home indicator', () => {
        const box = clampToViewport({ x: 20, y: 800, width: 200, height: 100 }, PHONE);
        expect(box.y + box.height).toBeLessThanOrEqual(852 - 34);
    });

    test('a landscape phone keeps it clear of the island on the left too', () => {
        const side = { x: 59, y: 0, width: 852 - 59 - 59, height: 393 - 21 };
        const box = clampToViewport({ x: 0, y: 10, width: 200, height: 100 }, side);
        expect(box.x).toBe(59);
    });
});

describe('Spike: what does not change', () => {
    test('with no insets, the area is the screen, as it was', () => {
        const box = clampToViewport({ x: -5, y: -5, width: 100, height: 100 }, { width: 800, height: 600 });
        expect(box).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    });

    test('a window bigger than the area is sized to it, and placed at its start', () => {
        const box = clampToViewport({ x: 0, y: 0, width: 2000, height: 2000 }, PHONE);
        expect(box.x).toBe(0);
        expect(box.y).toBe(59);
        expect(box.height).toBeLessThanOrEqual(PHONE.height);
    });
});

describe('Jenny: the page says where its edges are', () => {
    test('a DOM that resolves no insets says none', () => {
        expect(safeAreaInsets()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    });

    test('the area is the window, less what the insets take', () => {
        const area = safeArea();
        expect(area.x).toBe(0);
        expect(area.y).toBe(0);
        expect(area.width).toBe(window.innerWidth);
        expect(area.height).toBe(window.innerHeight);
    });
});
