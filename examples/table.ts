// Table specimen — Strontium, the next element after the approvals' Rubidium.
// Heads, rows, a time and a status that never break, a cell with a hover, and a row that opens on a press.

import { canvasPlaced } from '../canvas/placed';
import { declareScroller } from '../content/scroll';
import { createTable, tableCell } from '../table';
import type { Element } from '../element';

const MAILS: [when: string, to: string, subject: string, sent: boolean][] = [
    ['2026-09-24 14:03:11', 'tim@defacile.nl', 'Welkom', true],
    ['2026-09-24 13:51:40', 'spike@defacile.nl', 'Je account staat klaar', false],
    ['2026-09-23 09:12:05', 'jenny@defacile.nl', 'Een herinnering voor de afspraak van morgen om negen uur', true],
];

function outcome(sent: boolean): HTMLTableCellElement {
    const td = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = 'element-pill';
    pill.textContent = sent ? 'sent' : 'refused';
    td.appendChild(pill);
    return td;
}

export function renderTableSpecimen(): void {
    const root = document.getElementById('root');
    if (!root) return;

    const area = document.createElement('div');
    area.style.position = 'relative';
    area.style.height = '240px';
    area.dataset.canvasId = 'table-canvas';
    root.appendChild(area);

    const item: Element = {
        id: 'table-specimen',
        title: 'Strontium',
        symbol: 'Sr',
        renderContent: () => document.createElement('div'),
    };

    const { element } = canvasPlaced({
        item,
        className: 'canvas-table-specimen',
        defaults: { x: 16, y: 16, width: 360, height: 200 },
        titleBar: { label: 'Strontium' },
        logLabel: 'TableSpecimen',
    });

    const body = document.createElement('div');
    body.className = 'content-area';
    // A canvas-placed element has no body of the package's: this one is its scroller, said so.
    declareScroller(body);
    const said = document.createElement('div');
    said.textContent = 'press a row';
    body.appendChild(createTable('mail-sent', ['When', 'To', 'Subject', 'Outcome'], MAILS.map(([when, to, subject, sent]) => ({
        cells: [tableCell(when, 'element-time', `sent at ${when} UTC`), to, subject, outcome(sent)],
        onPress: () => { said.textContent = `opened: ${subject}`; },
    }))));
    body.appendChild(said);
    element.appendChild(body);
    area.appendChild(element);
}
