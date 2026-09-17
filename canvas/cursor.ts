/**
 * Cursor form — transient element preview during placement mode.
 *
 * A small element that follows the mouse pointer while the user
 * carries an element type from the spawn menu to a canvas position.
 * Unlike window/canvas/panel, cursor elements are not persisted, have no
 * chrome, and do not participate in the tray morph lifecycle.
 *
 * The cursor element can be reused as the placed canvas element's container
 * via canvasPlaced({ element }) to preserve DOM identity.
 */

const CURSOR_CLASS = 'cursor';

/**
 * Create a cursor element displaying the given symbol.
 * The element is positioned fixed and ignores pointer events.
 */
export function createCursorElement(symbol: string, elementType: string): HTMLElement {
    const el = document.createElement('div');
    el.className = CURSOR_CLASS;
    el.setAttribute('data-element-type', elementType);
    el.style.position = 'fixed';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '10003';

    // Symbol as a <span> so it can be extracted and reused in the placed element
    const sym = document.createElement('span');
    sym.className = 'cursor-symbol';
    sym.textContent = symbol;
    el.appendChild(sym);

    return el;
}

/**
 * Attach the cursor element to mouse movement.
 * Returns a cleanup function that removes the listener.
 */
export function attachCursorToMouse(element: HTMLElement): () => void {
    const onMouseMove = (e: MouseEvent) => {
        element.style.left = `${e.clientX}px`;
        element.style.top = `${e.clientY}px`;
    };
    document.addEventListener('mousemove', onMouseMove);
    return () => document.removeEventListener('mousemove', onMouseMove);
}

/**
 * Prepare cursor for placement — find the symbol span but keep
 * cursor styles intact. The element stays visually at cursor position
 * until the morph animation starts.
 * Returns the symbol span reference for the factory to reuse.
 */
export function prepareCursorForPlacement(element: HTMLElement): HTMLElement | null {
    const symbolSpan = element.querySelector('.cursor-symbol') as HTMLElement | null;
    element.removeAttribute('data-element-type');
    return symbolSpan;
}

/**
 * Commit the cursor-to-placed transition: strip all cursor-specific
 * styles so the element takes its final canvas layout.
 * Called after the morph animation starts (or immediately if no animation).
 */
export function commitCursorPlacement(element: HTMLElement): void {
    element.classList.remove(CURSOR_CLASS);
    element.style.position = '';
    element.style.pointerEvents = '';
    element.style.zIndex = '';
}
