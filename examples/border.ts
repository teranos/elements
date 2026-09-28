/**
 * Border specimen — a canvas-placed element whose border is visual identity.
 *
 * Like color, the border lives on the Element datum and every form
 * wears it: ⬆ expands to a window that keeps the dashed border; the window's
 * − places it back unchanged. Everything about an element survives every
 * transition (Element Axioma).
 */

import { canvasPlaced } from '../canvas/placed';
import { morphCanvasPlacedToWindow } from '../canvas/window';
import { getForm } from '../dataset';
import type { Element } from '../element';

const OWNED_BORDER = '2px dashed #ffd43b';

export function renderBorderSpecimen(): void {
    const root = document.getElementById('root');
    if (!root) return;

    const area = document.createElement('div');
    area.style.position = 'relative';
    area.style.height = '240px';
    area.dataset.canvasId = 'border-canvas';
    root.appendChild(area);

    const item: Element = {
        id: 'border-specimen',
        // "this one becomes Uranium"
        title: 'Uranium',
        symbol: 'U',
        // Visual identity on the datum — every form wears it
        border: OWNED_BORDER,
        // "and it glows green a bit, its borders"
        glow: '0 0 6px rgba(57, 255, 20, 0.5)',
        renderContent: () => document.createElement('div'),
    };

    const expand = document.createElement('button');
    expand.textContent = '⬆';
    expand.title = 'Expand to window';

    const { element } = canvasPlaced({
        item,
        className: 'canvas-border-specimen',
        defaults: { x: 16, y: 40, width: 240, height: 150 },
        titleBar: { label: 'Uranium', actions: [expand] },
        logLabel: 'BorderSpecimen',
    });

    const body = document.createElement('div');
    body.className = 'content-area';
    body.textContent = `inline border: ${OWNED_BORDER}`;
    element.appendChild(body);

    expand.addEventListener('click', () => {
        if (getForm(element) === 'window') return;
        morphCanvasPlacedToWindow(element, {
            title: 'Uranium',
            canvasId: 'border-canvas',
            onRestoreComplete: () => {},
        });
    });

    area.appendChild(element);
}
