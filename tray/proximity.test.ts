/**
 * Tests for configurable dot geometry
 *
 * The dot is the element at rest. Its size used to be five private constants
 * inside Proximity, written inline on every animation frame — unreachable
 * from a host app and unreachable from CSS (inline styles win). These tests pin
 * the config surface that replaced them.
 *
 * Personas:
 * - Tim: defaults and overrides through configureElements
 * - Spike: config arrives after the proximity engine already exists
 * - Jenny: the expanded dot renders item.symbol natively (SYMRD)
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { configureElements, getDotGeometry } from '../config';
import { Proximity, applyRestingDotGeometry } from './proximity';
import { tray } from './tray';
import { resetElement } from '../forms/morphology';
import type { Element } from '../element';

/**
 * The default geometry. Changing it changes the tray of every host that keeps
 * the defaults: a breaking change. 20×20 at rest since 2.0.0 (10×10 before), so
 * that a title fits the row a dot keeps when it grows.
 */
const DEFAULTS = {
    minWidth: 20,
    minHeight: 20,
    maxWidth: 220,
    maxHeight: 32,
    borderRadiusMax: 2,
};

// happy-dom does not put requestAnimationFrame on globalThis; updateProximity
// needs it. Run frame callbacks synchronously so assertions can read the result.
const realRAF = globalThis.requestAnimationFrame;
const realCAF = globalThis.cancelAnimationFrame;

beforeAll(() => {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
});

afterAll(() => {
    globalThis.requestAnimationFrame = realRAF;
    globalThis.cancelAnimationFrame = realCAF;
});

// Config is module-global — hand it back to the defaults so test order
// and other test files are unaffected.
afterEach(() => {
    configureElements({ dotGeometry: DEFAULTS });
    document.body.innerHTML = '';
});

/** A tray container holding one dot, as updateProximity expects to find it. */
function makeTray(): { container: HTMLElement; dot: HTMLElement } {
    const container = document.createElement('div');
    const dot = document.createElement('div');
    dot.className = 'dot';
    container.appendChild(dot);
    document.body.appendChild(container);
    return { container, dot };
}

const NO_ITEMS = new Map<string, Element>();

// ── Tim (happy path) ────────────────────────────────────────────────

describe('Tim: dot geometry config', () => {
    // MUST stay first: proves the untouched defaults, before any configureElements call.
    test('the defaults', () => {
        expect(getDotGeometry()).toEqual(DEFAULTS);
    });

    test('minWidth overridable, rest fall back to defaults', () => {
        configureElements({ dotGeometry: { minWidth: 16 } });
        expect(getDotGeometry()).toEqual({ ...DEFAULTS, minWidth: 16 });
    });

    test('minHeight overridable, rest fall back to defaults', () => {
        configureElements({ dotGeometry: { minHeight: 18 } });
        expect(getDotGeometry()).toEqual({ ...DEFAULTS, minHeight: 18 });
    });

    test('maxWidth overridable, rest fall back to defaults', () => {
        configureElements({ dotGeometry: { maxWidth: 400 } });
        expect(getDotGeometry()).toEqual({ ...DEFAULTS, maxWidth: 400 });
    });

    test('maxHeight overridable, rest fall back to defaults', () => {
        configureElements({ dotGeometry: { maxHeight: 48 } });
        expect(getDotGeometry()).toEqual({ ...DEFAULTS, maxHeight: 48 });
    });

    test('borderRadiusMax overridable, rest fall back to defaults', () => {
        configureElements({ dotGeometry: { borderRadiusMax: 6 } });
        expect(getDotGeometry()).toEqual({ ...DEFAULTS, borderRadiusMax: 6 });
    });

    test('zero is a literal value, not "unset"', () => {
        configureElements({ dotGeometry: { borderRadiusMax: 0 } });
        expect(getDotGeometry().borderRadiusMax).toBe(0);
    });

    test('a second call merges, it does not replace', () => {
        configureElements({ dotGeometry: { minWidth: 16 } });
        configureElements({ dotGeometry: { maxWidth: 400 } });
        expect(getDotGeometry()).toEqual({ ...DEFAULTS, minWidth: 16, maxWidth: 400 });
    });

    test('configureElements without dotGeometry leaves geometry untouched', () => {
        configureElements({ dotGeometry: { minWidth: 16 } });
        configureElements({ logSegment: 'TEST' });
        expect(getDotGeometry().minWidth).toBe(16);
    });

    test('resting geometry is applied to an element from config', () => {
        configureElements({ dotGeometry: { minWidth: 16, minHeight: 18, borderRadiusMax: 6 } });
        const el = document.createElement('div');
        applyRestingDotGeometry(el);
        expect(el.style.width).toBe('16px');
        expect(el.style.height).toBe('18px');
        expect(el.style.borderRadius).toBe('6px');
    });
});

// ── Spike (edge cases) ──────────────────────────────────────────────

