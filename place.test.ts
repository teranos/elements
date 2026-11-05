/**
 * An element placed on a canvas stands at the left and top it carries, and no host has to say so.
 *
 * "the very non standard way of positioning things in elements itself, and it starts at the
 * example in that repo"
 *
 * canvasPlaced writes left, top, width and height (canvas/drag.ts, applyCanvasElementLayout). A left
 * and a top mean nothing to a box nothing positioned: a host that did not write
 * `.canvas-element { position: absolute }` saw its elements flush in the corner, and the specimens
 * page, which writes none, did exactly that. The package says where a placed element stands, in its
 * layer, once. The real browser has the last word (browser/placed.browser.ts): these DOMs have no layout.
 *
 * Personas:
 * - Tim: Happy path — the package's layer says a canvas-placed element is absolute
 * - Spike: Edge cases — it is a default, not a decree: not important, so a morph's own position and a host's still win
 * - Jenny: Complex scenarios — an element placed on a canvas brings the rule; no other form is placed
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { placeRule } from './place';
import { canvasPlaced } from './canvas/placed';
import { setForm } from './dataset';

const RULE_ID = 'elements-text-size';
const rule = () => document.getElementById(RULE_ID);

beforeEach(() => {
    document.body.innerHTML = '';
    rule()?.remove();
});

describe('Tim: where a placed element stands', () => {
    test('a canvas-placed element is absolute', () => {
        expect(placeRule()).toContain('[data-form="canvasPlaced"]');
        expect(placeRule()).toContain('position: absolute');
    });

    test('the rule is in the package\'s layer, in the page', () => {
        setForm(document.createElement('div'), 'canvasPlaced');
        const css = rule()!.textContent!;

        expect(css).toContain('@layer elements');
        expect(css).toContain(placeRule());
    });
});

describe('Spike: a default, not a decree', () => {
    test('it is not important, so what a morph writes on the element, or a host writes, still wins', () => {
        expect(placeRule()).not.toContain('!important');
    });

    test('it names no form but canvas-placed', () => {
        const named = placeRule().match(/data-form="[a-zA-Z]+"/g) ?? [];

        expect(named).toEqual(['data-form="canvasPlaced"']);
    });
});

describe('Jenny: an element placed on a canvas', () => {
    test('brings the rule with it, and carries the form the rule names', () => {
        const { element } = canvasPlaced({
            item: { id: 'barium', title: 'Barium', renderContent: () => document.createElement('div') },
            className: 'canvas-place-specimen',
            defaults: { x: 16, y: 40, width: 240, height: 150 },
            logLabel: 'Place',
        });

        expect(element.dataset.form).toBe('canvasPlaced');
        expect(rule()!.textContent).toContain(placeRule());
        expect(element.style.left).toBe('16px');
        expect(element.style.top).toBe('40px');
    });
});
