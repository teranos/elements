/**
 * @qntx/glyphs — Element runtime and type definitions.
 *
 * The element is the universal UI primitive. This package provides the core
 * runtime (tray, proximity engine, morph transactions, forms) and
 * type definitions for element development.
 *
 * Host apps call configureElements() at startup to wire in their logger
 * and persistence. Without configuration, safe defaults apply.
 *
 * Usage:
 *   import { configureElements, Proximity } from '@qntx/glyphs';
 *   import type { Element, ElementUI, RenderFn } from '@qntx/glyphs';
 */

// Configuration / dependency injection
export { configureElements, getLogger, getLogSegment, getPersistence, getCanvasHost, getCanvasBridge, getDotGeometry, removeCanvasElement } from './config';
export type { ElementConfig, Logger, Persistence, DotGeometry, CanvasElementData, CanvasHost, CanvasCoordinateBridge } from './config';

// Element primitive — interface + constants
export {
    OPEN_DURATION_MS,
    REST_DURATION_MS,
    CONTENT_DEADLINE_MS,
    getOpenDuration,
    getRestDuration,
    DEFAULT_WINDOW_WIDTH,
    DEFAULT_WINDOW_HEIGHT,
    WINDOW_BORDER_RADIUS,
    WINDOW_BOX_SHADOW,
    TITLE_BAR_HEIGHT,
    WINDOW_BUTTON_SIZE,
    CONTENT_PADDING,
    PANEL_BORDER_RADIUS,
    PANEL_BORDER_RADIUS_BOTTOM,
    PANEL_OVERLAY_BG,
    PANEL_Z_INDEX,
    CANVAS_ELEMENT_TITLE_BAR_HEIGHT,
    CANVAS_ELEMENT_CONTENT_PADDING,
    CONTENT_INNER_PADDING,
    MAX_VIEWPORT_HEIGHT_RATIO,
    MAX_VIEWPORT_WIDTH_RATIO,
    MIN_WINDOW_HEIGHT,
    MIN_WINDOW_WIDTH,
    DEFAULT_COLOR,
    DEFAULT_TEXT_COLOR,
} from './element';
export type { Element } from './element';

// The forms an element can take — the list the type, the stylesheets and
// the morph functions all read from. AXIOMAS.md names the noun; this names them.
export { FORMS, TRAY_DESTINATIONS, isForm, isTrayDestination } from './form';
export type { Form, FormTable, TrayDestination } from './form';

// Dataset attribute helpers
export {
    setForm,
    getForm,
    /** @deprecated Use `getForm`. */
    isInWindowState,
    /** @deprecated Use `setForm`. */
    setWindowState,
    getLastPosition,
    setLastPosition,
    hasProximityText,
    setProximityText,
    getElementId,
    setElementId,
    setCanvasOrigin,
    getCanvasOrigin,
    clearCanvasOrigin,
    getSymbol,
    setSymbol,
    setContentState,
    getContentState,
} from './dataset';

// What an element's body is showing — the states, and the watch that settles them.
// A form with chrome and an empty body is a state the form
// table cannot name; these name it.
export { CONTENT_STATES, isContentState, isSettled } from './content-state';
export type { ContentState, ContentStateTable } from './content-state';
export {
    watchContent,
    disarmContentWatch,
    declareContent,
    showsSomething,
    isWatched,
} from './content-watch';

// Proximity engine
export { Proximity, applyRestingDotGeometry } from './tray/proximity';

// Symbol rendering — the one way item.symbol becomes DOM
export { createSymbolSpan, settleSymbolSpan } from './symbol-span';

// Morph transactions — Web Animations API, taken or abandoned
export {
    beginMorphToDot,
    /** @deprecated Renamed to `beginMorphToDot`. */
    beginMinimizeMorph,
    beginMorphToBox,
    beginMorphToCanvasPlaced,
    /** @deprecated Renamed to `beginMorphToCanvasPlaced`. */
    beginRestoreMorph,
    cancelMorph,
} from './morph-transaction';

// Form helpers
export {
    verifyElementAxiom,
    prepareMorphTo,
    calculateTrayTarget,
    resetElement,
} from './forms/morphology';

export { addWindowControls, removeWindowControls } from './forms/title-bar-controls';
export type { WindowControlsConfig } from './forms/title-bar-controls';

export { stashContent, restoreContent, hasStash } from './forms/stash';

export { renderContent } from './forms/render-content';
export type { RenderContentResult } from './forms/render-content';

// Canvas-window form — canvas ↔ window morphing
export {
    morphCanvasPlacedToWindow,
    morphWindowToCanvasPlaced,
    placeWindowOnCanvas,
} from './canvas/window';
export type { CanvasWindowConfig } from './canvas/window';

