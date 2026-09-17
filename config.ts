/**
 * @qntx/glyphs configuration
 *
 * Dependency injection for host-specific implementations.
 * Call configureElements() at startup to wire in your app's logger
 * and persistence layer.
 *
 * Defaults are safe no-ops so the package works standalone.
 */

import type { CompositionState } from './composition';

export interface Logger {
    debug(segment: string, message: string, metadata?: Record<string, unknown>): void;
    info(segment: string, message: string, metadata?: Record<string, unknown>): void;
    warn(segment: string, message: string, metadata?: Record<string, unknown>): void;
    error(segment: string, message: string, metadata?: Record<string, unknown>): void;
}

export interface Persistence {
    /** Ids of the glyphs resting in the tray */
    getResting(): string[];
    /** A glyph has come to rest in the tray */
    addResting(id: string): void;
    /** A glyph has left the tray for good */
    removeResting(id: string): void;
}

/** Element position and dimensions on a canvas. */
export interface CanvasElementData {
    id: string;
    symbol: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    content?: string;
    canvas_id?: string;
}

/** Host-provided canvas state — persistence, transform, selection, sync. */
export interface CanvasHost {
    saveCanvasElement(item: CanvasElementData): void;
    getCanvasElements(canvasId?: string): CanvasElementData[];
    getTransform(canvasId: string): { panX: number; panY: number; scale: number };
    getSelectedElementIds(canvasId: string): string[];
    isElementSelected(canvasId: string, elementId: string): boolean;
    saveComposition(composition: CompositionState): void;
    removeComposition(id: string): void;
    findCompositionByElement(elementId: string): CompositionState | null;
    flushSync(): void;
}

/** Coordinate transforms between canvas-local and screen-space. */
export interface CanvasCoordinateBridge {
    toScreen(canvasId: string, x: number, y: number): { x: number; y: number };
    fromScreen(canvasId: string, x: number, y: number): { x: number; y: number };
    getScale(canvasId: string): number;
}

/**
 * Geometry of the dot — the glyph at rest — and of its fully expanded proximity state.
 *
 * The proximity engine interpolates between min (proximity 0) and max (proximity 1)
 * and writes the result as inline styles, so a host cannot reach this through CSS.
 * It reaches it here instead. Every field is optional; anything omitted keeps the
 * default. All values are px.
 */
export interface DotGeometry {
    /** Dot width at rest. Default 10. */
    minWidth?: number;
    /** Dot height at rest. Default 10. */
    minHeight?: number;
    /** Width when fully expanded. Default 220. */
    maxWidth?: number;
    /** Height when fully expanded. Default 32. */
    maxHeight?: number;
    /** Border radius at rest; interpolates to 0 when fully expanded. Default 2. */
    borderRadiusMax?: number;
}

export interface ElementConfig {
    logger?: Logger;
    logSegment?: string;
    persistence?: Persistence;
    /** Canvas coordinate transforms — required for canvas-window morphs. */
    canvas?: CanvasCoordinateBridge;
    /** Canvas host — persistence, transform, selection, composition CRUD. */
    canvasHost?: CanvasHost;
    /** Called when a glyph is removed from the canvas (close/minimize). */
    removeCanvasElement?: (elementId: string) => void;
    /** Dot and expanded-state dimensions used by the proximity engine. */
    dotGeometry?: DotGeometry;
    /** Corner radius of an opened window. Written inline, so CSS cannot reach it. */
    windowBorderRadius?: string;
}

// Default no-op logger
const noopLogger: Logger = {
    debug() {},
    info() {},
    warn() {},
    error() {},
};

// Default no-op persistence
const noopPersistence: Persistence = {
    getResting: () => [],
    addResting() {},
    removeResting() {},
};

// Default no-op canvas host
const noopCanvasHost: CanvasHost = {
    saveCanvasElement() {},
    getCanvasElements: () => [],
    getTransform: () => ({ panX: 0, panY: 0, scale: 1 }),
    getSelectedElementIds: () => [],
    isElementSelected: () => false,
    saveComposition() {},
    removeComposition() {},
    findCompositionByElement: () => null,
    flushSync() {},
};

// Default dot geometry — the numbers the proximity engine used to hardcode
const defaultDotGeometry: Required<DotGeometry> = {
    minWidth: 10,
    minHeight: 10,
    maxWidth: 220,
    maxHeight: 32,
    borderRadiusMax: 2,
};

// Active configuration — starts with defaults
let config: {
    logger: Logger;
    logSegment: string;
    persistence: Persistence;
    canvas: CanvasCoordinateBridge | null;
    canvasHost: CanvasHost;
    removeCanvasElement: ((elementId: string) => void) | null;
    dotGeometry: Required<DotGeometry>;
    windowBorderRadius: string;
} = {
    logger: noopLogger,
    logSegment: 'ELEMENT',
    persistence: noopPersistence,
    canvas: null,
    canvasHost: noopCanvasHost,
    removeCanvasElement: null,
    dotGeometry: defaultDotGeometry,
    windowBorderRadius: '8px',
};

/**
 * Configure the glyph package with host-specific implementations.
 * Call once at app startup.
 */
export function configureElements(opts: ElementConfig): void {
    if (opts.logger) config.logger = opts.logger;
    if (opts.logSegment) config.logSegment = opts.logSegment;
    if (opts.persistence) config.persistence = opts.persistence;
    if (opts.canvas) config.canvas = opts.canvas;
    if (opts.canvasHost) config.canvasHost = opts.canvasHost;
    if (opts.removeCanvasElement) config.removeCanvasElement = opts.removeCanvasElement;
    if (opts.windowBorderRadius !== undefined) config.windowBorderRadius = opts.windowBorderRadius;
    if (opts.dotGeometry) {
        // Field by field, so a partial geometry merges instead of replacing, and
        // so 0 means 0 (a truthiness check would silently drop a zero radius).
        const g = opts.dotGeometry;
        const merged = { ...config.dotGeometry };
        if (typeof g.minWidth === 'number') merged.minWidth = g.minWidth;
        if (typeof g.minHeight === 'number') merged.minHeight = g.minHeight;
        if (typeof g.maxWidth === 'number') merged.maxWidth = g.maxWidth;
        if (typeof g.maxHeight === 'number') merged.maxHeight = g.maxHeight;
        if (typeof g.borderRadiusMax === 'number') merged.borderRadiusMax = g.borderRadiusMax;
        config.dotGeometry = merged;
    }
}

/** Get the active logger */
export function getLogger(): Logger {
    return config.logger;
}

/** Get the log segment string */
export function getLogSegment(): string {
    return config.logSegment;
}

/** Get the active persistence layer */
export function getPersistence(): Persistence {
    return config.persistence;
}

/** Get the active canvas host */
export function getCanvasHost(): CanvasHost {
    return config.canvasHost;
}

/** Get the dot geometry, every field resolved to a number */
export function getDotGeometry(): Required<DotGeometry> {
    return config.dotGeometry;
}

/** Corner radius an opened window commits to. */
export function getWindowBorderRadius(): string {
    return config.windowBorderRadius;
}

/** Get the canvas coordinate bridge (null if not configured). */
export function getCanvasBridge(): CanvasCoordinateBridge | null {
    return config.canvas;
}

/** Remove a glyph from canvas state. No-op if not configured. */
export function removeCanvasElement(elementId: string): void {
    config.removeCanvasElement?.(elementId);
}
