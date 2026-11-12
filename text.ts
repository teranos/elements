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

/** The person's text size over the browser's default of 16, as measured when the rule was put in the page. */
let heldScale = 1;

/**
 * A size as written: the person's text size, never under the package's number. "Be prepared for text-size changes"
 * (Apple HIG, Accessibility). The person's text size is the browser's own default, what `font-size: medium` is; a host
 * cannot set that, where it can set its root's font-size (so not rem). Measured once (personScale) and written in as
 * a number, so nothing in the page resolves it again: no host's root, custom property or rule moves it.
 */
function written(px: number): string {
    return `${Number((px * Math.max(1, heldScale)).toFixed(3))}px`;
}

/**
 * The person's text size over the browser's default of 16: what `medium` measures, in a closed shadow root of the
 * package's own, where no rule of the page reaches (a host's `span { font-size: 24px !important }` would). In serif,
 * a family of no one's choosing here: `medium` in a monospace family is the browser's fixed-width size (13 in Chrome).
 * Where nothing can be measured (a test DOM), 1.
 */
function personScale(): number {
    if (typeof document === 'undefined' || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return 1;
    const host = document.createElement('span');
    host.style.position = 'absolute';
    host.style.visibility = 'hidden';
    const probe = document.createElement('span');
    probe.style.fontSize = 'medium';
    probe.style.fontFamily = 'serif';
    if (typeof host.attachShadow === 'function') host.attachShadow({ mode: 'closed' }).appendChild(probe);
    else host.appendChild(probe);
    document.documentElement.appendChild(host);
    const px = parseFloat(window.getComputedStyle(probe).fontSize);
    host.remove();
    return Number.isFinite(px) && px > 0 ? px / 16 : 1;
}

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

const rule = (): string => `@layer elements {
${ELEMENT} { font-size: ${written(TEXT_SIZES[DEFAULT])} !important; }
${ELEMENT} * { font-size: inherit !important; }
${ELEMENT}, ${ELEMENT} * { overflow-wrap: anywhere !important; word-break: normal !important; }
${fitRule(ELEMENT)}
${Object.entries(TEXT_SIZES).map(([name, px]) =>
    `${ELEMENT} [data-text-size="${name}"], ${ELEMENT}[data-text-size="${name}"] { font-size: ${written(px)} !important; }`).join('\n')}
${ELEMENT} :is(input, textarea, select):is([data-text-size], *) { font-size: ${written(FIELD_TEXT_SIZE)} !important; }
${ELEMENT} :is(${EDITOR}, ${EDITOR} *):is([data-text-size], *) { font-size: ${written(FIELD_TEXT_SIZE)} !important; }
${Object.entries(TEXT_SIZES).map(([name, px]) =>
    `${SURFACE} [data-text-size="${name}"], ${SURFACE}[data-text-size="${name}"] { font-size: ${written(px)} !important; }`).join('\n')}
}`;

// A document stylesheet does not reach into a shadow root: the field rule is put into each open one
// inside an element. Layered and important, as the page's is. A closed root is the host's.
// Adopted where the browser has adoptedStyleSheets: nothing a host writes into the root's contents
// (innerHTML) takes it away, and it comes off cleanly. Elsewhere, a style element in the root.
const SHADOW_ID = 'data-elements-text';
const shadowRule = (): string => `@layer elements {
:is(input, textarea, select, ${EDITOR}, ${EDITOR} *) { font-size: ${written(FIELD_TEXT_SIZE)} !important; }
}`;

let adopted: CSSStyleSheet | null | undefined;

/** The one stylesheet roots adopt; null where a browser cannot (a test DOM, an old browser). */
function adoptable(): CSSStyleSheet | null {
    if (adopted !== undefined) return adopted;
    adopted = null;
    if (typeof CSSStyleSheet === 'function' && typeof ShadowRoot !== 'undefined'
        && 'replaceSync' in CSSStyleSheet.prototype && 'adoptedStyleSheets' in ShadowRoot.prototype) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(shadowRule());
        adopted = sheet;
    }
    return adopted;
}

/** The package's style element in a root, where there is no adopted sheet. */
function tagIn(shadow: ShadowRoot): Element | undefined {
    return Array.from(shadow.children).find((child) => child.tagName === 'STYLE' && child.hasAttribute(SHADOW_ID));
}

function styled(shadow: ShadowRoot): boolean {
    const sheet = adoptable();
    return sheet ? shadow.adoptedStyleSheets.includes(sheet) : !!tagIn(shadow);
}

function style(shadow: ShadowRoot): void {
    const sheet = adoptable();
    if (sheet) {
        shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
        return;
    }
    const tag = document.createElement('style');
    tag.setAttribute(SHADOW_ID, '');
    tag.textContent = shadowRule();
    shadow.prepend(tag);
}

function unstyle(shadow: ShadowRoot): void {
    const sheet = adoptable();
    if (sheet) shadow.adoptedStyleSheets = shadow.adoptedStyleSheets.filter((s) => s !== sheet);
    else tagIn(shadow)?.remove();
}

