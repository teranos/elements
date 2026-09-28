/**
 * Held — a press, from the moment it lands until it is let go.
 *
 * A held element is picked up: it wears its held glow, and it has the focus,
 * so every other element dims a little while it is held.
 */

import { getHeld, setHeld } from './dataset';
import { rewearShadow } from './paint';

/** How bright the rest are while one is held. A little lower, not much. */
export const FOCUS_DIM = 0.85;

/** How long the rest take to dim, and to come back. */
export const FOCUS_TRANSITION_MS = 750;

const EASE = `filter ${FOCUS_TRANSITION_MS}ms`;

// The transition each eased element had of its own, and the timer that gives it back.
const ownTransition = new WeakMap<HTMLElement, string>();
const giveBack = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

function ease(el: HTMLElement): void {
    const pending = giveBack.get(el);
    if (pending !== undefined) {
        // Still easing back from the last hold: its own transition is already kept.
        clearTimeout(pending);
        giveBack.delete(el);
        return;
    }
    const own = el.style.transition;
    ownTransition.set(el, own);
    el.style.transition = own ? `${own}, ${EASE}` : EASE;
}

function unease(el: HTMLElement): void {
    giveBack.set(el, setTimeout(() => {
        giveBack.delete(el);
        el.style.transition = ownTransition.get(el) ?? '';
        ownTransition.delete(el);
    }, FOCUS_TRANSITION_MS));
}

const wired = new WeakSet<HTMLElement>();

// What each dimmed element wore before, so letting go gives it back.
const before = new WeakMap<HTMLElement, string>();

let holding: HTMLElement | null = null;

export function isHeld(element: HTMLElement): boolean {
    return getHeld(element);
}

/** The element being held, or null. */
export function heldElement(): HTMLElement | null {
    return holding;
}

/**
 * The filter an element wears given the hold: dimmed while another is held,
 * otherwise what it asks for. The tray asks this every frame for its dots.
 */
export function focusFilter(element: HTMLElement, own: string): string {
    if (!holding || holding === element) return own;
    return own ? `${own} brightness(${FOCUS_DIM})` : `brightness(${FOCUS_DIM})`;
}

function others(held: HTMLElement): HTMLElement[] {
    return (Array.from(document.querySelectorAll('[data-element-id]')) as HTMLElement[])
        .filter(el => el !== held);
}

function hold(element: HTMLElement): void {
    if (holding) return;
    holding = element;
    setHeld(element, true);
    rewearShadow(element);
    for (const el of others(element)) {
        before.set(el, el.style.filter);
        ease(el);
        el.style.filter = focusFilter(el, el.style.filter);
    }
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
    for (const el of others(element)) {
        if (!before.has(el)) continue;
        el.style.filter = before.get(el)!;
        before.delete(el);
        // Back as slowly as it went, and then its own transition again.
        unease(el);
    }
}

/** A press on this element holds it. Wired once per element (Element Axioma). */
export function holdable(element: HTMLElement): void {
    if (wired.has(element)) return;
    wired.add(element);
    element.addEventListener('mousedown', () => hold(element), { capture: true });
    element.addEventListener('touchstart', () => hold(element), { capture: true, passive: true });
}
