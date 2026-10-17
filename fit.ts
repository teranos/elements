// "no element should have content that isnt accesible"
// Nothing in an element is wider than what holds it: text wraps even where a host said nowrap,
// a box is no wider than its holder, a row that runs out of room wraps rather than squeezing what
// is in it, a table divides the width it has, and a grid's tracks give way before the edge does.

/** What the fit decides, which a style attribute written important would otherwise keep. */
const FIT_PROPERTIES = ['white-space', 'text-wrap-mode', 'max-width', 'min-width', 'flex-wrap', 'table-layout'];

/** Inside an element, an important style attribute saying how wide is taken off; the element's own box is the form's. */
export function takeOffFit(node: Element): void {
    if (!(node instanceof HTMLElement) || node.dataset.elementId !== undefined) return;
    for (const name of FIT_PROPERTIES) {
        if (node.style.getPropertyPriority(name) === 'important') node.style.removeProperty(name);
    }
}

/** The package's fit for the elements `element` selects, laid into its layer by text.ts. */
export function fitRule(element: string): string {
    return `${element} * { text-wrap-mode: wrap !important; max-width: 100% !important; min-width: 0 !important; flex-wrap: wrap !important; }
${element} table { table-layout: fixed !important; width: 100% !important; }`;
}

/**
 * A grid wider than its holder takes its tracks as written, which no rule outranks: each track is
 * loosened to give way down to nothing, as far as the room asks. Measured, so only on a page.
 * Reports whether any was loosened.
 */
export function loosenGrids(scroller: HTMLElement): boolean {
    let loosened = false;
    for (const node of Array.from(scroller.querySelectorAll<HTMLElement>('*'))) {
        const display = getComputedStyle(node).display;
        if (!display.includes('grid') || node.scrollWidth <= node.clientWidth + 1) continue;
        const tracks = getComputedStyle(node).gridTemplateColumns.split(' ').filter((track) => track !== '' && track !== 'none');
        if (tracks.length === 0 || tracks.every((track) => track.startsWith('minmax(0'))) continue;
        node.style.setProperty('grid-template-columns', tracks.map((track) => `minmax(0, ${track})`).join(' '), 'important');
        loosened = true;
    }
    return loosened;
}
