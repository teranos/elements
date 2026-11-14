/**
 * Pill Form — an element resting as a pill in an input field, across its row when pressed.
 *
 * "Why doesn't it behave like an element form? Not as an overlay, but as a generalised 'pills above inputfields'
 * form?" "In elemental form, everything has an answer." "The input field pill should be inside of inputfield form, and
 * it taking focus should let kb stay in place." "I want inputfield to still be there." Pressed, the pill is the same
 * element across its row, what it holds in it, what else is in the row aside; the field stays, with the focus.
 *
 * Personas:
 * - Tim: Happy path — at rest a pill in the row; pressed, across the row, the field still there; let go, a pill again
 * - Spike: Edge cases — no field yet, Escape, a press outside, a press while it moves
 * - Jenny: Complex scenarios — one element through every form, what it holds drawn once, renamed while open
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { pillFrom, pillIn, PILL_RESTED } from './pill';
import { getForm } from '../dataset';
import type { Element } from '../element';
import { fitRule } from '../fit';
import { cancelMorph } from '../morph-transaction';

/** A road that does not end by itself, so its moving frame is looked at; cancelled, it ends as a browser's does. */
function stillMoving(element: HTMLElement): void {
    (element as unknown as { animate: unknown }).animate = () => {
        const told = new Map<string, () => void>();
        return {
            addEventListener: (type: string, f: () => void) => told.set(type, f),
            removeEventListener: (type: string) => told.delete(type),
            cancel: () => told.get('cancel')?.(),
        };
    };
}

afterEach(() => { document.body.innerHTML = ''; });

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

let drawn = 0;
function item(): Element {
    drawn = 0;
    return {
        id: 'xenon-choices',
        title: 'Opus 5.5 · high',
        renderContent: () => {
            drawn++;
            const options = document.createElement('div');
            options.className = 'options';
            options.innerHTML = '<button type="button">max</button>';
            return options;
        },
    };
}

/** An input field the way a chat draws it: the field, and under it a row of a +, the pill and a send. */
function rowWithField() {
    const element = document.createElement('div');
    element.dataset.elementId = 'xenon';
    const place = document.createElement('div');
    place.dataset.sayBox = '';
    const field = document.createElement('textarea');
    const row = document.createElement('div');
    const plus = document.createElement('button');
    const send = document.createElement('button');
    const pill = pillFrom(item());
    row.append(plus, pill.element, send);
    place.append(field, row);
    element.appendChild(place);
    document.body.appendChild(element);
    pillIn(pill.element, field);
    return { pill, row, place, field, plus, send };
}

describe('Tim: a pill', () => {
    test('at rest, it is the pill form, says its title, and is pressable', () => {
        const { pill } = rowWithField();
        expect(getForm(pill.element)).toBe('pill');
        expect(pill.element.textContent).toBe('Opus 5.5 · high');
        expect(pill.element.getAttribute('role')).toBe('button');
        expect(pill.element.tabIndex).toBe(0);
    });

    test('pressed, it is across its row, holding what it holds; what else is in the row stands aside; the field stays', async () => {
        const { pill, row, field, plus, send } = rowWithField();
        field.focus();
        pill.element.click();
        await settled();

        expect(getForm(pill.element)).toBe('pillOpen');
        expect(pill.element.parentElement).toBe(row);
        expect(plus.style.getPropertyValue('display')).toBe('none');
        expect(send.style.getPropertyValue('display')).toBe('none');
        expect(field.isConnected).toBe(true);
        expect(field.style.getPropertyValue('display')).toBe('');
        expect(document.activeElement).toBe(field);
        expect(pill.element.querySelector('.options')).not.toBeNull();
        expect(pill.element.getAttribute('aria-expanded')).toBe('true');
    });

    test('let go, it is the pill again in its place in the row, what was aside back, the field with the words', async () => {
        const { pill, field, plus, send } = rowWithField();
        let told = 0;
        pill.element.addEventListener(PILL_RESTED, () => told++);
        pill.element.click();
        await settled();
        pill.rest();
        await settled();

        expect(getForm(pill.element)).toBe('pill');
        expect(pill.element.previousElementSibling).toBe(plus);
        expect(pill.element.nextElementSibling).toBe(send);
        expect(plus.style.getPropertyValue('display')).toBe('');
        expect(pill.element.querySelector('.options')).toBeNull();
        expect(pill.element.textContent).toBe('Opus 5.5 · high');
        expect(document.activeElement).toBe(field);
        expect(told).toBe(1);
    });
});

