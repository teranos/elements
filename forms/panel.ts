/**
 * Panel Form - Full-width resizable workspace panel
 *
 * The element morphs from its tray dot into a full-width panel
 * via beginMorphToBox. The panel's target position is the OPPOSITE
 * edge of the system drawer (#system-drawer):
 * - Desktop: system drawer at bottom -> panel anchored to top
 * - Mobile: system drawer at top -> panel anchored to bottom
 *
 * The panel is the primary interaction surface for sustained work.
 * It opens at full viewport height, can be resized by dragging the
 * edge, and snaps to fullscreen when dragged past 90% height.
 * No overlay — the panel is a workspace, not a modal.
 *
 * Same single DOM element axiom — the element itself
 * becomes the panel, no cloning.
 */

import { getLogger, getLogSegment } from '../config';
import { safeAreaInsets } from '../safe-area';
import { applyRestingDotGeometry } from '../tray/proximity';
import { type Element, DEFAULT_COLOR, DEFAULT_TEXT_COLOR } from '../element';
import { wearIdentity, wearShadow } from '../paint';
import { addWindowControls } from './title-bar-controls';
import { homeOf } from './home';
import { disarmContentWatch } from '../content/watch';
import { stashContent } from '../content/stash';
import { renderContent } from '../content/render';
import {
    setForm,
    setElementId
} from '../dataset';
import { prepareMorphTo, calculateTrayTarget, resetElement } from './morphology';
import { beginMorphToBox, beginMorphToDot } from '../morph-transaction';
import {
    getOpenDuration,
    getRestDuration,
    PANEL_Z_INDEX
} from '../element';

// Type-safe element state — avoids `as any` on DOM elements
const escapeHandlers = new WeakMap<HTMLElement, (e: KeyboardEvent) => void>();
const minimizing = new WeakSet<HTMLElement>();
const resizeCleanups = new WeakMap<HTMLElement, () => void>();
const swipeCleanups = new WeakMap<HTMLElement, () => void>();

/** Fraction of viewport height at which panel snaps to fullscreen */
const FULLSCREEN_SNAP_THRESHOLD = 0.9;
/** Minimum panel height as fraction of viewport */
const MIN_PANEL_HEIGHT_FRACTION = 0.3;

// Swiped down by its title bar, a panel goes back to the tray (Apple Human
// Interface Guidelines, Sheets: "Support swiping to dismiss a sheet"). How far
// is far enough the HIG does not say; these are the package's.
/** Fraction of the screen's height that, dragged past, sends a panel to the tray */
const SWIPE_DISMISS_FRACTION = 0.25;
/** px/ms: a release this fast is a flick, and sends it to the tray from shorter */
const SWIPE_FLICK_SPEED = 0.5;
/** px: a flick shorter than this is a finger settling, not a flick */
const SWIPE_FLICK_MIN = 24;
/** ms: how long a panel let go short takes to come back */
const SWIPE_RETURN_MS = 200;

/**
 * A finger on the title bar drags the panel down after it. Let go far enough,
 * or with a flick, and it goes to the tray as its minimize button sends it;
 * short of that, it comes back. A press on a button in the bar is the button's.
 * The mouse is left to the bar as it was. Returns the listeners' removal.
 */
