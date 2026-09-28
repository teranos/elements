/**
 * Type-safe dataset attribute helpers for DOM elements
 *
 * These helpers ensure dataset attributes are accessed and modified
 * with proper type safety and validation.
 */

import { isForm, type Form } from './form';
import { isContentState, type ContentState } from './content/state';

/**
 * Record which form an element is in.
 *
 * AXIOMAS.md: a morph is a transition between forms, and an element is in
 * one at any time. This is where that is written down, so it can be read.
 */
export function setForm(element: HTMLElement, form: Form): void {
    element.dataset.form = form;
}

/**
 * Which form an element is in, or null if nothing has said.
 *
 * Null for a name the table does not have: an element carrying one is not in
 * some eighth form, it is carrying a word.
 */
export function getForm(element: HTMLElement): Form | null {
    const name = element.dataset.form;
    return name !== undefined && isForm(name) ? name : null;
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
 * The size a person gave this window, or null when nobody has.
 */
export function getLastSize(element: HTMLElement): { width: number, height: number } | null {
    const width = parseFloat(element.dataset.lastWidth ?? '');
    const height = parseFloat(element.dataset.lastHeight ?? '');
    return isNaN(width) || isNaN(height) ? null : { width, height };
}

/**
 * Keep the size a person gave this window, so it survives the tray (Element Axioma).
 */
export function setLastSize(element: HTMLElement, width: number, height: number): void {
    element.dataset.lastWidth = String(width);
    element.dataset.lastHeight = String(height);
}

/**
 * Check if element has proximity text showing
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
 * Get element ID from element
 */
export function getElementId(element: HTMLElement): string | null {
    return element.getAttribute('data-element-id');
}

/**
 * Set element ID on element
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
 * Get element symbol from element
 */
export function getSymbol(element: HTMLElement): string | undefined {
    return element.dataset.symbol;
}

/**
 * Set element symbol on element
 */
export function setSymbol(element: HTMLElement, symbol: string | undefined): void {
    if (symbol !== undefined) {
        element.dataset.symbol = symbol;
    } else {
        delete element.dataset.symbol;
    }
}

/**
 * Record what an element's body is showing.
 *
 * content/state.ts names the states; this is where one is written down, so it
 * can be read — off the element, which is the one thing an element keeps for its
 * whole life (AXIOMAS.md, Element Axioma).
 */
export function setContentState(element: HTMLElement, state: ContentState): void {
    element.dataset.content = state;
}

/**
 * What an element's body is showing, or null if nothing has said.
 *
 * Null is itself a finding: every window and panel is stamped at mount
 * (content/render.ts), so an unstamped body is one that reached
 * the screen by some path that does not say what it holds.
 */
export function getContentState(element: HTMLElement): ContentState | null {
    const name = element.dataset.content;
    return name !== undefined && isContentState(name) ? name : null;
}