describe('Spike: geometry is read at use time', () => {
    test('an engine built before configureElements still uses the new geometry', () => {
        // Engine exists first — it must not capture geometry at construction.
        const proximity = new Proximity();

        configureElements({
            dotGeometry: { minWidth: 16, minHeight: 18, maxWidth: 400, maxHeight: 48, borderRadiusMax: 6 },
        });

        const { container, dot } = makeTray();

        // Pointer far away → proximity 0 → resting size.
        proximity.setPointerPosition(10000, 10000);
        proximity.updateProximity(container, NO_ITEMS, false);

        expect(dot.style.width).toBe('16px');
        expect(dot.style.height).toBe('18px');
        expect(dot.style.borderRadius).toBe('6px');
    });

    test('proximity 1 widens to the configured max, and keeps the resting height', () => {
        configureElements({
            dotGeometry: { minWidth: 16, minHeight: 18, maxWidth: 400, maxHeight: 48, borderRadiusMax: 6 },
        });

        const proximity = new Proximity();
        const { container, dot } = makeTray();

        // Element rects are all-zero here, so pointer 0,0 sits inside the dot:
        // distance 0 → proximityRaw 1 → snap to fully expanded.
        proximity.setPointerPosition(0, 0);
        proximity.updateProximity(container, NO_ITEMS, false);

        expect(dot.style.width).toBe('400px');
        expect(dot.style.height).toBe('18px');
        expect(dot.style.borderRadius).toBe('0px');
    });

    test('a dot is born at the configured resting size, not the CSS size', () => {
        configureElements({ dotGeometry: { minWidth: 16, minHeight: 18, borderRadiusMax: 6 } });

        const item: Element = { id: 'dot-geometry-1', title: 'Dot Geometry', symbol: '■' };
        tray.add(item, true);
        const dot = document.querySelector('[data-element-id="dot-geometry-1"]') as HTMLElement;

        expect(dot).not.toBeNull();
        expect(dot.style.width).toBe('16px');
        expect(dot.style.height).toBe('18px');

        tray.remove('dot-geometry-1');
    });

    test('a dot returning to rest is re-sized from config after its styles are wiped', () => {
        configureElements({ dotGeometry: { minWidth: 16, minHeight: 18, borderRadiusMax: 6 } });

        const item: Element = { id: 'dot-geometry-2', title: 'Dot Geometry', symbol: '■' };
        const el = document.createElement('div');
        el.style.width = '600px';
        el.style.height = '400px';
        document.body.appendChild(el);

        resetElement(el, item, 'test', () => {});

        expect(el.style.width).toBe('16px');
        expect(el.style.height).toBe('18px');
        expect(el.style.borderRadius).toBe('6px');
    });

    test('unconfigured geometry morphs 20px → 220px wide, 20px tall throughout', () => {
        const proximity = new Proximity();
        const { container, dot } = makeTray();

        proximity.setPointerPosition(10000, 10000);
        proximity.updateProximity(container, NO_ITEMS, false);
        expect(dot.style.width).toBe('20px');
        expect(dot.style.height).toBe('20px');
        expect(dot.style.borderRadius).toBe('2px');

        proximity.setPointerPosition(0, 0);
        proximity.updateProximity(container, NO_ITEMS, false);
        expect(dot.style.width).toBe('220px');
        expect(dot.style.height).toBe('20px');
        expect(dot.style.borderRadius).toBe('0px');
    });
});

// ── Jenny (symbol in the expanded dot, SYMRD) ───────────────────────

describe('Jenny: the expanded dot shows the symbol', () => {
    /** A tray with one dot bound to an item, as the engine finds them. */
    function trayWithItem(item: Element): { container: HTMLElement; dot: HTMLElement; items: Map<string, Element> } {
        const { container, dot } = makeTray();
        dot.dataset.elementId = item.id;
        return { container, dot, items: new Map([[item.id, item]]) };
    }

    // The tray dot used to have no symbol resting or expanded — hosts glued
    // it to the front of the title string. The engine renders it natively now.
    test('symbol and title together', () => {
        const proximity = new Proximity();
        const { container, dot, items } = trayWithItem({
            id: 'sym-dot-1',
            title: 'Self',
            symbol: '●',
            renderContent: () => document.createElement('div'),
        });

        proximity.setPointerPosition(0, 0);
        proximity.updateProximity(container, items, false);

        expect(dot.textContent).toBe('● Self');
    });

    test('no symbol, the title alone', () => {
        const proximity = new Proximity();
        const { container, dot, items } = trayWithItem({
            id: 'sym-dot-2',
            title: 'Handlers',
            renderContent: () => document.createElement('div'),
        });

        proximity.setPointerPosition(0, 0);
        proximity.updateProximity(container, items, false);

        expect(dot.textContent).toBe('Handlers');
    });
});

// ── A dot growing under the pointer stays under it ─────────────────
//
// Measured on the specimens page: Lithium's dot grew from 20×20 to 220×32 as the
// pointer reached it, and moved up 52px, because every dot in the column grew
// and pushed the others. The point aimed at was Beryllium's by then, and a
// click there opened Beryllium, or nothing. A dot now grows sideways only: its
// row in the column is the same height grown or at rest, so nothing moves, and
// the gap between rows stays.

describe('Spike: a growing dot keeps its place', () => {
    test('fully grown, it is as tall as at rest, whatever maxHeight says', () => {
        configureElements({ dotGeometry: { maxHeight: 48 } });
        const proximity = new Proximity();
        const { container, dot } = makeTray();

        proximity.setPointerPosition(0, 0);
        proximity.updateProximity(container, NO_ITEMS, false);

        expect(dot.style.width).toBe('220px');
        expect(dot.style.height).toBe('20px');
    });

    test('its title fits the row: no padding above or below it', () => {
        const proximity = new Proximity();
        const { container, dot } = makeTray();
        dot.dataset.elementId = 'row-1';
        const items = new Map<string, Element>([['row-1', { id: 'row-1', title: 'Lithium', symbol: 'Li' }]]);

        proximity.setPointerPosition(0, 0);
        proximity.updateProximity(container, items, false);

        expect(dot.textContent).toBe('Li Lithium');
        expect(dot.style.paddingTop).toBe('0px');
        expect(dot.style.paddingBottom).toBe('0px');
    });
});
