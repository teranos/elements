/**
 * The body of a window is what scrolls.
 *
 * A window is a column in a box that clips (window/settle.ts). Its body is the
 * element's scroller unless the host declared another (content/scroll.ts).
 */

export function holdBody(body: HTMLElement): void {
    body.style.flex = '1 1 auto';
    // A flex item does not shrink below its content without this, and the box clips what does not shrink.
    body.style.minHeight = '0px';
    body.style.overflowX = 'auto';
    body.style.overflowY = 'auto';
    // A scroll that reaches the end of the body ends there: it does not move the page behind the window.
    body.style.overscrollBehavior = 'contain';
    body.dataset.scroller = 'body';
}
