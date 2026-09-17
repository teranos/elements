/**
 * Canvas-Placed Form — shared wrapper for elements on the canvas workspace.
 *
 * Every canvas-placed element needs:  container, position, drag, and (usually)
 * a title bar and resize handle.  This module provides all of that so each
 * element factory only has to supply its content.
 *
 * Usage:
 *   const { element, titleBar } = canvasPlaced({ element, className, ... });
 *   element.appendChild(myContent);        // factory adds its content
 *   titleBar?.appendChild(extraButton);    // optional: extend the title bar
 */

import type { Element } from '../element';
import { DEFAULT_COLOR, DEFAULT_TEXT_COLOR } from '../element';
import { setSymbol } from '../dataset';
import { createSymbolSpan, settleSymbolSpan } from '../symbol-span';
import { applyCanvasElementLayout, makeDraggable, preventDrag } from './drag';
import { makeResizable } from './resize';
import { storeCleanup } from './cleanup';
import type { MakeDraggableOptions } from './element-ui';

// ── Config ──────────────────────────────────────────────────────────

export interface CanvasPlacedConfig {
    item: Element;
    /** Type-specific CSS class (e.g. 'canvas-py-element'). Joined with 'canvas-element'. */
    className: string;
    /** Default position and size when element has no saved layout. */
    defaults: { x: number; y: number; width: number; height: number };
    /** Title bar with label and optional action buttons. Omit for no title bar. */
    titleBar?: { label: string; actions?: HTMLElement[] };
    /** Custom drag handle. Falls back to title bar, then element. */
    dragHandle?: HTMLElement;
    /** Extra options forwarded to makeDraggable. */
    draggableOptions?: Partial<MakeDraggableOptions>;
    /** Enable resize handle. Pass object for custom min dimensions. */
    resizable?: boolean | { minWidth?: number; minHeight?: number };
    /** Extra CSS class(es) for the resize handle (e.g. 'resize-handle--small'). */
    resizeHandleClass?: string;
    /** Label for drag/resize log messages (e.g. 'PyElement'). */
    logLabel: string;
    /** Use minHeight instead of height (for auto-sizing elements). */
    useMinHeight?: boolean;
    /** Existing element to populate (for conversion support). Creates new div if omitted. */
    element?: HTMLElement;
}

export interface CanvasPlacedResult {
    element: HTMLElement;
    titleBar: HTMLElement | null;
}

// ── Factory ─────────────────────────────────────────────────────────

export function canvasPlaced(config: CanvasPlacedConfig): CanvasPlacedResult {
    const { item, className, defaults, logLabel } = config;

    // Container — reuse cursor element from placement mode if available
    const element = config.element ?? item.cursorElement ?? document.createElement('div');
    element.className = `${className} canvas-element`;
    element.dataset.elementId = item.id;
    setSymbol(element, item.symbol);
    element.style.backgroundColor = item.color ?? DEFAULT_COLOR;
    element.style.color = item.textColor ?? DEFAULT_TEXT_COLOR;
    if (item.border) element.style.border = item.border;
    element.style.backdropFilter = 'blur(2px)';

    // Layout
    applyCanvasElementLayout(element, {
        x: item.x ?? defaults.x,
        y: item.y ?? defaults.y,
        width: item.width ?? defaults.width,
        height: item.height ?? defaults.height,
        useMinHeight: config.useMinHeight,
    });

    // Title bar
    let titleBar: HTMLElement | null = null;
    if (config.titleBar) {
        titleBar = document.createElement('div');
        titleBar.className = 'title-bar';

        // Symbol — reuse the span carried across the cursor morph, or render
        // item.symbol natively
        if (item.symbolElement) {
            titleBar.appendChild(settleSymbolSpan(item.symbolElement));
        } else if (item.symbol) {
            titleBar.appendChild(createSymbolSpan(item.symbol));
        }

        const label = document.createElement('span');
        label.textContent = config.titleBar.label;
        titleBar.appendChild(label);

        if (config.titleBar.actions) {
            for (const action of config.titleBar.actions) {
                preventDrag(action);
                titleBar.appendChild(action);
            }
        }

        element.appendChild(titleBar);
    }

    // Drag
    const dragHandle = config.dragHandle ?? titleBar ?? element;
    const cleanupDrag = makeDraggable(element, dragHandle, item, {
        logLabel,
        ...config.draggableOptions,
    });
    storeCleanup(element, cleanupDrag);

    // Resize
    if (config.resizable) {
        const handle = document.createElement('div');
        handle.className = config.resizeHandleClass
            ? `resize-handle ${config.resizeHandleClass}`
            : 'resize-handle';
        element.appendChild(handle);

        const resizeOpts = typeof config.resizable === 'object' ? config.resizable : {};
        const cleanupResize = makeResizable(element, handle, item, {
            logLabel,
            ...resizeOpts,
        });
        storeCleanup(element, cleanupResize);
    }

    return { element, titleBar };
}
