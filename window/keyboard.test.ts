/**
 * A window and the keyboard.
 *
 * Apple Human Interface Guidelines, Virtual keyboards: the layout guide "helps
 * you keep important parts of your interface visible while the virtual
 * keyboard is onscreen" — without it, "the keyboard covers part of the bottom
 * text field". A browser has no layout guide. iOS Safari and Chrome on Android
 * both leave a fixed window where it is and let the keyboard cover it; what
 * shrinks is the visual viewport. So a window answers the visual viewport.
 *
 * Neither test DOM has a visual viewport or layout: each test gives the window
 * one, a phone-sized screen with a keyboard that comes and goes, and a box.
 *
 * Personas:
 * - Tim: Happy path — the keyboard comes up over a window, and goes
 * - Spike: Edge cases — no visual viewport, a window already clear, a button
 *   not a field, a window taller than what the keyboard leaves
 * - Jenny: Complex scenarios — dragged, minimized, or left for another window
 *   while the keyboard is up; mid-morph
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { settleWindow } from './settle';
import { leaveWindow } from './window';
import { resetZOrder } from './z-order';
import { visibleArea } from '../safe-area';
import { setForm, getLastPosition } from '../dataset';

const SCREEN = { width: window.innerWidth, height: window.innerHeight };
const KEYBOARD = 300;

interface FakeViewport extends EventTarget {
    offsetLeft: number;
    offsetTop: number;
    width: number;
    height: number;
    scale: number;
}

let viewport: FakeViewport | undefined;

/** The visual viewport a phone has: the whole screen until the keyboard takes some. */
function giveVisualViewport(): FakeViewport {
    const vv = new (window as any).EventTarget() as FakeViewport;
    vv.offsetLeft = 0;
    vv.offsetTop = 0;
    vv.width = SCREEN.width;
    vv.height = SCREEN.height;
    vv.scale = 1;
    (window as any).visualViewport = vv;
    viewport = vv;
    return vv;
}

function keyboardUp(vv: FakeViewport, height = KEYBOARD): void {
    vv.height = SCREEN.height - height;
    vv.dispatchEvent(new (window as any).Event('resize'));
}

function keyboardDown(vv: FakeViewport): void {
    vv.height = SCREEN.height;
    vv.dispatchEvent(new (window as any).Event('resize'));
}

/** A settled window holding a field, laid out as `height` tall wherever its style puts it. */
function windowWithField(y: number, height = 200, id = 'selenium'): { el: HTMLElement; field: HTMLInputElement } {
    const el = document.createElement('div');
    el.dataset.elementId = id;
    setForm(el, 'window');
    const field = document.createElement('input');
    field.type = 'email';
    el.appendChild(field);
    document.body.appendChild(el);
    settleWindow(el, { x: 20, y, width: 300, height });

    el.getBoundingClientRect = () => {
        const top = parseFloat(el.style.top);
        const cap = parseFloat(el.style.maxHeight);
        const h = Number.isFinite(cap) ? Math.min(height, cap) : height;
        return { x: 20, y: top, left: 20, top, width: 300, height: h, right: 320, bottom: top + h, toJSON() {} } as DOMRect;
    };
    return { el, field };
}

const top = (el: HTMLElement) => parseFloat(el.style.top);
const bottom = (el: HTMLElement) => el.getBoundingClientRect().bottom;

beforeEach(() => {
    resetZOrder();
    document.body.innerHTML = '';
});

afterEach(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    delete (window as any).visualViewport;
    viewport = undefined;
});

describe('Tim: the keyboard comes up over a window, and goes', () => {
    test('a window the keyboard would cover rises above it', () => {
        const vv = giveVisualViewport();
        const { el, field } = windowWithField(500);

        field.focus();
        keyboardUp(vv);

        expect(bottom(el)).toBeLessThanOrEqual(SCREEN.height - KEYBOARD);
        // Only as far as it has to.
        expect(bottom(el)).toBe(SCREEN.height - KEYBOARD);
    });

    test('when the keyboard goes, the window is back where it stood', () => {
        const vv = giveVisualViewport();
        const { el, field } = windowWithField(500);

        field.focus();
        keyboardUp(vv);
        keyboardDown(vv);

        expect(top(el)).toBe(500);
    });

    test('a keyboard already up when the field is pressed is answered too', () => {
        const vv = giveVisualViewport();
        const { el, field } = windowWithField(500);

        keyboardUp(vv);
        field.focus();

        expect(bottom(el)).toBe(SCREEN.height - KEYBOARD);
    });
});

