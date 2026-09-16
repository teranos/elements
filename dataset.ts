/**
 * Type-safe dataset attribute helpers for glyph DOM elements
 *
 * These helpers ensure dataset attributes are accessed and modified
 * with proper type safety and validation.
 */

import { isForm, type Form } from './form';
import { isContentState, type ContentState } from './content-state';

/**
 * Record which form a glyph is in.
 *
 * AXIOMAS.md: a morph is a transition between forms, and a glyph is in
 * one at any time. This is where that is written down, so it can be read.
 */
export function setForm(element: HTMLElement, form: Form): void {
    element.dataset.form = form;
}

/**
 * Which form a glyph is in, or null if nothing has said.
 *
 * Null for a name the table does not have: an element carrying one is not in
 * some eighth form, it is carrying a word.
 */
export function getForm(element: HTMLElement): Form | null {
    const name = element.dataset.form;
    return name !== undefined && isForm(name) ? name : null;
}

/**
 * @deprecated Use {@link getForm}. One bit cannot hold a seven-name
 * list: this is true for `window` and for `canvasExpanded`, and false for
 * `panel`, `workspace` and a dot alike — so it can say what a glyph is not far
 * better than what it is.
 *
 * It reads the same store {@link setForm} writes, so it stays correct
 * about what it could ever say.
 */
export function isInWindowState(element: HTMLElement): boolean {
    const m = getForm(element);
    return m === 'window' || m === 'canvasExpanded';
}

/**
 * @deprecated Use {@link setForm}, which takes the name instead of a
 * bit. `false` here meant "not a window" and left three different destinations
 * — dot, canvasPlaced, workspace — indistinguishable at the far end of a morph.
 */
export function setWindowState(element: HTMLElement, isWindow: boolean): void {
    if (isWindow) {
        setForm(element, 'window');
    } else {
        delete element.dataset.form;
    }
}

/**
 * Get last saved position of window
 */
export function getLastPosition(element: HTMLElement): { x: number, y: number } | null {
    const x = parseFloat(element.dataset.lastX ?? '');
    const y = parseFloat(element.dataset.lastY ?? '');
    return isNaN(x) || isNaN(y) ? null : { x, y };
}

/**
 * Save window position for next restore
 */
export function setLastPosition(element: HTMLElement, x: number, y: number): void {
    element.dataset.lastX = String(x);
    element.dataset.lastY = String(y);
}

/**
 * Check if glyph has proximity text showing
 */
export function hasProximityText(element: HTMLElement): boolean {
    return element.dataset.hasText === 'true';
}

/**
 * Set proximity text visibility flag
 */
export function setProximityText(element: HTMLElement, hasText: boolean): void {
    if (hasText) {
        element.dataset.hasText = 'true';
    } else {
        delete element.dataset.hasText;
    }
}

/**
 * Get glyph ID from element
 */
export function getElementId(element: HTMLElement): string | null {
    return element.getAttribute('data-element-id');
}

/**
 * Set glyph ID on element
 */
export function setElementId(element: HTMLElement, id: string): void {
    element.setAttribute('data-element-id', id);
}

/**
 * Store canvas-placed origin coordinates for morph return
 * Coordinates are canvas-local (not screen) — use canvasToScreen() at morph time
 */
export function setCanvasOrigin(
    element: HTMLElement,
    origin: { x: number; y: number; width: number; height: number; canvasId: string }
): void {
    element.dataset.canvasOriginX = String(origin.x);
    element.dataset.canvasOriginY = String(origin.y);
    element.dataset.canvasOriginW = String(origin.width);
    element.dataset.canvasOriginH = String(origin.height);
    element.dataset.canvasOriginId = origin.canvasId;
}

/**
 * Get canvas-placed origin coordinates for morph return
 */
export function getCanvasOrigin(
    element: HTMLElement
): { x: number; y: number; width: number; height: number; canvasId: string } | null {
    const x = parseFloat(element.dataset.canvasOriginX ?? '');
    const y = parseFloat(element.dataset.canvasOriginY ?? '');
    const w = parseFloat(element.dataset.canvasOriginW ?? '');
    const h = parseFloat(element.dataset.canvasOriginH ?? '');
    const canvasId = element.dataset.canvasOriginId;
    if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h) || !canvasId) return null;
    return { x, y, width: w, height: h, canvasId };
}

/**
 * Clear canvas-placed origin coordinates
 */
export function clearCanvasOrigin(element: HTMLElement): void {
    delete element.dataset.canvasOriginX;
    delete element.dataset.canvasOriginY;
    delete element.dataset.canvasOriginW;
    delete element.dataset.canvasOriginH;
    delete element.dataset.canvasOriginId;
}

/**
 * Get glyph symbol from element
 */
export function getSymbol(element: HTMLElement): string | undefined {
    return element.dataset.symbol;
}

/**
 * Set glyph symbol on element
 */
export function setSymbol(element: HTMLElement, symbol: string | undefined): void {
    if (symbol !== undefined) {
        element.dataset.symbol = symbol;
    } else {
        delete element.dataset.symbol;
    }
}

/**
 * Record what a glyph's body is showing.
 *
 * content-state.ts names the states; this is where one is written down, so it
 * can be read — off the element, which is the one thing a glyph keeps for its
 * whole life (AXIOMAS.md, Element Axioma).
 */
export function setContentState(element: HTMLElement, state: ContentState): void {
    element.dataset.content = state;
}

/**
 * What a glyph's body is showing, or null if nothing has said.
 *
 * Null is itself a finding: every window and panel is stamped at mount
 * (forms/render-content.ts), so an unstamped body is one that reached
 * the screen by some path that does not say what it holds.
 */
export function getContentState(element: HTMLElement): ContentState | null {
    const name = element.dataset.content;
    return name !== undefined && isContentState(name) ? name : null;
}