// Expand-to-window — unified lifecycle wiring
export { wireExpandToWindow } from './canvas/expand-to-window';
export type { ExpandToWindowConfig } from './canvas/expand-to-window';

// Window drag — standalone, no canvas dependency
export { setupWindowDrag, teardownWindowDrag } from './window/drag';

// Placement — where an element lands when nothing says where
export { findPlacement, occupiedRects, overlapArea, placementCost, clampToViewport } from './window/placement';
export type { PlacementOpts, Rect, Size } from './window/placement';

// Stacking — the last window touched is the one in front
export { raise, raiseOnInteract } from './window/z-order';

// Forms — every morph names both ends, in the names the table holds
export { morphDotToWindow, morphWindowToDot } from './window/window';
export { morphDotToWorkspace, morphWorkspaceToDot } from './canvas/workspace';
export { morphDotToPanel, morphPanelToDot } from './forms/panel';
export {
    /** @deprecated Renamed to `morphDotToWindow`. */
    morphToWindow,
    /** @deprecated Renamed to `morphWindowToDot`. */
    morphFromWindow,
} from './window/window';
export {
    /** @deprecated Renamed to `morphDotToWorkspace`. */
    morphToCanvas,
    /** @deprecated Renamed to `morphWorkspaceToDot`. */
    morphFromCanvas,
} from './canvas/workspace';
export {
    /** @deprecated Renamed to `morphDotToPanel`. */
    morphToPanel,
    /** @deprecated Renamed to `morphPanelToDot`. */
    morphFromPanel,
} from './forms/panel';

// Cursor form — transient placement preview
export { createCursorElement, attachCursorToMouse, prepareCursorForPlacement, commitCursorPlacement } from './canvas/cursor';

// Canvas-placed factory (CPLCD)
export { canvasPlaced } from './canvas/placed';
export type { CanvasPlacedConfig, CanvasPlacedResult } from './canvas/placed';

// The tray singleton
export { tray } from './tray/tray';

// Composition types — canonical, package-owned (CTYPE)
export type { CompositionEdge, CompositionState, EdgeDirection } from './canvas/composition';
export { buildEdgesFromChain, extractElementIds } from './canvas/composition';

// Edge graph — pure DAG traversal and layout (EWALK + GRDLP)
export {
    getRootElementIds,
    getLeafElementIds,
    isPortFree,
    isConnectedGraph,
    computeGridPositions,
} from './canvas/edge-graph';

// Touch browse
export { setupTouchBrowse, findPeakedElement } from './tray/touch-browse';
export type { TouchBrowseHost } from './tray/touch-browse';

// Meld system
export {
    canInitiateMeld,
    canReceiveMeld,
    findMeldTarget,
    checkDirectionalProximity,
    PROXIMITY_THRESHOLD,
    MELD_THRESHOLD,
} from './canvas/meld/detect';
export { applyMeldFeedback, clearMeldFeedback } from './canvas/meld/feedback';
export {
    performMeld,
    extendComposition,
    reconstructMeld,
    isMeldedComposition,
    unmeldComposition,
    detachElement,
} from './canvas/meld/composition';
export {
    MELDABILITY,
    getInitiatorClasses,
    getTargetClasses,
    getCompatibleTargets,
    getCompatibleDirections,
    areClassesCompatible,
    getCompositionElementIds,
    getElementClass,
    getMeldOptions,
    selectPreferredMeldOption,
} from './canvas/meld/meldability';
export type { PortRule, MeldOption } from './canvas/meld/meldability';

// Canvas drag interaction (DRAGR)
export {
    makeDraggable,
    applyCanvasElementLayout,
    preventDrag,
} from './canvas/drag';
export type { CanvasElementLayoutOptions } from './canvas/drag';

// Canvas resize interaction
export { makeResizable } from './canvas/resize';
export type { MakeResizableOptions } from './canvas/resize';

// Element lifecycle cleanup
export {
    storeCleanup,
    runCleanup,
    cleanupResizeObserver,
    setupElementResizeObserver,
} from './canvas/cleanup';

// Where a dragged window sits and how wide it is
export { reflowBox } from './window/reflow';
export type { Box } from './window/reflow';

// ElementUI DOM primitives — the pure half of the ElementUI factory
export { createInput, createButton, createStatusLine } from './canvas/ui-primitives';

// ElementUI interface and related types
export type {
    ElementUI,
    ElementModule,
    ElementDef,
    RenderFn,
    ElementOpts,
    FetchOpts,
    MeldEvent,
    SpawnResultDetail,
    MakeDraggableOptions,
    AttestationQuery,
    Attestation,
} from './canvas/element-ui';
