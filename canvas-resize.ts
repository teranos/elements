/**
 * Canvas resize interaction for glyphs.
 *
 * Enables resize via a handle (typically in the bottom-right corner).
 * Final dimensions are persisted via CanvasHost.
 */

import type { Element } from './element';
import { getLogger, getLogSegment, getCanvasHost } from './config';

export interface MakeResizableOptions {
    /** Label used in log messages, e.g. "PyElement". */
    logLabel?: string;
    /** Minimum width in pixels (default: 200). */
    minWidth?: number;
    /** Minimum height in pixels (default: 120). */
    minHeight?: number;
}

/**
 * Make an element resizable by a handle.
 *
 * @param element - The element to make resizable
 * @param handle - The resize handle element
 * @param glyph - The glyph model to update with dimensions
 * @param opts - Optional configuration
 */
export function makeResizable(
    element: HTMLElement,
    handle: HTMLElement,
    item: Element,
    opts: MakeResizableOptions = {},
): () => void {
    const { logLabel = 'Element', minWidth = 200, minHeight = 120 } = opts;
    const log = getLogger();
    const seg = getLogSegment();
    const canvasHost = getCanvasHost();

    const setupController = new AbortController();
    let isResizing = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    let abortController: AbortController | null = null;
    let resizeCanvasId = '';

    const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;

        const scale = canvasHost.getTransform(resizeCanvasId).scale || 1;
        const deltaX = (e.clientX - startX) / scale;
        const deltaY = (e.clientY - startY) / scale;

        const newWidth = Math.max(minWidth, startWidth + deltaX);
        const newHeight = Math.max(minHeight, startHeight + deltaY);

        element.style.width = `${newWidth}px`;
        element.style.height = `${newHeight}px`;
    };

    const handleMouseUp = () => {
        if (!isResizing) return;
        isResizing = false;

        element.classList.remove('is-resizing');

        const finalWidth = element.offsetWidth;
        const finalHeight = element.offsetHeight;

        item.width = finalWidth;
        item.height = finalHeight;

        if (item.symbol && item.x !== undefined && item.y !== undefined) {
            const existing = canvasHost.getCanvasElements().find(g => g.id === item.id);
            canvasHost.saveCanvasElement({
                ...existing,
                id: item.id,
                symbol: item.symbol,
                x: item.x,
                y: item.y,
                width: finalWidth,
                height: finalHeight,
            });
        }

        log.debug(seg, `[${logLabel}] Finished resizing to ${finalWidth}x${finalHeight}`);

        abortController?.abort();
        abortController = null;
    };

    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;

        startX = e.clientX;
        startY = e.clientY;
        resizeCanvasId = (element.closest('[data-canvas-id]') as HTMLElement | null)?.dataset?.canvasId ?? '';
        startWidth = element.offsetWidth;
        startHeight = element.offsetHeight;

        element.classList.add('is-resizing');

        abortController = new AbortController();
        document.addEventListener('mousemove', handleMouseMove, { signal: abortController.signal });
        document.addEventListener('mouseup', handleMouseUp, { signal: abortController.signal });

        log.debug(seg, `[${logLabel}] Started resizing`);
    }, { signal: setupController.signal });

    return () => {
        setupController.abort();
        abortController?.abort();
    };
}
