/**
 * 「[Opus 5.5] A window's title bar drags it; a press in the title bar is pressed, not dragged.」
 *
 * 「[Opus 5.5] Seen on a phone: the title bar's presses draw what they say (forms/title-bar-controls.ts), and a tap landed on the」
 * 「[Opus 5.5] drawing, not on the button. The drag took it as its own, and the press was never pressed.」
 *
 * 「[Opus 5.5] Personas:」
 * 「[Opus 5.5] - Tim: Happy path — a press on the bar's own surface starts a drag」
 * 「[Opus 5.5] - Spike: Edge cases — a press on a button, or on what a button holds, does not」
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { setupWindowDrag, teardownWindowDrag } from './drag';

afterEach(() => { document.body.innerHTML = ''; });

function windowWithBar() {
    const element = document.createElement('div');
    const bar = document.createElement('div');
    const press = document.createElement('button');
    press.innerHTML = '<svg viewBox="0 0 12 12"><path d="M2 6h8"/></svg>';
    bar.appendChild(press);
    element.appendChild(bar);
    document.body.appendChild(element);
    setupWindowDrag(element, bar);
    return { element, bar, press, mark: press.querySelector('path')! };
}

const down = (target: Element, type: 'mousedown' | 'touchstart') => {
    const e = new Event(type, { bubbles: true, cancelable: true });
    if (type === 'touchstart') Object.defineProperty(e, 'touches', { value: [{ clientX: 5, clientY: 5 }] });
    else Object.assign(e, { clientX: 5, clientY: 5 });
    target.dispatchEvent(e);
    return e.defaultPrevented;
};

describe('Tim: the bar', () => {
    test('a press on its own surface starts a drag', () => {
        const { element, bar } = windowWithBar();
        expect(down(bar, 'touchstart')).toBe(true);
        teardownWindowDrag(element);
    });
});

describe('Spike: a press in the bar', () => {
    for (const type of ['mousedown', 'touchstart'] as const) {
        test(`${type} on the button is the button's`, () => {
            const { element, press } = windowWithBar();
            expect(down(press, type)).toBe(false);
            teardownWindowDrag(element);
        });

        test(`${type} on what the button draws is the button's`, () => {
            const { element, mark } = windowWithBar();
            expect(down(mark, type)).toBe(false);
            teardownWindowDrag(element);
        });
    }
});
