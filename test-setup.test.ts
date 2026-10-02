/**
 * The test DOMs.
 *
 * Personas:
 * - Tim: Happy path — what a test reaches for bare is the DOM's own
 * - Spike: Edge cases — an event made bare is one the DOM's elements take
 * - Jenny: Complex scenarios — a road played in a DOM without the Web Animations API
 */

import { describe, test, expect } from 'bun:test';
import { playAnimations } from './test-animations';

describe('Tim: bare globals are the DOM\'s own, under happy-dom and JSDOM alike', () => {
    test('getComputedStyle reads an element', () => {
        const el = document.createElement('div');
        el.style.display = 'flex';
        document.body.appendChild(el);
        expect(getComputedStyle(el).display).toBe('flex');
        el.remove();
    });

    test('Element and Event are there', () => {
        expect(document.createElement('div') instanceof Element).toBe(true);
        expect(typeof Event).toBe('function');
    });
});

describe('Spike: an event made bare is one the DOM takes', () => {
    test('a bare MouseEvent reaches its listener with what it carries', () => {
        const el = document.createElement('div');
        let detail = 0;
        el.addEventListener('click', (e) => { detail = (e as MouseEvent).detail; });
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }));
        expect(detail).toBe(2);
    });
});

describe('Jenny: the Web Animations API, played', () => {
    test('a road is recorded and finishes on the next turn', async () => {
        const played = playAnimations();
        try {
            const el = document.createElement('div');
            let finished = false;
            const a = el.animate([{ opacity: '0' }, { opacity: '1' }], { duration: 100 });
            a.addEventListener('finish', () => { finished = true; });
            expect(played.roads).toHaveLength(1);
            expect(played.roads[0]!.element).toBe(el);
            expect(played.of(el)[0]![1]).toMatchObject({ opacity: '1' });
            await new Promise((r) => setTimeout(r, 5));
            expect(finished).toBe(true);
        } finally {
            played.restore();
        }
    });

    test('cancelled, it says so and does not finish', async () => {
        const played = playAnimations();
        try {
            const el = document.createElement('div');
            let finished = false;
            let cancelled = false;
            const a = el.animate([{}, {}], { duration: 100 });
            a.addEventListener('finish', () => { finished = true; });
            a.addEventListener('cancel', () => { cancelled = true; });
            a.cancel();
            await new Promise((r) => setTimeout(r, 5));
            expect(cancelled).toBe(true);
            expect(finished).toBe(false);
        } finally {
            played.restore();
        }
    });

    test('restored, the DOM is as it was', () => {
        const before = (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
        playAnimations().restore();
        expect((HTMLElement.prototype as unknown as { animate?: unknown }).animate).toBe(before);
    });
});
