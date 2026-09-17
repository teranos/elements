/**
 * Tray - where elements rest
 *
 * Design: Elements are visual entities that morph between three states:
 * 1. Collapsed (8px square) - minimal visual footprint
 * 2. Proximity expanded (220px) - reveals title text on hover
 * 3. Window state - full application window with content
 *
 * The same DOM element transforms through all states via animation.
 *
 * AXIOM: An element is exactly ONE DOM element for its entire lifetime.
 *
 * FORBIDDEN OPERATIONS (will throw errors):
 * - cloneNode on an element
 * - document.createElement to represent an existing element
 * - Re-rendering an element via renderItems, add, remove, or diffing logic
 * - Having two elements with the same data-element-id
 * - "Fading out" one element while "fading in" another
 * - Recreating an element to "simplify animation"
 *
 * ALLOWED OPERATIONS:
 * - Reparenting the same DOM element (body ↔ indicator container)
 * - Changing position, transform, top/left, width/height
 * - Changing border-radius, background, opacity
 * - Temporarily detaching an element from layout flow
 * - Delaying content mount until after morph completion
 *
 * Every element MUST be created through the createElement factory.
 */

import { getLogger, getLogSegment, getPersistence } from '../config';
import { Proximity, applyRestingDotGeometry } from './proximity';
import { type Element, getOpenDuration, DEFAULT_COLOR } from '../element';
import { readPaint, wearPaint } from '../paint';
import { getForm, setElementId, setSymbol } from '../dataset';
import { morphDotToWindow } from '../window/window';
import { morphDotToWorkspace } from '../forms/canvas';
import { morphDotToPanel } from '../forms/panel';
import { setupTouchBrowse } from './touch-browse';
import { suppressSelectionUntilRelease } from '../morph-transaction';

// Re-export Element interface for external use
export type { Element } from '../element';


class Tray {
    // Track all created elements to enforce single-element axiom
    private elements: Map<string, HTMLElement> = new Map();

    // Track click handlers separately for proper cleanup (prevents memory leaks)
    private clickHandlers: WeakMap<HTMLElement, (e: MouseEvent) => void> = new WeakMap();

    // Proximity morphing handler
    private proximity: Proximity = new Proximity();

    /**
     * SINGLE FACTORY for creating DOM elements
     * This is the ONLY place that calls document.createElement for elements
     *
     * CRITICAL: This is not a UX preference.
     * This is a structural invariant required for future attestations and reasoning.
     *
     * The persistent DOM identity enables:
     * - Attestations about element state and transitions
     * - Reasoning about element relationships and dependencies
     * - Tracking provenance and lifecycle events
     * - Maintaining coherence between frontend and backend models
     *
     * The element's DOM element IS its identity, not a representation of it.
     */
    private createElement(item: Element): HTMLElement {
        const log = getLogger();
        const seg = getLogSegment();

        // Check if element already exists - THIS SHOULD NEVER HAPPEN
        if (this.elements.has(item.id)) {
            throw new Error(`AXIOM VIOLATION: Attempted to create duplicate element for ${item.id}`);
        }

        const existing = document.querySelector(`[data-element-id="${item.id}"]`);
        if (existing) {
            throw new Error(`AXIOM VIOLATION: Element ${item.id} already exists in DOM`);
        }

        // CREATE THE ELEMENT - ONCE AND ONLY ONCE
        const element = document.createElement('div');
        element.className = 'dot';
        applyRestingDotGeometry(element);
        element.style.backgroundColor = item.color ?? DEFAULT_COLOR;
        if (item.border) element.style.border = item.border;
        setElementId(element, item.id);
        setSymbol(element, item.symbol);

        // Track this element
        this.elements.set(item.id, element);

        // Attach click handler that will persist with the element forever
        const clickHandler = (e: MouseEvent) => {
            e.stopPropagation();
            log.debug(seg, `[Element ${item.id}] Click detected, form: ${getForm(element) ?? 'none'}`);
            this.morphElement(element, item);
        };

        // Store handler in WeakMap for proper cleanup
        this.clickHandlers.set(element, clickHandler);
        element.addEventListener('click', clickHandler);

        // The press is what starts a selection; click already fires on mouseup,
        // by which time the range exists.
        element.addEventListener('mousedown', suppressSelectionUntilRelease);

        return element;
    }
    // Deferred items to add after init
    private deferredItems: Element[] = [];
    private readonly MAX_DEFERRED_ITEMS = 100; // Prevent unbounded growth
    private deferredItemsTimeout: ReturnType<typeof setTimeout> | null = null;

