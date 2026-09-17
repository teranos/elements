/**
 * Window Form - Traditional window with chrome
 *
 * The window form morphs a glyph into a draggable window with:
 * - Title bar
 * - Minimize/close buttons
 * - Resizable content area
 * - Window chrome (borders, shadow, padding)
 */

import { getLogger, getLogSegment } from '../config';
import { type Element, DEFAULT_COLOR, DEFAULT_TEXT_COLOR } from '../element';
import { addWindowControls } from './title-bar-controls';
import { disarmContentWatch } from '../content-watch';
import { stashContent } from './stash';
import { renderContent } from './render-content';
import { setupWindowDrag, teardownWindowDrag } from '../window-drag';
import { fitsAsWindow } from '../window-fits';
import { morphDotToPanel } from './panel';
import { findPlacement, occupiedRects, clampToViewport } from '../placement';
import {
    getLastPosition,
    setLastPosition,
} from '../dataset';
import { prepareMorphTo, calculateTrayTarget, resetElement } from './morphology';
import { settleWindow } from './settle-window';
import { beginMorphToBox, beginMorphToDot } from '../morph-transaction';
import {
    getOpenDuration,
    getRestDuration,
    TITLE_BAR_HEIGHT,
    CANVAS_ELEMENT_CONTENT_PADDING,
    MORPHING_Z_INDEX,
} from '../element';

/**
 * Morph a glyph to window with chrome (title bar, buttons)
 */
export function morphDotToWindow(
    element: HTMLElement,
    item: Element,
    verifyElement: (id: string, element: HTMLElement) => void,
    onRemove: (id: string) => void,
    onMinimize: (element: HTMLElement, item: Element) => void
): void {
    const log = getLogger();
    const seg = getLogSegment();

    // Size ownership per axis:
    //   initialWidth set  → window owns width  (explicit px, content clips/scrolls)
    //   initialWidth unset → content owns width (`fit-content`, window wraps)
    // Same for height. Pre-render + measure the content when either axis is
    // content-owned so the morph animation targets the final box directly
    // (no post-animation resize flash).
    const widthOwnedByWindow = item.initialWidth != null;
    const heightOwnedByWindow = item.initialHeight != null;

    let preRenderedContent: HTMLElement | null = null;
    let measuredWidth = 0;
    let measuredHeight = 0;
    if (!widthOwnedByWindow || !heightOwnedByWindow) {
        preRenderedContent = item.renderContent();
        const measurer = document.createElement('div');
        measurer.style.position = 'fixed';
        measurer.style.left = '-99999px';
        measurer.style.top = '0';
        measurer.style.visibility = 'hidden';
        measurer.style.padding = `${CANVAS_ELEMENT_CONTENT_PADDING}px`;
        measurer.appendChild(preRenderedContent);
        document.body.appendChild(measurer);
        measuredWidth = measurer.scrollWidth;
        measuredHeight = measurer.scrollHeight;
        // Detach content from measurer so it can be reparented into the window
        // without being torn down (subscriptions/timers keep firing).
        measurer.removeChild(preRenderedContent);
        document.body.removeChild(measurer);
    }

    // Asked before a transaction opens, because which form this is
    // cannot be decided halfway through becoming one (Morph Axioma).
    if (!fitsAsWindow(measuredWidth, window.innerWidth)) {
        morphDotToPanel(element, item, verifyElement, onRemove, onMinimize, preRenderedContent ?? undefined);
        return;
    }

    // settleWindow() hands out the settled stacking value on commit.
    const morph = prepareMorphTo(element, item, verifyElement, 'window', MORPHING_Z_INDEX);
    const fromRect = morph.rect;

    const titleBarHeight = parseInt(TITLE_BAR_HEIGHT);
    // No declared or measured size outranks the screen it lands on — a phone
    // may be the primary screen. Size clamps before placement searches with it.
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const sized = clampToViewport({
        x: 0,
        y: 0,
        width: widthOwnedByWindow ? parseInt(item.initialWidth!) : measuredWidth,
        height: heightOwnedByWindow ? parseInt(item.initialHeight!) : measuredHeight + titleBarHeight,
    }, viewport);
    const windowWidth = sized.width;
    const windowHeight = sized.height;

    // Check if we have a remembered position on the element
    const rememberedPos = getLastPosition(element);

    // Remembered position, then a declared default, then the emptiest place
    // we can find. Centring every glyph put each new one on top of the last.
    const chosen = (rememberedPos || item.defaultX !== undefined)
        ? null
        : findPlacement(
            { width: windowWidth, height: windowHeight },
            occupiedRects(element),
            { width: window.innerWidth, height: window.innerHeight },
        );

    // A remembered or declared position must not park the title bar off-screen
    const { x: targetX, y: targetY } = clampToViewport({
        x: rememberedPos?.x ?? item.defaultX ?? chosen!.x,
        y: rememberedPos?.y ?? item.defaultY ?? chosen!.y,
        width: windowWidth,
        height: windowHeight,
    }, viewport);

    // BEGIN TRANSACTION: Start the morph animation
    beginMorphToBox(
        element,
        fromRect,
        { x: targetX, y: targetY, width: windowWidth, height: windowHeight },
        getOpenDuration()
    ).then(() => {
        // COMMIT PHASE: Animation completed successfully
        log.debug(seg, `[Window] Animation committed for ${item.id}`);

        // The morph class leaves with the morph. A window settles into no class
        // of its own: .glyph-window carried one declaration, pointer-events:
        // auto, which .glyph-morphing-to-window carried too, and
        // [data-form="window"] spans both. The glyph's own classes
        // survive the morph.
        morph.commitClass();

        // What a window is, wherever it came from — the box, the cap, the
        // shadow, the column that clips, its place in the stack
        // (forms/settle-window.ts). Per-axis size ownership is this
        // path's alone, so the style each axis takes is passed in.
        settleWindow(element, {
            x: targetX,
            y: targetY,
            width: windowWidth,
            height: windowHeight,
            widthStyle: widthOwnedByWindow ? undefined : 'fit-content',
            heightStyle: heightOwnedByWindow ? undefined : 'fit-content',
        });

        // What the glyph wears is data on the glyph and never a property of a
        // form (VISION.md). The canvas path reaches the same place by
        // leaving on the element what it already wore.
        element.style.backgroundColor = item.color ?? DEFAULT_COLOR;
        if (item.border) element.style.border = item.border;
        element.style.backdropFilter = 'blur(2px)';
        element.style.padding = '0';
        element.style.opacity = '1';
        element.style.color = item.textColor ?? DEFAULT_TEXT_COLOR;

        // Restore stashed content or render fresh (shared with panel.ts).
        // preRenderedContent is populated when we measured for fit-content
        // sizing above; passing it in avoids a second renderContent() call.
        const { titleBar } = renderContent(
            element,
            item,
            'Window',
            preRenderedContent ?? undefined,
        );

        // Add window controls (minimize/close) to the title bar
        addWindowControls(titleBar, {
            onMinimize: () => morphWindowToDot(element, item, verifyElement, onMinimize),
            onClose: item.onClose ? () => {
                teardownWindowDrag(element);
                // A closed glyph is not a glyph that failed to draw.
                disarmContentWatch(element);
                onRemove(item.id);
                element.remove();
                try {
                    item.onClose!();
                } catch (error) {
                    log.error(seg, `[Window ${item.id}] Error in onClose callback: ${error instanceof Error ? error.message : String(error)}`);
                }
            } : undefined,
        });

        // Width/height are owned per-axis (see morphDotToWindow prologue).
        // No ResizeObserver — `fit-content` handles growth/shrink naturally
        // when content owns the axis; explicit px handles the window-owned axis.

        // Make window draggable. The width a drag reflows from was recorded by
        // the settle, which is the one place that knows the box.
        setupWindowDrag(element, titleBar);
    }).catch(error => {
        // ROLLBACK: Animation was cancelled or failed
        log.warn(seg, `[Window] Animation failed for ${item.id}: ${error instanceof Error ? error.message : String(error)}`);
        // Element stays in glyph state with the classes it had, can retry
        morph.rollbackClass();
    });
}

