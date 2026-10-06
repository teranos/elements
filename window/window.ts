/**
 * Window Form - Traditional window with chrome
 *
 * The window form morphs an element into a draggable window with:
 * - Title bar
 * - Minimize/close buttons
 * - Resizable content area
 * - Window chrome (borders, shadow, padding)
 */

import { getLogger, getLogSegment } from '../config';
import { type Element, DEFAULT_COLOR, DEFAULT_TEXT_COLOR } from '../element';
import { wearIdentity } from '../paint';
import { addWindowControls } from '../forms/title-bar-controls';
import { homeOf } from '../forms/home';
import { disarmContentWatch } from '../content/watch';
import { stashContent } from '../content/stash';
import { renderContent } from '../content/render';
import { setupWindowDrag, teardownWindowDrag } from './drag';
import { setupWindowResize, teardownWindowResize } from './resize';
import { fitsAsWindow } from './fits';
import { morphDotToPanel } from '../forms/panel';
import { findPlacement, occupiedRects, clampToViewport } from './placement';
import { safeArea } from '../safe-area';
import {
    getLastPosition,
    setLastPosition,
    getLastSize,
} from '../dataset';
import { prepareMorphTo, calculateTrayTarget, resetElement } from '../forms/morphology';
import { settleWindow } from './settle';
import { backFromKeyboard } from './keyboard';
import { beginMorphToBox, beginMorphToDot } from '../morph-transaction';
import {
    getOpenDuration,
    getRestDuration,
    TITLE_BAR_HEIGHT,
    CANVAS_ELEMENT_CONTENT_PADDING,
    MORPHING_Z_INDEX,
} from '../element';

/**
 * Morph an element to window with chrome (title bar, buttons)
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

    // An element never declares its size. A window is the size a person gave
    // it (window/resize.ts), kept across the tray, or else what its content
    // measures — so the morph animation targets the final box directly.
    const given = getLastSize(element);

    let preRenderedContent: HTMLElement | null = null;
    let measuredWidth = 0;
    let measuredHeight = 0;
    if (!given) {
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
    if (!fitsAsWindow(given?.width ?? measuredWidth, window.innerWidth)) {
        morphDotToPanel(element, item, verifyElement, onRemove, onMinimize, preRenderedContent ?? undefined);
        return;
    }

    // settleWindow() hands out the settled stacking value on commit.
    const morph = prepareMorphTo(element, item, verifyElement, 'window', MORPHING_Z_INDEX);
    const fromRect = morph.rect;

    const titleBarHeight = parseInt(TITLE_BAR_HEIGHT);
    // No declared or measured size outranks the screen it lands on — a phone
    // may be the primary screen. Size clamps before placement searches with it.
    // The area a window may take is the safe area: its title bar and controls
    // are what a finger has to reach (safe-area.ts).
    const viewport = safeArea();
    const sized = clampToViewport({
        x: 0,
        y: 0,
        width: given?.width ?? measuredWidth,
        height: given?.height ?? measuredHeight + titleBarHeight,
    }, viewport);
    const windowWidth = sized.width;
    const windowHeight = sized.height;

    // Check if we have a remembered position on the element
    const rememberedPos = getLastPosition(element);

    // Remembered position, then a declared default, then the emptiest place
    // we can find. Centring every element put each new one on top of the last.
    const chosen = (rememberedPos || item.defaultX !== undefined)
        ? null
        : findPlacement(
            { width: windowWidth, height: windowHeight },
            occupiedRects(element),
            { width: viewport.width, height: viewport.height },
        );

    // A remembered or declared position must not park the title bar off-screen
    const { x: targetX, y: targetY } = clampToViewport({
        x: rememberedPos?.x ?? item.defaultX ?? viewport.x + chosen!.x,
        y: rememberedPos?.y ?? item.defaultY ?? viewport.y + chosen!.y,
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
        // of its own: a window class once carried one declaration, pointer-events:
        // auto, which the morph class carried too, and
        // [data-form="window"] spans both. The element's own classes
        // survive the morph.
        morph.commitClass();

        // What a window is, wherever it came from — the box, the cap, the
        // shadow, the column that clips, its place in the stack
        // (window/settle.ts). Per-axis size ownership is this
        // path's alone, so the style each axis takes is passed in.
        settleWindow(element, {
            x: targetX,
            y: targetY,
            width: windowWidth,
            height: windowHeight,
            widthStyle: given ? undefined : 'fit-content',
            heightStyle: given ? undefined : 'fit-content',
        });

        // What the element wears is data on the element and never a property of a
        // form (VISION.md). The canvas path reaches the same place by
        // leaving on the element what it already wore.
        element.style.backgroundColor = item.color ?? DEFAULT_COLOR;
        wearIdentity(element, item);
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
            onReturn: homeOf(element),
            onClose: item.onClose ? () => {
                teardownWindowDrag(element);
                teardownWindowResize(element);
                // A closed element is not an element that failed to draw.
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

        // No ResizeObserver — `fit-content` follows the content as it grows.

        // Make window draggable. The width a drag reflows from was recorded by
        // the settle, which is the one place that knows the box.
        setupWindowDrag(element, titleBar);
        // The corner is how a person gives it a size, and the body scrolls then.
        setupWindowResize(element);
    }).catch(error => {
        // ROLLBACK: Animation was cancelled or failed
        log.warn(seg, `[Window] Animation failed for ${item.id}: ${error instanceof Error ? error.message : String(error)}`);
        // Element stays in element state with the classes it had, can retry
        morph.rollbackClass();
    });
}

/**
 * What a window takes with it when it goes, wherever it goes: its place for next
 * time, its drag and its corner, and its content into the stash. Returns where
 * it was, for the road out.
 */
export function leaveWindow(windowElement: HTMLElement): DOMRect {
    // Where it stood, not where the keyboard pushed it (window/keyboard.ts).
    backFromKeyboard(windowElement);

    // Get current window state before clearing anything
    const currentRect = windowElement.getBoundingClientRect();

    // Remember window position for next time it opens
    setLastPosition(windowElement, currentRect.left, currentRect.top);

    // Tear down window drag handlers before stashing (prevents handler accumulation)
    teardownWindowDrag(windowElement);
    // The corner is the window's, not the content's: it is not stashed.
    teardownWindowResize(windowElement);

    // Stash content (strips window controls, preserves element identity off-DOM)
    stashContent(windowElement);
    return currentRect;
}

/**
 * Morph a window back into an element (dot)
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

    const currentRect = leaveWindow(windowElement);

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
