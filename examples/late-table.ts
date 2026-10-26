// Late table specimen — Yttrium, the next element after the table's Strontium.
// It opens as a window on "Loading…", and a node's four columns arrive after: QNTX's Users, on a phone.

// "You can clearly see how this element is not usable on mobile right ?"

import { tray } from '../tray/tray';
import { createTable } from '../table';
import type { Element } from '../element';

const USERS: [name: string, mail: string, level: string, door: string, created: string][] = [
    ['—', 'ada@example.com', 'PUBLIC_REGISTRATION', 'clean', '2026-01-02 10:00:00'],
    ['grace', 'grace@example.com', 'USER', '—', '2026-01-03 11:00:00'],
    ['—', 'linus@example.com', 'PUBLIC_REGISTRATION', 'clean', '2026-01-01 09:00:00'],
];

/** A cell that says one thing, and under it what goes with it. */
function stacked(top: string, under: string): HTMLTableCellElement {
    const td = document.createElement('td');
    const a = document.createElement('div');
    a.textContent = top;
    const b = document.createElement('div');
    b.textContent = under;
    td.append(a, b);
    return td;
}

function on(): HTMLTableCellElement {
    const td = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = 'element-pill';
    pill.textContent = 'on';
    td.appendChild(pill);
    return td;
}

export function renderLateTableSpecimen(): void {
    const item: Element = {
        id: 'late-table-specimen',
        title: 'Yttrium',
        symbol: 'Y',
        opensAs: 'window',
        renderContent: () => {
            const body = document.createElement('div');
            body.className = 'content';
            body.textContent = 'Loading…';
            // What the node answers, after the window stood.
            setTimeout(() => {
                body.textContent = '';
                body.appendChild(createTable('late-users', ['Name', 'Level', 'Created', 'Status'], USERS.map(([name, mail, level, door, created]) => ({
                    cells: [stacked(name, mail), stacked(level, door), created, on()],
                }))));
            }, 600);
            return body;
        },
    };
    tray.add(item);
}
