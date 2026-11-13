// Overlay form.
//
// "IF THERE ARE MESSAGES PENDING TO BE SENT, AS A COLLECTED BATCH, I SEE IT BOTTOM LEFTSIDE. SLIGHTLY TRANSPARENT. AND I CAN MOVE IT UP IF IT WANT TO."
// "IF I PRESS ON IT, IT OPENS UP FULLSCREEN."
// "THE OVERLAY IS A NEW ELEMENT FORM"
// "AND IS ALAYS ASSOCIATED WITH ONE OTHER ELEMENT"
//
// Personas:
// - Tim: Happy path — over its element, bottom left, pressed open, back in its place
// - Spike: Edge cases — no element to be over, a drag is no press, it stays inside
// - Jenny: Complex scenarios — moved and opened and back where it was moved to, taken away while open

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { overlayFrom, OVERLAY_OPACITY, OVERLAY_INSET, type OverlayHandle } from './overlay';
import { getForm, setElementId, setForm } from '../dataset';
import type { Element } from '../element';
import { tray } from '../tray/tray';
import { playAnimations, type Played } from '../test-animations';
import { expectAxiom } from '../test-axiom';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const realm = () => globalThis.window as unknown as { Event: typeof Event; MouseEvent: typeof MouseEvent };
// A morph finishes on the next turn (test-animations.ts); this is well past it.
const SETTLED = 15;

let animations: Played;
let rendered = 0;
let over: HTMLElement;
let overlay: OverlayHandle;
let taken = false;

function item(): Element {
    return {
        id: 'polonium',
        title: 'three wait',
        symbol: 'Po',
        renderContent: () => {
            rendered++;
            const body = document.createElement('div');
            body.className = 'polonium-body';
            body.textContent = 'what waited all along';
            return body;
        },
    };
}

const boxed = (el: HTMLElement, left: number, top: number, width: number, height: number) => {
    el.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
};

/** Where the overlay is drawn, from where it says it rests in its element (300 by 500 at 100, 50). */
const follow = (el: HTMLElement) => {
    el.getBoundingClientRect = () => {
        const left = 100 + (parseFloat(el.style.left) || 0);
        const bottom = 550 - (parseFloat(el.style.bottom) || 0);
        return { left, top: bottom - 30, width: 120, height: 30, right: left + 120, bottom, x: left, y: bottom - 30, toJSON: () => ({}) } as DOMRect;
    };
};

const click = (el: HTMLElement) => el.dispatchEvent(new (realm().MouseEvent)('click', { bubbles: true, detail: 1 }));
const pointer = (el: HTMLElement, type: string, x: number, y: number) => {
    const e = new (realm().Event)(type, { bubbles: true, cancelable: true });
    Object.assign(e, { clientX: x, clientY: y, pointerId: 1 });
    el.dispatchEvent(e);
};
const drag = (el: HTMLElement, dx: number, dy: number) => {
    pointer(el, 'pointerdown', 150, 530);
    pointer(el, 'pointermove', 150 + dx / 2, 530 + dy / 2);
    pointer(el, 'pointermove', 150 + dx, 530 + dy);
    pointer(el, 'pointerup', 150 + dx, 530 + dy);
    // The browser says a click after a press let go on what was pressed.
    click(el);
};
const escape = () => {
    const key = new (realm().Event)('keydown', { bubbles: true });
    Object.assign(key, { key: 'Escape' });
    document.dispatchEvent(key);
};
const down = (el: HTMLElement) => el.querySelector<HTMLElement>('.window-controls [aria-label="Back to its place"]');
const minimize = (el: HTMLElement) => el.querySelector<HTMLElement>('.window-controls [aria-label="Minimize"]');

beforeEach(() => {
    animations = playAnimations();
    document.body.innerHTML = '';
    tray.init();
    rendered = 0;
    taken = false;
    // The element it is over: a window, 300 by 500.
    over = document.createElement('div');
    setElementId(over, 'lead');
    setForm(over, 'window');
    over.style.position = 'fixed';
    boxed(over, 100, 50, 300, 500);
    document.body.appendChild(over);
    overlay = overlayFrom(item(), { over, className: 'host-overlay' });
    follow(overlay.element);
});

