// A press on a dot selects nothing; a press in a window selects what it presses.
// "i still cant select text in it"

// Personas:
// - Tim: text in a window that was a dot can be selected
// - Spike: a press on a dot in the tray still selects nothing

import { describe, test, expect, beforeEach } from 'bun:test';
import { tray } from './tray';

type Win = { MouseEvent: typeof MouseEvent };
const W = () => globalThis.window as unknown as Win & Window;

let n = 0;

beforeEach(() => {
    document.body.style.userSelect = '';
});

function dotFor(): HTMLElement {
    const id = `selection-${++n}`;
    tray.add({ id, title: id, renderContent: () => document.createElement('div') });
    return document.querySelector(`[data-element-id="${id}"]`) as HTMLElement;
}

function press(el: HTMLElement): void {
    el.dispatchEvent(new (W().MouseEvent)('mousedown', { bubbles: true }));
}

function release(): void {
    document.dispatchEvent(new (W().MouseEvent)('mouseup', { bubbles: true }));
}

describe('Tim: a window lets its text be selected', () => {
    // The dot is the window (Element Axioma): the same element leaves the tray.
    test('a press in an element that left the tray does not refuse a selection', () => {
        tray.init();
        const element = dotFor();
        document.body.appendChild(element);

        press(element);

        expect(document.body.style.userSelect).not.toBe('none');
        release();
    });
});

describe('Spike: a dot in the tray', () => {
    test('a press on a dot refuses a selection until it is let go', () => {
        tray.init();
        const element = dotFor();

        press(element);
        expect(document.body.style.userSelect).toBe('none');

        release();
        expect(document.body.style.userSelect).not.toBe('none');
    });
});
