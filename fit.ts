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
        if (node.style.getPropertyPriority(name) !== 'important') continue;
        // A row written to wrap already gives way, as the package's own say row is (content/say.ts).
        if (name === 'flex-wrap' && node.style.getPropertyValue(name).startsWith('wrap')) continue;
        node.style.removeProperty(name);
    }
}

/** The package's fit for the elements `element` selects, laid into its layer by text.ts. */
export function fitRule(element: string): string {
    return `${element} * { text-wrap-mode: wrap !important; max-width: 100% !important; min-width: 0 !important; }
${element} [data-fit-wrapped] { flex-wrap: wrap !important; }
${element} table { table-layout: fixed !important; width: 100% !important; }`;
}

/** A flex row whose content runs past it, or that squeezes what is in it below what that holds, wraps, once. Measured, so only on a page. */
export function wrapRows(scroller: HTMLElement): void {
    for (const node of Array.from(scroller.querySelectorAll<HTMLElement>('*'))) {
        // Once: a wrapped row would measure as fitting, and unwrapped it would not.
        if (node.dataset.fitWrapped !== undefined) continue;
        const style = getComputedStyle(node);
        if (!style.display.includes('flex') || !style.flexDirection.startsWith('row')) continue;
        const squeezed = Array.from(node.children).some((child) => child.scrollWidth > child.clientWidth + 1);
        if (node.scrollWidth <= node.clientWidth + 1 && !squeezed) continue;
        node.dataset.fitWrapped = '';
    }
}

/** How far the fit moved a placed box, to take back exactly that before it measures again. */
const SHIFTED = 'fitShifted';

// A box a host placed absolutely past the scroller's edge is moved in by as much as it reaches past,
// as a window is held on its screen; `translate` composes with whatever transform the host wrote.
export function bringInside(scroller: HTMLElement): void {
    const room = scroller.getBoundingClientRect();
    for (const node of Array.from(scroller.querySelectorAll<HTMLElement>('*'))) {
        if (getComputedStyle(node).position !== 'absolute') continue;
        // Inside the box it is placed in, as far as that box stands inside the scroller.
        const held = node.offsetParent instanceof HTMLElement && scroller.contains(node.offsetParent)
            ? node.offsetParent.getBoundingClientRect() : room;
        const edge = { left: Math.max(held.left, room.left), right: Math.min(held.right, room.right), width: 0 };
        edge.width = edge.right - edge.left;
        // Where the host placed it: where it stands, less what the fit moved it.
        const moved = Number(node.dataset[SHIFTED] ?? '0');
        const r = node.getBoundingClientRect();
        const left = r.left - moved;
        const right = r.right - moved;
        const by = r.width === 0 || r.width > edge.width ? 0
            : left < edge.left ? Math.round(edge.left - left)
            : right > edge.right ? Math.round(edge.right - right) : 0;
        // Written only when it changes: the watch looks again at every style written (content/scroll.ts).
        if (by === moved) continue;
        if (by === 0) {
            node.style.removeProperty('translate');
            delete node.dataset[SHIFTED];
        } else {
            node.style.setProperty('translate', `${by}px 0`, 'important');
            node.dataset[SHIFTED] = String(by);
        }
    }
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
        // Once: the watch looks again at every style written (content/scroll.ts).
        if (node.dataset.fitLoosened !== undefined) continue;
        const tracks = getComputedStyle(node).gridTemplateColumns.split(' ').filter((track) => track !== '' && track !== 'none');
        if (tracks.length === 0) continue;
        // Each track keeps its share of the width as written; one the overflow squeezed to nothing has its content back.
        const loose = tracks.map((track) => parseFloat(track) > 0 ? `minmax(0, ${parseFloat(track)}fr)` : 'auto');
        node.style.setProperty('grid-template-columns', loose.join(' '), 'important');
        node.dataset.fitLoosened = '';
        loosened = true;
    }
    return loosened;
}
