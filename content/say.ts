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

/** A host's word that this field is the one its element says from. Callable before it is in an element. */
export function declareSay(field: HTMLElement): void {
    field.dataset.say = '';
    for (const [name, value] of Object.entries(FIELD)) field.style.setProperty(name, value, 'important');
}

// "i think chatfield soudl be considered different from regular inputfied"

/** The field a chat says from, the package's own: lines of text, named by its label, declared the element's. */
export function sayFrom(say: { id: string; label: string }): HTMLTextAreaElement {
    if (typeof say.id !== 'string' || !say.id) throw new TypeError('a chat field has a name: its id');
    if (typeof say.label !== 'string' || !say.label) throw new TypeError(`chat field ${say.id} says nothing of what it is: it has no label`);
    const field = document.createElement('textarea');
    field.rows = 1;
    field.dataset.sayId = say.id;
    // No room above it for a label: its name is read out, and shown until it is typed over.
    field.setAttribute('aria-label', say.label);
    field.placeholder = say.label;
    declareSay(field);
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
    const row = field?.parentElement;
    if (!field || !row) return false;
    const body = element.querySelector<HTMLElement>(':scope > [data-scroller="body"]');
    // Its own row only: the body or the element is not a row to pin.
    const pinned = row === body || row === element ? field : row;
    if (pinned === row) row.style.setProperty('display', 'flex', 'important');
    for (const [name, value] of Object.entries(ROW)) pinned.style.setProperty(name, value, 'important');
    // What scrolls under it is not seen through it.
    pinned.style.setProperty('background-color', element.style.backgroundColor || getComputedStyle(element).backgroundColor, 'important');
    // The element's own window makes the event: a document's events are its window's.
    const view = element.ownerDocument.defaultView ?? window;
    element.dispatchEvent(new view.Event(SAY_HELD));
    return true;
}