function attachSwipeToTray(panel: HTMLElement, titleBar: HTMLElement, toTray: () => void): () => void {
    const controller = new AbortController();
    const { signal } = controller;
    let startY = 0;
    let startAt = 0;
    let dy = 0;
    let swiping = false;

    const back = () => {
        const from = dy;
        swiping = false;
        dy = 0;
        panel.style.transform = '';
        if (from > 0 && typeof panel.animate === 'function') {
            panel.animate([{ transform: `translateY(${from}px)` }, { transform: 'none' }], { duration: SWIPE_RETURN_MS, easing: 'ease-out' });
        }
    };

    titleBar.addEventListener('touchstart', (e: TouchEvent) => {
        if (e.touches.length !== 1) return;
        if ((e.target as HTMLElement | null)?.closest?.('button')) return;
        swiping = true;
        startY = e.touches[0]!.clientY;
        startAt = performance.now();
        dy = 0;
    }, { signal, passive: true });

    titleBar.addEventListener('touchmove', (e: TouchEvent) => {
        if (!swiping) return;
        if (e.touches.length !== 1) { back(); return; }
        // The finger is moving the panel, not the page behind it.
        e.preventDefault();
        dy = Math.max(0, e.touches[0]!.clientY - startY);
        panel.style.transform = `translateY(${dy}px)`;
    }, { signal, passive: false });

    titleBar.addEventListener('touchend', () => {
        if (!swiping) return;
        const elapsed = Math.max(1, performance.now() - startAt);
        const far = dy >= window.innerHeight * SWIPE_DISMISS_FRACTION;
        const flick = dy >= SWIPE_FLICK_MIN && dy / elapsed >= SWIPE_FLICK_SPEED;
        if (!far && !flick) { back(); return; }
        // Where the finger left it is where it leaves from.
        swiping = false;
        panel.style.transform = '';
        panel.style.top = `${(parseFloat(panel.style.top) || 0) + dy}px`;
        dy = 0;
        toTray();
    }, { signal });

    titleBar.addEventListener('touchcancel', () => { if (swiping) back(); }, { signal });

    return () => {
        controller.abort();
        panel.style.transform = '';
    };
}

/**
 * Determine panel anchor edge — opposite of system drawer position.
 * The element morphs to this target; there is no separate slide animation.
 */
function detectSlideDirection(): 'from-top' | 'from-bottom' {
    const drawer = document.getElementById('system-drawer');
    if (!drawer) return 'from-top'; // Default: desktop layout

    const rect = drawer.getBoundingClientRect();
    const viewportMid = window.innerHeight / 2;
    // If drawer center is below viewport midpoint, it's at the bottom -> slide from top
    return (rect.top + rect.height / 2) > viewportMid ? 'from-top' : 'from-bottom';
}

/**
 * The panel's background fills the screen; what is in it stays inside the
 * safe area (Apple Human Interface Guidelines, Layout: "place foreground
 * elements like interactive controls within the safe area"). Its edge is
 * pulled in with it, so the edge stays something a finger can take.
 */
function keepInsideSafeArea(panel: HTMLElement): void {
    const insets = safeAreaInsets();
    const at = panel.getBoundingClientRect();
    const top = Math.max(0, insets.top - at.top);
    const bottom = Math.max(0, at.bottom - (window.innerHeight - insets.bottom));
    panel.style.boxSizing = 'border-box';
    panel.style.paddingTop = `${top}px`;
    panel.style.paddingBottom = `${bottom}px`;
    panel.style.paddingLeft = `${insets.left}px`;
    panel.style.paddingRight = `${insets.right}px`;
    const handle = panel.querySelector<HTMLElement>(':scope > .panel-resize-handle');
    if (handle?.classList.contains('panel-resize-handle--top')) handle.style.top = `${top}px`;
    if (handle?.classList.contains('panel-resize-handle--bottom')) handle.style.bottom = `${bottom}px`;
}

/**
 * Attach a resize handle to the panel's bottom (from-top) or top (from-bottom) edge.
 * Dragging adjusts panel height. Snaps to fullscreen past 90% viewport height.
 * Returns a cleanup function.
 */