// "it taking focus should let kb stay in place": a press is a pointerdown first, and a pointerdown is where the
// focus moves; on the pill, it does not.
describe('Spike: a press on it', () => {
    test('takes no focus from the field, at rest or open', async () => {
        const { pill } = rowWithField();
        const down = () => {
            const e = new Event('pointerdown', { bubbles: true, cancelable: true });
            pill.element.dispatchEvent(e);
            return e.defaultPrevented;
        };
        const mouse = () => {
            const e = new Event('mousedown', { bubbles: true, cancelable: true });
            pill.element.querySelector('button, span')!.dispatchEvent(e);
            return e.defaultPrevented;
        };
        expect(down()).toBe(true);
        expect(mouse()).toBe(true);
        pill.element.click();
        await settled();
        expect(down()).toBe(true);
        expect(mouse()).toBe(true);
    });
});

describe('Spike: how it is left, and when it is not', () => {
    test('with no field to take the place of, a press does nothing', async () => {
        const pill = pillFrom(item());
        document.body.appendChild(pill.element);
        pill.element.click();
        await settled();
        expect(getForm(pill.element)).toBe('pill');
    });

    test('Escape lets it go', async () => {
        const { pill } = rowWithField();
        pill.element.click();
        await settled();
        pill.element.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await settled();
        expect(getForm(pill.element)).toBe('pill');
    });

    test('a press outside lets it go; a press inside does not', async () => {
        const { pill } = rowWithField();
        pill.element.click();
        await settled();
        pill.element.querySelector('.options')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        await settled();
        expect(getForm(pill.element)).toBe('pillOpen');
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        await settled();
        expect(getForm(pill.element)).toBe('pill');
    });

    test('Enter and Space press it, as a button', async () => {
        const { pill } = rowWithField();
        pill.element.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await settled();
        expect(getForm(pill.element)).toBe('pillOpen');
    });
});

// Seen on the moving frame of a screenshot: nothing. On its road it is on the page, and the panel it rests in was in
// front of it.
describe('Jenny: on its road', () => {
    test('it is in front of the element it rests in', async () => {
        const { pill } = rowWithField();
        const holder = pill.element.closest<HTMLElement>('[data-element-id="xenon"]')!;
        holder.style.position = 'fixed';
        holder.style.zIndex = '1000';
        // A road that does not end at once: the moving frame is looked at.
        stillMoving(pill.element);
        pill.element.click();
        expect(Number(pill.element.style.zIndex)).toBeGreaterThan(1000);
        cancelMorph(pill.element);
    });
});

// Seen on the moving frame: square, its options smaller. Lifted onto the bare page, it was no longer in its element,
// and what the package says of what is in an element no longer said it of this.
describe('Jenny: on its road, still in its element', () => {
    test('it is held by the body of the element it rests in', () => {
        const { pill, row } = rowWithField();
        const body = row.parentElement!;
        body.dataset.scroller = 'body';
        stillMoving(pill.element);
        pill.element.click();
        expect(pill.element.parentElement).toBe(body);
        expect(pill.element.style.position).toBe('fixed');
        cancelMorph(pill.element);
    });
});

// Seen on the moving frame: the row's presses folded at the first frame, the input field shrank, and the pill on its
// road lay over the words. They keep their room, unseen, until it is across the row.
describe('Jenny: on its road, the row keeps its room', () => {
    test('what else is in the row is unseen while it moves, and stands aside once it is there', () => {
        const { pill, plus } = rowWithField();
        stillMoving(pill.element);
        pill.element.click();
        expect(plus.style.getPropertyValue('visibility')).toBe('hidden');
        expect(plus.style.getPropertyValue('display')).toBe('');
        cancelMorph(pill.element);
    });
});

describe('Jenny: one element, all the way', () => {
    test('the same node rests, opens and rests again, and what it holds is drawn once', async () => {
        const { pill } = rowWithField();
        const node = pill.element;
        for (let i = 0; i < 3; i++) {
            node.click();
            await settled();
            pill.rest();
            await settled();
        }
        expect(document.querySelectorAll('[data-element-id="xenon-choices"]').length).toBe(1);
        expect(pill.element).toBe(node);
        expect(drawn).toBe(1);
    });

    test('renamed while open, it says the new title when it rests', async () => {
        const { pill } = rowWithField();
        pill.element.click();
        await settled();
        pill.retitle('Opus 5.5 · max');
        pill.rest();
        await settled();
        expect(pill.element.textContent).toBe('Opus 5.5 · max');
        expect(pill.element.getAttribute('aria-label')).toBe('Opus 5.5 · max');
    });
});

// Seen on the moving frame: past the right edge. The open form's width, written important, outranked the road's: it
// was as wide as the screen from the first frame. Its shape holds once it is there; on the road the road says how big.
describe('Spike: on its road, its size is the road\'s', () => {
    test('the form\'s shape is for an element that is not moving', () => {
        const rule = fitRule('[data-element-id]');
        expect(rule).toContain('[data-form="pillOpen"]:not([data-pill-moving]) {');
        expect(rule).toContain('[data-form="pill"]:not([hidden]):not([data-pill-moving]) {');
        const moving = rule.split('\n').find((line) => line.includes('[data-element-id] [data-pill-moving] {'))!;
        expect(moving).not.toContain('width');
        expect(moving).not.toContain('display');
    });
});
