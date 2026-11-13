// Overlay specimen — Polonium, and Astatine over it.
//
// "IF THERE ARE MESSAGES PENDING TO BE SENT, AS A COLLECTED BATCH, I SEE IT BOTTOM LEFTSIDE. SLIGHTLY TRANSPARENT. AND I CAN MOVE IT UP IF IT WANT TO."
// "IF I PRESS ON IT, IT OPENS UP FULLSCREEN."
// "THE UI CONTROLS ARE DISPLAYED IN THE HEADER AREA."
//
// Polonium is a conversation; Astatine is what waits to be said in it. Nothing
// happens to Polonium: Astatine is its own element, over it.

import { canvasPlaced } from '../canvas/placed';
import { declareScroller } from '../content/scroll';
import { overlayFrom } from '../forms/overlay';
import { pressFrom } from '../forms/press';
import type { Element } from '../element';

const WAITING: [string, string][] = [
    ['Alder', 'pull request one is open'],
    ['Hazel', 'the pond is drained'],
    ['Alder', 'pull request two is open'],
];

export function renderOverlaySpecimen(): void {
    const root = document.getElementById('root');
    if (!root) return;

    const area = document.createElement('div');
    area.style.position = 'relative';
    area.style.height = '380px';
    area.dataset.canvasId = 'overlay-canvas';
    root.appendChild(area);

    const holder: Element = {
        id: 'overlay-specimen',
        title: 'Polonium',
        symbol: 'Po',
        renderContent: () => document.createElement('div'),
    };

    const { element } = canvasPlaced({
        item: holder,
        className: 'canvas-overlay-specimen',
        defaults: { x: 16, y: 16, width: 320, height: 330 },
        titleBar: { label: 'Polonium' },
        logLabel: 'OverlaySpecimen',
    });

    const body = document.createElement('div');
    body.className = 'content-area';
    declareScroller(body);
    // What was said scrolls inside Polonium.
    body.style.height = '290px';
    body.style.boxSizing = 'border-box';
    for (let i = 1; i <= 40; i++) {
        const line = document.createElement('div');
        line.textContent = `line ${i} · ${i % 2 ? 'you' : 'polonium'} said something`;
        body.appendChild(line);
    }
    element.appendChild(body);
    area.appendChild(element);

    const moment = () => new Promise<void>((resolve) => setTimeout(resolve, 600));
    const waits: Element = {
        id: 'astatine-overlay',
        title: `${WAITING.length} wait · 14:00`,
        symbol: 'At',
        color: '#000',
        renderContent: () => {
            const whole = document.createElement('div');
            whole.style.display = 'flex';
            whole.style.flexDirection = 'column';
            whole.style.height = '100%';
            // The header: what is done with what waits, said once, above what scrolls.
            const header = document.createElement('div');
            header.className = 'overlay-header';
            header.style.display = 'flex';
            header.style.flexWrap = 'wrap';
            header.style.gap = '8px';
            header.style.paddingBottom = '8px';
            header.append(
                pressFrom({ id: 'astatine-now', title: 'Send now', again: 'it is sent', does: moment }).element,
                pressFrom({ id: 'astatine-later', title: 'Later', does: moment }).element,
                pressFrom({ id: 'astatine-cancel', title: 'Cancel', again: 'never sent', irrevocable: true, does: moment }).element,
            );
            const said = document.createElement('div');
            said.className = 'content';
            said.style.flex = '1';
            said.style.minHeight = '0';
            declareScroller(said);
            for (const [who, what] of WAITING) {
                const from = document.createElement('div');
                from.textContent = who;
                from.style.opacity = '0.7';
                const says = document.createElement('textarea');
                says.value = what;
                says.rows = 2;
                says.style.width = '100%';
                says.style.boxSizing = 'border-box';
                says.style.marginBottom = '12px';
                said.append(from, says);
            }
            whole.append(header, said);
            return whole;
        },
    };
    overlayFrom(waits, { over: element, className: 'specimen-overlay' });
}
