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
// 「[Opus 5.5] what is typed, the → at its end, on one line.」
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
        // 「[Opus 5.5] The words take what the presses leave, in their place between them.」
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

// "Inputfield an element yes, new form, inputfield." "The input field pill should be inside of inputfield form."
// 「[Opus 5.5] Claude's composer with a pill in it: the words on top, under them a row of the +, the pill, and the → at the end.」
describe('Tim: an input field', () => {
    function inputField(withPill: boolean) {
        const element = document.createElement('div');
        const body = document.createElement('div');
        body.dataset.scroller = 'body';
        const row = document.createElement('div');
        const field = document.createElement('textarea');
        field.dataset.sayId = 'xenon-says';
        const attach = document.createElement('button');
        const send = document.createElement('button');
        const pill = document.createElement('div');
        const other = document.createElement('div');
        declareSay(field, withPill ? { start: attach, end: send, pills: [pill, other] } : { start: attach, end: send });
        row.append(attach, field, send);
        body.appendChild(row);
        element.appendChild(body);
        document.body.appendChild(element);
        holdSay(element);
        return { field, attach, send, pill, other, box: field.parentElement! };
    }

    test('is an element of its own, in the inputfield form', () => {
        const { box } = inputField(false);
        expect(box.dataset.elementId).toBe('xenon-says-input');
        expect(box.dataset.form).toBe('inputfield');
    });

    // "The pills should be above, and outside of inputfield area", as the Claude app's are: the input field is one line,
    // 「[Opus 5.5] the + first, the words, the → last; its pills in a strip of their own above it, in the order given.」
    test('with pills: the input field one line; its pills in a strip above it, outside it, in order', () => {
        const { field, attach, send, pill, other, box } = inputField(true);
        expect(box.dataset.form).toBe('inputfield');
        // 「[Opus 5.5] Named, not compared as nodes: a node that differs is printed whole, with all it holds.」
        const named = new Map<unknown, string>([[attach, '+'], [field, 'words'], [send, '→'], [pill, 'pill'], [other, 'other']]);
        expect(Array.from(box.children).map((n) => named.get(n) ?? '?')).toEqual(['+', 'words', '→']);
        const strip = box.previousElementSibling as HTMLElement;
        expect(strip.dataset.sayPills).toBe('');
        expect(box.contains(strip)).toBe(false);
        expect(Array.from(strip.children).map((n) => named.get(n) ?? '?')).toEqual(['pill', 'other']);
    });

    // "normally you're able to drag pills sideways in most applications": one line, dragged sideways, never wrapped.
    test('its pills\' strip is one line that scrolls sideways', () => {
        const { box } = inputField(true);
        const strip = box.previousElementSibling as HTMLElement;
        expect(strip.dataset.scroller).toBe('sideways');
        expect(strip.style.getPropertyValue('overflow-x')).toBe('auto');
        expect(strip.style.getPropertyValue('flex-wrap')).toBe('nowrap');
    });

    // "IF THERE ARE MESSAGES PENDING TO BE SENT, AS A COLLECTED BATCH, I SEE IT": what waits is a pill, not an overlay
    // "taking over everything for no good reason". It is first, and seen whether or not anything is being said.
    test('what waits is first among its pills, seen though nothing is being said', () => {
        const element = document.createElement('div');
        const field = document.createElement('textarea');
        const attach = document.createElement('button');
        const waits = document.createElement('div');
        const choices = document.createElement('div');
        declareSay(field, { start: attach, waiting: [waits], pills: [choices] });
        element.appendChild(field);
        document.body.appendChild(element);
        holdSay(element);
        const strip = field.parentElement!.previousElementSibling as HTMLElement;
        const named = new Map<unknown, string>([[waits, 'waits'], [choices, 'choices']]);
        expect(Array.from(strip.children).map((n) => named.get(n) ?? '?')).toEqual(['waits', 'choices']);
        expect(choices.hidden).toBe(true);
        expect(waits.hidden).toBe(false);
    });
});

// 「[Opus 5.5] CodeRabbit on #115: "Evaluate pill visibility when the listeners are installed." "Move the pill strip with an existing」
// 「[Opus 5.5] inputfield box."」
describe('Spike: pills of a field that already says something, or has moved', () => {
    test('a field declared with words in it shows its pills', () => {
        const field = document.createElement('textarea');
        field.value = 'half a sentence';
        const choices = document.createElement('div');
        declareSay(field, { pills: [choices] });
        expect(choices.hidden).toBe(false);
    });

    test('a field declared while it has the focus shows its pills', () => {
        const field = document.createElement('textarea');
        document.body.appendChild(field);
        field.focus();
        const choices = document.createElement('div');
        declareSay(field, { pills: [choices] });
        expect(choices.hidden).toBe(false);
        field.remove();
    });

    test('its input field moved into another row: its pills go with it, above it', async () => {
        const { element, body } = chatElement(false);
        const field = document.createElement('textarea');
        const choices = document.createElement('div');
        declareSay(field, { pills: [choices] });
        const first = document.createElement('div');
        first.appendChild(field);
        body.appendChild(first);
        holdSay(element);
        const box = field.parentElement!;
        const strip = box.previousElementSibling as HTMLElement;
        expect(strip.dataset.sayPills).toBe('');

        const next = document.createElement('div');
        next.appendChild(box);
        body.replaceChildren(next);
        await settled();

        expect(box.previousElementSibling).toBe(strip);
        expect(strip.parentElement).toBe(next);
    });
});

// CodeRabbit on #115, after #114: "Pin the pill strip together with the input box in the direct-child case." "Remove the
// pill strip when its inputfield box is removed." "Preserve focus when pills trigger field wrapping."
describe('Jenny: the pills and their input field, as one', () => {
    test('a field straight in the body: its pills and its input field are pinned together, the pills above', () => {
        const { element, body } = chatElement(false);
        const field = document.createElement('textarea');
        const choices = document.createElement('div');
        declareSay(field, { pills: [choices] });
        body.appendChild(field);
        holdSay(element);
        const box = field.parentElement!;
        const strip = choices.parentElement!;
        const together = box.parentElement!;
        expect(together).not.toBe(body);
        expect(strip.parentElement).toBe(together);
        expect(strip.nextElementSibling).toBe(box);
        expect(together.style.getPropertyValue('position')).toBe('sticky');
    });

    test('its input field taken away, its pills go with it', async () => {
        const { element, body } = chatElement(false);
        const field = document.createElement('textarea');
        const waits = document.createElement('div');
        declareSay(field, { waiting: [waits] });
        const row = document.createElement('div');
        row.appendChild(field);
        body.appendChild(row);
        holdSay(element);
        field.parentElement!.remove();
        await settled();
        expect(waits.isConnected).toBe(false);
    });

    test('a field that has the focus keeps it, and where the caret was, when it is wrapped', () => {
        const { element, body } = chatElement(false);
        const field = document.createElement('textarea');
        field.value = 'half a sentence';
        body.appendChild(field);
        field.focus();
        field.setSelectionRange(4, 6);
        declareSay(field, { pills: [document.createElement('div')] });
        holdSay(element);
        expect(field.parentElement!.dataset.sayBox).toBe('');
        expect(document.activeElement).toBe(field);
        expect([field.selectionStart, field.selectionEnd]).toEqual([4, 6]);
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
