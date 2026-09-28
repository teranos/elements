/**
 * Held — a press, from the moment it lands until it is let go.
 *
 * A held element is picked up: it wears its held glow (Element.heldGlow).
 */

import { getHeld, setHeld } from './dataset';
import { rewearShadow } from './paint';

const wired = new WeakSet<HTMLElement>();

let holding: HTMLElement | null = null;

export function isHeld(element: HTMLElement): boolean {
    return getHeld(element);
}

function hold(element: HTMLElement): void {
    if (holding) return;
    holding = element;
    setHeld(element, true);
    rewearShadow(element);
    const letGo = () => {
        window.removeEventListener('mouseup', letGo, true);
        window.removeEventListener('touchend', letGo, true);
        window.removeEventListener('touchcancel', letGo, true);
        release(element);
    };
    window.addEventListener('mouseup', letGo, true);
    window.addEventListener('touchend', letGo, true);
    window.addEventListener('touchcancel', letGo, true);
}

function release(element: HTMLElement): void {
    holding = null;
    setHeld(element, false);
    rewearShadow(element);
}

/** A press on this element holds it. Wired once per element (Element Axioma). */
export function holdable(element: HTMLElement): void {
    if (wired.has(element)) return;
    wired.add(element);
    element.addEventListener('mousedown', () => hold(element), { capture: true });
    element.addEventListener('touchstart', () => hold(element), { capture: true, passive: true });
}
