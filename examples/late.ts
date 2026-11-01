// Late specimen — Yttrium, the next element after the table's Strontium.
// It opens on a loading line, and its list arrives while it is still opening, as a node's answer does.

import { tray } from '../tray/tray';
import type { Element } from '../element';

/** Inside the opening morph (OPEN_DURATION_MS): the list is there before the window has settled. */
const ARRIVES_MS = 100;

export function renderLateSpecimen(): void {
    const item: Element = {
        id: 'late-specimen',
        title: 'Yttrium',
        symbol: 'Y',
        // Where QNTX-Web's Stories opens: the right of a phone.
        defaultX: 300,
        defaultY: 40,
        renderContent: () => {
            const body = document.createElement('div');
            body.textContent = 'Reading the list…';
            setTimeout(() => {
                body.replaceChildren();
                for (let i = 1; i <= 30; i++) {
                    const row = document.createElement('div');
                    row.style.whiteSpace = 'nowrap';
                    row.textContent = `${i} a person sets up something with a long name, on a node`;
                    body.appendChild(row);
                }
            }, ARRIVES_MS);
            return body;
        },
    };
    tray.add(item);
}
