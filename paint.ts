/**
 * What an element is painted, carried across a change of form.
 *
 * An element is exactly one DOM element for its entire lifetime, and everything
 * about it survives every transition (Element Axioma). Inline styles are wiped
 * on a morph because geometry and layout belong to the form — a tray
 * dot is not laid out like a canvas frame. Paint does not belong to the
 * form. An element is the colour it is in the tray, in a window and on
 * the canvas.
 *
 * So it is read off the element before the wipe and worn again after. The Element
 * datum is not where the colour lives: a datum that names one is asking to
 * change it, and one that names none is not asking for the default.
 */

import { DEFAULT_COLOR } from './element';
import { getGlow, setGlow, getHeldGlow, setHeldGlow, getHeld } from './dataset';

/**
 * What an element is, written onto it from its datum: its border and its glows.
 * Every form that builds an element calls this, so no form forgets one of them.
 */
export function wearIdentity(element: HTMLElement, item: { border?: string; glow?: string; heldGlow?: string }): void {
    if (item.border) element.style.border = item.border;
    if (item.glow !== undefined) setGlow(element, item.glow);
    if (item.heldGlow !== undefined) setHeldGlow(element, item.heldGlow);
}

// The shadow each element's form last asked for, so a hold can wear the element
// again without knowing what form it is in.
const formShadows = new WeakMap<HTMLElement, string>();

/**
 * Write a form's shadow, with the element's own glow beside it. A form never
 * writes box-shadow any other way, or it would put out the glow.
 */
export function wearShadow(element: HTMLElement, formShadow: string): void {
    formShadows.set(element, formShadow);
    // Held, it wears its held glow if it has one.
    const glow = (getHeld(element) && getHeldGlow(element)) || getGlow(element);
    const form = formShadow === 'none' ? '' : formShadow;
    if (!glow) {
        element.style.boxShadow = formShadow;
        return;
    }
    element.style.boxShadow = form ? `${glow}, ${form}` : glow;
}

/** Wear the element's shadow again, under the form it is already in. */
export function rewearShadow(element: HTMLElement): void {
    wearShadow(element, formShadows.get(element) ?? '');
}

/** What an element is wearing now. */
export interface Paint {
    background: string;
    border: string;
}

/** Read the paint off an element, before anything wipes it. */
export function readPaint(element: HTMLElement): Paint {
    return {
        background: element.style.backgroundColor,
        border: element.style.border,
    };
}

/**
 * Put the paint back on, after the wipe.
 *
 * asked is what the caller wants changed, and wins where it says anything. What
 * the element wore is next, and the default is for an element that has never
 * been painted at all — one born straight into the tray.
 */
export function wearPaint(
    element: HTMLElement,
    was: Paint,
    asked?: { color?: string; border?: string; glow?: string },
): void {
    element.style.backgroundColor = asked?.color || was.background || DEFAULT_COLOR;

    const border = asked?.border || was.border;
    if (border) element.style.border = border;

    // The glow was never in the wiped styles: it is on the element.
    if (asked?.glow !== undefined) setGlow(element, asked.glow);
    wearShadow(element, '');
}
