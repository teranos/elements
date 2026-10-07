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
import { keepClearOfKeyboard, backFromKeyboard } from '../window/keyboard';
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

/** Fraction of viewport height at which panel snaps to fullscreen */
const FULLSCREEN_SNAP_THRESHOLD = 0.9;
/** Minimum panel height as fraction of viewport */
const MIN_PANEL_HEIGHT_FRACTION = 0.3;

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
/**
 * How far in from each side of the panel the tray reaches. The tray is the
 * package's own (tray/tray.ts); where it sits is the host's stylesheet's, so it
 * is measured, not assumed. An empty tray shows nothing and takes nothing.
 */
function trayEdges(at: DOMRect): { left: number; right: number } {
    // Asked of the page: tray.ts opens panels, so this file cannot import it.
    const tray = document.querySelector<HTMLElement>('body > .tray');
    if (!tray || tray.getAttribute('data-empty') === 'true') return { left: 0, right: 0 };
    const seen = tray.getBoundingClientRect();
    if (seen.width === 0) return { left: 0, right: 0 };
    const middle = at.left + at.width / 2;
    return seen.left >= middle
        ? { left: 0, right: Math.max(0, at.right - seen.left) }
        : { left: Math.max(0, seen.right - at.left), right: 0 };
}

function keepInsideSafeArea(panel: HTMLElement): void {
    const insets = safeAreaInsets();
    const at = panel.getBoundingClientRect();
    const top = Math.max(0, insets.top - at.top);
    const bottom = Math.max(0, at.bottom - (window.innerHeight - insets.bottom));
    panel.style.boxSizing = 'border-box';
    panel.style.paddingTop = `${top}px`;
    panel.style.paddingBottom = `${bottom}px`;
    // The tray's dots stay above every panel (tray/tray.ts); what the panel holds
    // stays clear of them as it does of the device's edges, so neither covers the other.
    const tray = trayEdges(at);
    panel.style.paddingLeft = `${Math.max(insets.left, tray.left)}px`;
    panel.style.paddingRight = `${Math.max(insets.right, tray.right)}px`;
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
        // A column that clips, as a window is (window/settle.ts): the body has the
        // height left under the title bar and scrolls inside it, never past the screen.
        element.style.display = 'flex';
        element.style.flexDirection = 'column';
        element.style.overflow = 'hidden';
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

        // Attach resize handle
        const cleanupFn = attachResizeHandle(element, direction);
        resizeCleanups.set(element, cleanupFn);
        keepInsideSafeArea(element);

        // Seen whole while a field in it has the keyboard up (window/keyboard.ts).
        keepClearOfKeyboard(element);
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
    // Where it stood before a keyboard came is where it leaves from.
    backFromKeyboard(panelElement);
    const currentRect = panelElement.getBoundingClientRect();

    // Clean up escape handler
    const handler = escapeHandlers.get(panelElement);
    if (handler) {
        document.removeEventListener('keydown', handler);
        escapeHandlers.delete(panelElement);
    }

    // Clean up resize handle
    cleanupResize(panelElement);

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
