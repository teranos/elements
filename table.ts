// "The elements package should own Tables"
// The table's shape and look are the package's; what each cell says and what a press opens are the host's.

/** A cell: its text, or the cell the host built whole. */
export type TableCell = string | HTMLTableCellElement;

/** A row: its cells, the id it carries, and what a press on it opens. */
export interface TableRow {
    cells: TableCell[];
    id?: string;
    onPress?: () => void;
}

const STYLE_ID = 'elements-table-style';

// One class and the design tokens; a time, a DID, a status on one line, never broken.
const STYLE = `
.element-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-mono);
    color: var(--text-on-dark);
}

.element-table th {
    text-align: left;
    padding: 4px 8px;
    font-weight: normal;
    color: var(--text-on-dark-tertiary);
    border-bottom: 1px solid var(--border-on-dark);
    white-space: nowrap;
}

.element-table td {
    padding: 3px 8px;
    vertical-align: middle;
    font-weight: normal;
    word-break: break-word;
    overflow-wrap: break-word;
}

.element-table .element-did,
.element-table .element-time,
.element-table .element-pill {
    white-space: nowrap;
}
`;

function ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE;
    document.head.appendChild(style);
}

/** A cell of text, with its class and its hover. */
export function tableCell(text: string, className = '', title = ''): HTMLTableCellElement {
    const td = document.createElement('td');
    td.className = className;
    td.textContent = text;
    if (title) td.title = title;
    return td;
}

function headCell(head: TableCell): HTMLTableCellElement {
    if (typeof head !== 'string') return head;
    const th = document.createElement('th');
    th.textContent = head;
    return th;
}

/** One table, named: the heads in one row, a row each below. */
export function createTable(name: string, heads: TableCell[], rows: TableRow[]): HTMLTableElement {
    ensureStyle();
    const table = document.createElement('table');
    table.className = `element-table ${name}-table`;

    const thead = document.createElement('thead');
    const headings = document.createElement('tr');
    for (const head of heads) headings.appendChild(headCell(head));
    thead.appendChild(headings);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const row of rows) {
        const tr = document.createElement('tr');
        if (row.id !== undefined) tr.dataset.id = row.id;
        const press = row.onPress;
        if (press) {
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', () => { press(); });
        }
        for (const cell of row.cells) tr.appendChild(typeof cell === 'string' ? tableCell(cell) : cell);
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
}