    // Component state
    private element: HTMLElement | null = null;
    private indicatorContainer: HTMLElement | null = null;
    private items: Map<string, Element> = new Map();
    private isRestoring: boolean = false; // Disable proximity morphing during restore

    /**
     * Initialize the tray and attach to DOM
     * Call this once when the app starts
     */
    public init(): void {
        if (this.element) {
            // Having an element is not the same as being in the document. If the
            // body was replaced under us, re-attach — otherwise every element added
            // from here lands in a detached tree and is never seen again.
            if (!this.element.isConnected) document.body.appendChild(this.element);
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'tray';
        this.element.setAttribute('data-empty', 'true');

        // Container for collapsed elements
        this.indicatorContainer = document.createElement('div');
        this.indicatorContainer.className = 'tray-dots';
        this.element.appendChild(this.indicatorContainer);

        document.body.appendChild(this.element);

        this.setupEventListeners();

        // Process any deferred items that tried to add before init
        if (this.deferredItems.length > 0) {
            // Clear timeout as we're processing items now
            if (this.deferredItemsTimeout) {
                clearTimeout(this.deferredItemsTimeout);
                this.deferredItemsTimeout = null;
            }

            const itemsToAdd = [...this.deferredItems];
            this.deferredItems = [];
            itemsToAdd.forEach(item => {
                // Use the add method which uses the factory
                this.add(item, false);
            });
        }
    }

    private setupEventListeners(): void {
        if (!this.element) return;

        // Desktop: proximity morphing on mouse movement
        document.addEventListener('mousemove', () => {
            this.updateProximity();
        });

        // Mobile: touch browse — hold thumb near tray, slide to browse, release to open.
        setupTouchBrowse({
            get element() { return tray.element; },
            get indicatorContainer() { return tray.indicatorContainer; },
            get proximity() { return tray.proximity; },
            get items() { return tray.items; },
            updateProximity: () => this.updateProximity(),
            morphElement: (el, item) => this.morphElement(el, item),
        });
    }

    /**
     * Morph an element from dot to its form (window, panel or workspace).
     * Shared by click handler and touch browse release.
     */
    private morphElement(element: HTMLElement, item: Element): void {
        // Already open — don't open it again. isInWindowState() answered this
        // for every form prepareMorphTo() reparents to document.body:
        // all three tray destinations, and canvasExpanded alongside them.
        const current = getForm(element);
        if (current === 'window' || current === 'panel'
            || current === 'workspace' || current === 'canvasExpanded') return;

        this.isRestoring = true;

        const opensAs = item.opensAs || 'window';
        if (opensAs === 'panel') {
            morphDotToPanel(
                element,
                item,
                (id, element) => this.verifyElementTracking(id, element),
                (id) => this.remove(id),
                (element, g) => this.reattachElementToIndicator(element, g)
            );
        } else if (opensAs === 'workspace') {
            morphDotToWorkspace(
                element,
                item,
                (id, element) => this.verifyElementTracking(id, element),
                (element, g) => this.reattachElementToIndicator(element, g)
            );
        } else {
            morphDotToWindow(
                element,
                item,
                (id, element) => this.verifyElementTracking(id, element),
                (id) => this.remove(id),
                (element, g) => this.reattachElementToIndicator(element, g)
            );
        }

        setTimeout(() => {
            this.isRestoring = false;
        }, getOpenDuration());
    }


    /**
     * Trigger proximity-based morphing update
     * Delegates to the proximity handler which modifies styles in place
     */
    private updateProximity(): void {
        this.proximity.updateProximity(
            this.indicatorContainer,
            this.items,
            this.isRestoring
        );
    }

    /**
     * Programmatically open an element by ID (morph from dot to its form)
     */
    public open(id: string): void {
        const log = getLogger();
        const seg = getLogSegment();
        const item = this.items.get(id);
        const element = this.elements.get(id);
        if (!item || !element) {
            log.warn(seg, `[Tray] open: element ${id} not found`);
            return;
        }
        this.morphElement(element, item);
    }

    /**
     * Load tray state from persistence
     * Returns the ids of the elements that were resting in the tray
     */
    public loadState(): string[] {
        return getPersistence().getResting();
    }

    /**
     * Add a minimized window to the tray
     * Creates the DOM element ONCE via factory - this element persists forever
     */
    public add(item: Element, skipSave: boolean = false): void {
        const log = getLogger();
        const seg = getLogSegment();
        // Try to initialize, but if it fails, defer the item
        this.init();

        if (!this.element) {
            // Tray not ready yet, defer this item (with safeguards)
            if (this.deferredItems.length >= this.MAX_DEFERRED_ITEMS) {
                log.warn(seg, `Tray: Deferred items limit reached (${this.MAX_DEFERRED_ITEMS}), dropping oldest`);
                this.deferredItems.shift(); // Remove oldest to make room
            }

            this.deferredItems.push(item);

            // Set a timeout to clear deferred items if init never happens
            if (!this.deferredItemsTimeout) {
                this.deferredItemsTimeout = setTimeout(() => {
                    log.warn(seg, `Tray: Clearing ${this.deferredItems.length} deferred items after 30s timeout`);
                    this.deferredItems = [];
                    this.deferredItemsTimeout = null;
                }, 30000); // Clear after 30 seconds
            }

            return;
        }

        if (this.items.has(item.id)) {
            return; // Already in tray
        }

        // Verify no duplicate elements exist (hard error if violated)
        this.verifyNoDuplicateElements(item.id);

        this.items.set(item.id, item);

        // USE THE FACTORY - THE ONLY WAY TO CREATE AN ELEMENT
        const element = this.createElement(item);

        // Add to indicator container
        this.indicatorContainer!.appendChild(element);

        this.element.setAttribute('data-empty', 'false');

        // Only save state if not skipping (skip during restore from persistence)
        if (!skipSave) {
            getPersistence().addResting(item.id);
        }
    }

    /**
     * Adopt an existing element into the tray (no new element created).
     * Used when a canvas-placed element is minimized to tray — the same
     * DOM element transitions from canvas/window to tray dot.
     */
    public adopt(element: HTMLElement, item: Element): void {
        const log = getLogger();
        const seg = getLogSegment();
        this.init();

        if (!this.element) return;
        if (this.items.has(item.id)) return;

        // Register the existing element (no factory creation)
        this.items.set(item.id, item);
        this.elements.set(item.id, element);

        // Class and geometry are what a tray dot is and change with the
        // form; paint is what the element is and does not.
        const was = readPaint(element);
        element.className = 'dot';
        applyRestingDotGeometry(element);
        wearPaint(element, was, item);
        setElementId(element, item.id);
        setSymbol(element, item.symbol);

        // Attach click handler
        const clickHandler = (e: MouseEvent) => {
            e.stopPropagation();
            log.debug(seg, `[Element ${item.id}] Click detected, form: ${getForm(element) ?? 'none'}`);
            this.morphElement(element, item);
        };
        this.clickHandlers.set(element, clickHandler);
        element.addEventListener('click', clickHandler);

        // Add to tray
        this.indicatorContainer!.appendChild(element);
        this.element.setAttribute('data-empty', 'false');
        getPersistence().addResting(item.id);
    }

    /**
     * Verify no duplicate elements exist in DOM
     * Hard errors if duplicates found - this is an AXIOM VIOLATION
     */
    private verifyNoDuplicateElements(elementId: string): void {
        const elements = document.querySelectorAll(`[data-element-id="${elementId}"]`);
        if (elements.length > 1) {
            throw new Error(
                `AXIOM VIOLATION: ${elements.length} elements found with data-element-id="${elementId}". ` +
                `An element must be exactly ONE DOM element. This is a critical error.`
            );
        }
        if (elements.length === 1) {
            throw new Error(
                `AXIOM VIOLATION: Element with data-element-id="${elementId}" already exists. ` +
                `Cannot create duplicate. An element must be exactly ONE DOM element.`
            );
        }
    }

    /**
     * Remove an element completely (when closed via X button)
     * This is the ONLY time we destroy the DOM element
     */
    public remove(id: string): void {
        if (!this.items.has(id)) return;

        this.items.delete(id);

        // Remove from tracking
        const tracked = this.elements.get(id);
        if (tracked) {
            // Verify it's the same element in DOM
            const inDom = document.querySelector(`[data-element-id="${id}"]`);
            if (inDom && inDom !== tracked) {
                throw new Error(
                    `AXIOM VIOLATION: Tracked element for ${id} doesn't match DOM element. ` +
                    `This indicates element recreation.`
                );
            }
            // Remove click handler before removing element
            const handler = this.clickHandlers.get(tracked);
            if (handler) {
                tracked.removeEventListener('click', handler);
                // WeakMap will automatically clean up when element is GC'd
            }
            tracked.remove();
            this.elements.delete(id);
        }

        if (this.items.size === 0) {
            this.element?.setAttribute('data-empty', 'true');
        }

        // Remove from persistence
        getPersistence().removeResting(id);
    }

    /**
     * Check if a window is in the tray
     */
    public has(id: string): boolean {
        return this.items.has(id);
    }

    /**
     * Get the target position for minimize animation.
     * If elementId is provided, returns that dot's position.
     * Falls back to the last dot, then the tray center.
     */
    public getTargetPosition(elementId?: string): { x: number; y: number } | null {
        if (!this.element) return null;

        if (elementId) {
            const dot = this.elements.get(elementId);
            if (dot) {
                const dotRect = dot.getBoundingClientRect();
                return {
                    x: dotRect.left + dotRect.width / 2,
                    y: dotRect.top + dotRect.height / 2,
                };
            }
        }

        if (this.indicatorContainer) {
            const lastDot = this.indicatorContainer.lastElementChild as HTMLElement | null;
            if (lastDot) {
                const lastRect = lastDot.getBoundingClientRect();
                return {
                    x: lastRect.left + lastRect.width / 2,
                    y: lastRect.bottom + 6,
                };
            }
        }

        // Last resort: tray center
        const rect = this.element.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }



    /**
     * Verify element tracking for morph operations
     */
    private verifyElementTracking(elementId: string, element: HTMLElement): void {
        const tracked = this.elements.get(elementId);
        if (tracked !== element) {
            throw new Error(
                `AXIOM VIOLATION: Element for ${elementId} doesn't match tracked element. ` +
                `This indicates element recreation somewhere.`
            );
        }
    }

    /**
     * Re-attach a morphed element back to the indicator container
     */
    private reattachElementToIndicator(element: HTMLElement, item: Element): void {
        const log = getLogger();
        const seg = getLogSegment();
        if (!this.indicatorContainer) return;

        // Remove any existing handler to avoid duplicates
        const existingHandler = this.clickHandlers.get(element);
        if (existingHandler) {
            element.removeEventListener('click', existingHandler);
        }

        // Re-attach the click handler
        // (Event listeners can be lost during certain DOM manipulations)
        const clickHandler = (e: MouseEvent) => {
            e.stopPropagation();
            log.debug(seg, `[Element ${item.id}] Click detected, form: ${getForm(element) ?? 'none'}`);
            this.morphElement(element, item);
        };

        this.clickHandlers.set(element, clickHandler);
        element.addEventListener('click', clickHandler);

        // Insert at the correct position in the indicator container
        const index = Array.from(this.items.keys()).indexOf(item.id);
        const dots = Array.from(this.indicatorContainer.children);
        if (index < dots.length) {
            this.indicatorContainer.insertBefore(element, dots[index]);
        } else {
            this.indicatorContainer.appendChild(element);
        }

        // Re-enable proximity morphing
        this.isRestoring = false;
    }


    /**
     * Get count of minimized windows
     */
    public get count(): number {
        return this.items.size;
    }

    /**
     * Verify the structural invariant: Each element is exactly ONE DOM element
     * Call this to ensure the system maintains coherence
     *
     * The Element must remain the same DOM element across dot → proximity → window → dot.
     * Any implementation that violates this, even invisibly, is incorrect.
     */
    public verifyInvariant(): void {
        const log = getLogger();
        const seg = getLogSegment();
        // Check that tracked elements match DOM
        this.elements.forEach((trackedElement, id) => {
            const inDom = document.querySelector(`[data-element-id="${id}"]`);

            // Verify element exists
            if (!inDom) {
                throw new Error(
                    `INVARIANT VIOLATION: Tracked element for ${id} not found in DOM`
                );
            }

            // Verify it's the SAME element (not a recreation)
            if (inDom !== trackedElement) {
                throw new Error(
                    `INVARIANT VIOLATION: DOM element for ${id} is different from tracked element. ` +
                    `Element was recreated, violating the single-element axiom.`
                );
            }

            // Verify no duplicates
            const allWithId = document.querySelectorAll(`[data-element-id="${id}"]`);
            if (allWithId.length !== 1) {
                throw new Error(
                    `INVARIANT VIOLATION: Found ${allWithId.length} elements with data-element-id="${id}". ` +
                    `Must be exactly one.`
                );
            }
        });

        // Check that all DOM elements are tracked
        document.querySelectorAll('[data-element-id]').forEach((element) => {
            const id = element.getAttribute('data-element-id');
            if (id && !this.elements.has(id)) {
                throw new Error(
                    `INVARIANT VIOLATION: DOM element with data-element-id="${id}" is not tracked. ` +
                    `Element was created outside the factory.`
                );
            }
        });

        log.info(seg, `Invariant verified: ${this.elements.size} elements maintain single-element axiom`);
    }
}

// Singleton instance
export const tray: Tray = new Tray();

/** Getter — safe to call from code that imports via the barrel without const init ordering issues. */
export function getTray(): Tray {
    return tray;
}
