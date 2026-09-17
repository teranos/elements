/**
 * Meld composition — create, extend, reconstruct, and unmeld element compositions.
 *
 * CRITICAL: This implementation respects the core element axiom:
 * "An element is exactly ONE DOM element for its entire lifetime"
 *
 * NO cloneNode. NO createElement for existing elements.
 * Melding is achieved through reparenting, not cloning.
 *
 * Layout: Absolute positioning derived from the edge DAG via computeGridPositions().
 * Elements are measured and positioned with pixel offsets, avoiding both
 * CSS grid's row-height coupling and flexbox's inability to express row offsets.
 */

import { getLogger, getLogSegment, getCanvasHost } from '../../config';
import type { Element } from '../../element';
import type { CompositionEdge, EdgeDirection } from '../composition';
import { computeGridPositions, isConnectedGraph } from '../edge-graph';
import { extractElementIds } from '../composition';
import { clearMeldFeedback, clearFeedbackShadow } from './feedback';

const UNMELD_OFFSET = 20; // px - spacing between elements when unmelding
const UNMELD_DURATION_MS = 200; // animation duration for unmeld slide

/**
 * Animate an element from one position to another using Web Animations API.
 * Sets final position in style so the value persists after animation completes.
 */
function animatePosition(
    el: HTMLElement,
    fromX: number, fromY: number,
    toX: number, toY: number
): void {
    // Set final position immediately (animation is visual overlay)
    el.style.left = `${toX}px`;
    el.style.top = `${toY}px`;

    // Animate from old position to new
    const dx = fromX - toX;
    const dy = fromY - toY;
    if (dx === 0 && dy === 0) return;

    el.animate([
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0, 0)' },
    ], {
        duration: UNMELD_DURATION_MS,
        easing: 'ease-out',
    });
}

/**
 * Apply absolute positioning layout to a composition based on its edge graph.
 * Single source of truth — used by performMeld, extendComposition, and reconstructMeld.
 *
 * Computes pixel positions from the DAG grid positions, measuring actual element
 * sizes to accumulate row/column offsets. This avoids both CSS grid's row-height
 * coupling and flexbox's inability to express row offsets.
 */
function applyColumnLayout(
    composition: HTMLElement,
    elements: HTMLElement[],
    edges: CompositionEdge[]
): void {
    const log = getLogger();
    const seg = getLogSegment();
    const positions = computeGridPositions(edges);

    // Remove existing column wrappers (migration from flexbox), moving children back
    composition.querySelectorAll('.meld-column').forEach(col => {
        while (col.firstChild) {
            composition.appendChild(col.firstChild);
        }
        col.remove();
    });

    // Build a map of element by id for quick lookup
    const elementById = new Map<string, HTMLElement>();
    for (const el of elements) {
        const id = el.getAttribute('data-element-id') || '';
        elementById.set(id, el);
    }

    // Group elements by (row, col) for layout computation
    const rows = new Map<number, Map<number, { el: HTMLElement; id: string }>>();
    let maxRow = 0;
    let maxCol = 0;
    for (const el of elements) {
        const id = el.getAttribute('data-element-id') || '';
        const pos = positions.get(id);
        if (!pos) {
            log.warn(seg, `[MeldSystem] No grid position computed for element ${id}`);
            continue;
        }
        if (!rows.has(pos.row)) rows.set(pos.row, new Map());
        rows.get(pos.row)!.set(pos.col, { el, id });
        maxRow = Math.max(maxRow, pos.row);
        maxCol = Math.max(maxCol, pos.col);
    }

    // Clear old layout styles and ensure children are direct children of composition
    for (const el of elements) {
        el.style.gridRow = '';
        el.style.gridColumn = '';
        el.style.position = 'absolute';
        if (el.parentElement !== composition) {
            composition.appendChild(el);
        }
    }

    // Force browser to compute layout before measuring:
    // Set a large temporary size so absolutely positioned children aren't constrained,
    // then trigger a synchronous reflow via offsetHeight read.
    composition.style.width = '10000px';
    composition.style.height = '10000px';
    void composition.offsetHeight;

    // Measure element sizes (must be in DOM and laid out to get dimensions)
    // getBoundingClientRect returns screen pixels (scaled by CSS transform),
    // but element left/top are in the content layer's local coordinate space.
    // Divide by scale to get unscaled dimensions.
    const canvasEl = composition.closest('.canvas-workspace');
    const canvasId = canvasEl?.getAttribute('data-canvas-id') || 'canvas-workspace';
    const { scale } = getCanvasHost().getTransform(canvasId);

    const colWidths = new Map<number, number>();
    const rowHeights = new Map<number, number>();

    for (const [id, el] of elementById) {
        const pos = positions.get(id);
        if (!pos) continue;
        const rect = el.getBoundingClientRect();
        const w = (rect.width / scale) || el.offsetWidth || 200;
        const h = (rect.height / scale) || el.offsetHeight || 150;
        colWidths.set(pos.col, Math.max(colWidths.get(pos.col) || 0, w));
        rowHeights.set(pos.row, Math.max(rowHeights.get(pos.row) || 0, h));
    }

    // Compute pixel offsets: accumulate column widths and row heights
    const colOffsets = new Map<number, number>();
    let xAccum = 0;
    for (let c = 1; c <= maxCol; c++) {
        colOffsets.set(c, xAccum);
        xAccum += (colWidths.get(c) || 0);
    }

    const rowOffsets = new Map<number, number>();
    let yAccum = 0;
    for (let r = 1; r <= maxRow; r++) {
        rowOffsets.set(r, yAccum);
        yAccum += (rowHeights.get(r) || 0);
    }

    // Position each element
    for (const [id, el] of elementById) {
        const pos = positions.get(id);
        if (!pos) continue;
        el.style.left = `${colOffsets.get(pos.col) || 0}px`;
        el.style.top = `${rowOffsets.get(pos.row) || 0}px`;
    }

    // Size the composition to contain all children
    composition.style.width = `${xAccum}px`;
    composition.style.height = `${yAccum}px`;
}

