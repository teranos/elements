/**
 * A button in an element is never squeezed around its words.
 *
 * "NO MORE SQUEEZED BUTTONS PLEASE", "buttons of elements have the same issue": the fit makes a button as wide as what
 * it says (fit.ts), and a host's padding of 4px by 8px left its words touching its edges. In an element's body a button
 * is a finger tall, as every press is (PRESS_SIZES), with its words an em in from each side, whatever the host wrote.
 *
 * Personas:
 * - Tim: Happy path — a button in an element's body is a finger tall, its words an em in
 * - Spike: Edge cases — a press, a say press and the title bar's controls keep their own boxes
 * - Jenny: Complex scenarios — a finger is a press's height: one number, not two
 */

import { describe, test, expect } from 'bun:test';
import { fitRule, FINGER } from './fit';
import { PRESS_SIZES } from './forms/press';

const RULE = fitRule('[data-element-id]');
const ROOM = ':is([data-scroller="body"], [data-scroller="declared"]) button:not([data-element-id]):not([data-press]):not([data-say-press])';

describe('Tim: a button in an element\'s body', () => {
    test('is a finger tall, its words an em in from each side', () => {
        expect(RULE).toContain(`[data-element-id] ${ROOM} { box-sizing: border-box !important; min-height: ${FINGER}px !important; padding: 0 1em !important; }`);
    });
});

describe('Spike: what keeps its own box', () => {
    test('a press, a say press, and what is not in the body (the title bar\'s controls)', () => {
        expect(ROOM).toContain(':not([data-press])');
        expect(ROOM).toContain(':not([data-say-press])');
        expect(ROOM.startsWith(':is([data-scroller="body"], [data-scroller="declared"])')).toBe(true);
    });
});

describe('Jenny: a finger', () => {
    test('is a press\'s height', () => {
        for (const size of Object.values(PRESS_SIZES)) expect(size.height).toBe(FINGER);
    });
});
