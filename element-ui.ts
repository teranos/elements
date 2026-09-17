/**
 * ElementUI — type definitions for building elements.
 */

import type { Element } from './element';

// ── Render contract ──────────────────────────────────────────────────

/** The render function a plugin module must export. */
export type RenderFn = (item: Element, ui: ElementUI) => HTMLElement | Promise<HTMLElement>;

// A plugin provides its own UI. This is the whole of it: a module that exports these two.
export interface ElementModule {
    render: RenderFn;
    def?: ElementDef;
}

/** Self-describing metadata exported by pure TS plugin modules. */
export interface ElementDef {
    symbol: string;
    title: string;
    label: string;
    // A plugin's UI is a panel in the tray, a peer of Database and Handlers.
    // Narrower than TrayDestination: a plugin does not open as a window.
    form?: 'panel' | 'workspace';
    defaultWidth?: number;
    defaultHeight?: number;
}

// ── UI interface ─────────────────────────────────────────────────────

/** UI interface injected into element render functions. */
export interface ElementUI {
    /**
     * Create a canvas-placed element with title bar, drag, and resize.
     * Returns a content area — the scrollable body below the title bar.
     * Append plugin content into `content`, not `element`.
     */
    element(opts: ElementOpts): { element: HTMLElement; titleBar: HTMLElement | null; content: HTMLElement };

    /** Prevent drag from starting on interactive children. */
    preventDrag(...elements: HTMLElement[]): void;

    /**
     * Fetch from this element's HTTP endpoints.
     * Path is relative to /api/{name}/ — e.g., pluginFetch('/execute', ...).
     */
    pluginFetch(path: string, opts?: FetchOpts): Promise<Response>;

    /** Structured logging with [{name}] prefix. */
    log: {
        debug(msg: string, ...args: unknown[]): void;
        info(msg: string, ...args: unknown[]): void;
        warn(msg: string, ...args: unknown[]): void;
        error(msg: string, ...args: unknown[]): void;
    };

    /** Register a cleanup function called when the element is removed. */
    onCleanup(fn: () => void): void;

    /** Create a text input with drag protection already applied. */
    input(opts?: { label?: string; placeholder?: string; value?: string; type?: string }): HTMLElement;

    /** Create a button. */
    button(opts: { label: string; onClick: () => void; primary?: boolean }): HTMLButtonElement;

    /**
     * Create a status line for showing feedback messages.
     * TODO: Weak design element — useful concept (contextual feedback next to the
     * action that caused it) but visually underwhelming. Rethink the presentation.
     */
    statusLine(): { element: HTMLElement; show(msg: string, isError?: boolean): void; clear(): void };

    /**
     * Open a WebSocket to this element's WS endpoint.
     * Constructs the full URL from backend config — no hardcoded ports.
     */
    pluginWebSocket(params?: Record<string, string>): WebSocket;

    /**
     * Subscribe to meld events — called when another element melds onto this one.
     * Returns unsubscribe function.
     */
    onMeld(callback: (event: MeldEvent) => void): () => void;

    /** Load this element's persisted config from the server. Returns null if no config saved. */
    loadConfig(): Promise<Record<string, unknown> | null>;

    /** Save config for this element to the server. */
    saveConfig(config: Record<string, unknown>): Promise<void>;

    // The real API is right there: a module reads the store through this alone.
    attestations(query: AttestationQuery): Promise<Attestation[]>;

    /**
     * Spawn a result element below this element on the canvas.
     * Fires a DOM event — the canvas workspace handles positioning, state, and meld.
     */
    spawnResult(result: SpawnResultDetail['result']): void;

    /**
     * A URL on this node, for the times the browser needs one rather than a
     * fetch — the src of an embed, an image, a video.
     *
     * pluginFetch answers with a Response, which an <embed> cannot take. The
     * node is not always the origin the page came from, so an element cannot
     * write a relative path and be right.
     */
    nodeUrl(path: string): string;

    /**
     * What was persisted with this element, or nothing when it holds none yet.
     *
     * An element on a canvas keeps one string of its own — the note's text, the
     * editor's code, the doc's file reference. Every built-in reads it; a
     * published module could not, which is what kept a stateful element inside
     * the shell.
     */
    content(): string | undefined;

    /**
     * Persist this element's content, debounced.
     *
     * Call it on every change; it writes once the changes stop, the same as
     * every built-in that saves as you type. The element reads it back through
     * content() when the canvas next draws it.
     */
    saveContent(content: string): void;
}

// ── Supporting types ─────────────────────────────────────────────────

/** Filter for ui.attestations(). Every field narrows; none means everything the node lets you read. */
export interface AttestationQuery {
    subject?: string;
    predicate?: string;
    context?: string;
    actor?: string;
    source?: string;
    limit?: number;
}

// The shape is the node's JSON: timestamps are RFC 3339 strings, the signature is base64.
export interface Attestation {
    id: string;
    subjects: string[];
    predicates: string[];
    contexts: string[];
    actors: string[];
    timestamp: string;
    source: string;
    attributes?: Record<string, unknown>;
    created_at: string;
    signature?: string;
    signer_did?: string;
}

/** Detail payload for the element:spawn-result DOM event. */
export interface SpawnResultDetail {
    elementId: string;
    name: string;
    result: {
        success: boolean;
        stdout: string;
        stderr: string;
        result: unknown;
        error: string | null;
        duration_ms: number;
    };
}

/** Data passed to onMeld callbacks when an element melds onto this one. */
export interface MeldEvent {
    /** ID of the element that melded onto this one */
    elementId: string;
    /** Symbol of the melded element */
    symbol: string;
    /** Direction the meld came from (the edge direction) */
    direction: string;
    /** Content of the melded element (source code, URL, markdown, etc.) */
    content: string;
}

export interface ElementOpts {
    defaults: { x: number; y: number; width: number; height: number };
    titleBar?: { label: string; actions?: HTMLElement[]; color?: string; labelColor?: string };
    resizable?: boolean | { minWidth?: number; minHeight?: number };
    className?: string;
    /** Custom drag handle element. Falls back to title bar, then container. */
    dragHandle?: HTMLElement;
    /** Extra options forwarded to makeDraggable (e.g. ignoreButtons). */
    draggableOptions?: Partial<MakeDraggableOptions>;
    /** Use minHeight instead of fixed height (for auto-sizing elements). */
    useMinHeight?: boolean;
    /**
     * The ⬆ that lifts this element off the canvas into a window and puts it
     * back. On by default for an element with a title bar: it is the canvas's own
     * affordance and every placed element has it. False for one that has no
     * business becoming a window.
     */
    lift?: boolean;
}

export interface FetchOpts {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
}

export interface MakeDraggableOptions {
    /** When true the drag is cancelled if the mousedown target is a <button>. */
    ignoreButtons?: boolean;
    /** Label used in log messages, e.g. "PyElement". */
    logLabel?: string;
    /** The prompt element object (if this is a prompt being made draggable) */
    promptElement?: Element;
}
