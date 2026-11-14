/**
 * The field a chat says from takes the bottom.
 *
 * "making the inputfield take up the entire bottom of the screen for chat
 * elements like claude or pi" (#40). A host declares its field; the package gives
 * it the last line of its row to itself, the whole width, and keeps the row at the
 * bottom of the element while what was said scrolls above it. What the host put
 * beside the field wraps above it. Written important: no host stylesheet squeezes it.
 */

import { sheetOpen, CHOICES_CLOSED, CHOICE_TAKEN } from './choices';

const FIELD: Record<string, string> = {
    flex: '1 1 100%', width: '100%', 'min-width': '0', 'max-width': 'none',
    order: '99', 'box-sizing': 'border-box', margin: '0',
};

const ROW: Record<string, string> = {
    'flex-wrap': 'wrap', position: 'sticky', bottom: '0', 'z-index': '1',
};

/**
 * The presses a field says with: the + at its start, the → at its end.
 *
 * "And how often do you want me to complain about the positions of these buttons". "This i want", "I want this
 * only": the Claude app's composer, one pill, the + at its start, what is typed, the → (■ while it answers) at its
 * end, all on one line.
 */
export interface SayPresses {
    start?: HTMLElement;
    end?: HTMLElement;
    /** The choices it says with (choicesFrom, content/choices.ts): above the pill, only while something is being said. */
    choices?: HTMLElement;
}

const presses = new WeakMap<HTMLElement, SayPresses>();


/** The Claude app's composer, measured from its screenshots on #114 at 3px a point: a 36pt press, 8pt in from the pill's edge. */
export const SAY_PRESS = 36;
export const SAY_INSET = 8;

/** The pill the field and its presses are: one line, rounded whole, its presses SAY_INSET in. Literals: a const made of another is undefined in a Bun bundle. */
const PILL: Record<string, string> = {
    display: 'flex', 'align-items': 'center', gap: '8px', padding: '8px', 'border-radius': '9999px',
};

/** The field in the pill: the words, on the pill's surface. */
const IN_PILL: Record<string, string> = {
    flex: '1 1 auto', width: 'auto', 'min-width': '0', display: 'block', 'align-self': 'center', order: '0',
};

/** A host's word that this field is the one its element says from, with its presses. Callable before it is in an element. */
export function declareSay(field: HTMLElement, with_?: SayPresses): void {
    field.dataset.say = '';
    for (const [name, value] of Object.entries(FIELD)) field.style.setProperty(name, value, 'important');
    if (with_?.start || with_?.end || with_?.choices) presses.set(field, with_);
    if (with_?.choices) whileSaying(field, with_.choices);
}

/**
 * "We don't need to show the picker always": the choices show while something is being said, the field focused or
 * holding words, and while their own sheet is open; otherwise they are gone.
 */
function whileSaying(field: HTMLElement, choices: HTMLElement): void {
    const words = () => ((field as HTMLTextAreaElement).value ?? '').trim() !== '';
    const look = () => {
        const doc = field.ownerDocument;
        choices.hidden = !(doc.activeElement === field || words() || sheetOpen(choices) || choices.contains(doc.activeElement));
    };
    choices.hidden = true;
    field.addEventListener('focus', look);
    field.addEventListener('input', look);
    // Left for the pill: the press lands before it is looked at again.
    field.addEventListener('blur', () => setTimeout(look, 0));
    choices.addEventListener('focusout', () => setTimeout(look, 0));
    choices.addEventListener(CHOICES_CLOSED, look);
    // A choice taken is part of saying something: the field has the words again, as Claude's does.
    choices.addEventListener(CHOICE_TAKEN, () => { field.focus(); look(); });
}

// "i think chatfield soudl be considered different from regular inputfied"

/** The field a chat says from, the package's own: lines of text, named by its label, declared the element's. */
export function sayFrom(say: { id: string; label: string } & SayPresses): HTMLTextAreaElement {
    if (typeof say.id !== 'string' || !say.id) throw new TypeError('a chat field has a name: its id');
    if (typeof say.label !== 'string' || !say.label) throw new TypeError(`chat field ${say.id} says nothing of what it is: it has no label`);
    const field = document.createElement('textarea');
    field.rows = 1;
    field.dataset.sayId = say.id;
    // No room above it for a label: its name is read out, and shown until it is typed over.
    field.setAttribute('aria-label', say.label);
    field.placeholder = say.label;
    declareSay(field, say);
    return field;
}

/** What an element is told when the field it says from changes: a panel keeps nothing of its body under it (forms/panel.ts). */
export const SAY_HELD = 'elements:say-held';

/** The field each element is held to now, whichever it is. */
const holding = new WeakMap<HTMLElement, { field: HTMLElement | null; row: HTMLElement | null }>();

