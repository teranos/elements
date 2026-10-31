/**
 * Touch hold — a finger held still on a canvas, the phone's right-click.
 *
 * NOT YET WRITTEN. This is the shape the tests pin; every call is a no-op.
 */

export const HOLD_MS = 500;
export const HOLD_SLOP_PX = 10;

export interface TouchHoldOptions {
    holdMs?: number;
    slopPx?: number;
}

export interface TouchHold {
    /** From the moment a hold fired until its finger lifts, however long that is. */
    isHeld(): boolean;
    dispose(): void;
}

export function onTouchHold(
    _container: HTMLElement | Document,
    _fire: (clientX: number, clientY: number, target: HTMLElement) => void,
    _options: TouchHoldOptions = {},
): TouchHold {
    return { isHeld: () => false, dispose() {} };
}