/** The package's rule, in the page once. */
export function holdTextSize(): void {
    if (document.getElementById(RULE_ID)) return;
    const style = document.createElement('style');
    style.id = RULE_ID;
    heldScale = personScale();
    style.textContent = rule();
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

// The roots each held element has put the field rule into: given back when it is released.
const roots = new WeakMap<HTMLElement, Set<ShadowRoot>>();

/** A shadow root, by shape: a fragment with a host (a DOM may not name the class). */
function isRoot(node: unknown): node is ShadowRoot {
    return !!node && (node as Node).nodeType === 11 && !!(node as ShadowRoot).host;
}

const WATCH = { attributes: true, attributeFilter: ['style'], childList: true, subtree: true };

function takeOffSize(node: Element): void {
    if (node instanceof HTMLElement && node.style.fontSize) node.style.removeProperty('font-size');
    // A root has no fit rule (fit.ts) to take the place of a layout property taken off: it stays there.
    if (!isRoot(node.getRootNode())) takeOffFit(node);
}

/** The nearest held element around a node, however many shadow roots lie between. */
function heldAround(node: Node | null): HTMLElement | null {
    for (let at: Node | null = node; at; at = at.parentNode ?? (at as ShadowRoot).host ?? null) {
        if (at instanceof HTMLElement && watching.has(at)) return at;
    }
    return null;
}

/** Sizes off a node and what it holds, and the field rule into every open shadow root in it. */
function reach(root: Element | ShadowRoot): void {
    if (!isRoot(root)) takeOffSize(root);
    root.querySelectorAll('[style]').forEach(takeOffSize);
    const hosts = Array.from(root.querySelectorAll('*'));
    if (!isRoot(root)) hosts.unshift(root);
    hosts.forEach((host) => { if (host.shadowRoot) hold(host.shadowRoot); });
}

// The held element each styled root belongs to.
const ownerOf = new WeakMap<ShadowRoot, HTMLElement>();

/**
 * A root put right with the held element nearest it now: styled and watched by it, moved to it from
 * another, or given back to its host when no held element is around it any more.
 */
function hold(shadow: ShadowRoot): void {
    const owner = heldAround(shadow.host);
    const was = ownerOf.get(shadow);
    if (!owner) {
        if (was) {
            roots.get(was)?.delete(shadow);
            ownerOf.delete(shadow);
            unstyle(shadow);
        }
        return;
    }
    if (was === owner && styled(shadow)) return;
    if (!styled(shadow)) style(shadow);
    if (was && was !== owner) roots.get(was)?.delete(shadow);
    ownerOf.set(shadow, owner);
    let held = roots.get(owner);
    if (!held) roots.set(owner, (held = new Set()));
    held.add(shadow);
    // An element's own watch stops at a root's edge.
    watching.get(owner)?.observe(shadow, WATCH);
    reach(shadow);
}

/** Every open root in a subtree that came or went, put right with whoever holds it now. */
function settle(node: Element): void {
    const hosts = Array.from(node.querySelectorAll('*'));
    hosts.unshift(node);
    hosts.forEach((host) => { if (host.shadowRoot) hold(host.shadowRoot); });
}

// A shadow root attached to a host already in an element gives the page no signal. Whatever a person
// touches or focuses inside one names it (composedPath, an open root only) before a keyboard or a zoom.
let listening = false;

function listen(): void {
    if (listening || typeof document === 'undefined') return;
    listening = true;
    const found = (e: Event) => {
        for (const node of e.composedPath()) if (isRoot(node)) hold(node);
    };
    document.addEventListener('pointerdown', found, true);
    document.addEventListener('focusin', found, true);
}

/** This element's text is at the package's sizes, whatever is written on it or in it. */
export function holdElementText(element: HTMLElement): void {
    holdTextSize();
    if (watching.has(element) || typeof MutationObserver === 'undefined') return;
    listen();
    const observer = new MutationObserver((records) => {
        records.forEach((record) => {
            if (record.type === 'attributes') takeOffSize(record.target as Element);
            else {
                record.removedNodes.forEach((removed) => { if (removed instanceof Element) settle(removed); });
                record.addedNodes.forEach((added) => { if (added instanceof Element) reach(added); });
                // A root whose contents were replaced.
                if (isRoot(record.target)) hold(record.target);
            }
        });
    });
    watching.set(element, observer);
    reach(element);
    observer.observe(element, WATCH);
}

/** A dot: its symbol is the tray's, and what is written on it every frame is not watched. */
export function releaseElementText(element: HTMLElement): void {
    watching.get(element)?.disconnect();
    watching.delete(element);
    // A root inside another held element is that one's now; otherwise it is the host's again.
    const held = roots.get(element);
    roots.delete(element);
    held?.forEach((shadow) => {
        ownerOf.delete(shadow);
        hold(shadow);
        if (!ownerOf.has(shadow)) unstyle(shadow);
    });
}
