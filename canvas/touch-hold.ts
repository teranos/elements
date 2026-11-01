/**
 * Touch hold — a finger held still on a canvas, the phone's right-click.
 *
 * "on mobile, can't get into spawn menu"
 *
 * The spawn menu opens on `contextmenu`, and WebKit on iOS never fires one for
 * a long press. Held still for HOLD_MS, a finger fires what a right-click
 * would, where it rests. A finger that moves is panning; two are pinching;
 * either lets go of the hold. A press in a field is left to the field: a long
 * press there selects text.
 *
 * A hold is a hold until its finger lifts, however long that is: no timer
 * ends it. The lift of a held finger sends no mouse events after it (they
 * would be taken for a press somewhere else), and it is heard on the window,
 * so a finger lifting off something the page moved or removed is still heard.
 * Should a lift never come, the next finger down ends the hold.
 *
 * Where the platform fires `contextmenu` for a long press as well (Android),
 * the one that comes first counts: the hold gives way to a `contextmenu` that
 * came before it, and `isHeld()` tells the one that comes after it that the
 * hold already opened what it would open.
 */

export const HOLD_MS = 500;
export const HOLD_SLOP_PX = 10;

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], .cm-editor';

export interface TouchHoldOptions {
    holdMs?: number;
    slopPx?: number;
}

export interface TouchHold {
    /** From the moment a hold fired until its finger lifts, however long that is. */
    isHeld(): boolean;
    dispose(): void;
}

/** Calls fire with where a finger was held still on container, and what it held. */
export function onTouchHold(
    container: HTMLElement | Document,
    fire: (clientX: number, clientY: number, target: HTMLElement) => void,
    options: TouchHoldOptions = {},
): TouchHold {
    const holdMs = options.holdMs ?? HOLD_MS;
    const slop = options.slopPx ?? HOLD_SLOP_PX;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let finger: number | null = null;
    let startX = 0;
    let startY = 0;
    let held = false;

    const letGo = (): void => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        finger = null;
    };

    const asEvents = (e: Event): TouchEvent => e as TouchEvent;

    // Heard on the window while held: the finger may lift off something that
    // has left the canvas, and a new finger down means the old one is gone.
    const lifted = (e: Event): void => {
        letGo();
        if (!held) return;
        endHold();
        // No mouse events after a hold: a menu's mousedown would take the
        // lifted finger for a press outside itself.
        if (e.cancelable) e.preventDefault();
    };
    const pressed = (): void => { if (held) endHold(); };

    const endHold = (): void => {
        held = false;
        window.removeEventListener('touchend', lifted, true);
        window.removeEventListener('touchcancel', lifted, true);
        window.removeEventListener('touchstart', pressed, true);
    };

    const onStart = (raw: Event): void => {
        const e = asEvents(raw);
        letGo();
        if (held) endHold();
        if (e.touches.length !== 1) return;
        const target = e.target as HTMLElement | null;
        if (!target || typeof target.closest !== 'function' || target.closest(EDITABLE)) return;

        const t = e.touches[0];
        finger = t.identifier;
        startX = t.clientX;
        startY = t.clientY;
        timer = setTimeout(() => {
            timer = null;
            if (finger === null) return;
            held = true;
            window.addEventListener('touchend', lifted, { capture: true, passive: false });
            window.addEventListener('touchcancel', lifted, { capture: true, passive: false });
            window.addEventListener('touchstart', pressed, { capture: true, passive: true });
            fire(startX, startY, target);
        }, holdMs);
    };

    const onMove = (raw: Event): void => {
        const e = asEvents(raw);
        if (finger === null) return;
        if (e.touches.length !== 1) { letGo(); return; }
        const t = Array.from(e.touches).find(f => f.identifier === finger);
        if (!t) { letGo(); return; }
        if (Math.hypot(t.clientX - startX, t.clientY - startY) > slop) letGo();
    };

    // A lift before the hold is a tap, and lets go of it.
    const onEnd = (): void => { if (!held) letGo(); };
    // The platform got there first: the hold gives way.
    const onContext = (): void => { if (!held) letGo(); };

    const listeners: [string, EventListener, AddEventListenerOptions?][] = [
        ['touchstart', onStart, { passive: true }],
        ['touchmove', onMove, { passive: true }],
        ['touchend', onEnd],
        ['touchcancel', onEnd],
        ['contextmenu', onContext],
    ];
    for (const [type, fn, opts] of listeners) container.addEventListener(type, fn, opts);

    return {
        isHeld: () => held,
        dispose(): void {
            letGo();
            if (held) endHold();
            for (const [type, fn] of listeners) container.removeEventListener(type, fn);
        },
    };
}
