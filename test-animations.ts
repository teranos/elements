/**
 * The Web Animations API, played, for the test DOMs that lack it.
 *
 * Neither happy-dom nor JSDOM implements element.animate, so a morph there takes
 * its new state at once (morph-transaction.ts, runOrTake). A test that is about
 * the road itself installs this: every road is recorded, and finishes on the
 * next turn unless it is cancelled first.
 */

export interface Road {
    element: HTMLElement;
    keyframes: Keyframe[];
}

export interface Played {
    /** Every road played since installed, in order. */
    roads: Road[];
    /** The keyframes of each road one element took. */
    of(element: HTMLElement): Keyframe[][];
    /** Takes the stand-in away again. */
    restore(): void;
}

export function playAnimations(): Played {
    const proto = (globalThis.window as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement.prototype as unknown as { animate?: unknown };
    const had = proto.animate;
    const roads: Road[] = [];

    proto.animate = function (this: HTMLElement, keyframes: Keyframe[]) {
        roads.push({ element: this, keyframes });
        const handlers: Record<string, (() => void)[]> = {};
        let over = false;
        const fire = (type: string) => {
            if (over) return;
            over = true;
            (handlers[type] ?? []).slice().forEach((fn) => fn());
        };
        setTimeout(() => fire('finish'), 1);
        return {
            addEventListener: (type: string, fn: () => void) => { (handlers[type] ??= []).push(fn); },
            removeEventListener: (type: string, fn: () => void) => {
                handlers[type] = (handlers[type] ?? []).filter((h) => h !== fn);
            },
            cancel: () => fire('cancel'),
        };
    };

    return {
        roads,
        of: (element) => roads.filter((r) => r.element === element).map((r) => r.keyframes),
        restore: () => { proto.animate = had; },
    };
}
