// "Text size needs to be owned by Elements entirely and misuse should result into compilation error."
// The sizes are the package's. Inside an element, text is sized by sizeText() with a name from this
// set, and nothing else: a host's stylesheet, a style attribute or an em has no say there.

/** px: the sizes text inside an element is read at, hand-tuned. */
export const TEXT_SIZES = Object.freeze({ xs: 10, sm: 11, md: 13, lg: 14 } as const);

/** A size from the set. Any other size does not compile. */
export type TextSize = keyof typeof TEXT_SIZES;

/** px: a field's text, not a size a host picks: under 16, iOS zooms the page when the field is tapped. */
export const FIELD_TEXT_SIZE = 16;

/** What text inside an element is at until sizeText() says otherwise. */
const DEFAULT: TextSize = 'sm';

const RULE_ID = 'elements-text-size';

// An element in any form but a dot: a dot's symbol is the tray's.
const ELEMENT = '[data-element-id]:not(.dot)';

// A field outranks a size from the set around it or on it: :is() counts its most specific name.
// Layered and important: an important rule in a layer outranks every important rule outside
// one, and every rule of any kind in a stylesheet or a style attribute that is not important.
const RULE = `@layer elements {
${ELEMENT} { font-size: ${TEXT_SIZES[DEFAULT]}px !important; }
${ELEMENT} * { font-size: inherit !important; }
${Object.entries(TEXT_SIZES).map(([name, px]) =>
    `${ELEMENT} [data-text-size="${name}"], ${ELEMENT}[data-text-size="${name}"] { font-size: ${px}px !important; }`).join('\n')}
${ELEMENT} :is(input, textarea, select):is([data-text-size], *) { font-size: ${FIELD_TEXT_SIZE}px !important; }
}`;

/** The package's rule, in the page once. */
export function holdTextSize(): void {
    if (document.getElementById(RULE_ID)) return;
    const style = document.createElement('style');
    style.id = RULE_ID;
    style.textContent = RULE;
    document.head.appendChild(style);
}

/** Size this node's text, and what it holds, at a size from the set. */
export function sizeText(node: HTMLElement, size: TextSize): void {
    // A caller with no types reaches here with any string; it is stopped the same.
    if (!Object.prototype.hasOwnProperty.call(TEXT_SIZES, size)) {
        throw new TypeError(`"${String(size)}" is not a text size; the sizes are ${Object.keys(TEXT_SIZES).join(', ')}`);
    }
    holdTextSize();
    node.dataset.textSize = size;
}

// A style attribute set important is the one thing a layered important rule does not outrank:
// inside an element it is taken off as it is written, and off whatever is added with one.
const watching = new WeakMap<HTMLElement, MutationObserver>();

function takeOffSize(node: Element): void {
    if (node instanceof HTMLElement && node.style.fontSize) node.style.removeProperty('font-size');
}

function takeOffSizes(root: Element): void {
    takeOffSize(root);
    root.querySelectorAll('[style]').forEach(takeOffSize);
}

/** This element's text is at the package's sizes, whatever is written on it or in it. */
export function holdElementText(element: HTMLElement): void {
    holdTextSize();
    if (watching.has(element) || typeof MutationObserver === 'undefined') return;
    takeOffSizes(element);
    const observer = new MutationObserver((records) => {
        records.forEach((record) => {
            if (record.type === 'attributes') takeOffSize(record.target as Element);
            else record.addedNodes.forEach((added) => { if (added instanceof Element) takeOffSizes(added); });
        });
    });
    observer.observe(element, { attributes: true, attributeFilter: ['style'], childList: true, subtree: true });
    watching.set(element, observer);
}

/** A dot: its symbol is the tray's, and what is written on it every frame is not watched. */
export function releaseElementText(element: HTMLElement): void {
    watching.get(element)?.disconnect();
    watching.delete(element);
}
