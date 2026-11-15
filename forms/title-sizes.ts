/**
 * The presses in an element's title bar: "Those buttons are supposed to be square and equally sized and margin and
 * alignment within the header". Its own file, so the fit rule (fit.ts) reads them without the controls.
 * Literals: a const made of another is undefined in a Bun bundle.
 */

/** px: each press in a title bar is this square, whatever it holds. */
export const TITLE_PRESS = 24;

/** px: as far in from the bar's end as from its top and bottom in a TITLE_BAR_HEIGHT bar, and this far apart. */
export const TITLE_INSET = 4;
