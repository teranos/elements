/**
 * The choices a chat says with: an element in Pill Form (forms/pill.ts).
 *
 * "Why not do it like anthropic does, where its a combined model+effort pill". At rest it says what is chosen, joined
 * (`Opus 5.5 · high`). Pressed, it takes its field's place and holds each choice's options, with no words over them:
 * "the word labels being overly verbose, it isn't telling us anything we don't know". An option taken is what it says,
 * the host is told, and it rests again above the field. Beside a say field it shows only while something is being
 * said (content/say.ts): "We don't need to show the picker always".
 */

import { pillFrom } from '../forms/pill';

export interface Choice {
    /** What is chosen, "Model", "Effort": its options' name for a screen reader, and what the host is told. */
    name: string;
    options: readonly string[];
    value: string;
}

export interface Choices {
    id: string;
    /** What the pill is, for a screen reader: "Model and effort". */
    label: string;
    choices: Choice[];
    /** Told the choice and what it now is, each time one is taken. */
    onChoose?: (name: string, value: string) => void;
}

const OPTIONS: Record<string, string> = { display: 'flex', 'flex-wrap': 'wrap', gap: '4px' };

const ROUND: Record<string, string> = { 'border-radius': '9999px' };

function pin(node: HTMLElement, styles: Record<string, string>): void {
    for (const [name, value] of Object.entries(styles)) node.style.setProperty(name, value, 'important');
}

/** The choices as one element: a pill above its field, its options in the field's place when pressed. */
export function choicesFrom(c: Choices): HTMLElement {
    if (!c.choices.length) throw new TypeError(`choices ${c.id} chooses nothing: it has no choices`);
    for (const choice of c.choices) {
        if (!choice.options.includes(choice.value)) {
            throw new TypeError(`choice ${choice.name} of ${c.id} is "${choice.value}", which is not among its options: ${choice.options.join(', ')}`);
        }
    }
    const chosen = new Map(c.choices.map((choice) => [choice.name, choice.value]));
    const words = () => c.choices.map((choice) => chosen.get(choice.name)!).join(' · ');
    const presses: HTMLButtonElement[] = [];
    const mark = () => {
        for (const press of presses) press.setAttribute('aria-pressed', String(chosen.get(press.dataset.choice!) === press.textContent));
    };

    const pill = pillFrom({
        id: c.id,
        title: words(),
        renderContent: () => {
            const all = document.createElement('div');
            pin(all, { display: 'flex', 'flex-direction': 'column', gap: '4px' });
            for (const choice of c.choices) {
                // No words over its options: they say what they are. Named for a screen reader.
                const options = document.createElement('div');
                options.setAttribute('role', 'group');
                options.setAttribute('aria-label', choice.name);
                pin(options, OPTIONS);
                for (const value of choice.options) {
                    const press = document.createElement('button');
                    press.type = 'button';
                    press.dataset.choice = choice.name;
                    press.textContent = value;
                    pin(press, ROUND);
                    press.addEventListener('click', () => {
                        chosen.set(choice.name, value);
                        mark();
                        pill.retitle(words());
                        c.onChoose?.(choice.name, value);
                        pill.rest();
                    });
                    presses.push(press);
                    options.appendChild(press);
                }
                all.appendChild(options);
            }
            mark();
            return all;
        },
    });
    pill.element.dataset.choices = c.id;
    pill.element.title = c.label;
    return pill.element;
}