/**
 * Perform meld operation
 * CRITICAL: This reparents the actual DOM elements, does NOT clone them
 *
 * Compositions are persisted to storage and survive page refresh.
 * Supports multi-directional melding: right (horizontal) and bottom (vertical).
 */
export function performMeld(
    initiatorElement: HTMLElement,
    targetElement: HTMLElement,
    initiatorItem: Element,
    targetItem: Element,
    direction: EdgeDirection = 'right'
): HTMLElement {
    const canvas = initiatorElement.parentElement;
    if (!canvas) {
        throw new Error(`Cannot meld: no canvas parent for initiator ${initiatorItem.id}`);
    }

    const log = getLogger();
    const seg = getLogSegment();
    const canvasHost = getCanvasHost();

    log.info(seg, '[MeldSystem] Performing meld - reparenting elements', { direction });

    // Generate composition ID
    const compositionId = `melded-${initiatorItem.id}-${targetItem.id}`;

    // Create edge with the actual direction from proximity detection
    const edges: CompositionEdge[] = [{
        from: initiatorItem.id,
        to: targetItem.id,
        direction,
        position: 0
    }];

    // Create composition container
    const composition = document.createElement('div');
    composition.className = 'melded-composition';
    composition.setAttribute('data-melded', 'true');
    composition.setAttribute('data-element-id', compositionId);

    // Position at initiator location
    composition.style.position = 'absolute';
    composition.style.left = initiatorElement.style.left;
    composition.style.top = initiatorElement.style.top;

    // Parse position for storage
    const x = parseInt(initiatorElement.style.left || '0', 10);
    const y = parseInt(initiatorElement.style.top || '0', 10);

    if (isNaN(x) || isNaN(y)) {
        log.warn(seg, '[MeldSystem] Invalid position during meld', {
            rawLeft: initiatorElement.style.left,
            rawTop: initiatorElement.style.top,
            parsedX: x,
            parsedY: y
        });
    }

    // Clear positioning from elements (they're now relative to composition)
    initiatorElement.style.position = 'relative';
    initiatorElement.style.left = '0';
    initiatorElement.style.top = '0';
    targetElement.style.position = 'relative';
    targetElement.style.left = '0';
    targetElement.style.top = '0';

    // Clear meld feedback
    clearMeldFeedback(initiatorElement);
    clearMeldFeedback(targetElement);

    // REPARENT the actual elements (NOT clones!)
    composition.appendChild(initiatorElement);
    composition.appendChild(targetElement);

    // Add to canvas BEFORE layout so elements are in the DOM for measurement
    canvas.appendChild(composition);

    // Apply grid layout from edge graph
    applyColumnLayout(composition, [initiatorElement, targetElement], edges);

    // Persist composition to storage and flush to backend immediately
    canvasHost.saveComposition({
        id: compositionId,
        edges,
        x: isNaN(x) ? 0 : x,
        y: isNaN(y) ? 0 : y
    });
    canvasHost.flushSync();

    log.info(seg, '[MeldSystem] Meld complete - elements reparented and persisted', {
        compositionId,
        edges: edges.length,
        elements: extractElementIds(edges)
    });

    return composition;
}

