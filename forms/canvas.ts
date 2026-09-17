/**
 * Workspace Form — the canvas itself, edge to edge, no chrome.
 *
 * Its row in FORMS is `workspace`: `canvas` sat one suffix from
 * `canvasPlaced` and meant the opposite thing, the surface rather than a glyph
 * on it. QNTX's canvas-glyph.ts already gives this one `id: 'canvas-workspace'`.
 *
 * The canvas form morphs a glyph to fill the entire viewport
 * with no window chrome, title bar, or padding. Used for spatial workspaces,
 * overlays, and other full-screen experiences.
 */

import { getLogger, getLogSegment } from '../config';
import { type Element, DEFAULT_COLOR, DEFAULT_TEXT_COLOR } from '../element';
import { beginMorphToBox, beginMorphToDot } from '../morph-transaction';
import { getOpenDuration, getRestDuration } from '../element';
import { prepareMorphTo, calculateTrayTarget, resetElement } from './morphology';

/**
 * Morph a glyph to fullscreen canvas (no chrome)
 */
export function morphDotToWorkspace(
    element: HTMLElement,
    item: Element,
    verifyElement: (id: string, element: HTMLElement) => void,
    onMinimize: (element: HTMLElement, item: Element) => void
): void {
    const log = getLogger();
    const seg = getLogSegment();
    const morph = prepareMorphTo(element, item, verifyElement, 'workspace', '1000');
    const fromRect = morph.rect;

    // Target: full viewport
    const targetX = 0;
    const targetY = 0;
    const targetWidth = window.innerWidth;
    const targetHeight = window.innerHeight;

    // BEGIN TRANSACTION: Start the morph animation
    beginMorphToBox(
        element,
        fromRect,
        { x: targetX, y: targetY, width: targetWidth, height: targetHeight },
        getOpenDuration()
    ).then(() => {
        // COMMIT PHASE: Animation completed successfully
        log.debug(seg, `[Canvas] Animation committed for ${item.id}`);

        // Apply final fullscreen state - NO CHROME
        element.style.position = 'fixed';
        element.style.left = '0';
        element.style.top = '0';
        element.style.width = '100vw';
        element.style.height = '100vh';
        element.style.borderRadius = '0'; // No rounded corners
        element.style.backgroundColor = item.color ?? DEFAULT_COLOR;
        if (item.border) element.style.border = item.border;
        element.style.backdropFilter = 'blur(2px)';
        element.style.color = item.textColor ?? DEFAULT_TEXT_COLOR;
        element.style.boxShadow = 'none'; // No shadow
        element.style.padding = '0'; // No padding
        element.style.opacity = '1';

        // Set up as flex container (content fills entire viewport)
        element.style.display = 'flex';
        element.style.flexDirection = 'column';
        // Morph class leaves with the morph; settled fullscreen class stays
        morph.commitClass('canvas-fullscreen-adjusted');

        // Add minimize button (floating, top-right corner)
        const minimizeBtn = document.createElement('button');
        minimizeBtn.textContent = '\u2212';
        minimizeBtn.className = 'canvas-minimize-btn';
        minimizeBtn.onclick = () => morphWorkspaceToDot(
            element,
            item,
            verifyElement,
            onMinimize
        );
        element.appendChild(minimizeBtn);

        // Add content (fills viewport)
        try {
            const content = item.renderContent();
            content.style.flex = '1'; // Take all space
            content.style.overflow = 'hidden';
            element.appendChild(content);
        } catch (error) {
            log.error(seg, `[Canvas ${item.id}] Error rendering content: ${error instanceof Error ? error.message : String(error)}`);
            const errorContent = document.createElement('div');
            errorContent.style.padding = '16px';
            errorContent.style.flex = '1';
            errorContent.style.color = 'var(--color-error)';

            const errorTitle = document.createElement('div');
            errorTitle.style.fontWeight = 'bold';
            errorTitle.textContent = 'Error rendering content';
            errorContent.appendChild(errorTitle);

            const errorMsg = document.createElement('div');
            errorMsg.style.opacity = '0.8';
            errorMsg.style.fontSize = '12px';
            errorMsg.textContent = error instanceof Error ? error.message : String(error);
            errorContent.appendChild(errorMsg);

            element.appendChild(errorContent);
        }
    }).catch(error => {
        // ROLLBACK: Animation failed — the glyph keeps the classes it had
        log.warn(seg, `[Canvas] Animation failed for ${item.id}: ${error instanceof Error ? error.message : String(error)}`);
        morph.rollbackClass();
    });
}

/**
 * Morph canvas back to glyph (dot)
 */
export function morphWorkspaceToDot(
    canvasElement: HTMLElement,
    item: Element,
    verifyElement: (id: string, element: HTMLElement) => void,
    onMorphComplete: (element: HTMLElement, item: Element) => void
): void {
    const log = getLogger();
    const seg = getLogSegment();
    verifyElement(item.id, canvasElement);
    log.debug(seg, `[Canvas] Minimizing ${item.id}`);

    // Get current canvas state
    const currentRect = canvasElement.getBoundingClientRect();

    // Clear canvas content
    canvasElement.innerHTML = '';
    canvasElement.textContent = '';

    const trayTarget = calculateTrayTarget(item.id);

    beginMorphToDot(canvasElement, currentRect, trayTarget, getRestDuration())
        .then(() => {
            resetElement(canvasElement, item, 'Canvas', onMorphComplete);
        })
        .catch(error => {
            log.warn(seg, `[Canvas] Animation failed for ${item.id}: ${error instanceof Error ? error.message : String(error)}`);
        });
}

/**
 * @deprecated Renamed to {@link morphDotToWorkspace} — the canvas it named is the workspace, one suffix from `canvasPlaced` and the opposite thing.
 *
 * Every morph now says both ends, in the names the table holds. This is the
 * same function, so a consumer still on it is unaffected.
 */
export const morphToCanvas: typeof morphDotToWorkspace = morphDotToWorkspace;

/**
 * @deprecated Renamed to {@link morphWorkspaceToDot} — same canvas, same suffix, and the destination was unsaid.
 *
 * Every morph now says both ends, in the names the table holds. This is the
 * same function, so a consumer still on it is unaffected.
 */
export const morphFromCanvas: typeof morphWorkspaceToDot = morphWorkspaceToDot;
