// An element can glow, and like its border every form wears it.
// "and it glows green a bit, its borders"
// "part of the element"

// Personas:
// - Tim: an element born with a glow wears it, in the tray and on the canvas
// - Spike: an element with no glow wears only what the form gives it

// - Jenny: the glow survives a window, the way back, and a wipe

import { describe, test, expect, beforeEach } from 'bun:test';
import { tray } from './tray/tray';
import { canvasPlaced } from './canvas/placed';
import { settleWindow } from './window/settle';
import { WINDOW_STYLE_PROPS } from './canvas/window';
import { readPaint, wearPaint, wearShadow } from './paint';
import { WINDOW_BOX_SHADOW } from './element';
import type { Element } from './element';

const GLOW = '0 0 6px rgba(57, 255, 20, 0.6)';

function make(id: string, overrides: Partial<Element> = {}): Element {
    return { id, title: 'Uranium', renderContent: () => document.createElement('div'), ...overrides };
}

function placed(item: Element): HTMLElement {
    return canvasPlaced({
        item,
        className: 'canvas-glow',
        defaults: { x: 0, y: 0, width: 200, height: 120 },
        logLabel: 'Glow',
    }).element;
}

function glows(el: HTMLElement): boolean {
    return el.style.boxShadow.includes('rgba(57, 255, 20, 0.6)');
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('Tim: an element born with a glow wears it', () => {
    test('a tray dot glows', () => {
        tray.init();
        tray.add(make('glow-dot', { glow: GLOW }));
        const dot = document.querySelector('[data-element-id="glow-dot"]') as HTMLElement;

        expect(glows(dot)).toBe(true);
    });

    test('a canvas element glows', () => {
        expect(glows(placed(make('glow-canvas', { glow: GLOW })))).toBe(true);
    });
});

describe('Spike: no glow', () => {
    test('a form\'s shadow is all an element without a glow wears', () => {
        const el = document.createElement('div');

        wearShadow(el, WINDOW_BOX_SHADOW);

        expect(el.style.boxShadow).not.toBe('');
        expect(glows(el)).toBe(false);
    });
});

describe('Jenny: the glow survives every form', () => {
    test('a window wears its glow beside the window\'s own shadow', () => {
        const el = placed(make('glow-window', { glow: GLOW }));

        settleWindow(el, { x: 0, y: 0, width: 200, height: 120 });

        expect(glows(el)).toBe(true);
        expect(el.style.boxShadow).not.toBe(GLOW);
    });

    test('back on the canvas, the glow is worn again', () => {
        const el = placed(make('glow-back', { glow: GLOW }));
        settleWindow(el, { x: 0, y: 0, width: 200, height: 120 });

        // What morphWindowToCanvasPlaced takes off on the way back.
        for (const property of WINDOW_STYLE_PROPS) {
            (el.style as unknown as Record<string, string>)[property as string] = '';
        }
        wearShadow(el, '');

        expect(glows(el)).toBe(true);
    });

    test('a wipe does not take the glow: it is worn again with the paint', () => {
        const el = placed(make('glow-wipe', { glow: GLOW }));
        const was = readPaint(el);

        el.style.cssText = '';
        wearPaint(el, was);

        expect(glows(el)).toBe(true);
    });
});