describe('Spike: when nothing should move', () => {
    test('with no visual viewport, nothing says where a keyboard is, and nothing moves', () => {
        const { el, field } = windowWithField(500);
        field.focus();
        expect(top(el)).toBe(500);
    });

    test('the visible area is the safe area when the browser has no visual viewport', () => {
        expect(visibleArea()).toEqual({ x: 0, y: 0, width: SCREEN.width, height: SCREEN.height });
    });

    test('the visible area ends where the keyboard begins', () => {
        const vv = giveVisualViewport();
        keyboardUp(vv);
        expect(visibleArea()).toEqual({ x: 0, y: 0, width: SCREEN.width, height: SCREEN.height - KEYBOARD });
    });

    test('a window the keyboard leaves clear is not moved', () => {
        const vv = giveVisualViewport();
        const { el, field } = windowWithField(40);

        field.focus();
        keyboardUp(vv);

        expect(top(el)).toBe(40);
    });

    test('a button pressed is not a field: no keyboard is coming for it', () => {
        const vv = giveVisualViewport();
        const { el } = windowWithField(500);
        const button = document.createElement('button');
        el.appendChild(button);

        button.focus();
        keyboardUp(vv);

        expect(top(el)).toBe(500);
    });

    test('a window taller than what the keyboard leaves takes all of it, title bar first', () => {
        const vv = giveVisualViewport();
        const { el, field } = windowWithField(100, 600);

        field.focus();
        keyboardUp(vv);

        expect(top(el)).toBe(0);
        expect(el.style.maxHeight).toBe(`${SCREEN.height - KEYBOARD}px`);
    });

    test('a taller window gets its own cap back when the keyboard goes', () => {
        const vv = giveVisualViewport();
        const { el, field } = windowWithField(100, 600);
        const cap = el.style.maxHeight;

        field.focus();
        keyboardUp(vv);
        keyboardDown(vv);

        expect(el.style.maxHeight).toBe(cap);
        expect(top(el)).toBe(100);
    });

    test('a visual viewport scrolled down the page: the window rises into what is seen', () => {
        const vv = giveVisualViewport();
        const { el, field } = windowWithField(500);

        field.focus();
        vv.offsetTop = 50;
        keyboardUp(vv);

        expect(top(el)).toBeGreaterThanOrEqual(50);
        expect(bottom(el)).toBeLessThanOrEqual(50 + SCREEN.height - KEYBOARD);
    });
});

describe('Spike: what Safari on an iPhone says, measured on one', () => {
    // iOS 26, keyboard up over a window low on the screen: Safari pans the page
    // so the field is seen (offsetTop 310), and window.innerHeight shrinks to
    // the visual viewport's height (714 → 404).
    const PANNED = { offsetTop: 310, height: 404 };

    function safariKeyboardUp(vv: FakeViewport): void {
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: PANNED.height });
        vv.offsetTop = PANNED.offsetTop;
        vv.height = PANNED.height;
        vv.dispatchEvent(new (window as any).Event('resize'));
    }

    afterEach(() => {
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: SCREEN.height });
    });

    test('the visible area is the visual viewport\'s, even when innerHeight shrinks with it', () => {
        const vv = giveVisualViewport();
        safariKeyboardUp(vv);
        expect(visibleArea()).toEqual({ x: 0, y: PANNED.offsetTop, width: SCREEN.width, height: PANNED.height });
    });

    test('a window Safari already panned into view is left where it is, whole', () => {
        const vv = giveVisualViewport();
        const { el, field } = windowWithField(500, 117);
        const cap = el.style.maxHeight;

        field.focus();
        safariKeyboardUp(vv);

        expect(top(el)).toBe(500);
        expect(el.style.maxHeight).toBe(cap);
    });

    test('WebKit measures a fixed window from the visual viewport; where it stands is its own', () => {
        const vv = giveVisualViewport();
        const { el, field } = windowWithField(500, 117);
        // WebKit: a rect is relative to the visual viewport, not the layout one.
        const layout = el.getBoundingClientRect;
        el.getBoundingClientRect = () => {
            const r = layout();
            return { ...r, y: r.y - vv.offsetTop, top: r.top - vv.offsetTop, bottom: r.bottom - vv.offsetTop } as DOMRect;
        };

        safariKeyboardUp(vv);
        field.focus();

        expect(top(el)).toBe(500);
    });
});

describe('Jenny: what else happens while the keyboard is up', () => {
    test('dragged while the keyboard is up, it stays where it was dragged', () => {
        const vv = giveVisualViewport();
        const { el, field } = windowWithField(500);

        field.focus();
        keyboardUp(vv);
        el.style.top = '120px'; // what a drag writes
        keyboardDown(vv);

        expect(top(el)).toBe(120);
    });

    test('minimized while the keyboard is up, it remembers where it stood', () => {
        const vv = giveVisualViewport();
        const { el, field } = windowWithField(500);

        field.focus();
        keyboardUp(vv);
        leaveWindow(el);

        expect(getLastPosition(el)?.y).toBe(500);
    });

    test('a field in another window pressed: the first goes back, the second rises', () => {
        const vv = giveVisualViewport();
        const first = windowWithField(500, 200, 'selenium');
        const second = windowWithField(520, 200, 'bromine');

        first.field.focus();
        keyboardUp(vv);
        second.field.focus();
        vv.dispatchEvent(new (window as any).Event('resize'));

        expect(top(first.el)).toBe(500);
        expect(bottom(second.el)).toBe(SCREEN.height - KEYBOARD);
    });

    test('mid-morph, a window is its morph\'s to place', () => {
        const vv = giveVisualViewport();
        const { el, field } = windowWithField(500);
        el.classList.add('morphing');

        field.focus();
        keyboardUp(vv);

        expect(top(el)).toBe(500);
    });
});