function attachResizeHandle(
    panelElement: HTMLElement,
    direction: 'from-top' | 'from-bottom'
): () => void {
    const log = getLogger();
    const seg = getLogSegment();
    const handle = document.createElement('div');
    handle.className = direction === 'from-top'
        ? 'panel-resize-handle panel-resize-handle--bottom'
        : 'panel-resize-handle panel-resize-handle--top';
    panelElement.appendChild(handle);

    const controller = new AbortController();
    let isDragging = false;
    let startY = 0;
    let startHeight = 0;
    let dragController: AbortController | null = null;

    const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;

        const delta = direction === 'from-top'
            ? e.clientY - startY    // Dragging bottom edge down = taller
            : startY - e.clientY;   // Dragging top edge up = taller

        let newHeight = startHeight + delta;
        const vh = window.innerHeight;
        const minHeight = Math.round(vh * MIN_PANEL_HEIGHT_FRACTION);

        newHeight = Math.max(minHeight, Math.min(vh, newHeight));

        // Snap to fullscreen
        const isFullscreen = newHeight / vh >= FULLSCREEN_SNAP_THRESHOLD;
        if (isFullscreen) {
            newHeight = vh;
        }

        panelElement.style.height = `${newHeight}px`;
        panelElement.classList.toggle('panel--fullscreen', isFullscreen);

        // For from-bottom panels, also adjust top position
        if (direction === 'from-bottom') {
            panelElement.style.top = `${vh - newHeight}px`;
        }
        keepInsideSafeArea(panelElement);
    };

    const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        panelElement.classList.remove('panel--resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        dragController?.abort();
        dragController = null;

        log.debug(seg, `[Panel] Resized to ${panelElement.offsetHeight}px`);
    };

    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        startY = e.clientY;
        startHeight = panelElement.offsetHeight;

        panelElement.classList.add('panel--resizing');
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';

        dragController = new AbortController();
        document.addEventListener('mousemove', onMouseMove, { signal: dragController.signal });
        document.addEventListener('mouseup', onMouseUp, { signal: dragController.signal });
    }, { signal: controller.signal });

    return () => {
        controller.abort();
        dragController?.abort();
        handle.remove();
    };
}

/**
 * Morph an element to a full-width panel (no overlay)
 */
export function morphDotToPanel(
    element: HTMLElement,
    item: Element,
    verifyElement: (id: string, element: HTMLElement) => void,
    onRemove: (id: string) => void,
    onMinimize: (element: HTMLElement, item: Element) => void,
    // Content already rendered by a caller that measured it before deciding
    // this is a panel. Rendering again would build the element's content twice.
    preRenderedContent?: HTMLElement,
): void {
    const log = getLogger();
    const seg = getLogSegment();
    const morph = prepareMorphTo(element, item, verifyElement, 'panel', PANEL_Z_INDEX);
    const fromRect = morph.rect;

    const direction = detectSlideDirection();

    // Panel dimensions: full viewport width, full viewport height
    const panelWidth = window.innerWidth;
    const panelHeight = window.innerHeight;

    // Target position based on slide direction
    const targetX = 0;
    const targetY = direction === 'from-top' ? 0 : window.innerHeight - panelHeight;

    // Close on Escape
    const escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            document.removeEventListener('keydown', escapeHandler);
            morphPanelToDot(element, item, verifyElement, onMinimize);
        }
    };
    document.addEventListener('keydown', escapeHandler);
    escapeHandlers.set(element, escapeHandler);

    beginMorphToBox(
        element,
        fromRect,
        { x: targetX, y: targetY, width: panelWidth, height: panelHeight },
        getOpenDuration()
    ).then(() => {
        log.debug(seg, `[Panel] Animation committed for ${item.id}`);

        const directionClass = direction === 'from-top' ? 'panel--from-top' : 'panel--from-bottom';
        // Morph class leaves with the morph; the element's own classes survive
        morph.commitClass(`panel panel--fullscreen ${directionClass}`);
        element.style.cssText = '';
        element.style.position = 'fixed';
        element.style.left = `${targetX}px`;
        element.style.top = `${targetY}px`;
        element.style.width = `${panelWidth}px`;
        element.style.height = `${panelHeight}px`;
        element.style.zIndex = PANEL_Z_INDEX;
        element.style.backgroundColor = item.color ?? DEFAULT_COLOR;
        element.style.color = item.textColor ?? DEFAULT_TEXT_COLOR;
        wearIdentity(element, item);
        wearShadow(element, '');

        // Restore stashed content or render fresh (shared with window.ts)
        const { titleBar } = renderContent(element, item, 'Panel', preRenderedContent);

        // Add window controls (minimize/close) to the title bar
        addWindowControls(titleBar, {
            onMinimize: () => morphPanelToDot(element, item, verifyElement, onMinimize),
            onReturn: homeOf(element),
            onClose: item.onClose ? () => {
                const handler = escapeHandlers.get(element);
                if (handler) {
                    document.removeEventListener('keydown', handler);
                    escapeHandlers.delete(element);
                }
                cleanupResize(element);
                // A closed element is not an element that failed to draw.
                disarmContentWatch(element);
                onRemove(item.id);
                element.remove();
                try { item.onClose!(); } catch (error) {
                    log.error(seg, `[Panel ${item.id}] Error in onClose: ${error instanceof Error ? error.message : String(error)}`);
                }
            } : undefined,
        });

        // Swiped down by its title bar, it goes where the minimize button sends it.
        swipeCleanups.set(element, attachSwipeToTray(element, titleBar, () => morphPanelToDot(element, item, verifyElement, onMinimize)));

        // Attach resize handle
        const cleanupFn = attachResizeHandle(element, direction);
        resizeCleanups.set(element, cleanupFn);
        keepInsideSafeArea(element);
    }).catch(error => {
        log.warn(seg, `[Panel] Animation failed for ${item.id}: ${error instanceof Error ? error.message : String(error)}`);
        const handler = escapeHandlers.get(element);
        if (handler) {
            document.removeEventListener('keydown', handler);
            escapeHandlers.delete(element);
        }
        // Reattach to tray so the element isn't orphaned — with the classes it had
        setForm(element, 'dot');
        element.remove();
        element.style.cssText = '';
        morph.rollbackClass();
        applyRestingDotGeometry(element);
        setElementId(element, item.id);
        onMinimize(element, item);
    });
}

