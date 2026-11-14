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
import { declareSay, holdSay, SAY_HELD, SAY_INSET } from './say';

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

// "This i want", "I want this only", "LOOK AT THIS THE SHAPE": the Claude app's composer. One pill, the + at its start,
// what is typed, the → at its end, on one line.
describe('Tim: a field with its presses', () => {
    test('is one pill: the + first, the words, the → last; what else the host put there stays in the row', () => {
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
        expect(Array.from(box.children)).toEqual([attach, field, send]);
        expect(box.style.getPropertyValue('display')).toBe('flex');
        expect(box.style.getPropertyValue('align-items')).toBe('center');
        expect(box.style.getPropertyValue('padding')).toBe(`${SAY_INSET}px`);
        expect(choice.parentElement).toBe(row);
        // The words take what the presses leave, in their place between them.
        expect(field.style.getPropertyValue('order')).toBe('0');
        expect(field.style.getPropertyValue('flex')).toBe('1 1 auto');
    });

    test('its presses are the package\'s: marked, so the pill\'s rule sizes them, not what they hold', () => {
        const field = document.createElement('textarea');
        const attach = document.createElement('button');
        const send = document.createElement('button');
        declareSay(field, { start: attach, end: send });
        const row = document.createElement('div');
        row.append(attach, field, send);
        const element = document.createElement('div');
        element.appendChild(row);
        document.body.appendChild(element);

        holdSay(element);

        expect(attach.dataset.sayPress).toBe('');
        expect(send.dataset.sayPress).toBe('');
    });
});

// Qodo on #114: "Switched chats obscure typed text", "Removing a chat field exposes bottom controls". QNTX-Web draws a
// new chat, its own field, when a harness tab is pressed; a host may take its chat away. The element is held to the
// field it has now, whichever that is, and told each time it changes.
describe('Jenny: the field changes while the element is open', () => {
    test('a field drawn in place of the first is pinned, and the element told again', async () => {
        const { element, body } = chatElement(true);
        let told = 0;
        element.addEventListener(SAY_HELD, () => told++);
        holdSay(element);
        expect(told).toBe(1);

        const next = rowWithField();
        body.replaceChildren(next);
        await settled();

        expect(next.style.getPropertyValue('position')).toBe('sticky');
        expect(told).toBe(2);
    });

    test('a field taken away tells the element, so it gives back what it gave the field', async () => {
        const { element, body } = chatElement(true);
        let told = 0;
        element.addEventListener(SAY_HELD, () => told++);
        holdSay(element);

        body.replaceChildren(document.createElement('p'));
        await settled();

        expect(told).toBe(2);
    });

    test('what changes around the same field tells nothing', async () => {
        const { element, body } = chatElement(true);
        let told = 0;
        element.addEventListener(SAY_HELD, () => told++);
        holdSay(element);

        body.appendChild(document.createElement('p'));
        await settled();

        expect(told).toBe(1);
    });
});

// Qodo on #114: "Moved chat fields lose their bottom row". A host may move the field it has into another row.
describe('Jenny: the same field, moved', () => {
    test('into another row: that row is pinned', async () => {
        const { element, body } = chatElement(true);
        holdSay(element);
        const field = element.querySelector<HTMLElement>('[data-say]')!;

        const next = document.createElement('div');
        next.appendChild(field);
        body.replaceChildren(next);
        await settled();

        expect(next.style.getPropertyValue('position')).toBe('sticky');
    });
});

// Qodo on #114: "Late-declared chat fields stay unpinned". A host may put its field in first and declare it after.
describe('Jenny: a field declared after it was put in', () => {
    test('is pinned when it is declared, and the element told', async () => {
        const { element, body } = chatElement(false);
        let told = 0;
        element.addEventListener(SAY_HELD, () => told++);
        holdSay(element);
        const row = document.createElement('div');
        const field = document.createElement('textarea');
        row.appendChild(field);
        body.appendChild(row);
        await settled();

        declareSay(field);
        await settled();

        expect(row.style.getPropertyValue('position')).toBe('sticky');
        expect(told).toBe(1);
    });
});

// Qodo on #114: "Confirmation text shifts chat fields". A two-stage press says its confirmation and its failure right
// after itself (forms/press.ts); in the field's box that pushed the field up. What a press says goes to the row,
// above the field, as what else the host put beside it does.
describe('Spike: what a press says after itself', () => {
    test('is not in the field\'s box, but in its row', async () => {
        const element = document.createElement('div');
        const body = document.createElement('div');
        body.dataset.scroller = 'body';
        const row = document.createElement('div');
        const field = document.createElement('textarea');
        const send = document.createElement('button');
        declareSay(field, { end: send });
        row.append(send, field);
        body.appendChild(row);
        element.appendChild(body);
        document.body.appendChild(element);
        holdSay(element);

        const said = document.createElement('span');
        send.after(said);
        await settled();

        expect(said.parentElement).toBe(row);
        expect(send.parentElement!.dataset.sayBox).toBe('');
    });
});
