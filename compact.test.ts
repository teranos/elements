/**
 * Compact and Regular: a screen's size classes, by its width and by its height.
 *
 * "Let's support Compact and Regular" (Apple Human Interface Guidelines, Layout: size classes), at the edges
 * agreed: 600 wide and 480 high, which are Material's window size classes' compact edges (width under 600dp,
 * height under 480dp).
 *
 * Personas:
 * - Tim: Happy path — a phone held upright, a desktop, a phone held sideways
 * - Spike: Edge cases — a pixel either side of each edge; no matchMedia at all
 * - Jenny: Complex scenarios — the package's own table columns follow the width class, the tray keeps its own edge
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { sizeClasses, COMPACT_WIDTH, COMPACT_HEIGHT } from './compact';
import { fitRule } from './fit';

const had = (window as any).matchMedia;

/** A screen of this size answers min/max width and height queries as a browser would. */
function screenOf(width: number, height: number): void {
    (window as any).matchMedia = (query: string) => {
        const px = (name: string) => { const m = new RegExp(`${name}:\\s*([\\d.]+)px`).exec(query); return m ? parseFloat(m[1]!) : null; };
        const maxW = px('max-width'), maxH = px('max-height');
        const matches = (maxW === null || width <= maxW) && (maxH === null || height <= maxH);
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

    test('where nothing can be asked of the screen, it is Regular both ways', () => {
        (window as any).matchMedia = undefined;
        expect(sizeClasses()).toEqual({ width: 'regular', height: 'regular' });
    });
});

describe('Jenny: what follows the classes, and what does not', () => {
    test('the package\'s table hides a column said to be regular under the Compact width', () => {
        expect(fitRule('[data-element-id]')).toContain(`@media ${COMPACT_WIDTH} {`);
        expect(COMPACT_WIDTH).toBe('(max-width: 599.98px)');
        expect(COMPACT_HEIGHT).toBe('(max-height: 479.98px)');
    });
});
