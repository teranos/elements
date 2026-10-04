/**
 * Panel specimen — Krypton, an element that takes the whole screen, as a
 * dataset like Pulse's schedules does in QNTX.
 *
 * "It just takes over the entire screen and isn't pressable." Full screen, its
 * background fills the screen and its controls stay inside the safe area.
 */

import { tray } from '../tray/tray';
import type { Element } from '../element';

export function renderPanelSpecimen(): void {
    const item: Element = {
        id: 'panel-specimen',
        title: 'Krypton',
        symbol: 'Kr',
        opensAs: 'panel',
        renderContent: () => {
            const body = document.createElement('div');
            body.className = 'content';
            for (let i = 1; i <= 40; i++) {
                const row = document.createElement('div');
                row.textContent = `schedule ${i} · ACTIVE · every ${i}m`;
                body.appendChild(row);
            }
            return body;
        },
    };
    tray.add(item);
}
