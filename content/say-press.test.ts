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
