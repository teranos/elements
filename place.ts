// "the very non standard way of positioning things in elements itself, and it starts at the example in that repo"
// An element placed on a canvas stands at the left and top it carries (canvas/drag.ts,
// applyCanvasElementLayout), and a left and a top mean nothing to a box nothing positioned. Where a
// canvas-placed element stands is the package's, so the package says it, and no host has to.
//
// A default, not a decree: it is not important, so what a morph writes on the element while it moves
// (fixed, from the cursor, from a window or from a button) and what a host writes both still win. When
// a morph lets go of its position (canvas/cursor.ts, commitCursorPlacement), this is what the element
// is left standing on.

/** The package's place for a canvas-placed element, laid into its layer by text.ts. */
export function placeRule(): string {
    return '[data-form="canvasPlaced"] { position: absolute; }';
}
