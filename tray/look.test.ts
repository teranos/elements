/**
 * The tray's place, layout and motion are the package's.
 *
 * They lived in each host's stylesheet, and no two were the same: the hand-tuned
 * one glided, the specimens page's copy stepped. Now the package writes them,
 * the hand-tuned values, inline, as it writes a dot's size. Font, text colour and
 * border colour are the host's theme and stay the host's.
 *
 * Personas:
 * - Tim: Happy path — the tray at the right edge, its column, a dot at rest that glides
 * - Spike: Edge cases — a phone's gap and resting size; a host's own size wins
 * - Jenny: Complex scenarios — a dot morphing does not glide; back to rest, it does again
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { wearTrayLook, wearDotLook } from './look';
import { applyRestingDotGeometry } from './proximity';
import { configureElements, getDotGeometry, resetDotGeometry } from '../config';
import { prepareMorphTo } from '../forms/morphology';

/** A screen this wide, as matchMedia answers it. */
function screen(width: number): () => void {
    const had = window.matchMedia;
    (window as any).matchMedia = (query: string) => {
        const max = Number(/max-width:\s*(\d+)px/.exec(query)?.[1] ?? Infinity);
        return { matches: width <= max, media: query, addEventListener() {}, removeEventListener() {} };
    };
    return () => { (window as any).matchMedia = had; };
}

let restoreScreen: () => void = () => {};

beforeEach(() => {
    document.body.innerHTML = '';
    resetDotGeometry();
});

afterEach(() => {
    restoreScreen();
    restoreScreen = () => {};
    resetDotGeometry();
});

function trayAndDots(): { trayEl: HTMLElement; dots: HTMLElement } {
    const trayEl = document.createElement('div');
    const dots = document.createElement('div');
    trayEl.appendChild(dots);
    wearTrayLook(trayEl, dots);
    return { trayEl, dots };
}

describe('Tim: the tray, its column, its dots', () => {
    test('the tray is fixed at the right edge, 4px in, centred down the screen', () => {
        restoreScreen = screen(1280);
        const { trayEl } = trayAndDots();

        expect(trayEl.style.position).toBe('fixed');
        expect(trayEl.style.top).toBe('50%');
        expect(trayEl.style.right).toBe('4px');
        expect(trayEl.style.transform).toBe('translateY(-50%)');
        expect(trayEl.style.display).toBe('flex');
        expect(trayEl.style.flexDirection).toBe('column');
        expect(trayEl.style.alignItems).toBe('flex-end');
        // Only the dots take the pointer; a thumb browsing it is not a scroll.
        expect(trayEl.style.pointerEvents).toBe('none');
        expect(trayEl.style.touchAction).toBe('none');
    });

    test('its dots are a column 2px apart, as tight as the dots', () => {
        restoreScreen = screen(1280);
        const { dots } = trayAndDots();

        expect(dots.style.display).toBe('flex');
        expect(dots.style.flexDirection).toBe('column');
        expect(dots.style.gap).toBe('2px');
        expect(dots.style.width).toBe('fit-content');
        expect(dots.style.height).toBe('fit-content');
    });

    test('a dot at rest glides to every size it is given, and takes the pointer', () => {
        const dot = document.createElement('div');
        applyRestingDotGeometry(dot);

        expect(dot.style.transition).toBe('all 0.2s ease-out');
        expect(dot.style.boxSizing).toBe('border-box');
        // Anchored right: it grows leftward.
        expect(dot.style.marginLeft).toBe('auto');
        expect(dot.style.pointerEvents).toBe('auto');
        expect(dot.style.cursor).toBe('pointer');
    });
});

describe('Spike: a phone, and a host\'s own size', () => {
    test('on a phone the dots are 6px apart', () => {
        restoreScreen = screen(390);
        const { dots } = trayAndDots();

        expect(dots.style.gap).toBe('6px');
    });

    test('a dot rests at 13px on a phone, 15px up to 900px, 10px above', () => {
        restoreScreen = screen(390);
        expect(getDotGeometry().minWidth).toBe(13);
        expect(getDotGeometry().minHeight).toBe(13);
        restoreScreen();

        restoreScreen = screen(850);
        expect(getDotGeometry().minWidth).toBe(15);
        restoreScreen();

        restoreScreen = screen(1280);
        expect(getDotGeometry().minWidth).toBe(10);
    });

    test('a host that sets its own resting size has it, on any screen', () => {
        restoreScreen = screen(390);
        configureElements({ dotGeometry: { minWidth: 20, minHeight: 20 } });

        expect(getDotGeometry().minWidth).toBe(20);
        expect(getDotGeometry().minHeight).toBe(20);
    });
});

describe('Jenny: a dot that morphs, and comes back', () => {
    test('morphing, it does not glide: the morph moves it, not the transition', () => {
        const dot = document.createElement('div');
        dot.className = 'dot';
        dot.dataset.elementId = 'lithium';
        document.body.appendChild(dot);
        applyRestingDotGeometry(dot);

        prepareMorphTo(dot, { id: 'lithium', title: 'Lithium' }, () => {}, 'window', '1000');

        expect(dot.style.transition).toBe('');
        expect(dot.style.marginLeft).toBe('');
    });

    test('a morph called off puts it back at rest, gliding again', () => {
        const dot = document.createElement('div');
        dot.className = 'dot';
        dot.dataset.elementId = 'lithium';
        document.body.appendChild(dot);
        applyRestingDotGeometry(dot);

        const morph = prepareMorphTo(dot, { id: 'lithium', title: 'Lithium' }, () => {}, 'window', '1000');
        morph.rollbackClass();

        expect(dot.style.transition).toBe('all 0.2s ease-out');
    });

    test('wearing the look twice is the look once', () => {
        const dot = document.createElement('div');
        wearDotLook(dot);
        wearDotLook(dot);

        expect(dot.style.transition).toBe('all 0.2s ease-out');
    });
});
