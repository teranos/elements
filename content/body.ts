/**
 * The body of a window is what scrolls.
 *
 * A window is a column in a box that clips (window/settle.ts).
 */

export function holdBody(body: HTMLElement): void {
    body.style.flex = '1 1 auto';
    // A flex item does not shrink below its content without this, and the box clips what does not shrink.
    body.style.minHeight = '0px';
    body.style.overflow = 'auto';
}
