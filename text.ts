// "Text size needs to be owned by Elements entirely and misuse should result into compilation error."
// The sizes are the package's. Inside an element, text is sized by sizeText() with a name from this
// set, and nothing else: a host's stylesheet, a style attribute or an em has no say there.

import { fitRule, takeOffFit } from './fit';

/** px: the sizes text inside an element is read at, hand-tuned. */
export const TEXT_SIZES: Readonly<{ xs: 10; sm: 11; md: 13; lg: 14 }> = Object.freeze({ xs: 10, sm: 11, md: 13, lg: 14 } as const);

/** A size from the set. Any other size does not compile. */
export type TextSize = keyof typeof TEXT_SIZES;

/** px: a field's or editor's text, not a size a host picks: under 16, iOS zooms the page when it is tapped. */
export const FIELD_TEXT_SIZE = 16;

/** What text inside an element is at until sizeText() says otherwise. */
const DEFAULT: TextSize = 'sm';

const RULE_ID = 'elements-text-size';

// Text the package draws outside any element, on a surface of its own (the spawn menu, and the
// cursor carried from it until it is placed): sized from the same set, by the same call.
const SURFACE = '[data-text-surface]';

// An element in any form but a dot: a dot's symbol is the tray's.
const ELEMENT = '[data-element-id]:not(.dot)';

// "This, I never want to have happen": text that ran off a panel's edge, cut off, unread. Inside an
// element, text breaks to the width it has, a word too long for it anywhere in it.
// A field outranks a size from the set around it or on it: :is() counts its most specific name.
// Layered and important: an important rule in a layer outranks every important rule outside
// one, and every rule of any kind in a stylesheet or a style attribute that is not important.
// An editor is a field that is not a tag (CodeMirror's surface is a div): the same 16, and what is written in it.
const EDITOR = '[contenteditable]:not([contenteditable="false"])';

const RULE = `@layer elements {
${ELEMENT} { font-size: ${TEXT_SIZES[DEFAULT]}px !important; }
${ELEMENT} * { font-size: inherit !important; }
${ELEMENT}, ${ELEMENT} * { overflow-wrap: anywhere !important; word-break: normal !important; }
${fitRule(ELEMENT)}
${Object.entries(TEXT_SIZES).map(([name, px]) =>
    `${ELEMENT} [data-text-size="${name}"], ${ELEMENT}[data-text-size="${name}"] { font-size: ${px}px !important; }`).join('\n')}
${ELEMENT} :is(input, textarea, select):is([data-text-size], *) { font-size: ${FIELD_TEXT_SIZE}px !important; }
${ELEMENT} :is(${EDITOR}, ${EDITOR} *):is([data-text-size], *) { font-size: ${FIELD_TEXT_SIZE}px !important; }
${Object.entries(TEXT_SIZES).map(([name, px]) =>
    `${SURFACE} [data-text-size="${name}"], ${SURFACE}[data-text-size="${name}"] { font-size: ${px}px !important; }`).join('\n')}
}`;

// A document stylesheet does not reach into a shadow root: the field rule is put into each open one
// inside an element (reachShadows). Layered and important, as the page's is. A closed root is the host's.
const SHADOW_ID = 'data-elements-text';
const SHADOW_RULE = `@layer elements {
:is(input, textarea, select, ${EDITOR}, ${EDITOR} *) { font-size: ${FIELD_TEXT_SIZE}px !important; }
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
    takeOffFit(node);
}

/** This element's text is at the package's sizes, whatever is written on it or in it. */
export function holdElementText(element: HTMLElement): void {
    holdTextSize();
    if (watching.has(element) || typeof MutationObserver === 'undefined') return;
    const options = { attributes: true, attributeFilter: ['style'], childList: true, subtree: true };
    const observer: MutationObserver = new MutationObserver((records) => {
        records.forEach((record) => {
            if (record.type === 'attributes') takeOffSize(record.target as Element);
            else record.addedNodes.forEach((added) => { if (added instanceof Element) reach(added); });
        });
    });

    // Sizes off a node and what it holds, and the field rule into every open shadow root in it (and
    // each root watched, since the element's own watch stops at a root's edge).
    function reach(root: Element | ShadowRoot): void {
        if (root instanceof Element) takeOffSize(root);
        root.querySelectorAll('[style]').forEach(takeOffSize);
        const hosts = Array.from(root.querySelectorAll('*'));
        if (root instanceof Element) hosts.unshift(root);
        hosts.forEach((host) => { if (host.shadowRoot) reachRoot(host.shadowRoot); });
    }

    function reachRoot(shadow: ShadowRoot): void {
        if (shadow.querySelector(`:scope > style[${SHADOW_ID}]`)) return;
        const style = document.createElement('style');
        style.setAttribute(SHADOW_ID, '');
        style.textContent = SHADOW_RULE;
        shadow.prepend(style);
        observer.observe(shadow, options);
        reach(shadow);
    }

    reach(element);
    observer.observe(element, options);
    watching.set(element, observer);
}

/** A dot: its symbol is the tray's, and what is written on it every frame is not watched. */
export function releaseElementText(element: HTMLElement): void {
    watching.get(element)?.disconnect();
    watching.delete(element);
}
