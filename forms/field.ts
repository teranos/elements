// Field: one line of text a person types into, with its label. The package's only field but the chat's (content/say.ts).

// "and elements should own all inputfields"
// "and most other inputfields can just be one thing Element owns and is enforced that consymers cant do their own inputfields anymore"

import { preventDrag } from '../canvas/drag';
import { sizeText } from '../text';
import { MEANS } from './press';

/** The keyboard a phone brings up for it: the one thing a field varies by. */
export const KEYBOARDS: readonly ['text', 'email', 'tel'] = Object.freeze(['text', 'email', 'tel'] as const);

export type Keyboard = typeof KEYBOARDS[number];

export interface Field {
    /** Its name: data-field, and the input's id. */
    id: string;
    /** What it asks for, shown above it: a placeholder is gone once someone types. */
    label: string;
    placeholder?: string;
    value?: string;
    /** Default text. */
    keyboard?: Keyboard;
}

export interface FieldHandle {
    /** The label and the input, to put where a field goes. */
    element: HTMLElement;
    /** What a failure is said at: throw AtField(input, ...) from a press's does. */
    input: HTMLInputElement;
}

const KEYS = new Set(['id', 'label', 'placeholder', 'value', 'keyboard']);

/** Each field's own id, so two fields of one name in a page are two inputs a label each points to. */
let fields = 0;

/** What a caller with no types is stopped on, where the compiler stops a typed one. */
function refuse(field: Field): void {
    const said = field as unknown as Record<string, unknown>;
    const unknown = Object.keys(said).filter((key) => !KEYS.has(key));
    if (unknown.length) throw new TypeError(`a field has no ${unknown.join(', ')}; it says ${[...KEYS].join(', ')}`);
    if (typeof said.id !== 'string' || !said.id) throw new TypeError('a field has a name: its id');
    if (typeof said.label !== 'string' || !said.label) throw new TypeError(`field ${said.id} asks for nothing: it has no label`);
    if (said.keyboard !== undefined && !KEYBOARDS.includes(said.keyboard as Keyboard)) {
        throw new TypeError(`field ${said.id}: "${String(said.keyboard)}" is not a keyboard; the keyboards are ${KEYBOARDS.join(', ')}`);
    }
}

// Written important on the node itself: no stylesheet, layered or not, says otherwise.
function pin(node: HTMLElement, styles: Record<string, string>): void {
    for (const [name, value] of Object.entries(styles)) node.style.setProperty(name, value, 'important');
}

/** A field, to put where an input goes. */
export function fieldFrom(field: Field): FieldHandle {
    refuse(field);
    const element = document.createElement('div');
    element.dataset.field = field.id;
    pin(element, { display: 'flex', 'flex-direction': 'column', gap: '4px', 'min-width': '0' });

    const input = document.createElement('input');
    input.id = `elements-field-${field.id}-${++fields}`;
    input.type = field.keyboard ?? 'text';
    if (field.placeholder !== undefined) input.placeholder = field.placeholder;
    if (field.value !== undefined) input.value = field.value;
    // The press's look: black, square, a 2px white outline, and as tall as a finger (WCAG 2.2, 2.5.8).
    pin(input, {
        'box-sizing': 'border-box',
        width: '100%',
        'min-width': '0',
        'min-height': '44px',
        padding: '8px 12px',
        'border-width': '2px',
        'border-style': 'solid',
        'border-color': MEANS.neither,
        'border-radius': '0',
        'background-color': '#000',
        color: MEANS.neither,
        'font-family': 'inherit',
    });
    preventDrag(input);

    const label = document.createElement('label');
    label.htmlFor = input.id;
    label.textContent = field.label;
    sizeText(label, 'sm');

    element.append(label, input);
    return { element, input };
}