afterEach(() => {
    // Whatever a test did, it ends with the one element it began with, unless it was taken away.
    if (!taken) expectAxiom('polonium', overlay.element);
    animations.restore();
    if (tray.has('polonium')) tray.remove('polonium');
});

describe('Tim: over its element, pressed open, back in its place', () => {
    test('it is an overlay: in the form table, saying what it says', () => {
        expect(getForm(overlay.element)).toBe('overlay');
        expect(overlay.element.textContent).toBe('three wait');
        expect(overlay.element.className).toBe('host-overlay');
        expect(overlay.element.querySelector('.title-bar')).toBeNull();
    });

    test('it rests in the element it is over, bottom left', () => {
        expect(overlay.element.parentElement).toBe(over);
        expect(overlay.element.style.position).toBe('absolute');
        expect(overlay.element.style.left).toBe(`${OVERLAY_INSET}px`);
        expect(overlay.element.style.bottom).toBe(`${OVERLAY_INSET}px`);
    });

    test('it is slightly transparent while it rests', () => {
        expect(OVERLAY_OPACITY).toBeLessThan(1);
        expect(OVERLAY_OPACITY).toBeGreaterThan(0.5);
        expect(overlay.element.style.background.split(' ').join('')).toContain(`,${OVERLAY_OPACITY})`);
    });

    test('a press opens it fullscreen: a panel, the same element, drawn once', async () => {
        click(overlay.element);
        expect(getForm(overlay.element)).toBe('panel');
        await wait(SETTLED);
        expectAxiom('polonium', overlay.element);
        expect(overlay.element.parentElement).toBe(document.body);
        expect(overlay.element.classList.contains('panel--fullscreen')).toBe(true);
        expect(overlay.element.style.getPropertyValue('backdrop-filter')).toBe('');
        expect(overlay.element.querySelectorAll('.polonium-body')).toHaveLength(1);
        expect(rendered).toBe(1);
    });

    test('the down arrow brings it back to its place over its element', async () => {
        click(overlay.element);
        await wait(SETTLED);
        down(overlay.element)!.click();
        await wait(SETTLED);
        expectAxiom('polonium', overlay.element);
        expect(getForm(overlay.element)).toBe('overlay');
        expect(overlay.element.parentElement).toBe(over);
        expect(overlay.element.style.left).toBe(`${OVERLAY_INSET}px`);
        expect(overlay.element.style.bottom).toBe(`${OVERLAY_INSET}px`);
        expect(overlay.element.textContent).toBe('three wait');
    });

    test('what it says is the host\'s to change, wherever it is', async () => {
        overlay.says('four wait');
        expect(overlay.element.textContent).toBe('four wait');
        click(overlay.element);
        await wait(SETTLED);
        overlay.says('five wait');
        expect(overlay.element.querySelector('.title-bar .overlay-label')!.textContent).toBe('five wait');
    });
});

