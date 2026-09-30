/**
 * Tooltip specimen — Gallium, the next element after the tray's Zinc.
 *
 * "In the galium glyph, there would be text that says Hover Please. Nothing
 * happens to Galium." Hovering the text, after 300ms a tooltip; after 1s more
 * the expanded tooltip; a click takes Window Form. "ITS A NEW ELEMENT EVERY
 * FUCKING TIME."
 */

import { canvasPlaced } from '../canvas/placed';
import { tooltipFrom } from '../forms/tooltip';
import type { Element } from '../element';

let said = 0;

/** What the text says: a new element each hover. */
function saying(): Element {
    said++;
    const n = said;
    return {
        id: `gallium-said-${n}`,
        title: `Said ${n}`,
        renderContent: () => {
            const body = document.createElement('div');
            body.className = 'content';
            body.textContent = `A new element, the ${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} this text has said.`;
            return body;
        },
    };
}

export function renderTooltipSpecimen(): void {
    const root = document.getElementById('root');
    if (!root) return;

    const area = document.createElement('div');
    area.style.position = 'relative';
    area.style.height = '160px';
    area.dataset.canvasId = 'tooltip-canvas';
    root.appendChild(area);

    const item: Element = {
        id: 'tooltip-specimen',
        title: 'Gallium',
        symbol: 'Ga',
        renderContent: () => document.createElement('div'),
    };

    const { element } = canvasPlaced({
        item,
        className: 'canvas-tooltip-specimen',
        defaults: { x: 16, y: 16, width: 240, height: 110 },
        titleBar: { label: 'Gallium' },
        logLabel: 'TooltipSpecimen',
    });

    const body = document.createElement('div');
    body.className = 'content-area';
    const text = document.createElement('span');
    text.className = 'hover-please';
    text.textContent = 'Hover Please';
    body.appendChild(text);
    element.appendChild(body);

    tooltipFrom(text, saying);
    area.appendChild(element);
}
