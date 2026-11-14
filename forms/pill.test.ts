/**
 * Pill Form — an element resting as a pill above an input field, and taking the field's place when pressed.
 *
 * "Why doesn't it behave like an element form? Not as an overlay, but as a generalised 'pills above inputfields'
 * form?" "In elemental form, everything has an answer." And cyan, on a screenshot: "we would not be using the
 * inputfield while in the pill choosing something". Pressed, the pill is the same element in the field's place, what
 * it holds in it; let go, it is the pill again, above the field, and the field has the words again.
 *
 * Personas:
 * - Tim: Happy path — at rest a pill above the field; pressed, in the field's place; let go, a pill again
 * - Spike: Edge cases — no field yet, Escape, a press outside, a press while it moves
 * - Jenny: Complex scenarios — one element through every form, what it holds drawn once, renamed while open
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { pillFrom, pillAbove, PILL_RESTED } from './pill';
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

/** A row the way a chat draws it: the pill, then the field's box. */
function rowWithField() {
    const element = document.createElement('div');
    element.dataset.elementId = 'xenon';
    const row = document.createElement('div');
    const place = document.createElement('div');
    place.dataset.sayBox = '';
    place.style.setProperty('display', 'flex', 'important');
    const field = document.createElement('textarea');
    place.appendChild(field);
    const pill = pillFrom(item());
    row.append(pill.element, place);
    element.appendChild(row);
    document.body.appendChild(element);
    pillAbove(pill.element, field);
    return { pill, row, place, field };
}

describe('Tim: a pill', () => {
    test('at rest, it is the pill form, says its title, and is pressable', () => {
        const { pill } = rowWithField();
        expect(getForm(pill.element)).toBe('pill');
        expect(pill.element.textContent).toBe('Opus 5.5 · high');
        expect(pill.element.getAttribute('role')).toBe('button');
        expect(pill.element.tabIndex).toBe(0);
    });

    test('pressed, it takes the field\'s place, holding what it holds, and the field stands aside', async () => {
        const { pill, row, place } = rowWithField();
        pill.element.click();
        await settled();

        expect(getForm(pill.element)).toBe('pillOpen');
        expect(pill.element.parentElement).toBe(row);
        expect(pill.element.nextElementSibling).toBe(place);
        expect(place.style.getPropertyValue('display')).toBe('none');
        expect(pill.element.querySelector('.options')).not.toBeNull();
        expect(pill.element.getAttribute('aria-expanded')).toBe('true');
    });

    test('let go, it is the pill again above the field, the field back, with the words', async () => {
        const { pill, place, field } = rowWithField();
        let told = 0;
        pill.element.addEventListener(PILL_RESTED, () => told++);
        pill.element.click();
        await settled();
        pill.rest();
        await settled();

        expect(getForm(pill.element)).toBe('pill');
        expect(pill.element.nextElementSibling).toBe(place);
        expect(place.style.getPropertyValue('display')).toBe('flex');
        expect(place.style.getPropertyPriority('display')).toBe('important');
        expect(pill.element.querySelector('.options')).toBeNull();
        expect(pill.element.textContent).toBe('Opus 5.5 · high');
        expect(document.activeElement).toBe(field);
        expect(told).toBe(1);
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