/**
 * Extend an existing composition by adding an element at a leaf (append) or root (prepend)
 *
 * CRITICAL: Reparents the incoming element into the existing composition container.
 * Regenerates composition ID and updates storage.
 */
export function extendComposition(
    compositionElement: HTMLElement,
    incomingElement: HTMLElement,
    incomingElementId: string,
    anchorElementId: string,
    direction: EdgeDirection,
    incomingRole: 'from' | 'to'
): HTMLElement {
    const log = getLogger();
    const seg = getLogSegment();
    const canvasHost = getCanvasHost();

    // Look up existing composition state
    const existingComp = canvasHost.findCompositionByElement(anchorElementId);
    if (!existingComp) {
        throw new Error(`Cannot extend composition: no composition found for element ${anchorElementId}`);
    }

    const oldId = existingComp.id;

    // Build new edge based on role
    const newEdge: CompositionEdge = incomingRole === 'to'
        ? { from: anchorElementId, to: incomingElementId, direction, position: existingComp.edges.length }
        : { from: incomingElementId, to: anchorElementId, direction, position: existingComp.edges.length };

    // Regenerate composition ID from the new edge
    const newId = `melded-${newEdge.from}-${newEdge.to}`;

    log.info(seg, '[MeldSystem] Extending composition', {
        oldId,
        newId,
        anchor: anchorElementId,
        incoming: incomingElementId,
        direction,
        incomingRole
    });

    // Clear positioning and meld feedback on incoming element
    incomingElement.style.position = 'relative';
    incomingElement.style.left = '0';
    incomingElement.style.top = '0';
    clearMeldFeedback(incomingElement);

    // Clear feedback on all existing elements in the composition (anchor element may still glow)
    compositionElement.querySelectorAll('[data-element-id]').forEach(el => {
        clearFeedbackShadow(el as HTMLElement);
    });

    // Append incoming as direct child — grid handles placement
    compositionElement.appendChild(incomingElement);

    // Update composition ID on DOM
    compositionElement.setAttribute('data-element-id', newId);

    // Update storage: remove old, add new with all edges
    const allEdges = [...existingComp.edges, newEdge];
    canvasHost.removeComposition(oldId);
    canvasHost.saveComposition({
        id: newId,
        edges: allEdges,
        x: existingComp.x,
        y: existingComp.y
    });
    canvasHost.flushSync();

    // Rebuild grid positions for all children
    const allChildren = Array.from(
        compositionElement.querySelectorAll('[data-element-id]')
    ) as HTMLElement[];
    applyColumnLayout(compositionElement, allChildren, allEdges);

    log.info(seg, '[MeldSystem] Composition extended', {
        newId,
        edges: allEdges.length,
        elements: extractElementIds(allEdges)
    });

    return compositionElement;
}

/**
 * Reconstruct a melded composition from storage (without persisting)
 * Used when restoring compositions on page load
 */
export function reconstructMeld(
    members: HTMLElement[],
    edges: CompositionEdge[],
    compositionId: string,
    x: number,
    y: number
): HTMLElement {
    if (members.length === 0) {
        throw new Error(`Cannot reconstruct meld: no elements provided for composition ${compositionId}`);
    }

    const canvas = members[0].parentElement;
    if (!canvas) {
        throw new Error(`Cannot reconstruct meld: no canvas parent for composition ${compositionId}`);
    }

    const log = getLogger();
    const seg = getLogSegment();

    log.info(seg, '[MeldSystem] Reconstructing meld from storage', {
        elementCount: members.length,
        edgeCount: edges.length
    });

    // Create composition container
    const composition = document.createElement('div');
    composition.className = 'melded-composition';
    composition.setAttribute('data-melded', 'true');
    composition.setAttribute('data-element-id', compositionId);

    // Position at saved location
    composition.style.position = 'absolute';
    composition.style.left = `${x}px`;
    composition.style.top = `${y}px`;

    // Clear positioning from elements and reparent
    members.forEach(element => {
        element.style.position = 'relative';
        element.style.left = '0';
        element.style.top = '0';
        composition.appendChild(element);
    });

    // Add to canvas BEFORE layout so elements are in the DOM for measurement
    canvas.appendChild(composition);

    // Apply grid layout from edge graph
    applyColumnLayout(composition, members, edges);

    log.info(seg, '[MeldSystem] Meld reconstructed', {
        compositionId,
        elementCount: members.length
    });

    return composition;
}

