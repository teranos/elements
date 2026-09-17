/**
 * Canvas drag interaction for elements.
 *
 * Pointer-driven move with meld-on-drop.
 * Uses DI (CanvasHost) for position persistence, transform,
 * selection, and composition state.
 */

import type { Element } from './element';
import type { MakeDraggableOptions } from './element-ui';
import { getForm } from './dataset';
import { getLogger, getLogSegment, getCanvasHost } from './config';
import {
    canInitiateMeld,
    canReceiveMeld,
    findMeldTarget,
    checkDirectionalProximity,
    PROXIMITY_THRESHOLD,
    MELD_THRESHOLD,
} from './meld/meld-detect';
import { applyMeldFeedback, clearMeldFeedback } from './meld/meld-feedback';
import {
    performMeld,
    extendComposition,
    isMeldedComposition,
} from './meld/meld-composition';
import {
    getMeldOptions,
    selectPreferredMeldOption,
    getElementClass,
    getCompatibleDirections,
    isPortFree,
    type EdgeDirection,
} from './meld/meldability';

// Monotonic z-index counter — each drag/click brings element to front
let topZIndex = 1;

// ── Composition anchor selection ────────────────────────────────────

/**
 * Find the spatially-nearest element in a composition that has a free port
 * compatible with the standalone element, in ANY valid direction.
 *
 * This replaces trusting findMeldTarget's single result as the anchor —
 * findMeldTarget picks the closest element on the entire canvas, which may
 * not be the closest element *within* the composition the user is targeting.
 * Its detected direction may also be wrong (e.g., 'bottom' when user meant 'right').
 *
 * Returns both the anchor ID and the best direction for that anchor.
 */
function findBestAnchorInComposition(
    standaloneElement: HTMLElement,
    compositionElement: HTMLElement,
    edges: Array<{ from: string; to: string; direction: string }>,
): { anchorId: string; direction: EdgeDirection; role: 'from' | 'to' } | null {
    const standaloneRect = standaloneElement.getBoundingClientRect();
    const standaloneClass = getElementClass(standaloneElement);
    if (!standaloneClass) return null;

    let bestId: string | null = null;
    let bestDirection: EdgeDirection = 'right';
    let bestRole: 'from' | 'to' = 'to';
    let bestDistance = Infinity;

    const members = compositionElement.querySelectorAll('[data-element-id]');
    for (const el of members) {
        const member = el as HTMLElement;
        const elementId = member.dataset.elementId;
        if (!elementId) continue;

        const memberClass = getElementClass(member);
        if (!memberClass) continue;

        const memberRect = member.getBoundingClientRect();

        // Append: composition element → standalone (outgoing port)
        for (const dir of getCompatibleDirections(memberClass, standaloneClass)) {
            if (!isPortFree(elementId, dir, 'outgoing', edges)) continue;
            const dist = checkDirectionalProximity(memberRect, standaloneRect, dir);
            if (dist < bestDistance) {
                bestDistance = dist;
                bestId = elementId;
                bestDirection = dir;
                bestRole = 'to';
            }
        }

        // Prepend: standalone → composition element (incoming port)
        for (const dir of getCompatibleDirections(standaloneClass, memberClass)) {
            if (!isPortFree(elementId, dir, 'incoming', edges)) continue;
            const dist = checkDirectionalProximity(standaloneRect, memberRect, dir);
            if (dist < bestDistance) {
                bestDistance = dist;
                bestId = elementId;
                bestDirection = dir;
                bestRole = 'from';
            }
        }
    }

    if (!bestId) return null;
    return { anchorId: bestId, direction: bestDirection, role: bestRole };
}

// ── Options ─────────────────────────────────────────────────────────

export type { MakeDraggableOptions };

// ── applyCanvasElementLayout ──────────────────────────────────────────

export interface CanvasElementLayoutOptions {
    x: number;
    y: number;
    width: number;
    height: number;
    /** Use minHeight instead of height (element grows with content) */
    useMinHeight?: boolean;
}

/**
 * Apply shared positioning and flex layout to a canvas-placed element.
 *
 * Pairs with the `.canvas-element` CSS class which provides the visual
 * defaults (background, border, border-radius, overflow). This function
 * handles the instance-specific values that can't live in CSS (x/y/size).
 */