/** Clean up resize handler for a panel element */
function cleanupResize(element: HTMLElement): void {
    const cleanup = resizeCleanups.get(element);
    if (cleanup) {
        cleanup();
        resizeCleanups.delete(element);
    }
}

/**
 * What a panel takes with it when it goes, wherever it goes: its Escape, its
 * edge, and its content into the stash. Returns where it was, for the road out.
 */
export function leavePanel(panelElement: HTMLElement): DOMRect {
    const currentRect = panelElement.getBoundingClientRect();

    // Clean up escape handler
    const handler = escapeHandlers.get(panelElement);
    if (handler) {
        document.removeEventListener('keydown', handler);
        escapeHandlers.delete(panelElement);
    }

    // Clean up resize handle
    cleanupResize(panelElement);

    // And the swipe on its title bar: the bar goes to the stash, and comes back to a new panel.
    swipeCleanups.get(panelElement)?.();
    swipeCleanups.delete(panelElement);

    // Stash content (strips window controls, preserves element identity off-DOM)
    stashContent(panelElement);
    return currentRect;
}

/**
 * Morph a panel back into an element (dot)
 */
export function morphPanelToDot(
    panelElement: HTMLElement,
    item: Element,
    verifyElement: (id: string, element: HTMLElement) => void,
    onMorphComplete: (element: HTMLElement, item: Element) => void
): void {
    const log = getLogger();
    const seg = getLogSegment();
    // Re-entrance guard: Escape can fire in quick succession
    if (minimizing.has(panelElement)) return;
    minimizing.add(panelElement);

    verifyElement(item.id, panelElement);
    log.debug(seg, `[Panel] Minimizing ${item.id}`);

    const currentRect = leavePanel(panelElement);

    const trayTarget = calculateTrayTarget(item.id);

    beginMorphToDot(panelElement, currentRect, trayTarget, getRestDuration())
        .then(() => {
            minimizing.delete(panelElement);
            resetElement(panelElement, item, 'Panel', onMorphComplete);
        })
        .catch(error => {
            log.warn(seg, `[Panel] Animation failed for ${item.id}: ${error instanceof Error ? error.message : String(error)}`);
            minimizing.delete(panelElement);
        });
}
