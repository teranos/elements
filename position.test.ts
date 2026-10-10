/**
 * Where the page stands, while a field takes the keyboard.
 *
 * "you tap a box to type, and the only thing that happens is the keyboard
 * coming up. No zoom, nothing moves, nothing refocuses."
 *
 * In QNTX-App's web view, a tap on a box well above the keyboard scrolled the
 * window 35 points, the box and everything with it. The package holds the
 * window where it stood when the field took focus, until the field lets go.
 *
 * Personas:
 * - Tim: Happy path — a field takes focus, the window is scrolled, it goes back
 * - Spike: Edge cases — nothing holds without a field; a page scrolled before the tap stays where it was
 * - Jenny: Complex scenarios — the field lets go and the page scrolls freely; a second field holds again
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { holdPosition } from './position';

holdPosition();

// Neither test DOM scrolls a window (JSDOM does not implement it), so the
// window here keeps where it was scrolled to, as a browser's does.
let scrolled = { x: 0, y: 0 };
const had = { scrollTo: window.scrollTo, x: Object.getOwnPropertyDescriptor(window, 'scrollX'), y: Object.getOwnPropertyDescriptor(window, 'scrollY') };

beforeAll(() => {
    Object.defineProperty(window, 'scrollX', { configurable: true, get: () => scrolled.x });
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrolled.y });
    (window as any).scrollTo = (x: number, y: number) => { scrolled = { x, y }; };
});

afterAll(() => {
    window.scrollTo = had.scrollTo;
    if (had.x) Object.defineProperty(window, 'scrollX', had.x); else delete (window as any).scrollX;
    if (had.y) Object.defineProperty(window, 'scrollY', had.y); else delete (window as any).scrollY;
});

/** What a web view does on its own: scroll the window, and say so. */
function webViewScrolls(x: number, y: number): void {
    window.scrollTo(x, y);
    window.dispatchEvent(new Event('scroll'));
}

const at = () => ({ x: window.scrollX, y: window.scrollY });

let field: HTMLTextAreaElement;
let other: HTMLInputElement;

beforeEach(() => {
    document.body.innerHTML = '';
    window.scrollTo(0, 0);
    field = document.createElement('textarea');
    other = document.createElement('input');
    document.body.append(field, other);
});

afterEach(() => {
    (document.activeElement as HTMLElement | null)?.blur();
});

describe('Tim: a field takes the keyboard', () => {
    test('the window scrolled under it goes back to where it stood', () => {
        field.focus();
        webViewScrolls(0, 35);

        expect(at()).toEqual({ x: 0, y: 0 });
    });
});

describe('Spike: what is not held', () => {
    test('with no field in focus the page scrolls as it scrolls', () => {
        webViewScrolls(0, 35);

        expect(at()).toEqual({ x: 0, y: 35 });
    });

    test('a page scrolled before the tap is held there, not at the top', () => {
        webViewScrolls(0, 120);
        field.focus();
        webViewScrolls(0, 155);

        expect(at()).toEqual({ x: 0, y: 120 });
    });

    test('a button taking focus holds nothing', () => {
        const button = document.createElement('button');
        document.body.appendChild(button);
        button.focus();
        webViewScrolls(0, 35);

        expect(at()).toEqual({ x: 0, y: 35 });
    });
});

describe('Jenny: from field to field, and away', () => {
    test('once the field lets go, the page scrolls freely again', () => {
        field.focus();
        field.blur();
        webViewScrolls(0, 35);

        expect(at()).toEqual({ x: 0, y: 35 });
    });

    test('moving to another field holds where the window stood all along', () => {
        field.focus();
        other.focus();
        webViewScrolls(0, 35);

        expect(at()).toEqual({ x: 0, y: 0 });
    });
});
