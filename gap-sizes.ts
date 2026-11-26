// "elements should own gaps right? So no consumers can disagree"
// The set of gaps, apart from gapAt so the package's rule (text.ts) can read it without what gapAt brings with it.

/**
 * px: the space between things inside an element, and nothing else. none between things meant to touch (the segments
 * of one strip); sm between a thing and what labels it (a label
 * and its field, the presses of a title bar); md between things of one group, and what any box is spaced at until
 * said otherwise; lg between groups. The Claude app's composer, measured on #114: 8 inside, 16 at the edges.
 * Literals: a const made of another is undefined in a Bun bundle.
 */
export const GAPS: Readonly<{ none: 0; sm: 4; md: 8; lg: 16 }> = Object.freeze({ none: 0, sm: 4, md: 8, lg: 16 } as const);

/** A gap from the set. Any other gap does not compile. */
export type GapSize = keyof typeof GAPS;
