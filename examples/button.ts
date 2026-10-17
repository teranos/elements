/**
 * Button specimen — Germanium, the next element after the tooltip's Gallium.
 *
 * "It really feels like a button. Until you click it and your entire conceptual
 * model of what UI could be shatters." Germanium holds the button and nothing
 * happens to Germanium: the button is its own element.
 *
 * Beside it, the press, Button Form's variation that does rather than opens:
 * one press, two stages, one that cannot be undone, one that creates, one that fails.
 */

import { canvasPlaced } from '../canvas/placed';
import { declareScroller } from '../content/scroll';
import { buttonFrom } from '../forms/button';
import { pressFrom } from '../forms/press';
import type { Element } from '../element';

export function renderButtonSpecimen(): void {
    const root = document.getElementById('root');
    if (!root) return;

    const area = document.createElement('div');
    area.style.position = 'relative';
    area.style.height = '380px';
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
        // Narrower than a phone, tall enough for the presses to wrap.
        defaults: { x: 16, y: 16, width: 320, height: 330 },
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

    const moment = () => new Promise<void>((resolve) => setTimeout(resolve, 600));
    const presses = document.createElement('div');
    presses.style.display = 'flex';
    presses.style.flexWrap = 'wrap';
    presses.style.alignItems = 'flex-start';
    presses.style.gap = '8px';
    presses.style.marginTop = '12px';
    presses.append(
        pressFrom({ id: 'germanium-save', title: 'Save', does: moment }).element,
        pressFrom({ id: 'germanium-unbind', title: 'Unbind', again: 'it is unbound', does: moment }).element,
        pressFrom({ id: 'germanium-nuke', title: 'Nuke', again: 'gone, for good', irrevocable: true, does: moment }).element,
        pressFrom({ id: 'germanium-plus', title: '+', again: 'the canvas is made', creates: true, does: moment }).element,
        pressFrom({ id: 'germanium-fail', title: 'Send', does: async () => { await moment(); throw new Error('502 from the node'); } }).element,
    );
    body.appendChild(presses);
    element.appendChild(body);
    area.appendChild(element);

    // One on the bare page, in no element: no rule of the package's is around it.
    root.appendChild(pressFrom({ id: 'germanium-bare', title: 'Leave', again: 'you are signed out', does: moment }).element);
}
