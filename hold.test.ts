// A held press is a state of its own: the element is picked up.
// "pciking up uranium the held click, is a state chance the uranium glows more"

// Personas:
// - Tim: a press holds an element until it is let go, and it glows more
// - Spike: an element with no held glow, one wired twice, and the rest untouched

// - Jenny: every element can be picked up

import { describe, test, expect, beforeEach } from 'bun:test';
import { holdable, isHeld } from './hold';
import * as elements from './index';
import { wearIdentity, wearShadow } from './paint';
import { tray } from './tray/tray';
import { canvasPlaced } from './canvas/placed';

type Win = { MouseEvent: typeof MouseEvent };
const W = () => globalThis.window as unknown as Win & Window;

const GLOW = '0 0 6px rgba(57, 255, 20, 0.5)';
const HELD = '0 0 18px rgba(57, 255, 20, 0.9)';

beforeEach(() => {
    document.body.innerHTML = '';
});

function element(id: string, look: { glow?: string; heldGlow?: string } = {}): HTMLElement {
    const el = document.createElement('div');
    el.dataset.elementId = id;
    document.body.appendChild(el);
    wearIdentity(el, look);
    wearShadow(el, '');
    holdable(el);
    return el;
}

function press(el: HTMLElement): void {
    el.dispatchEvent(new (W().MouseEvent)('mousedown', { bubbles: true }));
}

// A real mouseup lands on what is under the pointer and is caught on its way
// past the window. Sent to the window itself, JSDOM's selector engine kept the
// window as the last mouse target, and any later :hover asked a node whether
// it contains the window: it threw, failing the proximity tests that ran after.
function release(): void {
    document.body.dispatchEvent(new (W().MouseEvent)('mouseup', { bubbles: true }));
}

describe('Tim: a press picks an element up', () => {
    test('held from the press until it is let go', () => {
        const el = element('uranium');

        press(el);
        expect(isHeld(el)).toBe(true);

        release();
        expect(isHeld(el)).toBe(false);
    });

    test('held, it glows more; let go, it glows as it did', () => {
        const el = element('uranium', { glow: GLOW, heldGlow: HELD });

        press(el);
        expect(el.style.boxShadow).toContain('18px');

        release();
        expect(el.style.boxShadow).toContain('6px');
        expect(el.style.boxShadow).not.toContain('18px');
    });
});

describe('Spike: no held glow, and wired twice', () => {
    test('an element with no held glow keeps its glow while held', () => {
        const el = element('iron', { glow: GLOW });

        press(el);

        expect(el.style.boxShadow).toContain('6px');
        release();
    });

    test('wired twice, one press is one hold', () => {
        const el = element('uranium');
        holdable(el);

        press(el);
        release();

        expect(isHeld(el)).toBe(false);
    });
});

// "OK, SO THE CLICK FOCUS BEHAVIOUR, I DONT LIKE IT ANYMORE, REMOVE IT FROM THE ELEMENTS PACKAGE"
describe('Spike: holding one leaves the rest as they are', () => {
    test('another element is not dimmed, and its transition is not touched', () => {
        const held = element('uranium');
        const other = element('iron');
        other.style.filter = 'saturate(2)';
        other.style.transition = 'opacity 200ms';

        press(held);

        expect(other.style.filter).toBe('saturate(2)');
        expect(other.style.transition).toBe('opacity 200ms');
        release();
    });

    test.each(['FOCUS_DIM', 'FOCUS_TRANSITION_MS', 'heldElement'])('%s is not exported', (name) => {
        expect(name in (elements as unknown as Record<string, unknown>)).toBe(false);
    });
});

describe('Jenny: every element can be picked up', () => {
    test('a tray dot', () => {
        tray.init();
        tray.add({ id: 'hold-dot', title: 'Iron', renderContent: () => document.createElement('div') });
        const dot = document.querySelector('[data-element-id="hold-dot"]') as HTMLElement;

        press(dot);
        expect(isHeld(dot)).toBe(true);
        release();
    });

    test('a canvas element', () => {
        const { element: el } = canvasPlaced({
            item: { id: 'hold-canvas', title: 'Uranium', renderContent: () => document.createElement('div') },
            className: 'canvas-hold',
            defaults: { x: 0, y: 0, width: 200, height: 120 },
            logLabel: 'Hold',
        });
        document.body.appendChild(el);

        press(el);
        expect(isHeld(el)).toBe(true);
        release();
    });
});
