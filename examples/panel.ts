/**
 * Panel specimen — Krypton, an element that takes the whole screen, as a
 * dataset like Pulse's schedules does in QNTX.
 *
 * "It just takes over the entire screen and isn't pressable." Full screen, its
 * background fills the screen and its controls stay inside the safe area.
 */

import { tray } from '../tray/tray';
import type { Element } from '../element';
import { createInput } from '../canvas/ui-primitives';

export function renderPanelSpecimen(): void {
    const item: Element = {
        id: 'panel-specimen',
        title: 'Krypton',
        symbol: 'Kr',
        opensAs: 'panel',
        color: '#000',
        renderContent: () => {
            const body = document.createElement('div');
            body.className = 'content';
            // A row wider than a phone's screen: the panel does not let it be panned to.
            const wide = document.createElement('div');
            wide.style.whiteSpace = 'nowrap';
            wide.textContent = 'schedule 0 · ACTIVE · every 1m · next 11:18 · last 11:17 · ok · runs 1204 · owner root · wider than a phone';
            body.appendChild(wide);
            for (let i = 1; i <= 40; i++) {
                const row = document.createElement('div');
                row.textContent = `schedule ${i} · ACTIVE · every ${i}m`;
                body.appendChild(row);
            }
            // A field at the end of the list: on a phone the keyboard comes up over
            // the bottom of the screen, which is where this panel's last field is.
            body.appendChild(createInput({ label: 'New schedule', placeholder: 'every 5m', type: 'text' }));
            return body;
        },
    };
    tray.add(item);
}