/**
 * Detach a single element from a composition, keeping the rest melded if possible.
 *
 * - If only 2 elements: delegates to unmeldComposition (can't have 1-element composition)
 * - If removing the element disconnects the graph: delegates to unmeldComposition
 * - Otherwise: removes the element, updates edges/storage, rebuilds layout
 *
 * Returns the detached element and remaining composition (null if fully unmelded).
 */
export function detachElement(elementId: string, composition: HTMLElement): {
    detachedElement: HTMLElement;
    remainingComposition: HTMLElement | null;
} | null {
    const log = getLogger();
    const seg = getLogSegment();
    const canvasHost = getCanvasHost();

    if (!isMeldedComposition(composition)) {
        log.warn(seg, '[MeldSystem] detachElement: not a melded composition');
        return null;
    }

    const canvas = composition.parentElement;
    if (!canvas) {
        log.error(seg, '[MeldSystem] detachElement: composition has no parent canvas');
        return null;
    }

    const compositionId = composition.getAttribute('data-element-id') || '';
    const storedComp = canvasHost.findCompositionByElement(elementId);
    if (!storedComp) {
        log.warn(seg, `[MeldSystem] detachElement: no stored composition for element ${elementId}`);
        return null;
    }

    const allElementIds = extractElementIds(storedComp.edges);

    // 2-element composition → full unmeld
    if (allElementIds.length <= 2) {
        log.info(seg, '[MeldSystem] detachElement: 2-element composition, delegating to full unmeld');
        const result = unmeldComposition(composition);
        if (!result) return null;
        const detached = result.members.find(
            el => (el.getAttribute('data-element-id') || el.dataset.elementId) === elementId
        );
        if (!detached) return null;
        return { detachedElement: detached, remainingComposition: null };
    }

    // Filter edges: remove all edges involving this element
    const remainingEdges = storedComp.edges.filter(
        e => e.from !== elementId && e.to !== elementId
    );

    // Check if remaining edges form a connected graph
    if (!isConnectedGraph(remainingEdges)) {
        log.info(seg, `[MeldSystem] detachElement: removing ${elementId} disconnects graph, delegating to full unmeld`);
        const result = unmeldComposition(composition);
        if (!result) return null;
        const detached = result.members.find(
            el => (el.getAttribute('data-element-id') || el.dataset.elementId) === elementId
        );
        if (!detached) return null;
        return { detachedElement: detached, remainingComposition: null };
    }

    // Partial detach: reparent detached element to canvas
    const detachedEl = composition.querySelector(`[data-element-id="${elementId}"]`) as HTMLElement | null;
    if (!detachedEl) {
        log.error(seg, `[MeldSystem] detachElement: element not found for element ${elementId}`);
        return null;
    }

    // Position the detached element based on where it sat inside the composition
    const compLeft = parseInt(composition.style.left || '0', 10) || 0;
    const compTop = parseInt(composition.style.top || '0', 10) || 0;
    const innerLeft = parseFloat(detachedEl.style.left) || 0;
    const innerTop = parseFloat(detachedEl.style.top) || 0;

    // Target: slide out from its composition position + offset away from remaining elements
    const targetX = compLeft + innerLeft + UNMELD_OFFSET;
    const targetY = compTop + innerTop - UNMELD_OFFSET - 40;

    // Start at the element's current visual position (composition origin + inner offset)
    const startX = compLeft + innerLeft;
    const startY = compTop + innerTop;

    detachedEl.style.position = 'absolute';
    detachedEl.style.left = `${startX}px`;
    detachedEl.style.top = `${startY}px`;
    detachedEl.style.gridRow = '';
    detachedEl.style.gridColumn = '';

    // Reparent to canvas
    canvas.insertBefore(detachedEl, composition);

    // Animate slide to target position
    animatePosition(detachedEl, startX, startY, targetX, targetY);

    // Persist detached element's new position
    const detachedSymbol = detachedEl.dataset.symbol || '';
    if (detachedSymbol) {
        const existing = canvasHost.getCanvasElements().find(g => g.id === elementId);
        canvasHost.saveCanvasElement({
            ...existing,
            id: elementId,
            symbol: detachedSymbol,
            x: targetX,
            y: targetY,
        });
    }

    // Update storage: remove old composition, add new with remaining edges
    const newId = `melded-${remainingEdges[0].from}-${remainingEdges[0].to}`;
    canvasHost.removeComposition(storedComp.id);
    composition.setAttribute('data-element-id', newId);
    canvasHost.saveComposition({
        id: newId,
        edges: remainingEdges,
        x: storedComp.x,
        y: storedComp.y
    });
    canvasHost.flushSync();

    // Rebuild layout for remaining elements
    const remainingElements = Array.from(
        composition.querySelectorAll('[data-element-id]')
    ) as HTMLElement[];
    applyColumnLayout(composition, remainingElements, remainingEdges);

    log.info(seg, `[MeldSystem] Detached element ${elementId} from composition`, {
        oldId: compositionId,
        newId,
        remainingEdges: remainingEdges.length,
        remainingItems: extractElementIds(remainingEdges)
    });

    return { detachedElement: detachedEl, remainingComposition: composition };
}

