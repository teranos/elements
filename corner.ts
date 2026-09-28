/**
 * The resize corner — one for a window, one for a canvas element, the same corner.
 *
 * Its place and size are geometry, so they are the package's and written inline.
 * How it looks is the host's, through the `resize-handle` class.
 */

/** The size a corner is unless an element asks for another. */
export const CORNER_SIZE = 16;

export function createCorner(size: number = CORNER_SIZE): HTMLElement {
    const corner = document.createElement('div');
    corner.className = 'resize-handle';
    corner.style.position = 'absolute';
    corner.style.right = '0px';
    corner.style.bottom = '0px';
    corner.style.width = `${size}px`;
    corner.style.height = `${size}px`;
    corner.style.cursor = 'nwse-resize';
    corner.style.zIndex = '2';
    corner.style.touchAction = 'none';
    return corner;
}
