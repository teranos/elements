/**
 * A button in an element is neither squeezed around its words nor swollen past them.
 *
 * "NO MORE SQUEEZED BUTTONS PLEASE", "buttons of elements have the same issue": a host's padding of 4px by 8px left
 * its words touching its edges. Then a finger's 44 tall, on 14px words, was "wasted space", purple on a screenshot of
 * xenon's model and effort pill. In an element's body a button's words are an em in from each side and half an em from
 * its top and bottom, whatever the host wrote.
 *
 * Personas:
 * - Tim: Happy path — a button in an element's body: an em at its sides, half an em above and below
 * - Spike: Edge cases — a press, a say press and the title bar's controls keep their own boxes
 * - Jenny: Complex scenarios — no height is held over its words: no air but the half em
 */

import { describe, test, expect } from 'bun:test';
import { fitRule } from './fit';

const RULE = fitRule('[data-element-id]');
const ROOM = ':is([data-scroller="body"], [data-scroller="declared"]) button:not([data-element-id]):not([data-press]):not([data-say-press])';

describe('Tim: a button in an element\'s body', () => {
    test('has its words an em in from each side, half an em from its top and bottom', () => {
        expect(RULE).toContain(`[data-element-id] ${ROOM} { box-sizing: border-box !important; padding: 0.5em 1em !important; }`);
    });
});

describe('Spike: what keeps its own box', () => {
    test('a press, a say press, and what is not in the body (the title bar\'s controls)', () => {
        expect(ROOM).toContain(':not([data-press])');
        expect(ROOM).toContain(':not([data-say-press])');
        expect(ROOM.startsWith(':is([data-scroller="body"], [data-scroller="declared"])')).toBe(true);
    });
});

describe('Jenny: no air but the half em', () => {
    test('no height is held over its words', () => {
        const rule = RULE.split('\n').find((line) => line.includes(ROOM))!;
        expect(rule).not.toContain('min-height');
    });
});
