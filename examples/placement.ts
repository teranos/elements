/**
 * Placement specimen — a tray with twenty items in it.
 *
 * Open them by hand, one at a time, and watch where each lands. Nothing here
 * passes a position, so every open goes through morphDotToWindow → findPlacement.
 */

import { tray } from '../tray/tray';
import type { Element } from '../element';

const WINDOW_WIDTH = 380;

// Big enough that twenty of them crowd a viewport, which is the case worth
// watching — an empty canvas takes the first candidate and stops.
const BODY_HEIGHT = 220;

// Twenty distinct marks, so a window is identifiable at a glance.
const SYMBOLS = [
    '●', '■', '▲', '◆', '★', '○', '□', '△', '◇', '☆',
    '◐', '◑', '◒', '◓', '⬟', '⬠', '⬡', '⬢', '⬣', '⬤',
];
const TRAY_SIZE = SYMBOLS.length;

// "in the exampe have element 2 be having a lot of content"
// More than a screen holds, as QNTX's i element does: the window fits it up to the screen, and its body scrolls.
const FLOWS_OVER = 2;
const FLOW_OVER_LINES = 80;

function flowOver(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'content';
    for (let i = 0; i < FLOW_OVER_LINES; i++) {
        const line = document.createElement('div');
        // "3 times on one line"
        line.style.whiteSpace = 'nowrap';
        line.textContent = 'FLOW OVER FLOW OVER FLOW OVER';
        el.appendChild(line);
    }
    return el;
}

function specimenElement(index: number): Element {
    return {
        id: `placement-${index}`,
        title: `element ${index}`,
        symbol: SYMBOLS[index - 1],
        // Element 1 carries a border and its own background as visual identity —
        // like color, the dot, the window, and the dot it minimizes back into
        // all wear them.
        border: index === 1 ? '2px dashed #ffd43b' : undefined,
        opensAs: 'window',
        // No size: the engine measures the content below and commits fit-content.
        color: index === 1 ? '#6b21a8' : index === FLOWS_OVER ? '#ff0000' : '#000',
        textColor: index === FLOWS_OVER ? '#000' : '#fff',
        renderContent: () => {
            if (index === FLOWS_OVER) return flowOver();
            const el = document.createElement('div');
            el.className = 'content';
            el.style.maxWidth = `${WINDOW_WIDTH - 2 - 16}px`;
            el.style.minHeight = `${BODY_HEIGHT}px`;
            el.textContent = `element ${index}`;
            return el;
        },
    } as Element;
}

/** Fills the tray. Opening is done by hand from the tray. */
export function renderPlacementSpecimen(): void {
    for (let i = 1; i <= TRAY_SIZE; i++) {
        tray.add(specimenElement(i));
    }
}