/**
 * The field's box holds the field and its presses, nothing else. What a press says after itself (a two-stage press's
 * confirmation, its failure: forms/press.ts) goes into the row, above the field, as what else the host put beside it.
 */
function keepBoxToItsOwn(field: HTMLElement): void {
    const box = field.parentElement;
    if (box?.dataset.sayBox !== '') return;
    const own = presses.get(field);
    for (const child of Array.from(box.children)) {
        if (child !== field && child !== own?.start && child !== own?.end) box.before(child);
    }
}

/** The row a field stands in: its box's, when it has one. */
function rowOf(field: HTMLElement): HTMLElement | null {
    const box = field.parentElement?.dataset.sayBox === '' ? field.parentElement : field;
    return box.parentElement;
}

/**
 * The declared field's row, at the bottom of this element, worn in the element's own colour.
 *
 * A host may draw its field after the element opened: QNTX-Web's Node Agent asks the node which harnesses it offers
 * first. It may draw another in its place: a harness tab pressed draws that harness's chat, its own field. It may take
 * it away. The element is held to the field it has now, and told each time that changes (SAY_HELD).
 */
export function holdSay(element: HTMLElement): void {
    if (holding.has(element)) return;
    const hold: { field: HTMLElement | null; row: HTMLElement | null } = { field: null, row: null };
    holding.set(element, hold);
    const look = () => {
        const field = element.querySelector<HTMLElement>('[data-say]');
        if (field) keepBoxToItsOwn(field);
        const row = field ? rowOf(field) : null;
        if (field === hold.field && row === hold.row) return;
        const changed = field !== hold.field;
        hold.field = field;
        if (field) pinSay(element, field);
        // Its row, once pinned: the same field moved into another row is pinned there too.
        hold.row = field ? rowOf(field) : null;
        if (changed) tell(element);
    };
    look();
    // A field put in first and declared after is found when it is declared.
    if (typeof MutationObserver === 'function') {
        new MutationObserver(look).observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-say'] });
    }
}

/** Tells the element its field changed (forms/panel.ts). */
function tell(element: HTMLElement): void {
    // The element's own window makes the event: a document's events are its window's.
    const view = element.ownerDocument.defaultView ?? window;
    element.dispatchEvent(new view.Event(SAY_HELD));
}

/** Pins the declared field's row at the bottom of the element. */
function pinSay(element: HTMLElement, field: HTMLElement): void {
    if (!field.parentElement) return;
    const box = boxOf(field);
    const row = box.parentElement;
    if (!row) return;
    const body = element.querySelector<HTMLElement>(':scope > [data-scroller="body"]');
    // Its own row only: the body or the element is not a row to pin.
    const pinned = row === body || row === element ? box : row;
    if (pinned === row) row.style.setProperty('display', 'flex', 'important');
    for (const [name, value] of Object.entries(ROW)) pinned.style.setProperty(name, value, 'important');
    // What scrolls under it is not seen through it.
    pinned.style.setProperty('background-color', element.style.backgroundColor || getComputedStyle(element).backgroundColor, 'important');
}

/** The field's box: the field itself, or, with presses, the pill holding it and them, where the field stood. */
function boxOf(field: HTMLElement): HTMLElement {
    const own = presses.get(field);
    if (!own || (!own.start && !own.end)) {
        if (own?.choices && field.parentElement && own.choices.parentElement !== field.parentElement) field.parentElement.insertBefore(own.choices, field);
        return field;
    }
    const parent = field.parentElement!;
    if (parent.dataset.sayBox === '') return parent;
    const box = field.ownerDocument.createElement('div');
    box.dataset.sayBox = '';
    // The pill takes the field's line, as the field did.
    for (const [name, value] of Object.entries(FIELD)) box.style.setProperty(name, value, 'important');
    for (const [name, value] of Object.entries(PILL)) box.style.setProperty(name, value, 'important');
    parent.insertBefore(box, field);
    // The choices stand above the pill, on their own line of the row.
    if (own.choices) parent.insertBefore(own.choices, box);
    if (own.start) box.appendChild(own.start);
    box.appendChild(field);
    if (own.end) box.appendChild(own.end);
    for (const [name, value] of Object.entries(IN_PILL)) field.style.setProperty(name, value, 'important');
    // The pill is its surface: the field draws none of its own.
    field.style.setProperty('border', 'none');
    field.style.setProperty('background', 'transparent');
    field.style.setProperty('resize', 'none');
    // Its presses are SAY_PRESS square and round, by the package's rule (fit.ts); what they look like is the host's.
    for (const press of [own.start, own.end]) if (press) press.dataset.sayPress = '';
    return box;
}
