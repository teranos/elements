/**
 * The tray's place, layout and motion, as hand-tuned.
 *
 * Written inline by the package, as a dot's size is (tray/proximity.ts), so no
 * host keeps its own copy of them. Font, text colour and border colour are a
 * host's theme and stay in its stylesheet.
 */

/** A phone: the dots further apart, for a finger. */
const PHONE = '(max-width: 768px)';

const DOT_LOOK: Record<string, string> = {
    transition: 'all 0.2s ease-out',
    boxSizing: 'border-box',
    // Anchored right: a dot grows leftward.
    marginLeft: 'auto',
    pointerEvents: 'auto',
    cursor: 'pointer',
};

/** The tray at the right edge, centred down the screen, and its column of dots. */
export function wearTrayLook(trayEl: HTMLElement, dots: HTMLElement): void {
    Object.assign(trayEl.style, {
        position: 'fixed',
        top: '50%',
        right: '4px',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        // Only the dots take the pointer, and a thumb browsing the tray is not a scroll.
        pointerEvents: 'none',
        touchAction: 'none',
    });
    Object.assign(dots.style, {
        display: 'flex',
        flexDirection: 'column',
        width: 'fit-content',
        height: 'fit-content',
        transition: 'opacity 0.2s ease',
    });
    const phone = typeof window.matchMedia === 'function' ? window.matchMedia(PHONE) : null;
    const gap = () => { dots.style.gap = phone?.matches ? '6px' : '2px'; };
    gap();
    phone?.addEventListener?.('change', gap);
}

/** A dot at rest: it glides to every size the proximity engine gives it. */
export function wearDotLook(dot: HTMLElement): void {
    Object.assign(dot.style, DOT_LOOK);
}

/** A dot leaving rest: the morph moves it, not the transition. */
export function takeOffDotLook(dot: HTMLElement): void {
    for (const property of Object.keys(DOT_LOOK)) (dot.style as any)[property] = '';
}
