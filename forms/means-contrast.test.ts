/**
 * What yes and no are drawn in reads both ways they are used.
 *
 * "Text is not readable like this", "I intend on future sessions to look at the elements work and accept it as
 * exemplary". A meaning colour is words on black (an approval's option, a press's failure said beside it) and a fill
 * under white words (the option that was sent, a red press armed). Both are small text: 4.5 to 1 (WCAG), each way.
 *
 * Personas:
 * - Tim: Happy path — yes and no, as words on black, read
 * - Spike: Edge cases — yes and no, as a fill under white words, read
 * - Jenny: Complex scenarios — the approvals' failed bar is the same no
 */

import { describe, test, expect } from 'bun:test';
import { MEANS } from './press';
import { FAILED } from '../approvals/segments';

function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const lin = (s: number) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
}
const contrast = (a: string, b: string) => {
    const [x, y] = [luminance(a), luminance(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe('Tim: as words on black', () => {
    for (const means of ['yes', 'no'] as const) {
        test(`${means} reads`, () => expect(contrast(MEANS[means], '#000000')).toBeGreaterThanOrEqual(4.5));
    }
});

describe('Spike: as a fill under white words', () => {
    for (const means of ['yes', 'no'] as const) {
        test(`${means} reads`, () => expect(contrast('#ffffff', MEANS[means])).toBeGreaterThanOrEqual(4.5));
    }
});

describe('Jenny: the approvals\' failed bar', () => {
    test('is no', () => expect(FAILED).toBe(MEANS.no));
});
