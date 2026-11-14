/**
 * The choices a chat says with, as one pill: what is chosen, joined, and pressed, the lists to choose from.
 *
 * "Why not do it like anthropic does, where its a combined model+effort pill", "We don't need to show the picker
 * always". One pill reads what is chosen (`Opus 5.5 · high`); pressed, it opens a sheet above itself with each choice's
 * options; a choice taken closes it. Beside a say field it shows only while something is being said: the field has
 * focus or words, or its sheet is open.
 *
 * Personas:
 * - Tim: Happy path — the pill reads what is chosen; pressed, the sheet; an option taken, the pill reads it
 * - Spike: Edge cases — no choices, a value not among its options, Escape, a press outside
 * - Jenny: Complex scenarios — beside a say field: hidden at rest, there while typing, kept while its sheet is open
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { choicesFrom } from './choices';
import { declareSay, holdSay } from './say';

afterEach(() => { document.body.innerHTML = ''; });

const MODEL = { name: 'Model', options: ['Opus 5.5', 'Sonnet 5.5', 'Haiku 5.5'], value: 'Opus 5.5' };
const EFFORT = { name: 'Effort', options: ['low', 'medium', 'high', 'xhigh', 'max'], value: 'high' };

const pillOf = (choices: HTMLElement) => choices.querySelector<HTMLButtonElement>('[data-choices-pill]')!;
const sheetOf = (choices: HTMLElement) => choices.querySelector<HTMLElement>('[data-choices-sheet]')!;
const option = (choices: HTMLElement, text: string) =>
    Array.from(sheetOf(choices).querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === text)!;

describe('Tim: the pill', () => {
    test('reads what is chosen, joined, and is labelled for a screen reader', () => {
        const choices = choicesFrom({ id: 'xenon-choices', label: 'Model and effort', choices: [MODEL, EFFORT] });
        expect(pillOf(choices).textContent).toBe('Opus 5.5 · high');
        expect(pillOf(choices).getAttribute('aria-label')).toBe('Model and effort: Opus 5.5 · high');
        expect(sheetOf(choices).hidden).toBe(true);
    });

    test('pressed, opens its sheet: each choice\'s options, what is chosen marked', () => {
        const choices = choicesFrom({ id: 'xenon-choices', label: 'Model and effort', choices: [MODEL, EFFORT] });
        document.body.appendChild(choices);
        pillOf(choices).click();

        expect(sheetOf(choices).hidden).toBe(false);
        expect(sheetOf(choices).style.display).toBe('flex');
        expect(pillOf(choices).getAttribute('aria-expanded')).toBe('true');
        // "the word labels being overly verbose, it isn't telling us anything we don't know": no words over the options;
        // each group is named for a screen reader.
        expect(sheetOf(choices).querySelector('[data-choices-name]')).toBeNull();
        const groups = Array.from(sheetOf(choices).querySelectorAll('[role="group"]')).map((g) => g.getAttribute('aria-label'));
        expect(groups).toEqual(['Model', 'Effort']);
        expect(option(choices, 'high').getAttribute('aria-pressed')).toBe('true');
        expect(option(choices, 'max').getAttribute('aria-pressed')).toBe('false');
    });

    test('an option taken: the pill reads it, the host is told, the sheet closes', () => {
        const told: [string, string][] = [];
        const choices = choicesFrom({ id: 'xenon-choices', label: 'Model and effort', choices: [MODEL, EFFORT], onChoose: (name, value) => told.push([name, value]) });
        document.body.appendChild(choices);
        pillOf(choices).click();
        option(choices, 'max').click();

        expect(pillOf(choices).textContent).toBe('Opus 5.5 · max');
        expect(told).toEqual([['Effort', 'max']]);
        expect(sheetOf(choices).hidden).toBe(true);
        // Hidden in a browser too, where a display written important outranks the attribute.
        expect(sheetOf(choices).style.display).toBe('none');
    });
});

// Off the right edge on a phone: "Haiku 5.5" and "max" were cut. The sheet spans the row it stands over, and its
// options wrap inside it.
describe('Tim: the sheet', () => {
    test('spans the row it stands over', () => {
        const choices = choicesFrom({ id: 'xenon-choices', label: 'Model and effort', choices: [MODEL, EFFORT] });
        expect(sheetOf(choices).style.getPropertyValue('left')).toBe('0px');
        expect(sheetOf(choices).style.getPropertyValue('right')).toBe('0px');
        expect(sheetOf(choices).style.getPropertyValue('width')).toBe('auto');
    });
});

describe('Spike: what it is not given, and how it is left', () => {
    test('no choices is no pill', () => {
        expect(() => choicesFrom({ id: 'x', label: 'Nothing', choices: [] })).toThrow();
    });

    test('a value not among its options is said, not shown', () => {
        expect(() => choicesFrom({ id: 'x', label: 'Model', choices: [{ name: 'Model', options: ['Opus 5.5'], value: 'GPT' }] })).toThrow(/GPT/);
    });

    test('Escape closes the sheet, and nothing is chosen', () => {
        const choices = choicesFrom({ id: 'xenon-choices', label: 'Model and effort', choices: [MODEL, EFFORT] });
        document.body.appendChild(choices);
        pillOf(choices).click();
        sheetOf(choices).dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(sheetOf(choices).hidden).toBe(true);
        expect(pillOf(choices).textContent).toBe('Opus 5.5 · high');
    });

    test('a press outside closes the sheet', () => {
        const choices = choicesFrom({ id: 'xenon-choices', label: 'Model and effort', choices: [MODEL, EFFORT] });
        document.body.appendChild(choices);
        pillOf(choices).click();
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(sheetOf(choices).hidden).toBe(true);
    });
});

describe('Jenny: beside a say field', () => {
    function chat() {
        const element = document.createElement('div');
        const row = document.createElement('div');
        const field = document.createElement('textarea');
        const send = document.createElement('button');
        const choices = choicesFrom({ id: 'xenon-choices', label: 'Model and effort', choices: [MODEL, EFFORT] });
        declareSay(field, { end: send, choices });
        row.append(field, send);
        element.appendChild(row);
        document.body.appendChild(element);
        holdSay(element);
        return { field, choices };
    }
    const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

    test('it stands in the row, above the pill, hidden while nothing is being said', () => {
        const { field, choices } = chat();
        expect(choices.nextElementSibling).toBe(field.closest('[data-say-box]'));
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

    test('an option taken, the field has the words again, and the pill stays', async () => {
        const { field, choices } = chat();
        field.focus();
        pillOf(choices).click();
        field.blur();
        option(choices, 'max').click();
        await settled();
        expect(field.ownerDocument.activeElement).toBe(field);
        expect(choices.hidden).toBe(false);
    });

    test('kept while its sheet is open, though the field was left', async () => {
        const { field, choices } = chat();
        field.focus();
        pillOf(choices).click();
        field.blur();
        await settled();
        expect(choices.hidden).toBe(false);
    });
});