/**
 * Check if element is a melded composition
 */
export function isMeldedComposition(element: HTMLElement): boolean {
    return element.classList.contains('melded-composition');
}

/**
 * Unmeld a composition back to individual elements
 * Restores the original elements to canvas and removes from storage
 *
 * Returns the unmelded elements so caller can restore drag handlers.
 */
export function unmeldComposition(composition: HTMLElement): {
    members: HTMLElement[];
} | null {
    const log = getLogger();
    const seg = getLogSegment();
    const canvasHost = getCanvasHost();

    if (!isMeldedComposition(composition)) {
        log.warn(seg, '[MeldSystem] Not a melded composition');
        return null;
    }

    const canvas = composition.parentElement;
    if (!canvas) {
        log.error(seg, '[MeldSystem] Composition has no parent canvas');
        return null;
    }

    // Get composition ID for storage removal
    const compositionId = composition.getAttribute('data-element-id') || '';

    // Find all child elements in composition
    const members = Array.from(composition.querySelectorAll('[data-element-id]')) as HTMLElement[];

    if (members.length === 0) {
        log.error(seg, '[MeldSystem] No elements found in composition - removing corrupted composition');
        if (compositionId) {
            canvasHost.removeComposition(compositionId);
        }
        composition.remove();
        return null;
    }

    // Restore absolute positioning
    const compLeft = parseInt(composition.style.left || '0', 10);
    const compTop = parseInt(composition.style.top || '0', 10);

    // Validate parsed values - fallback to 0 if NaN
    if (isNaN(compLeft)) {
        log.warn(seg, `[MeldSystem] Invalid composition.style.left: "${composition.style.left}", using 0`);
    }
    if (isNaN(compTop)) {
        log.warn(seg, `[MeldSystem] Invalid composition.style.top: "${composition.style.top}", using 0`);
    }
    const left = isNaN(compLeft) ? 0 : compLeft;
    const top = isNaN(compTop) ? 0 : compTop;

    // Use each element's inner position within the composition to compute canvas position.
    // Elements slide out from their composition position to a spread-out arrangement.
    members.forEach((element, i) => {
        const innerLeft = parseFloat(element.style.left) || 0;
        const innerTop = parseFloat(element.style.top) || 0;

        // Start: element's actual visual position (composition origin + inner offset)
        const startX = left + innerLeft;
        const startY = top + innerTop;

        // Target: spread out with offset so they don't stack on top of each other
        const targetX = startX + i * UNMELD_OFFSET;
        const targetY = startY + i * UNMELD_OFFSET;

        element.style.position = 'absolute';
        element.style.left = `${startX}px`;
        element.style.top = `${startY}px`;
        element.style.gridRow = '';
        element.style.gridColumn = '';

        // Reparent back to canvas
        canvas.insertBefore(element, composition);

        // Animate slide to spread-out position
        animatePosition(element, startX, startY, targetX, targetY);

        // Persist new position so it survives refresh
        const elementIdAttr = element.getAttribute('data-element-id') || element.dataset.elementId || '';
        const symbol = element.dataset.symbol || '';
        if (elementIdAttr && symbol) {
            const existing = canvasHost.getCanvasElements().find(g => g.id === elementIdAttr);
            canvasHost.saveCanvasElement({
                ...existing,
                id: elementIdAttr,
                symbol,
                x: targetX,
                y: targetY,
            });
        }
    });

    // Remove composition from storage
    if (compositionId) {
        canvasHost.removeComposition(compositionId);
    }
    canvasHost.flushSync();

    // Remove composition container
    composition.remove();

    log.info(seg, '[MeldSystem] Unmeld complete - elements restored and removed from storage', {
        compositionId,
        elementCount: members.length
    });

    // Return elements so caller can restore drag handlers
    return {
        members
    };
}
