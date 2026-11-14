/**
 * The presses a field says with are the package's to size, as every other press is.
 *
 * "FIX THE PACKAGE", "STOP CHEATING WITH MAGIC PIXELS": a host's icon press was fitted to its icon (fit.ts makes a
 * button as wide as what it says), and QNTX-Web gave it padding to make it round. The pill's press is SAY_PRESS square
 * and round whatever it holds; the host says only what it looks like.
 *
 * Personas:
 * - Tim: Happy path — a say press is SAY_PRESS square and round
 * - Spike: Edge cases — the button fit does not reach it, by rule or by style attribute
 * - Jenny: Complex scenarios — the pill is a press inset all round, as the Claude app's is
 */

import { describe, test, expect } from 'bun:test';
import { fitRule, takeOffFit } from '../fit';
import { SAY_PRESS, SAY_INSET } from './say';

const RULE = fitRule('[data-element-id]');

describe('Tim: a say press', () => {
    test('is SAY_PRESS square and round, whatever it holds', () => {
        expect(RULE).toContain(`[data-element-id] [data-say-press] { box-sizing: border-box !important; width: ${SAY_PRESS}px !important; height: ${SAY_PRESS}px !important; padding: 0 !important; border-radius: 50% !important; flex: none !important;`);
    });
});

describe('Spike: the button fit does not reach it', () => {
    test('by rule', () => {
        expect(RULE).toContain('button:not([data-element-id]):not([data-press]):not([data-say-press]) { width: fit-content !important;');
    });

    test('by style attribute: its width written important stays', () => {
        const press = document.createElement('button');
        press.dataset.sayPress = '';
        press.style.setProperty('width', '36px', 'important');
        takeOffFit(press);
        expect(press.style.getPropertyValue('width')).toBe('36px');
    });
});

describe('Jenny: the pill around its presses', () => {
    test('is the Claude app\'s: a 36pt press, 8pt in from the pill\'s edge', () => {
        expect(SAY_PRESS).toBe(36);
        expect(SAY_INSET).toBe(8);
    });
});

// "Text is not readable like this": what was typed into xenon's pill was black on black. The field is out of the field
// look (it is the pill's surface), so its words are the element's colour, unless the host says otherwise.
describe('Spike: the words in the pill', () => {
    test('are the element\'s colour, in the package\'s layer, so a host stylesheet still says otherwise', () => {
        expect(RULE).toContain('[data-element-id] [data-say-box] [data-say] { color: inherit; }');
        // Not important: a host's own colour for its words wins.
        expect(RULE).not.toContain('[data-say-box] [data-say] { color: inherit !important');
    });
});

// The field look gave a field its ground and ink but no colour for what it says before anything is typed: the
// browser's grey, 3.8 to 1 on the field's ground (browser/contrast.browser.ts). It is the field's own ink, lighter.
describe('Spike: what a field says before anything is typed', () => {
    test('is its own ink, lighter, in the package\'s layer, so a host stylesheet still says otherwise', () => {
        expect(RULE).toContain('[data-element-id] :is(input, textarea)::placeholder { color: color-mix(in srgb, currentColor 65%, transparent); }');
    });
});

// The field in the pill drew its own focus ring, a box inside the pill. The pill is the field's surface: it shows the
// focus, around itself.
describe('Spike: the pill, focused', () => {
    test('rings itself, not the field inside it', () => {
        expect(RULE).toContain('[data-element-id] [data-say-box] [data-say] { outline: none; }');
        expect(RULE).toContain('[data-element-id] [data-say-box]:focus-within { outline: 2px solid currentColor; outline-offset: 2px; }');
    });
});
