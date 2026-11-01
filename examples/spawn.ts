/**
 * Spawn specimen — a canvas that answers a right-click, or a finger held still.
 *
 * "on mobile, can't get into spawn menu"
 *
 * Right-click on the canvas below, or hold a finger on it: the menu opens where
 * it is pressed. Choose a symbol, then press where it goes; Escape, a right-click
 * or another hold lets go of it. The host here is these few lines: it says what
 * can be spawned and renders into the element it is handed.
 */

import { configureElements } from '../config';
import type { SpawnEntry } from '../canvas/spawn';

const ENTRIES: SpawnEntry[] = [
    { id: 'note', symbol: 'Nt', title: 'Note', description: 'Freeform text', hint: 'Hold a finger, choose, press' },
    { id: 'query', symbol: 'Qy', title: 'Query', description: 'Ask the graph' },
    { id: 'sub', symbol: 'Sc', title: 'Subcanvas', description: 'A canvas inside a canvas' },
];

export function renderSpawnSpecimen(): void {
    const root = document.getElementById('root');
    if (!root) return;

    const style = document.createElement('style');
    style.textContent = '.spawn-placed{position:absolute;min-width:88px;padding:8px;border:1px solid #fff;background:#000;color:#fff}';
    document.head.appendChild(style);

    const canvas = document.createElement('div');
    canvas.dataset.canvasId = 'spawn-canvas';
    canvas.style.cssText = 'position:relative;height:320px;border:1px dashed #fff;overflow:hidden;user-select:none;-webkit-touch-callout:none';
    const hint = document.createElement('div');
    hint.style.cssText = 'padding:8px;color:#aaa';
    hint.textContent = 'Right-click here, or hold a finger still.';
    canvas.appendChild(hint);
    root.appendChild(canvas);

    configureElements({
        spawn: {
            entries: () => ENTRIES,
            place: async ({ entry, canvas: onto, at, carried }) => {
                const box = onto.getBoundingClientRect();
                carried.classList.add('spawn-placed');
                carried.style.left = `${at.clientX - box.left}px`;
                carried.style.top = `${at.clientY - box.top}px`;
                carried.style.transform = '';
                const label = document.createElement('div');
                label.textContent = entry.title;
                carried.appendChild(label);
                onto.appendChild(carried);
                return carried;
            },
        },
    });
}
