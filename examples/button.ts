/**
 * Button specimen — Germanium, the next element after the tooltip's Gallium.
 *
 * "It really feels like a button. Until you click it and your entire conceptual
 * model of what UI could be shatters." Germanium holds the button and nothing
 * happens to Germanium: the button is its own element.
 */

import { canvasPlaced } from '../canvas/placed';
import { declareScroller } from '../content/scroll';
import { buttonFrom } from '../forms/button';
import type { Element } from '../element';

export function renderButtonSpecimen(): void {
    const root = document.getElementById('root');
    if (!root) return;

    const area = document.createElement('div');
    area.style.position = 'relative';
    area.style.height = '160px';
    area.dataset.canvasId = 'button-canvas';
    root.appendChild(area);

    const holder: Element = {
        id: 'button-specimen',
        title: 'Germanium',
        symbol: 'Ge',
        renderContent: () => document.createElement('div'),
    };

    const { element } = canvasPlaced({
        item: holder,
        className: 'canvas-button-specimen',
        defaults: { x: 16, y: 16, width: 240, height: 110 },
        titleBar: { label: 'Germanium' },
        logLabel: 'ButtonSpecimen',
    });

    const pressed: Element = {
        id: 'germanium-button',
        title: 'Press Please',
        renderContent: () => {
            const body = document.createElement('div');
            body.className = 'content';
            body.textContent = 'The same element, all along.';
            return body;
        },
    };

    const body = document.createElement('div');
    body.className = 'content-area';
    // A canvas-placed element has no body of the package's: this one is its scroller, said so.
    declareScroller(body);
    body.appendChild(buttonFrom(pressed, { className: 'specimen-button' }));
    element.appendChild(body);
    area.appendChild(element);
}
