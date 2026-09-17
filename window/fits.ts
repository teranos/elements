/**
 * Whether an element has the room to be a window.
 *
 * A window is a box with screen around it: something you place, drag and put
 * beside another one. Where the content wants more room than a window may take,
 * the element is a panel and takes the whole screen.
 *
 * On a phone that is almost every element, which is why one rarely opens as
 * a window there.
 */

import { MAX_VIEWPORT_WIDTH_RATIO } from '../element';

/**
 * `contentWidth` is what the element's content measured. Zero is an element that
 * was never measured, and nothing about it asks for the screen.
 */
export function fitsAsWindow(contentWidth: number, viewport: number): boolean {
    if (contentWidth <= 0) return true;
    return contentWidth <= viewport * MAX_VIEWPORT_WIDTH_RATIO;
}
