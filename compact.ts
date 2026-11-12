// "Let's support Compact and Regular"
// A screen is Compact or Regular by its width, and again by its height: Apple's size classes (Human Interface
// Guidelines, Layout). The edges are Material's window size classes' compact edges, as agreed: under 600 wide,
// under 480 high. A phone held upright is Compact wide; held sideways it is Compact high.
// The tray's spacing for a finger keeps its own edge (tray/look.ts): it is about a finger, not a size class.

/** The media query for a Compact width: under 600. */
export const COMPACT_WIDTH = '(max-width: 599.98px)';

/** The media query for a Compact height: under 480. */
export const COMPACT_HEIGHT = '(max-height: 479.98px)';

/** The Compact width, by its first name. (A literal: the bundler loses a const that names another.) */
export const COMPACT = '(max-width: 599.98px)';

/** One axis of a screen: Compact or Regular. */
export type SizeClass = 'compact' | 'regular';

/** The size classes of the screen this page is on now. Where nothing can be asked of it, Regular both ways. */
export function sizeClasses(): { width: SizeClass; height: SizeClass } {
    const ask = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? (query: string): boolean => window.matchMedia(query).matches
        : (): boolean => false;
    return {
        width: ask(COMPACT_WIDTH) ? 'compact' : 'regular',
        height: ask(COMPACT_HEIGHT) ? 'compact' : 'regular',
    };
}
