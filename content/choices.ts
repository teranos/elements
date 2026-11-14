/**
 * The choices a chat says with: an element in Pill Form (forms/pill.ts), in its input field.
 *
 * "Why not do it like anthropic does, where its a combined model+effort pill". At rest it says what is chosen, joined
 * (`Opus 5.5 · high`). Pressed, it is across its row and holds each choice's options, with no words over them:
 * "the word labels being overly verbose, it isn't telling us anything we don't know". An option of one taken is what
 * it says, the host is told, and it rests again; an option of many ("attached repositories") is chosen or let go, and
 * it stays open for the next. In a say field it shows only while something is being said (content/say.ts): "We don't
 * need to show the picker always".
 */

import { pillFrom } from '../forms/pill';

/** One of its options chosen: a model, an effort. */
export interface ChoiceOfOne {
    /** What is chosen, "Model", "Effort": its options' name for a screen reader, and what the host is told. */
    name: string;
    options: readonly string[];
    value: string;
}

/**
 * Any of its options chosen, none or all: "add another inputfieldpillmenu for attached repositories". An option taken
 * is chosen or let go, and the pill stays open for the next.
 */
export interface ChoiceOfMany {
    /** What is chosen, "Repositories": what the pill says when none is, and what the host is told. */
    name: string;
    options: readonly string[];
    chosen: readonly string[];
    many: true;
}

export type Choice = ChoiceOfOne | ChoiceOfMany;

export interface Choices {
    id: string;
    /** What the pill is, for a screen reader: "Model and effort". */
    label: string;
    choices: Choice[];
    /** Told the choice, the option taken, and what is chosen of it now, in the order offered, each time one is taken. */
    onChoose?: (name: string, value: string, chosen: readonly string[]) => void;
}

const OPTIONS: Record<string, string> = { display: 'flex', 'flex-wrap': 'wrap', gap: '4px' };

const ROUND: Record<string, string> = { 'border-radius': '9999px' };

function pin(node: HTMLElement, styles: Record<string, string>): void {
    for (const [name, value] of Object.entries(styles)) node.style.setProperty(name, value, 'important');
}

/** The choices as one element: a pill in its field, its options across its row when pressed. */
export function choicesFrom(c: Choices): HTMLElement {
    if (!c.choices.length) throw new TypeError(`choices ${c.id} chooses nothing: it has no choices`);
    const many = (choice: Choice): choice is ChoiceOfMany => 'many' in choice && choice.many === true;
    for (const choice of c.choices) {
        for (const value of many(choice) ? choice.chosen : [choice.value]) {
            if (!choice.options.includes(value)) {
                throw new TypeError(`choice ${choice.name} of ${c.id} is "${value}", which is not among its options: ${choice.options.join(', ')}`);
            }
        }
    }
    // What is chosen of each, in the order its options are offered.
    const chosen = new Map(c.choices.map((choice) => [choice.name, new Set(many(choice) ? choice.chosen : [choice.value])]));
    const ordered = (choice: Choice) => choice.options.filter((o) => chosen.get(choice.name)!.has(o));
    // Many chosen: two said, more the first and how many more; none, what it is.
    const says = (choice: Choice) => {
        const are = ordered(choice);
        if (!are.length) return choice.name;
        return are.length > 2 ? `${are[0]} +${are.length - 1}` : are.join(' · ');
    };
    const words = () => c.choices.map(says).join(' · ');
    const presses: HTMLButtonElement[] = [];
    const mark = () => {
        for (const press of presses) press.setAttribute('aria-pressed', String(chosen.get(press.dataset.choice!)!.has(press.textContent!)));
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
                        const of = chosen.get(choice.name)!;
                        if (!many(choice)) { of.clear(); of.add(value); }
                        else if (of.has(value)) of.delete(value);
                        else of.add(value);
                        mark();
                        pill.retitle(words());
                        c.onChoose?.(choice.name, value, ordered(choice));
                        // One of one taken, it rests; one of many, it stays open for the next.
                        if (!many(choice)) pill.rest();
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
