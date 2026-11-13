/**
 * The field a chat says from takes the bottom, whenever the host draws it.
 *
 * QNTX-Web draws its Node Agent's chat after the element opens: it asks the node which harnesses it offers first.
 * The field arrived after the package had looked for it, so its row was never pinned and a panel never gave it the
 * home bar's strip.
 *
 * Personas:
 * - Tim: Happy path — a field drawn with the element: its row is pinned at once
 * - Spike: Edge cases — an element that never says from a field is left alone
 * - Jenny: Complex scenarios — a field drawn later: its row is pinned when it arrives, and the element is told
 */

import { describe, test, expect } from 'bun:test';
import { declareSay, holdSay, SAY_HELD } from './say';

function chatElement(withField: boolean): { element: HTMLElement; body: HTMLElement } {
    const element = document.createElement('div');
    const body = document.createElement('div');
    body.dataset.scroller = 'body';
    element.appendChild(body);
    if (withField) body.appendChild(rowWithField());
    document.body.appendChild(element);
    return { element, body };
}

function rowWithField(): HTMLElement {
    const row = document.createElement('div');
    const field = document.createElement('textarea');
    declareSay(field);
    row.appendChild(field);
    return row;
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Tim: a field drawn with the element', () => {
    test('its row is pinned at the bottom at once', () => {
        const { element, body } = chatElement(true);
        holdSay(element);
        const row = body.firstElementChild as HTMLElement;
        expect(row.style.getPropertyValue('position')).toBe('sticky');
        expect(row.style.getPropertyValue('bottom')).toBe('0px');
    });
});

describe('Spike: an element that says from no field', () => {
    test('is left alone, and told nothing', async () => {
        const { element, body } = chatElement(false);
        let told = 0;
        element.addEventListener(SAY_HELD, () => told++);
        holdSay(element);
        body.appendChild(document.createElement('p'));
        await settled();
        expect(told).toBe(0);
    });
});

describe('Jenny: a field drawn after the element opened', () => {
    test('its row is pinned when it arrives, and the element is told', async () => {
        const { element, body } = chatElement(false);
        let told = 0;
        element.addEventListener(SAY_HELD, () => told++);
        holdSay(element);

        // The host asks the node first, then draws its chat.
        const talk = document.createElement('div');
        body.appendChild(talk);
        const row = rowWithField();
        talk.appendChild(row);
        await settled();

        expect(row.style.getPropertyValue('position')).toBe('sticky');
        expect(told).toBe(1);
    });
});

// Purple arrows on a screenshot: the + into the field's bottom-left corner, the → into its bottom-right. "And how
// often do you want me to complain about the positions of these buttons". A field's presses are in its box, not on
// the line above it.
describe('Tim: a field with its presses', () => {
    test('the + and the → are in the field\'s box, at its bottom corners, and the words leave them room', () => {
        const element = document.createElement('div');
        const body = document.createElement('div');
        body.dataset.scroller = 'body';
        const row = document.createElement('div');
        const choice = document.createElement('select');
        const field = document.createElement('textarea');
        const attach = document.createElement('button');
        const send = document.createElement('button');
        declareSay(field, { start: attach, end: send });
        row.append(choice, attach, send, field);
        body.appendChild(row);
        element.appendChild(body);
        document.body.appendChild(element);

        holdSay(element);

        const box = field.parentElement!;
        expect(box.dataset.sayBox).toBe('');
        expect(attach.parentElement).toBe(box);
        expect(send.parentElement).toBe(box);
        expect(choice.parentElement).toBe(row);
        expect(attach.style.getPropertyValue('position')).toBe('absolute');
        expect(attach.style.getPropertyValue('left')).not.toBe('');
        expect(send.style.getPropertyValue('right')).not.toBe('');
        // The line the presses stand on is kept under the words (happy-dom drops a calc() with a var() in it; a
        // browser holds it, browser/say-field.browser.ts).
        expect(field.style.getPropertyValue('--elements-say-room')).not.toBe('');
    });
});
