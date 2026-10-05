/**
 * The safe area: the part of the screen the device keeps nothing over.
 *
 * Apple Human Interface Guidelines, Layout: "place foreground elements like
 * interactive controls within the safe area", and let background elements fill
 * the available space. On a phone the status bar, the Dynamic Island, the home
 * indicator and the rounded corners are the device's; a control under them
 * cannot be pressed.
 *
 * The browser says where those edges are as env(safe-area-inset-*), once the
 * page asks to draw edge to edge (viewport-fit=cover). A host or a test may
 * say it instead, with --elements-safe-area-top, -right, -bottom and -left.
 */

import type { Rect } from './window/placement';

export interface Insets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

const EDGES = ['top', 'right', 'bottom', 'left'] as const;

/** How far in from each edge of the screen the device's own things reach. */
export function safeAreaInsets(): Insets {
    const insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
    if (typeof document === 'undefined' || !document.body) return insets;
    const probe = document.createElement('div');
    probe.style.position = 'fixed';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    for (const edge of EDGES) {
        probe.style.setProperty(`padding-${edge}`, `var(--elements-safe-area-${edge}, env(safe-area-inset-${edge}, 0px))`);
    }
    document.body.appendChild(probe);
    const style = window.getComputedStyle(probe);
    for (const edge of EDGES) {
        // A DOM that cannot resolve var() or env() says nothing a number can be read from.
        const read = parseFloat(style.getPropertyValue(`padding-${edge}`));
        insets[edge] = Number.isFinite(read) && read > 0 ? read : 0;
    }
    probe.remove();
    return insets;
}

/**
 * What a person can see of the safe area: less what an on-screen keyboard covers.
 *
 * iOS Safari and Chrome on Android leave a fixed element where it is and let the
 * keyboard cover it; what shrinks is the visual viewport. A browser without one
 * says nothing about a keyboard, and the visible area is the safe area.
 */
export function visibleArea(): Rect {
    const area = safeArea();
    const vv = (window as { visualViewport?: VisualViewport | null }).visualViewport;
    if (!vv) return area;
    const left = Math.max(area.x, vv.offsetLeft);
    const top = Math.max(area.y, vv.offsetTop);
    const right = Math.min(area.x + area.width, vv.offsetLeft + vv.width);
    const bottom = Math.min(area.y + area.height, vv.offsetTop + vv.height);
    return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** The safe area itself, in the coordinates a fixed element is placed in. */
export function safeArea(): Rect {
    const i = safeAreaInsets();
    return {
        x: i.left,
        y: i.top,
        width: Math.max(0, window.innerWidth - i.left - i.right),
        height: Math.max(0, window.innerHeight - i.top - i.bottom),
    };
}
