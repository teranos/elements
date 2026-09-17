/**
 * Expand-to-Window — unified lifecycle for canvas ↔ window ↔ tray morphing.
 *
 * Replaces the copy-pasted expand-button click handler that existed in every
 * element file (attestation, note, response, plugin-module). Each element now
 * passes a config object and gets the full bidirectional morph for free.
 */

import { getLogger, getLogSegment, removeCanvasElement } from './config';
import { getForm } from './dataset';
import { getTray } from './tray/tray';
import type { Element } from './element';
import {
    morphCanvasPlacedToWindow,
    placeWindowOnCanvas,
} from './forms/canvas-window';

// ── Public API ───────────────────────────────────────────────────────

export interface ExpandToWindowConfig {
    /** The canvas-placed element. */
    element: HTMLElement;
    /** The expand/collapse button. */
    expandBtn: HTMLElement;
    /** Element identity. */
    elementId: string;
    /** Window title and tray label. */
    title: string;
    /** Symbol for the tray dot. */
    symbol: string;
    /** Factory for tray content when minimized. */
    renderContent: () => HTMLElement;
    /** Log label prefix (e.g. 'AsElement', 'NoteElement'). */
    logLabel?: string;
    /** Visual identity for tray dot. */
    color?: string;
    textColor?: string;
    border?: string;
    /** Called after restoring to canvas — re-apply visual identity, save dims, etc. */
    onRestoreToCanvas?: (element: HTMLElement) => void;
    /** Extra fields forwarded to tray.adopt() (e.g. renderTitleBar, opensAs). */
    adoptExtras?: Partial<Element>;
    /** Whether to stopPropagation on click (needed for cloned buttons). */
    stopPropagation?: boolean;
}

/**
 * Wire an expand button with the full canvas ↔ window ↔ tray lifecycle.
 *
 * On click when on canvas: morphs to floating window with minimize-to-tray
 * and close. On click when in window: places back on canvas.
 */
export function wireExpandToWindow(config: ExpandToWindowConfig): void {
    const {
        element,
        expandBtn,
        elementId,
        title,
        symbol,
        renderContent,
        logLabel,
        color,
        textColor,
        border,
        onRestoreToCanvas,
        adoptExtras,
        stopPropagation,
    } = config;

    const label = logLabel ?? 'Element';

    expandBtn.addEventListener('click', (e) => {
        if (stopPropagation) e.stopPropagation();

        const log = getLogger();
        const seg = getLogSegment();

        // Already off the canvas → place it back on. What isInWindowState()
        // answered here: a window, or a canvas-placed element filling the viewport.
        const form = getForm(element);
        if (form === 'window' || form === 'canvasExpanded') {
            placeWindowOnCanvas(element, {
                onRestoreComplete: (el) => {
                    expandBtn.textContent = '\u2B06'; // ⬆
                    expandBtn.title = 'Expand to window';
                    onRestoreToCanvas?.(el);
                    log.debug(seg, `[${label}] Placed on canvas ${elementId}`);
                },
            });
            return;
        }

        // On canvas → morph to window
        const canvas = element.closest('.canvas-workspace') as HTMLElement | null;
        const canvasId = (canvas?.closest('[data-canvas-id]') as HTMLElement | null)?.dataset?.canvasId ?? 'canvas-workspace';

        morphCanvasPlacedToWindow(element, {
            title,
            canvasId,
            onClose: () => {
                element.remove();
                removeCanvasElement(elementId);
                log.debug(seg, `[${label}] Closed from window ${elementId}`);
            },
            onMinimize: (el: HTMLElement) => {
                getTray().adopt(el, {
                    id: elementId,
                    title,
                    symbol,
                    color,
                    textColor,
                    border,
                    renderContent,
                    onClose: () => {
                        log.debug(seg, `[${label}] Closed from tray ${elementId}`);
                    },
                    ...adoptExtras,
                });
                log.debug(seg, `[${label}] Minimized to tray ${elementId}`);
            },
            onRestoreComplete: (el) => {
                onRestoreToCanvas?.(el);
                log.debug(seg, `[${label}] Restored to canvas ${elementId}`);
            },
        });

        expandBtn.textContent = '\u2B07'; // ⬇
        expandBtn.title = 'Place on canvas';
    });
}
