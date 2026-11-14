/**
 * The choices a chat says with: one element in Pill Form.
 *
 * "Why not do it like anthropic does, where its a combined model+effort pill", "We don't need to show the picker
 * always", "Not as an overlay, but as a generalised 'pills above inputfields' form". At rest it says what is chosen,
 * joined (`Opus 5.5 · high`). Pressed, it takes its field's place with each choice's options, no words over them. An
 * option taken is what it says; it rests above the field again, and the field has the words.
 *
 * Personas:
 * - Tim: Happy path — it says what is chosen; pressed, its options in the field's place; one taken, it says that
 * - Spike: Edge cases — no choices, a value not among its options
 * - Jenny: Complex scenarios — beside a say field: hidden at rest, there while typing, kept while it is open
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { choicesFrom } from './choices';
import { declareSay, holdSay } from './say';
import { getForm } from '../dataset';

afterEach(() => { document.body.innerHTML = ''; });

const MODEL = { name: 'Model', options: ['Opus 5.5', 'Sonnet 5.5', 'Haiku 5.5'], value: 'Opus 5.5' };
const EFFORT = { name: 'Effort', options: ['low', 'medium', 'high', 'xhigh', 'max'], value: 'high' };
// "add another inputfieldpillmenu for attached repositories": more than one of them can be chosen.
const REPOSITORIES = { name: 'Repositories', options: ['QNTX', 'QNTX-Web', 'elements', 'ground'], chosen: ['QNTX', 'elements'], many: true as const };

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));
const option = (choices: HTMLElement, text: string) =>
    Array.from(choices.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === text)!;

/** A chat's row: the choices given to its say field, with a send press. */
function chat(onChoose?: (name: string, value: string) => void) {
    const element = document.createElement('div');
    element.dataset.elementId = 'xenon';
    const row = document.createElement('div');
    const field = document.createElement('textarea');
    const send = document.createElement('button');
    const choices = choicesFrom({ id: 'xenon-choices', label: 'Model and effort', choices: [MODEL, EFFORT], onChoose });
    declareSay(field, { end: send, pills: [choices] });
    row.append(field, send);
    element.appendChild(row);
    document.body.appendChild(element);
    holdSay(element);
    return { field, choices, box: field.closest<HTMLElement>('[data-say-box]')! };
}

describe('Tim: the choices', () => {
    test('are one element in Pill Form, saying what is chosen, joined', () => {
        const { choices } = chat();
        expect(getForm(choices)).toBe('pill');
        expect(choices.dataset.elementId).toBe('xenon-choices');
        expect(choices.textContent).toBe('Opus 5.5 · high');
    });

    test('pressed, its options are across its row in the input field, no words over them; the field stays', async () => {
        const { field, choices, box } = chat();
        field.focus();
        choices.click();
        await settled();

        expect(getForm(choices)).toBe('pillOpen');
        expect(box.contains(choices)).toBe(true);
        expect(box.contains(field)).toBe(true);
        expect(document.activeElement).toBe(field);
        // "the word labels being overly verbose, it isn't telling us anything we don't know": named for a screen reader only.
        const groups = Array.from(choices.querySelectorAll('[role="group"]')).map((g) => g.getAttribute('aria-label'));
        expect(groups).toEqual(['Model', 'Effort']);
        expect(choices.textContent).not.toContain('Model');
        expect(option(choices, 'high').getAttribute('aria-pressed')).toBe('true');
        expect(option(choices, 'max').getAttribute('aria-pressed')).toBe('false');
    });

    test('an option taken: it says it, the host is told, it rests, and the field has the words', async () => {
        const told: [string, string][] = [];
        const { field, choices, box } = chat((name, value) => told.push([name, value]));
        field.focus();
        choices.click();
        await settled();
        option(choices, 'max').click();
        await settled();

        expect(getForm(choices)).toBe('pill');
        expect(choices.textContent).toBe('Opus 5.5 · max');
        expect(told).toEqual([['Effort', 'max']]);
        expect(box.contains(choices)).toBe(true);
        expect(document.activeElement).toBe(field);
        expect(choices.hidden).toBe(false);
    });
});