describe('Spike: what an overlay is not', () => {
    test('it is over one other element: what carries no element id is refused', () => {
        const bare = document.createElement('div');
        document.body.appendChild(bare);
        expect(() => overlayFrom({ ...item(), id: 'astatine' }, { over: bare })).toThrow('one other element');
        expect(document.querySelector('[data-element-id="astatine"]')).toBeNull();
    });

    test('minimized, it goes to its place and never to the tray', async () => {
        click(overlay.element);
        await wait(SETTLED);
        minimize(overlay.element)!.click();
        await wait(SETTLED);
        expectAxiom('polonium', overlay.element);
        expect(getForm(overlay.element)).toBe('overlay');
        expect(overlay.element.parentElement).toBe(over);
        expect(tray.has('polonium')).toBe(false);
    });

    test('Escape takes it to its place too', async () => {
        click(overlay.element);
        await wait(SETTLED);
        escape();
        await wait(SETTLED);
        expect(getForm(overlay.element)).toBe('overlay');
        expect(overlay.element.parentElement).toBe(over);
    });

    test('a drag moves it and is no press', () => {
        drag(overlay.element, 0, -200);
        expect(getForm(overlay.element)).toBe('overlay');
        expect(overlay.element.style.bottom).toBe(`${OVERLAY_INSET + 200}px`);
        expect(overlay.element.style.left).toBe(`${OVERLAY_INSET}px`);
    });

    test('a finger that barely moved pressed it', () => {
        drag(overlay.element, 1, -2);
        expect(getForm(overlay.element)).toBe('panel');
    });

    test('where it first rests is the host\'s to say: above a chat\'s field', () => {
        const above = overlayFrom({ ...item(), id: 'radon' }, { over, at: { bottom: 96 } });
        expect(above.element.style.bottom).toBe('96px');
        expect(above.element.style.left).toBe(`${OVERLAY_INSET}px`);
        above.away();
    });

    test('it is moved no further than the element it is over', () => {
        drag(overlay.element, -500, -5000);
        expect(overlay.element.style.left).toBe('0px');
        // 500 tall, itself 30.
        expect(overlay.element.style.bottom).toBe('470px');
        drag(overlay.element, 5000, 5000);
        expect(overlay.element.style.left).toBe('180px');
        expect(overlay.element.style.bottom).toBe('0px');
    });

    test('what is pressed on it does not reach the element it is over', () => {
        let reached = 0;
        over.addEventListener('pointerdown', () => reached++);
        over.addEventListener('mousedown', () => reached++);
        over.addEventListener('touchstart', () => reached++);
        pointer(overlay.element, 'pointerdown', 150, 530);
        overlay.element.dispatchEvent(new (realm().Event)('mousedown', { bubbles: true }));
        overlay.element.dispatchEvent(new (realm().Event)('touchstart', { bubbles: true }));
        pointer(overlay.element, 'pointerup', 150, 530);
        expect(reached).toBe(0);
    });
});

describe('Jenny: moved, opened, taken away', () => {
    test('moved up and opened, it comes back to where it was moved to', async () => {
        drag(overlay.element, 40, -200);
        click(overlay.element);
        await wait(SETTLED);
        expect(getForm(overlay.element)).toBe('panel');
        down(overlay.element)!.click();
        await wait(SETTLED);
        expectAxiom('polonium', overlay.element);
        expect(overlay.element.style.left).toBe(`${OVERLAY_INSET + 40}px`);
        expect(overlay.element.style.bottom).toBe(`${OVERLAY_INSET + 200}px`);
    });

    test('its road back ends where it rests over its element', async () => {
        click(overlay.element);
        await wait(SETTLED);
        animations.roads.length = 0;
        down(overlay.element)!.click();
        const road = animations.roads.find((r) => r.element === overlay.element)!;
        const last = road.keyframes[road.keyframes.length - 1]!;
        // Its element stands at 100, 50, 300 by 500; it is 120 by 30, inset from the bottom left.
        expect(last).toMatchObject({ left: `${100 + OVERLAY_INSET}px`, top: `${550 - OVERLAY_INSET - 30}px`, width: '120px', height: '30px' });
        await wait(SETTLED);
    });

    test('opened twice, its body is the one it had', async () => {
        click(overlay.element);
        await wait(SETTLED);
        const body = overlay.element.querySelector('.polonium-body');
        down(overlay.element)!.click();
        await wait(SETTLED);
        click(overlay.element);
        await wait(SETTLED);
        expectAxiom('polonium', overlay.element);
        expect(overlay.element.querySelector('.polonium-body')).toBe(body);
        expect(rendered).toBe(1);
    });

    test('taken away at rest, nothing of it is left', () => {
        overlay.away();
        taken = true;
        expect(document.querySelector('[data-element-id="polonium"]')).toBeNull();
    });

    test('taken away while open, nothing of it is left and Escape finds nothing', async () => {
        click(overlay.element);
        await wait(SETTLED);
        overlay.away();
        taken = true;
        expect(document.querySelector('[data-element-id="polonium"]')).toBeNull();
        escape();
        await wait(SETTLED);
        expect(document.querySelector('[data-element-id="polonium"]')).toBeNull();
    });

    test('its element stashed for the tray, it goes with it and comes back with it', () => {
        const held = document.createDocumentFragment();
        while (over.firstChild) held.appendChild(over.firstChild);
        expect(document.querySelector('[data-element-id="polonium"]')).toBeNull();
        over.appendChild(held);
        expect(overlay.element.parentElement).toBe(over);
        expect(getForm(overlay.element)).toBe('overlay');
        // Out of the page for a moment, it is the one element still.
    });
});
