/**
 * 「[Opus 5.5] Compact and Regular: a screen's size classes, by its width and by its height.」
 *
 * 「[Opus 5.5] "Let's support Compact and Regular" (Apple Human Interface Guidelines, Layout: size classes), at the edges」
 * 「[Opus 5.5] agreed: 600 wide and 480 high, which are Material's window size classes' compact edges (width under 600dp,」
 * 「[Opus 5.5] height under 480dp).」
 *
 * 「[Opus 5.5] Personas:」
 * 「[Opus 5.5] - Tim: Happy path — a phone held upright, a desktop, a phone held sideways」
 * 「[Opus 5.5] - Spike: Edge cases — a pixel either side of each edge; no matchMedia at all」
 * 「[Opus 5.5] - Jenny: Complex scenarios — the package's own table columns follow the width class, the tray keeps its own edge」
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sizeClasses, COMPACT_WIDTH, COMPACT_HEIGHT } from './compact';
import { fitRule } from './fit';

const had = (window as any).matchMedia;

/** A screen of this size answers a media query list as a browser does: any alternative that matches, max-width / max-height or the range form. */
function screenOf(width: number, height: number): void {
    (window as any).matchMedia = (query: string) => {
        const one = (q: string): boolean => {
            const num = (re: RegExp) => { const m = re.exec(q); return m ? parseFloat(m[1]!) : null; };
            const maxW = num(/max-width:\s*([\d.]+)px/), maxH = num(/max-height:\s*([\d.]+)px/);
            const ltW = num(/width\s*<\s*([\d.]+)px/), ltH = num(/height\s*<\s*([\d.]+)px/);
            return (maxW === null || width <= maxW) && (maxH === null || height <= maxH)
                && (ltW === null || width < ltW) && (ltH === null || height < ltH);
        };
        const matches = query.split(',').some((q) => one(q.trim()));
        return { matches, media: query, addEventListener() {}, removeEventListener() {} };
    };
}

afterEach(() => { (window as any).matchMedia = had; });

describe('Tim: a screen is Compact or Regular, by width and by height', () => {
    test('a phone held upright is Compact wide, Regular high', () => {
        screenOf(393, 852);
        expect(sizeClasses()).toEqual({ width: 'compact', height: 'regular' });
    });

    test('a desktop is Regular both ways', () => {
        screenOf(1280, 800);
        expect(sizeClasses()).toEqual({ width: 'regular', height: 'regular' });
    });

    test('a phone held sideways is Regular wide, Compact high', () => {
        screenOf(852, 393);
        expect(sizeClasses()).toEqual({ width: 'regular', height: 'compact' });
    });
});

describe('Spike: the edges, 600 wide and 480 high', () => {
    test('599 wide is Compact, 600 is Regular', () => {
        screenOf(599, 900);
        expect(sizeClasses().width).toBe('compact');
        screenOf(600, 900);
        expect(sizeClasses().width).toBe('regular');
    });

    test('479 high is Compact, 480 is Regular', () => {
        screenOf(900, 479);
        expect(sizeClasses().height).toBe('compact');
        screenOf(900, 480);
        expect(sizeClasses().height).toBe('regular');
    });

    // 「[Opus 5.5] A browser zoomed in can give a viewport a fractional width: under 600 is Compact, to the last fraction.」
    test('599.99 wide is Compact, 479.99 high is Compact', () => {
        screenOf(599.99, 900);
        expect(sizeClasses().width).toBe('compact');
        screenOf(900, 479.99);
        expect(sizeClasses().height).toBe('compact');
    });

    test('where nothing can be asked of the screen, it is Regular both ways', () => {
        (window as any).matchMedia = undefined;
        expect(sizeClasses()).toEqual({ width: 'regular', height: 'regular' });
    });
});

describe('Jenny: what follows the classes, and what does not', () => {
    test('the package\'s table hides a column said to be regular under the Compact width', () => {
        expect(fitRule('[data-element-id]')).toContain(`@media ${COMPACT_WIDTH} {`);
        // 「[Opus 5.5] The range form is exact; the max- form is for a browser that cannot read it (Safari before 16.4),」
        // 「[Opus 5.5] where the list still matches by its other alternative.」
        expect(COMPACT_WIDTH).toBe('(max-width: 599.98px), (width < 600px)');
        expect(COMPACT_HEIGHT).toBe('(max-height: 479.98px), (height < 480px)');
    });
});
