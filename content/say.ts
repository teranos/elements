/**
 * The field a chat says from takes the bottom.
 *
 * "making the inputfield take up the entire bottom of the screen for chat
 * elements like claude or pi" (#40). A host declares its field; the package gives
 * it the last line of its row to itself, the whole width, and keeps the row at the
 * bottom of the element while what was said scrolls above it. What the host put
 * beside the field wraps above it. Written important: no host stylesheet squeezes it.
 */

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
 * Purple arrows on a screenshot: the + into the field's bottom-left corner, the → into its bottom-right. "And how
 * often do you want me to complain about the positions of these buttons". They are in the field's box, at its
 * bottom corners, and what is typed leaves them their line.
 */
export interface SayPresses {
    start?: HTMLElement;
    end?: HTMLElement;
}

const presses = new WeakMap<HTMLElement, SayPresses>();

/** Where a press stands in the field's box: at its bottom corner, above the home bar's strip (forms/panel.ts). */
const PRESS: Record<string, string> = {
    position: 'absolute', bottom: 'calc(6px + var(--elements-say-strip, 0px))', margin: '0', 'z-index': '1',
};

/** A host's word that this field is the one its element says from, with its presses. Callable before it is in an element. */
export function declareSay(field: HTMLElement, with_?: SayPresses): void {
    field.dataset.say = '';
    for (const [name, value] of Object.entries(FIELD)) field.style.setProperty(name, value, 'important');
    if (with_?.start || with_?.end) presses.set(field, with_);
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

/** What an element is told when the field it says from is held: a panel gives it the home bar's strip (forms/panel.ts). */
export const SAY_HELD = 'elements:say-held';

const waiting = new WeakMap<HTMLElement, MutationObserver>();

/**
 * The declared field's row, at the bottom of this element, worn in the element's own colour.
 *
 * A host may draw its field after the element opened: QNTX-Web's Node Agent asks the node which harnesses it offers
 * first. A field not there yet is held when it arrives.
 */
export function holdSay(element: HTMLElement): void {
    if (pinSay(element) || waiting.has(element) || typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver(() => {
        if (!pinSay(element)) return;
        observer.disconnect();
        waiting.delete(element);
    });
    waiting.set(element, observer);
    observer.observe(element, { childList: true, subtree: true });
}

/** Pins the declared field's row, if there is one yet, and tells the element. */
function pinSay(element: HTMLElement): boolean {
    const field = element.querySelector<HTMLElement>('[data-say]');
    if (!field?.parentElement) return false;
    const box = boxOf(field);
    const row = box.parentElement;
    if (!row) return false;
    const body = element.querySelector<HTMLElement>(':scope > [data-scroller="body"]');
    // Its own row only: the body or the element is not a row to pin.
    const pinned = row === body || row === element ? box : row;
    if (pinned === row) row.style.setProperty('display', 'flex', 'important');
    for (const [name, value] of Object.entries(ROW)) pinned.style.setProperty(name, value, 'important');
    // What scrolls under it is not seen through it.
    pinned.style.setProperty('background-color', element.style.backgroundColor || getComputedStyle(element).backgroundColor, 'important');
    leaveRoom(field);
    // The element's own window makes the event: a document's events are its window's.
    const view = element.ownerDocument.defaultView ?? window;
    element.dispatchEvent(new view.Event(SAY_HELD));
    return true;
}

/** The field's box: the field itself, or, with presses, a box holding it and them, where the field stood. */
function boxOf(field: HTMLElement): HTMLElement {
    const own = presses.get(field);
    if (!own) return field;
    const parent = field.parentElement!;
    if (parent.dataset.sayBox === '') return parent;
    const box = field.ownerDocument.createElement('div');
    box.dataset.sayBox = '';
    // The box takes the field's line, as the field did; the field fills it.
    for (const [name, value] of Object.entries(FIELD)) box.style.setProperty(name, value, 'important');
    box.style.setProperty('position', 'relative', 'important');
    parent.insertBefore(box, field);
    box.appendChild(field);
    // A block in its box: an inline field keeps a descender's gap under itself.
    field.style.setProperty('flex', 'none', 'important');
    field.style.setProperty('display', 'block', 'important');
    for (const [side, press] of [['left', own.start], ['right', own.end]] as const) {
        if (!press) continue;
        box.appendChild(press);
        for (const [name, value] of Object.entries(PRESS)) press.style.setProperty(name, value, 'important');
        press.style.setProperty(side, '6px', 'important');
    }
    return box;
}

/**
 * What is typed stays above the presses and above the home bar's strip: the field's own padding under it, the
 * presses' line, and the strip a panel gives it (forms/panel.ts).
 */
function leaveRoom(field: HTMLElement): void {
    if (field.dataset.sayOwnPadding === undefined) {
        const own = parseFloat(getComputedStyle(field).paddingBottom);
        field.dataset.sayOwnPadding = `${Number.isFinite(own) ? own : 0}px`;
    }
    const own = presses.get(field);
    if (own) {
        const tallest = Math.max(...[own.start, own.end].map((press) => press?.getBoundingClientRect().height ?? 0));
        field.style.setProperty('--elements-say-room', `${(tallest > 0 ? tallest : 32) + 6}px`);
    }
    field.style.setProperty('padding-bottom', `calc(${field.dataset.sayOwnPadding} + var(--elements-say-room, 0px) + var(--elements-say-strip, 0px))`, 'important');
}
