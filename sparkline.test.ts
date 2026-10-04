// Sparkline: the drawing is the package's, what the numbers mean is the host's.
// Personas: Tim (a line, its moments, said when pointed at), Spike (too little, gaps, markup, unreadable),
// Jenny (the whole line on a longer hover, lines drawn after wiring, the host's timing and colours).

import { describe, test, expect, beforeEach } from 'bun:test';
import { renderSparkline, wireLineTooltips, stepAt } from './sparkline';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const realm = () => globalThis.window as unknown as { Event: typeof Event; MouseEvent: typeof MouseEvent };

const TIMING = { delay: 5, expandAfter: 30, grace: 5 };
const AT = ['2026-09-29 10', '2026-09-29 11', '2026-09-29 12'];

const tooltips = () => Array.from(document.querySelectorAll<HTMLElement>('[data-form="tooltip"]'));
const said = () => tooltips()[0]?.querySelector('.tooltip-title')?.textContent ?? null;
const point = (el: globalThis.Element, type: string, x: number) =>
    el.dispatchEvent(new (realm().MouseEvent)(type, { clientX: x, bubbles: type !== 'pointerenter' }));

/** A line in the page, 100px wide, so where the pointer is along it is known. */
function aLine(data: (number | null)[] = [1, 0, 4], at: string[] = AT, name?: string): globalThis.Element {
    const holder = document.createElement('div');
    holder.innerHTML = renderSparkline(data, at, name);
    document.body.appendChild(holder);
    const line = holder.querySelector('svg')!;
    line.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, bottom: 16, right: 100, height: 16, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    return line;
}

// Wiring is once per document, the way a host does it.
wireLineTooltips(document, TIMING);

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('Tim: a line, carrying its moments, said when pointed at', () => {
    test('numbers draw an 80×16 line scaled to their own maximum', () => {
        const line = aLine([1, 0, 4]);
        expect(line.getAttribute('viewBox')).toBe('0 0 80 16');
        expect(line.getAttribute('class')).toBe('sparkline-line');
        expect(line.querySelector('polyline')!.getAttribute('points')).toBe('0,11.5 40,15 80,1');
    });

    test('given when each step is, the line carries its moments and its name', () => {
        const line = aLine([1, 0, 3], ['a', 'b', 'c'], 'page_view');
        expect(JSON.parse(line.getAttribute('data-tooltip-series')!)).toEqual([['a', 1], ['b', 0], ['c', 3]]);
        expect(line.getAttribute('data-tooltip-name')).toBe('page_view');
    });

    test('the step under the pointer, along the line', () => {
        const line = aLine();
        expect(stepAt(line, 2)).toBe('2026-09-29 10 · 1');
        expect(stepAt(line, 98)).toBe('2026-09-29 12 · 4');
    });

    test('pointing at a line says the moment under the pointer, and follows it', async () => {
        const line = aLine();
        point(line, 'pointerover', 2);
        point(line, 'pointerenter', 2);
        await wait(15);
        expect(said()).toBe('2026-09-29 10 · 1');
        point(line, 'pointermove', 98);
        expect(said()).toBe('2026-09-29 12 · 4');
    });
});

describe('Spike: too little, gaps, markup, unreadable', () => {
    test('fewer than two values is no line', () => {
        expect(renderSparkline([])).toBe('');
        expect(renderSparkline([3])).toBe('');
        expect(renderSparkline([null, 3, null])).toBe('');
    });

    test('nothing but zero is no line', () => {
        expect(renderSparkline([0, 0, 0])).toBe('');
    });

    test('a missing value is left out of the line, and said as zero', () => {
        const line = aLine([2, null, 2], ['a', 'b', 'c']);
        expect(line.querySelector('polyline')!.getAttribute('points')).toBe('0,1 80,1');
        expect(JSON.parse(line.getAttribute('data-tooltip-series')!)).toEqual([['a', 2], ['b', 0], ['c', 2]]);
    });

    test('without when each step is, it is only a line', () => {
        expect(renderSparkline([1, 0, 3])).not.toContain('data-tooltip-series');
        expect(renderSparkline([1, 0, 3], ['a', 'b'])).not.toContain('data-tooltip-series');
        expect(renderSparkline([1, 0, 3], undefined, 'named')).not.toContain('data-tooltip-name');
    });

    test('a name and moments holding markup arrive as they were', () => {
        const line = aLine([1, 2], ['"<a>" & b', 'c'], 'say "<b>" & go');
        expect(line.getAttribute('data-tooltip-name')).toBe('say "<b>" & go');
        expect(JSON.parse(line.getAttribute('data-tooltip-series')!)).toEqual([['"<a>" & b', 1], ['c', 2]]);
        expect(line.querySelectorAll('a, b')).toHaveLength(0);
    });

    test('moments that cannot be read are said to be unreadable', () => {
        const line = aLine();
        line.setAttribute('data-tooltip-series', '[not json');
        expect(stepAt(line, 2).startsWith("this line's moments could not be read: ")).toBe(true);
    });

    test('a line that carries no moments says nothing at the pointer', () => {
        const line = aLine([1, 2], ['a', 'b']);
        line.setAttribute('data-tooltip-series', '[]');
        expect(stepAt(line, 2)).toBe('');
    });
});

describe('Jenny: the whole line, late lines, the host\'s timing and colours', () => {
    test('a longer hover grows the same element into the whole line, named', async () => {
        const line = aLine([1, 0, 4], AT, 'staand:page_view');
        point(line, 'pointerover', 50);
        point(line, 'pointerenter', 50);
        await wait(60);
        const [tip] = tooltips();
        expect(tip!.dataset.expanded).toBe('true');
        expect(tip!.querySelector('.sparkline-whole svg polyline')).not.toBeNull();
        const axis = tip!.querySelector('.sparkline-whole-axis')!;
        expect(Array.from(axis.children).map((c) => c.textContent)).toEqual(['2026-09-29 10', '2026-09-29 12']);
        const moments = tip!.querySelector('.sparkline-whole-moments')!.textContent;
        expect(moments).toContain('2026-09-29 12 · 4');
        expect(moments).not.toContain('2026-09-29 11 · 0');
    });

    test('a line drawn after the wiring answers pointing all the same, and is said once', async () => {
        const line = aLine();
        point(line, 'pointerover', 2);
        point(line, 'pointerover', 2);
        point(line, 'pointerenter', 2);
        await wait(15);
        expect(tooltips()).toHaveLength(1);
    });

    test('its colours are the package\'s own names, never a host\'s', () => {
        const svg = renderSparkline([1, 0, 4], AT);
        expect(svg).toContain('var(--elements-sparkline-stroke');
        expect(svg).not.toContain('--text-on-dark');
        expect(svg).not.toContain('--border-on-dark');
    });

    test('the whole line wears the package\'s names too', async () => {
        const line = aLine();
        point(line, 'pointerover', 2);
        point(line, 'pointerenter', 2);
        await wait(60);
        const whole = tooltips()[0]!.querySelector('.sparkline-whole')!;
        expect(whole.querySelector('polyline')!.getAttribute('stroke')).toContain('var(--elements-sparkline-whole-stroke');
        expect(whole.querySelector('.sparkline-whole-axis')!.getAttribute('style')).toContain('--elements-sparkline-mute');
    });
});
