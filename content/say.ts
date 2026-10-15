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

/** The declared field's row, at the bottom of this element, worn in the element's own colour. */
export function holdSay(element: HTMLElement): void {
    const field = element.querySelector<HTMLElement>('[data-say]');
    const row = field?.parentElement;
    if (!field || !row) return;
    const body = element.querySelector<HTMLElement>(':scope > [data-scroller="body"]');
    // Its own row only: the body or the element is not a row to pin.
    const pinned = row === body || row === element ? field : row;
    if (pinned === row) row.style.setProperty('display', 'flex', 'important');
    for (const [name, value] of Object.entries(ROW)) pinned.style.setProperty(name, value, 'important');
    // What scrolls under it is not seen through it.
    pinned.style.setProperty('background-color', element.style.backgroundColor || getComputedStyle(element).backgroundColor, 'important');
}
