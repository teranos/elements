// 「[Sonnet 5.5] Users specimens — Yttrium and Zirconium, the next elements after the table's Strontium.」
// 「[Sonnet 5.5] A table wider than the screen it is read on: a DID and a time that never break, a status, a name.」
// 「[Sonnet 5.5] Seen on a phone as TOO WIDE: its content 417px wide in 393px, and the element dropped dead.」
// 「[Sonnet 5.5] Yttrium shows every column and scrolls sideways in its own box. Zirconium says its DID is for Regular」
// 「[Sonnet 5.5] screens only: on a Compact one that column is not shown, and the rest fits.」

import { canvasPlaced } from '../canvas/placed';
import { declareScroller } from '../content/scroll';
import { createTable, tableCell, type TableShows, type TableHeads } from '../table';
import type { Element } from '../element';

const USERS: [name: string, did: string, on: boolean, seen: string][] = [
    ['Tim', 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK', true, '2026-09-24 14:03:11'],
    ['Spike', 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH', false, '2026-09-23 09:12:05'],
    ['Jenny', 'did:key:z6MktWjP95fMZTMJYU74Te3o9Fai1nNxS2tqqLdbTJdFFgoF', true, '2026-09-22 18:40:27'],
];

function status(on: boolean): HTMLTableCellElement {
    const td = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = 'element-pill';
    pill.textContent = on ? 'on' : 'off';
    td.appendChild(pill);
    return td;
}

function renderUsers(id: string, title: string, symbol: string, canvasId: string, shows?: TableShows<['User', 'DID', 'Status', 'Last seen'] & TableHeads>): void {
    const root = document.getElementById('root');
    if (!root) return;

    const area = document.createElement('div');
    area.style.position = 'relative';
    area.style.height = '300px';
    area.dataset.canvasId = canvasId;
    root.appendChild(area);

    const item: Element = {
        id,
        title,
        symbol,
        renderContent: () => document.createElement('div'),
    };

    const { element } = canvasPlaced({
        item,
        className: `canvas-${id}`,
        defaults: { x: 16, y: 16, width: 360, height: 260 },
        titleBar: { label: title },
        logLabel: 'UsersSpecimen',
    });

    const body = document.createElement('div');
    body.className = 'content-area';
    declareScroller(body);
    const invite = document.createElement('div');
    invite.className = 'users-invite-link';
    invite.textContent = '+';
    body.appendChild(invite);
    body.appendChild(createTable('users', ['User', 'DID', 'Status', 'Last seen'], USERS.map(([name, did, on, seen]) => ({
        cells: [name, tableCell(did, 'element-did', did), status(on), tableCell(seen, 'element-time', `seen ${seen} UTC`)],
    })), shows));
    element.appendChild(body);
    area.appendChild(element);
}

export function renderUsersSpecimen(): void {
    renderUsers('users-specimen', 'Yttrium', 'Y', 'users-canvas');
}

export function renderUsersCompactSpecimen(): void {
    renderUsers('users-compact-specimen', 'Zirconium', 'Zr', 'users-compact-canvas', ['always', 'regular', 'always', 'always']);
}