/**
 * Morph a window back into a glyph (dot)
 * THE SAME ELEMENT morphs back - no new elements created
 */
export function morphWindowToDot(
    windowElement: HTMLElement,
    item: Element,
    verifyElement: (id: string, element: HTMLElement) => void,
    onMorphComplete: (element: HTMLElement, item: Element) => void
): void {
    const log = getLogger();
    const seg = getLogSegment();
    verifyElement(item.id, windowElement);
    log.debug(seg, `[Window] Minimizing ${item.id}`);

    // Get current window state before clearing anything
    const currentRect = windowElement.getBoundingClientRect();

    // Remember window position for next time it opens
    setLastPosition(windowElement, currentRect.left, currentRect.top);

    // Tear down window drag handlers before stashing (prevents handler accumulation)
    teardownWindowDrag(windowElement);

    // Stash content (strips window controls, preserves glyph identity off-DOM)
    stashContent(windowElement);

    const trayTarget = calculateTrayTarget(item.id);

    beginMorphToDot(windowElement, currentRect, trayTarget, getRestDuration())
        .then(() => {
            resetElement(windowElement, item, 'Window', onMorphComplete);
        })
        .catch(error => {
            // Animation was cancelled or failed
            log.warn(seg, `[Window] Animation failed for ${item.id}: ${error instanceof Error ? error.message : String(error)}`);
            // Element stays in window state, can retry
        });
}

/**
 * @deprecated Renamed to {@link morphDotToWindow} — the tray dot is where it starts, and `To`/`From` left that unsaid.
 *
 * Every morph now says both ends, in the names the table holds. This is the
 * same function, so a consumer still on it is unaffected.
 */
export const morphToWindow: typeof morphDotToWindow = morphDotToWindow;

/**
 * @deprecated Renamed to {@link morphWindowToDot} — `From` named the origin and left the destination to be guessed.
 *
 * Every morph now says both ends, in the names the table holds. This is the
 * same function, so a consumer still on it is unaffected.
 */
export const morphFromWindow: typeof morphWindowToDot = morphWindowToDot;