describe('Tim: a choice of many, the attached repositories', () => {
    function repositories(onChoose?: (name: string, value: string, chosen: readonly string[]) => void) {
        const choices = choicesFrom({ id: 'xenon-repositories', label: 'Attached repositories', choices: [REPOSITORIES], onChoose });
        const field = document.createElement('textarea');
        declareSay(field, { pills: [choices] });
        const element = document.createElement('div');
        element.appendChild(field);
        document.body.appendChild(element);
        holdSay(element);
        return { choices, field };
    }

    test('it says what is attached, joined', () => {
        const { choices } = repositories();
        expect(choices.textContent).toBe('QNTX · elements');
    });

    test('an option taken is attached or let go, and it stays open for the next', async () => {
        const told: [string, string, string[]][] = [];
        const { choices } = repositories((name, value, chosen) => told.push([name, value, [...chosen]]));
        choices.click();
        await settled();
        option(choices, 'ground').click();
        await settled();
        expect(getForm(choices)).toBe('pillOpen');
        expect(option(choices, 'ground').getAttribute('aria-pressed')).toBe('true');
        option(choices, 'QNTX').click();
        await settled();
        expect(option(choices, 'QNTX').getAttribute('aria-pressed')).toBe('false');
        // Told what was taken, and what is attached now, in the order they are offered.
        expect(told).toEqual([['Repositories', 'ground', ['QNTX', 'elements', 'ground']], ['Repositories', 'QNTX', ['elements', 'ground']]]);
    });

    test('more than two attached: the first, and how many more', async () => {
        const { choices } = repositories();
        choices.click();
        await settled();
        option(choices, 'ground').click();
        option(choices, 'QNTX-Web').click();
        expect(choices.getAttribute('aria-label')).toBe('QNTX +3');
    });

    test('none attached: it says what it is', async () => {
        const { choices } = repositories();
        choices.click();
        await settled();
        option(choices, 'QNTX').click();
        option(choices, 'elements').click();
        expect(choices.getAttribute('aria-label')).toBe('Repositories');
    });
});

describe('Spike: what it is not given', () => {
    test('no choices is no pill', () => {
        expect(() => choicesFrom({ id: 'x', label: 'Nothing', choices: [] })).toThrow();
    });

    test('a value not among its options is said, not shown', () => {
        expect(() => choicesFrom({ id: 'x', label: 'Model', choices: [{ name: 'Model', options: ['Opus 5.5'], value: 'GPT' }] })).toThrow(/GPT/);
    });
});

describe('Jenny: beside a say field', () => {
    // "The input field pill should be inside of inputfield form."
    test('it rests in the input field, in the row under the words, hidden while nothing is being said', () => {
        const { field, choices, box } = chat();
        expect(choices.parentElement!.parentElement).toBe(box);
        expect(choices.parentElement).toBe(field.nextElementSibling);
        expect(choices.hidden).toBe(true);
    });

    test('there while the field has focus, gone when it is left empty', async () => {
        const { field, choices } = chat();
        field.focus();
        expect(choices.hidden).toBe(false);
        field.blur();
        await settled();
        expect(choices.hidden).toBe(true);
    });

    test('kept while the field holds words, focused or not', async () => {
        const { field, choices } = chat();
        field.value = 'think hard';
        field.dispatchEvent(new Event('input'));
        expect(choices.hidden).toBe(false);
        field.blur();
        await settled();
        expect(choices.hidden).toBe(false);
    });

    test('kept while it is open, though the field was left', async () => {
        const { field, choices } = chat();
        field.focus();
        choices.click();
        field.blur();
        await settled();
        expect(choices.hidden).toBe(false);
    });
});