export function applyCanvasElementLayout(el: HTMLElement, opts: CanvasElementLayoutOptions): void {
    el.style.left = `${opts.x}px`;
    el.style.top = `${opts.y}px`;
    el.style.width = `${opts.width}px`;
    if (opts.useMinHeight) {
        el.style.minHeight = `${opts.height}px`;
    } else {
        el.style.height = `${opts.height}px`;
    }
}

// ── preventDrag ─────────────────────────────────────────────────────

/**
 * Prevent drag from starting on an interactive child element.
 *
 * Canvas elements are draggable, but their interactive children (textareas,
 * buttons, inputs) need to receive mousedown without triggering a drag.
 * This stops the event from bubbling to the drag handler.
 *
 * Also marks elements with data-prevent-drag so the canvas click handler
 * knows to skip focus theft and element selection for these elements.
 */
export function preventDrag(...elements: HTMLElement[]): void {
    for (const el of elements) {
        el.dataset.preventDrag = '';
        el.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
    }
}

// ── makeDraggable ───────────────────────────────────────────────────

/**
 * Make an element draggable by a handle.
 *
 * Design decision: Uses free-form dragging without live grid snapping.
 * Grid position is calculated only on mouseup for persistence. This provides
 * smoother UX for content elements compared to grid-snapped dragging.
 *
 * @param element - The element to make draggable
 * @param handle - The handle that triggers dragging (typically a title bar)
 * @param element - The element model to update with position
 * @param opts - Optional configuration
 * @returns Cleanup function to remove all event listeners
 */
