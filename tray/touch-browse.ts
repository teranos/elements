/**
 * Touch browse — hold thumb near tray, slide to browse, release to open.
 *
 * Separated from tray.ts because touch interaction is a self-contained
 * concern with its own state (suppressNextClick, activation zone).
 */

import { getLogger, getLogSegment } from '../config';
import type { Proximity } from './proximity';
import type { Element } from '../element';

// How close to the tray's edge the touch must land (px)
const TOUCH_ACTIVATION_MARGIN = 44;

// Minimum proximity factor to count as "thumb was on this element"
const MIN_PROXIMITY_THRESHOLD = 0.3;

export interface TouchBrowseHost {
    readonly element: HTMLElement | null;
    readonly indicatorContainer: HTMLElement | null;
    readonly proximity: Proximity;
    readonly items: Map<string, Element>;
    updateProximity(): void;
    morphElement(element: HTMLElement, item: Element): void;
}

/**
 * Find the element dot with the highest proximity factor.
 * Returns the element and its Element data, or null if nothing is close enough.
 */
export function findPeakedElement(host: TouchBrowseHost): { element: HTMLElement; item: Element } | null {
    if (!host.indicatorContainer) return null;

    const dots = Array.from(
        host.indicatorContainer.querySelectorAll('.dot')
    ) as HTMLElement[];

    let bestProximity = 0;
    let bestElement: HTMLElement | null = null;

    dots.forEach((dot) => {
        const { proximityRaw } = host.proximity.calculateProximity(dot);
        if (proximityRaw > bestProximity) {
            bestProximity = proximityRaw;
            bestElement = dot;
        }
    });

    if (!bestElement || bestProximity < MIN_PROXIMITY_THRESHOLD) {
        return null;
    }

    const elementId = (bestElement as HTMLElement).dataset.elementId ?? '';
    const item = host.items.get(elementId);
    if (!item) return null;

    return { element: bestElement, item };
}

/**
 * Set up touch browse on the document.
 *
 * touchstart near the tray edge enters browse mode.
 * touchmove slides through elements — proximity morphing shows labels.
 * touchend opens the element with highest proximity.
 *
 * Suppresses the synthetic click that would otherwise fire on the 8px dot.
 */
export function setupTouchBrowse(host: TouchBrowseHost): void {
    const log = getLogger();
    const seg = getLogSegment();

    let suppressNextClick = false;

    document.addEventListener('touchstart', (e) => {
        if (!host.element || !host.indicatorContainer) return;
        if (host.items.size === 0) return;

        const touch = e.touches[0];
        if (!touch) return;

        // A touch on a button or an open element is not a browse, however
        // close to the tray it lands — its own interaction wins. Only dots,
        // the tray, and bare page near the tray start a browse.
        // (e.target can be the document itself, which has no closest().)
        const target = e.target as HTMLElement | null;
        if (target && typeof target.closest === 'function') {
            if (target.closest('button')) return;
            const owner = target.closest('[data-element-id]') as HTMLElement | null;
            if (owner && !owner.classList.contains('dot')) return;
        }

        const trayRect = host.element.getBoundingClientRect();
        const withinX = touch.clientX >= trayRect.left - TOUCH_ACTIVATION_MARGIN
                     && touch.clientX <= trayRect.right + TOUCH_ACTIVATION_MARGIN;
        const withinY = touch.clientY >= trayRect.top - TOUCH_ACTIVATION_MARGIN
                     && touch.clientY <= trayRect.bottom + TOUCH_ACTIVATION_MARGIN;

        if (!withinX || !withinY) return;

        e.preventDefault();
        host.proximity.isTouchBrowsing = true;
        host.proximity.setPointerPosition(touch.clientX, touch.clientY);
        host.updateProximity();

        log.debug(seg, `[Tray] Touch browse started at ${touch.clientX},${touch.clientY} with ${host.items.size} elements`);
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (!host.proximity.isTouchBrowsing) return;

        const touch = e.touches[0];
        if (!touch) return;

        e.preventDefault();
        host.proximity.setPointerPosition(touch.clientX, touch.clientY);
        host.updateProximity();
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (!host.proximity.isTouchBrowsing) return;

        host.proximity.isTouchBrowsing = false;

        const peaked = findPeakedElement(host);

        host.proximity.setPointerPosition(-9999, -9999);
        host.updateProximity();

        if (peaked) {
            suppressNextClick = true;
            log.debug(seg, `[Tray] Touch browse selected ${peaked.item.id}`);
            host.morphElement(peaked.element, peaked.item);
        } else {
            log.debug(seg, '[Tray] Touch browse ended with no selection');
        }
    });

    // Suppress synthetic click after touch browse.
    // Capture phase so we catch it before the element's own click handler.
    document.addEventListener('click', (e) => {
        if (!suppressNextClick) return;
        suppressNextClick = false;

        const target = e.target as HTMLElement;
        if (target.closest('.dot')) {
            e.stopPropagation();
            e.preventDefault();
            log.debug(seg, '[Tray] Suppressed post-browse synthetic click');
        }
    }, { capture: true });
}
