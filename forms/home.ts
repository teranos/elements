/**
 * Where an element has a place of its own to go back to.
 *
 * An element in button form has one: the gap it left (forms/button.ts). Every
 * window and panel it becomes asks here, so the down arrow is on it however it
 * got there, straight from the button or out of the tray.
 */

const homes = new WeakMap<HTMLElement, () => void>();
const only = new WeakSet<HTMLElement>();

/**
 * Gives the element a place, and what takes it back there. One that rests
 * nowhere else (forms/overlay.ts) says so: minimized, swiped away or left by
 * Escape, it goes to its place and never to the tray.
 */
export function setHome(element: HTMLElement, back: () => void, nowhereElse = false): void {
    homes.set(element, back);
    if (nowhereElse) only.add(element);
    else only.delete(element);
}

/** Takes the element's place away: it has none any more. */
export function clearHome(element: HTMLElement): void {
    homes.delete(element);
    only.delete(element);
}

/** What takes the element to the only place it rests, if it rests nowhere else. */
export function onlyHomeOf(element: HTMLElement): (() => void) | undefined {
    return only.has(element) ? homes.get(element) : undefined;
}

/** What takes the element back to its place, if it has one. */
export function homeOf(element: HTMLElement): (() => void) | undefined {
    return homes.get(element);
}