export function makeDraggable(
    element: HTMLElement,
    handle: HTMLElement,
    item: Element,
    opts: MakeDraggableOptions = {},
): () => void {
    const { ignoreButtons = false, logLabel = 'Element' } = opts;
    const log = getLogger();
    const seg = getLogSegment();
    const canvasHost = getCanvasHost();

    // AbortController for all event listeners (including mousedown)
    const setupController = new AbortController();

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let elementStartX = 0;
    let elementStartY = 0;
    let dragController: AbortController | null = null;
    let currentMeldTarget: HTMLElement | null = null;
    let rafId: number | null = null;
    let dragCanvasId = '';

    // Multi-selection drag support
    let isMultiDrag = false;
    let multiDragElements: Array<{ element: HTMLElement; startX: number; startY: number; item: Element }> = [];

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;

        const scale = canvasHost.getTransform(dragCanvasId).scale || 1;
        const deltaX = (e.clientX - dragStartX) / scale;
        const deltaY = (e.clientY - dragStartY) / scale;

        if (isMultiDrag) {
            for (const { element: el, startX, startY } of multiDragElements) {
                const newX = startX + deltaX;
                const newY = startY + deltaY;
                el.style.left = `${newX}px`;
                el.style.top = `${newY}px`;
            }
        } else {
            const newX = elementStartX + deltaX;
            const newY = elementStartY + deltaY;
            element.style.left = `${newX}px`;
            element.style.top = `${newY}px`;
        }

        // Cancel any pending meld feedback update
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
        }

        // Schedule meld feedback for next frame
        if (canInitiateMeld(element) || canReceiveMeld(element)) {
            rafId = requestAnimationFrame(() => {
                rafId = null;
                const meldInfo = findMeldTarget(element);
                if (meldInfo.target && meldInfo.distance < PROXIMITY_THRESHOLD) {
                    const [initiator, target] = meldInfo.reversed
                        ? [meldInfo.target, element]
                        : [element, meldInfo.target];
                    applyMeldFeedback(initiator, target, meldInfo.distance, meldInfo.direction);
                    currentMeldTarget = meldInfo.target;
                } else if (currentMeldTarget) {
                    clearMeldFeedback(element);
                    currentMeldTarget = null;
                }
            });
        }
    };

    const handleMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;

        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }

        element.classList.remove('is-dragging');
        if (isMultiDrag) {
            for (const { element: el } of multiDragElements) {
                el.classList.remove('is-dragging');
            }
        }

        // Check if we should meld
        if (canInitiateMeld(element) || canReceiveMeld(element)) {
            const meldInfo = findMeldTarget(element);
            if (meldInfo.target && meldInfo.distance < MELD_THRESHOLD) {
                const nearbyElement = meldInfo.target;
                const nearbyElementId = nearbyElement.dataset.elementId || 'element-unknown';

                const nearbyItem: Element = {
                    id: nearbyElementId,
                    title: 'Element',
                    renderContent: () => nearbyElement
                };

                if (rafId !== null) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
                clearMeldFeedback(element);
                clearMeldFeedback(nearbyElement);
                setupController.abort();
                dragController?.abort();

                const [meldInitiator, meldTarget, meldInitiatorItem, meldTargetItem] = meldInfo.reversed
                    ? [nearbyElement, element, nearbyItem, item]
                    : [element, nearbyElement, item, nearbyItem];

                const targetComp = meldTarget.closest('.melded-composition') as HTMLElement | null;
                const initiatorComp = meldInitiator.closest('.melded-composition') as HTMLElement | null;

                if (targetComp || initiatorComp) {
                    const compositionElement = (targetComp || initiatorComp)!;
                    const standaloneElement = targetComp ? meldInitiator : meldTarget;
                    const standaloneId = standaloneElement.dataset.elementId || '';
                    const standaloneClass = getElementClass(standaloneElement);
                    const fallbackAnchorId = (targetComp ? meldTarget : meldInitiator).dataset.elementId || '';
                    const existingComp = canvasHost.findCompositionByElement(fallbackAnchorId);

                    if (existingComp && standaloneClass) {
                        const selectedIds = canvasHost.getSelectedElementIds(dragCanvasId);
                        const selectedAnchor = selectedIds.find(id =>
                            compositionElement.querySelector(`[data-element-id="${id}"]`) !== null
                        );

                        let bestAnchorId: string;
                        let bestDirection: EdgeDirection;
                        if (selectedAnchor) {
                            bestAnchorId = selectedAnchor;
                            bestDirection = meldInfo.direction;
                        } else {
                            const bestAnchor = findBestAnchorInComposition(
                                standaloneElement, compositionElement, existingComp.edges
                            );
                            bestAnchorId = bestAnchor?.anchorId || fallbackAnchorId;
                            bestDirection = bestAnchor?.direction || meldInfo.direction;
                        }

                        const options = getMeldOptions(standaloneClass, compositionElement, existingComp.edges);
                        const option = selectPreferredMeldOption(options, bestAnchorId, bestDirection);

                        if (option) {
                            extendComposition(compositionElement, standaloneElement, standaloneId, option.elementId, option.direction, option.incomingRole);

                            const updatedId = compositionElement.getAttribute('data-element-id') || '';
                            const compositionItem: Element = {
                                id: updatedId,
                                title: 'Melded Composition',
                                renderContent: () => compositionElement
                            };
                            makeDraggable(compositionElement, compositionElement, compositionItem, {
                                logLabel: 'MeldedComposition'
                            });

                            log.info(seg, `[${logLabel}] Extended composition with ${standaloneId} (${option.direction}, ${option.incomingRole})`);
                            return;
                        }
                    }
                    log.debug(seg, `[${logLabel}] No free ports for ${standaloneId}, skipping meld`);
                    return;
                }

                // Neither is in a composition — create new 2-element composition
                const composition = performMeld(meldInitiator, meldTarget, meldInitiatorItem, meldTargetItem, meldInfo.direction);

                const compositionItem: Element = {
                    id: composition.getAttribute('data-element-id') || `melded-${meldInitiatorItem.id}-${meldTargetItem.id}`,
                    title: 'Melded Composition',
                    renderContent: () => composition
                };

                makeDraggable(composition, composition, compositionItem, {
                    logLabel: 'MeldedComposition'
                });

                log.info(seg, `[${logLabel}] Melded ${meldInitiatorItem.id} → ${meldTargetItem.id} (${meldInfo.direction}${meldInfo.reversed ? ', reversed' : ''})`);
                return;
            }
        }

        // Clear any meld feedback
        clearMeldFeedback(element);
        currentMeldTarget = null;

        // Save positions
        if (isMeldedComposition(element)) {
            const x = Math.round(parseFloat(element.style.left) || 0);
            const y = Math.round(parseFloat(element.style.top) || 0);
            const compositionId = element.getAttribute('data-element-id') || '';
            const firstChild = element.querySelector('[data-element-id]');
            const childId = firstChild?.getAttribute('data-element-id') || '';
            const existingComp = canvasHost.findCompositionByElement(childId);
            if (existingComp) {
                canvasHost.saveComposition({ ...existingComp, x, y });
                log.debug(seg, `[${logLabel}] Updated composition position`, { compositionId, x, y });
            } else {
                log.warn(seg, `[${logLabel}] Composition ${compositionId} not found in storage`);
            }
        } else if (isMultiDrag) {
            for (const { element: el, item: g } of multiDragElements) {
                const x = Math.round(parseFloat(el.style.left) || 0);
                const y = Math.round(parseFloat(el.style.top) || 0);
                g.x = x;
                g.y = y;
                if (g.symbol) {
                    const existing = canvasHost.getCanvasElements().find(cg => cg.id === g.id);
                    canvasHost.saveCanvasElement({
                        ...existing,
                        id: g.id,
                        symbol: g.symbol,
                        x,
                        y,
                        width: g.width,
                        height: g.height,
                    });
                }
            }
            log.debug(seg, `[${logLabel}] Finished multi-dragging ${multiDragElements.length} elements`);
            multiDragElements = [];
            isMultiDrag = false;
        } else {
            const x = Math.round(parseFloat(element.style.left) || 0);
            const y = Math.round(parseFloat(element.style.top) || 0);
            item.x = x;
            item.y = y;
            if (item.symbol) {
                const existing = canvasHost.getCanvasElements().find(g => g.id === item.id);
                canvasHost.saveCanvasElement({
                    ...existing,
                    id: item.id,
                    symbol: item.symbol,
                    x,
                    y,
                    width: item.width,
                    height: item.height,
                });
            }
            log.debug(seg, `[${logLabel}] Finished dragging ${item.id}`);
        }

        dragController?.abort();
        dragController = null;
    };

    handle.addEventListener('mousedown', (e) => {
        if (ignoreButtons && (e.target as HTMLElement).tagName === 'BUTTON') {
            return;
        }

        // A window and a viewport-filling element both carry their own drag.
        const form = getForm(element);
        if (form === 'window' || form === 'canvasExpanded') {
            return;
        }

        if (element.closest('.melded-composition') && !element.classList.contains('melded-composition')) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        isDragging = true;

        dragStartX = e.clientX;
        dragStartY = e.clientY;
        elementStartX = element.offsetLeft;
        elementStartY = element.offsetTop;

        element.classList.add('is-dragging');
        element.style.zIndex = String(++topZIndex);

        const canvasId = (element.closest('[data-canvas-id]') as HTMLElement | null)?.dataset?.canvasId ?? 'canvas-workspace';
        dragCanvasId = canvasId;
        const selectedIds = canvasHost.getSelectedElementIds(canvasId);
        if (selectedIds.length > 1 && canvasHost.isElementSelected(canvasId, item.id)) {
            isMultiDrag = true;
            const canvas = element.parentElement;
            if (canvas) {
                for (const id of selectedIds) {
                    const el = canvas.querySelector(`[data-element-id="${id}"]`) as HTMLElement | null;
                    if (el) {
                        const elRect = el.getBoundingClientRect();
                        const itemData: Element = {
                            id,
                            title: el.dataset.elementTitle || 'Element',
                            symbol: el.dataset.symbol,
                            width: Math.round(elRect.width),
                            height: Math.round(elRect.height),
                            renderContent: () => el
                        };
                        multiDragElements.push({
                            element: el,
                            startX: el.offsetLeft,
                            startY: el.offsetTop,
                            item: itemData
                        });
                        el.classList.add('is-dragging');
                        el.style.zIndex = element.style.zIndex;
                    }
                }
            }
        }

        dragController = new AbortController();
        document.addEventListener('mousemove', handleMouseMove, { signal: dragController.signal });
        document.addEventListener('mouseup', handleMouseUp, { signal: dragController.signal });

        log.debug(seg, `[${logLabel}] Started dragging ${isMultiDrag ? `${selectedIds.length} elements` : item.id}`);
    }, { signal: setupController.signal });

    return () => {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
        }
        setupController.abort();
        dragController?.abort();
    };
}

