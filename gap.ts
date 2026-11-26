// "elements should own gaps right? So no consumers can disagree"
// The gaps are the package's. Inside an element, things are spaced by a container's gap at a size from this set, by
// gapAt(), and nothing else: a margin there is none, and a host's stylesheet or style attribute has no say (text.ts).

import { GAPS, type GapSize } from './gap-sizes';
import { holdTextSize } from './text';

export { GAPS, type GapSize };

/** Space what this node holds at a gap from the set. */
export function gapAt(node: HTMLElement, size: GapSize): void {
    // A caller with no types reaches here with any string; it is stopped the same.
    if (!Object.prototype.hasOwnProperty.call(GAPS, size)) {
        throw new TypeError(`"${String(size)}" is not a gap; the gaps are ${Object.keys(GAPS).join(', ')}`);
    }
    holdTextSize();
    node.dataset.gap = size;
    // Outside any element no rule of the package's spaces it, so the node says its gap itself, not important:
    // inside one, the package's rule outranks it, and says the same.
    node.style.setProperty('gap', `${GAPS[size]}px`);
}
