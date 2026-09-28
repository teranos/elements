/**
 * The symbol a resting dot shows, when a host turns it on (configureElements({ dotSymbol })).
 *
 * A real span, not a pseudo element: the package writes nothing but inline styles.
 * Place and size are geometry and the package's; the font is the host's, by the class.
 */

import { getDotSymbol } from '../config';

const REST_CLASS = 'dot-symbol';

export function wearRestSymbol(dot: HTMLElement, symbol: string | undefined): void {
    removeRestSymbol(dot);
    if (!getDotSymbol() || !symbol) return;

    const span = document.createElement('span');
    span.className = REST_CLASS;
    span.textContent = symbol;
    span.style.display = 'grid';
    span.style.placeItems = 'center';
    span.style.width = '100%';
    span.style.height = '100%';
    span.style.lineHeight = '1';
    // The press belongs to the dot.
    span.style.pointerEvents = 'none';
    dot.appendChild(span);
}

export function removeRestSymbol(dot: HTMLElement): void {
    dot.querySelector(`:scope > .${REST_CLASS}`)?.remove();
}
