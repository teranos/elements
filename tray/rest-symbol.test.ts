// A resting dot can show the symbol of what it opens.
// "likewise, i want htis to moe from ascender to elements"

// Personas:
// - Tim: turned on, a dot at rest shows its symbol
// - Spike: off, or nothing to show, and the dot is empty

// - Jenny: the symbol leaves when the dot becomes something else, and comes back

import { describe, test, expect, beforeEach } from 'bun:test';
import { wearRestSymbol, removeRestSymbol } from './rest-symbol';
import { configureElements } from '../config';

beforeEach(() => {
    document.body.innerHTML = '';
    configureElements({ dotSymbol: false });
});

function dot(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'dot';
    document.body.appendChild(el);
    return el;
}

function shown(el: HTMLElement): HTMLElement | null {
    return el.querySelector(':scope > .dot-symbol');
}

describe('Tim: a resting dot shows its symbol', () => {
    test('turned on, the dot holds the symbol', () => {
        configureElements({ dotSymbol: true });
        const el = dot();

        wearRestSymbol(el, 'C');

        expect(shown(el)?.textContent).toBe('C');
    });

    // Place and size are geometry; the font is the host's.
    test('the symbol fills the dot and sits in its centre', () => {
        configureElements({ dotSymbol: true });
        const el = dot();

        wearRestSymbol(el, 'C');

        expect(shown(el)!.style.display).toBe('grid');
        expect(shown(el)!.style.placeItems).toBe('center');
        expect(shown(el)!.style.width).toBe('100%');
        expect(shown(el)!.style.height).toBe('100%');
    });
});

describe('Spike: nothing to show', () => {
    test('off by default, the dot stays empty', () => {
        const el = dot();

        wearRestSymbol(el, 'C');

        expect(shown(el)).toBeNull();
    });

    test('an element with no symbol shows nothing', () => {
        configureElements({ dotSymbol: true });
        const el = dot();

        wearRestSymbol(el, undefined);

        expect(shown(el)).toBeNull();
    });
});

describe('Jenny: leaving the rest, and coming back', () => {
    test('worn twice is one symbol', () => {
        configureElements({ dotSymbol: true });
        const el = dot();

        wearRestSymbol(el, 'C');
        wearRestSymbol(el, 'C');

        expect(el.querySelectorAll(':scope > .dot-symbol').length).toBe(1);
    });

    test('removed when the dot becomes something else, worn again when it rests', () => {
        configureElements({ dotSymbol: true });
        const el = dot();

        wearRestSymbol(el, 'C');
        removeRestSymbol(el);
        expect(shown(el)).toBeNull();

        wearRestSymbol(el, 'C');
        expect(shown(el)?.textContent).toBe('C');
    });
});
