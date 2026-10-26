/**
 * What a window is, once its morph has committed.
 *
 * `window` is one row in FORMS and had two constructors: a tray dot
 * opening (window.ts) and a canvas-placed element being lifted (canvas-window.ts).
 * Both wrote `data-form="window"` and neither agreed with the other on
 * what that meant — a content-sized box against a fixed 520x420, a cap on one
 * and none on the other, a z-index that rose on a press and one that sat at the
 * base and never moved. The table names the state. Nothing said what the state
 * is, so the two drifted where nothing was watching.
 *
 * This is what says it. The box is the caller's — it is the morph's own target,
 * and how each path arrives at one is its own business. Everything a window is
 * regardless of where it came from is here, written once.
 *
 * What is deliberately NOT here: what the element wears. Its colour, its border,
 * its padding are data on the element and never a property of a form
 * (VISION.md) — the tray path reads them off the Element, the canvas path leaves
 * the element wearing what it already wore, and both are the same intent
 * reached by different routes. Nor the content: one path rebuilds from
 * renderContent(), the other wraps the children it already has so a scroll
 * position and a half-typed textarea survive the lift.
 */

import { safeArea } from '../safe-area';
import { getWindowBorderRadius } from '../config';
import {
    WINDOW_BOX_SHADOW,
    MAX_VIEWPORT_WIDTH_RATIO,
    MAX_VIEWPORT_HEIGHT_RATIO,
} from '../element';
import { setNaturalWidth } from './drag';
import { wearShadow } from '../paint';
import { raise, raiseOnInteract } from './z-order';
import { keepClearOfKeyboard } from './keyboard';

/**
 * The box a morph animated to.
 *
 * `width` and `height` are the numbers the animation ended on, and they stay
 * numbers even when an axis is written as `fit-content`: a drag against an edge
 * reflows from what the window measures, and `fit-content` is not a number.
 */
export interface WindowBox {
    x: number;
    y: number;
    width: number;
    height: number;
    /** Written instead of `${width}px` when the content owns the axis. */
    widthStyle?: string;
    /** Written instead of `${height}px` when the content owns the axis. */
    heightStyle?: string;
}

// A window stands whole on its screen, whatever it is given to hold after it opened and
// whatever the screen does under it: past the right edge it slides back; wider than the
// screen, it is the screen's width and what it holds wraps. The README's Boundary says why.
const held = new WeakSet<HTMLElement>();

function onScreen(element: HTMLElement): void {
    if (element.dataset.form !== 'window' || !element.isConnected) return;
    const area = safeArea();
    const widest = Math.floor(area.width);
    if (parseFloat(element.style.maxWidth) > widest) element.style.maxWidth = `${widest}px`;
    const r = element.getBoundingClientRect();
    const right = area.x + area.width;
    if (r.right > right + 0.5) element.style.left = `${Math.max(area.x, Math.floor(right - Math.min(r.width, widest)))}px`;
    else if (r.left < area.x - 0.5) element.style.left = `${area.x}px`;
    // Past the bottom it slides back up; taller than the screen, it is the screen tall.
    const tallest = Math.floor(area.height);
    if (parseFloat(element.style.maxHeight) > tallest) element.style.maxHeight = `${tallest}px`;
    const bottom = area.y + area.height;
    if (r.bottom > bottom + 0.5) element.style.top = `${Math.max(area.y, Math.floor(bottom - Math.min(r.height, tallest)))}px`;
    else if (r.top < area.y - 0.5) element.style.top = `${area.y}px`;
}

/** Hold a window on its screen from now on: as it settles, as what it holds grows, as the screen changes. */
export function holdOnScreen(element: HTMLElement): void {
    onScreen(element);
    if (held.has(element)) return;
    held.add(element);
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => onScreen(element)).observe(element);
    // Whoever writes where it stands, a host's code included: it ends on its screen.
    if (typeof MutationObserver === 'function') new MutationObserver(() => onScreen(element)).observe(element, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', () => onScreen(element));
}

/**
 * Settle an element into the window form.
 *
 * Call at morph commit, from either constructor. Idempotent: an element reopened
 * is one element (Element Axioma), and settling it again neither stacks its
 * press listener nor loses its place in the stack.
 */
export function settleWindow(element: HTMLElement, box: WindowBox): void {
    element.style.position = 'fixed';
    element.style.left = `${box.x}px`;
    element.style.top = `${box.y}px`;
    element.style.width = box.widthStyle ?? `${box.width}px`;
    element.style.height = box.heightStyle ?? `${box.height}px`;

    // No declared, remembered or measured box outranks the screen it landed on
    // — a phone may be the primary screen (window/placement.ts, clampToViewport).
    const area = safeArea();
    element.style.maxWidth = `${Math.floor(area.width * MAX_VIEWPORT_WIDTH_RATIO)}px`;
    element.style.maxHeight = `${Math.floor(area.height * MAX_VIEWPORT_HEIGHT_RATIO)}px`;
    holdOnScreen(element);

    element.style.borderRadius = getWindowBorderRadius();
    // The window's shadow, and the element's own glow beside it.
    wearShadow(element, WINDOW_BOX_SHADOW);

    // A window holds a title bar above a body that clips.
    element.style.display = 'flex';
    element.style.flexDirection = 'column';
    element.style.overflow = 'hidden';

    // How wide this window is when nothing is squeezing it, so a drag against
    // an edge knows what it is giving way from.
    setNaturalWidth(element, box.width);

    // In front on arrival, and in front again whenever it is touched.
    raise(element);
    raiseOnInteract(element);

    // Seen whole while a field in it has the keyboard up.
    keepClearOfKeyboard(element);
}
