/**
 * Where an element has a place of its own to go back to.
 *
 * An element in button form has one: the gap it left (forms/button.ts). Every
 * window and panel it becomes asks here, so the down arrow is on it however it
 * got there, straight from the button or out of the tray.
 */

const homes = new WeakMap<HTMLElement, () => void>();

/** Gives the element a place, and what takes it back there. */
export function setHome(element: HTMLElement, back: () => void): void {
    homes.set(element, back);
}

/** What takes the element back to its place, if it has one. */
export function homeOf(element: HTMLElement): (() => void) | undefined {
    return homes.get(element);
}
