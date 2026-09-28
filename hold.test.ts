// A held press is a state of its own: the element is picked up.
// "pciking up uranium the held click, is a state chance the uranium glows more"
// "when held, we focus on it, the rest should be lower brightness"
// "but not too much lower"

// Personas:
// - Tim: a press holds an element until it is let go, and it glows more
// - Spike: an element with no held glow, and one wired twice

// - Jenny: while one is held the rest dim, and come back as they were

import { describe, test, expect, beforeEach } from 'bun:test';
import { holdable, isHeld, FOCUS_DIM, FOCUS_TRANSITION_MS } from './hold';
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

function release(): void {
    W().dispatchEvent(new (W().MouseEvent)('mouseup', {}));
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

describe('Jenny: the rest dims while one is held', () => {
    test('the others dim, a little; the held one does not', () => {
        const held = element('uranium');
        const other = element('iron');

        press(held);

        expect(other.style.filter).toBe(`brightness(${FOCUS_DIM})`);
        expect(held.style.filter).not.toContain('brightness');
        expect(FOCUS_DIM).toBeGreaterThanOrEqual(0.8);
        release();
    });

    test('let go, the others wear what they wore before', () => {
        const held = element('uranium');
        const other = element('iron');
        other.style.filter = 'saturate(2)';

        press(held);
        release();

        expect(other.style.filter).toBe('saturate(2)');
    });
});

// "the brightness transision needs to be slown down to 750ms"
describe('Jenny: the rest dim slowly, and come back slowly', () => {
    test('the dimming eases over 750ms', () => {
        const held = element('uranium');
        const other = element('iron');

        press(held);

        expect(FOCUS_TRANSITION_MS).toBe(750);
        expect(other.style.transition).toContain('filter');
        expect(other.style.transition).toContain('750ms');
        release();
    });

    test('once the way back has eased, the transition it had is its own again', async () => {
        const held = element('uranium');
        const other = element('iron');
        other.style.transition = 'opacity 200ms';

        press(held);
        release();
        expect(other.style.transition).toContain('750ms');

        await Bun.sleep(FOCUS_TRANSITION_MS + 50);
        expect(other.style.transition).toBe('opacity 200ms');
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
