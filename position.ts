/**
 * Where the page stands, while a field takes the keyboard.
 *
 * "you tap a box to type, and the only thing that happens is the keyboard
 * coming up. No zoom, nothing moves, nothing refocuses."
 *
 * In QNTX-App's web view a tap on a box well above the keyboard scrolled the
 * window 35 points, and the box and everything else went with it. So the
 * package holds the window where it stood when the field took focus, until the
 * field lets go, and the host has no say. A field the keyboard would cover is
 * a window's or a panel's to raise (window/keyboard.ts), not the page's.
 */

// An input of these types brings no keyboard, so it holds nothing.
const NO_KEYBOARD = new Set([
    'button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit',
]);

/** Where the window stood when a field took the keyboard; null while none has it. */
let held: { x: number; y: number } | null = null;
let holding = false;

function takesKeyboard(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.tagName === 'TEXTAREA') return true;
    if (target.tagName === 'INPUT') return !NO_KEYBOARD.has((target as HTMLInputElement).type);
    return target.isContentEditable === true;
}

/** Hold the window where it stands while a field has the keyboard, from now on. */
export function holdPosition(): void {
    if (holding) return;
    holding = true;
    window.addEventListener('focusin', (event) => {
        if (takesKeyboard(event.target)) held = { x: window.scrollX, y: window.scrollY };
    });
    window.addEventListener('focusout', () => { held = null; });
    window.addEventListener('scroll', () => {
        if (held && (window.scrollX !== held.x || window.scrollY !== held.y)) window.scrollTo(held.x, held.y);
    });
}
