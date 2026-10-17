// Press specimen — Yttrium, the next element after the table's Strontium.
// One press that takes a moment, one that can be undone, one that cannot, and one that fails.

import { canvasPlaced } from '../canvas/placed';
import { declareScroller } from '../content/scroll';
import { pressFrom } from '../forms/press';
import type { Element } from '../element';

const moment = () => new Promise<void>((resolve) => setTimeout(resolve, 600));

export function renderPressSpecimen(): void {
    const root = document.getElementById('root');
    if (!root) return;

    const area = document.createElement('div');
    area.style.position = 'relative';
    area.style.height = '300px';
    area.dataset.canvasId = 'press-canvas';
    root.appendChild(area);

    const holder: Element = {
        id: 'press-specimen',
        title: 'Yttrium',
        symbol: 'Y',
        renderContent: () => document.createElement('div'),
    };

    const { element } = canvasPlaced({
        item: holder,
        className: 'canvas-press-specimen',
        // Narrower than a phone, and tall enough for the presses to wrap into two rows.
        defaults: { x: 16, y: 16, width: 320, height: 260 },
        titleBar: { label: 'Yttrium' },
        logLabel: 'PressSpecimen',
    });

    const body = document.createElement('div');
    body.className = 'content-area';
    declareScroller(body);
    body.style.display = 'flex';
    body.style.flexWrap = 'wrap';
    body.style.alignItems = 'flex-start';
    body.style.gap = '8px';
    body.style.padding = '8px';
    body.append(
        pressFrom({ id: 'yttrium-save', title: 'Save', does: moment }).element,
        pressFrom({ id: 'yttrium-unbind', title: 'Unbind', again: 'it is unbound', does: moment }).element,
        pressFrom({ id: 'yttrium-nuke', title: 'Nuke', again: 'gone, for good', irrevocable: true, does: moment }).element,
        pressFrom({ id: 'yttrium-fail', title: 'Send', does: async () => { await moment(); throw new Error('502 from the node'); } }).element,
    );
    element.appendChild(body);
    area.appendChild(element);

    // One on the bare page, in no element: no rule of the package's is around it.
    root.appendChild(pressFrom({ id: 'yttrium-bare', title: 'Leave', again: 'you are signed out', does: moment }).element);
}
