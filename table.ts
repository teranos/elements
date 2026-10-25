// "The elements package should own Tables"
// The table's shape and look are the package's; what each cell says and what a press opens are the host's.

/** A cell: its text, or the cell the host built whole. */
export type TableCell = string | HTMLTableCellElement;

/** The most columns a table has. "TABLES BEING MAX 4 col." */
export const MAX_TABLE_COLUMNS = 4;

/** The heads: one to four. A fifth does not compile. */
export type TableHeads =
    | readonly [TableCell]
    | readonly [TableCell, TableCell]
    | readonly [TableCell, TableCell, TableCell]
    | readonly [TableCell, TableCell, TableCell, TableCell];

/** A row of cells as wide as the heads: one more or one fewer does not compile. */
export type TableCells<H extends TableHeads = TableHeads> = { readonly [K in keyof H]: TableCell };

/** A row: its cells, the id it carries, and what a press on it opens. */
export interface TableRow<H extends TableHeads = TableHeads> {
    cells: TableCells<H>;
    id?: string;
    onPress?: () => void;
}

const STYLE_ID = 'elements-table-style';

// One class and the design tokens; a time, a DID, a status on one line, never broken.

// "You can clearly see how this element is not usable on mobile right ?"
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

/* Four columns broke every word on a phone: there a row stands as a card,
   each cell under its head, and the heads are kept for a screen reader. */
@media (max-width: 600px) {
    .element-table,
    .element-table tbody,
    .element-table tr,
    .element-table td {
        display: block;
        width: auto;
    }

    .element-table thead {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
    }

    .element-table tr {
        padding: 6px 0;
        border-bottom: 1px solid var(--border-on-dark);
    }

    .element-table td {
        padding: 2px 8px;
    }

    .element-table td[data-head]::before {
        content: attr(data-head);
        display: block;
        color: var(--text-on-dark-tertiary);
    }
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

/** One table, named: the heads in one row, a row each below, as wide as the heads. */
export function createTable<const H extends TableHeads>(name: string, heads: H, rows: readonly TableRow<NoInfer<H>>[]): HTMLTableElement {
    // A caller with no types reaches here with any width; it is stopped the same.
    if (heads.length < 1 || heads.length > MAX_TABLE_COLUMNS) {
        throw new TypeError(`table "${name}" has ${heads.length} columns; a table has 1 to ${MAX_TABLE_COLUMNS}`);
    }
    for (const row of rows) {
        if (row.cells.length !== heads.length) {
            throw new TypeError(`a row of table "${name}" has ${row.cells.length} cells; its heads are ${heads.length}`);
        }
    }
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
        row.cells.forEach((cell, i) => {
            const td = typeof cell === 'string' ? tableCell(cell) : cell;
            // What the cell is, said beside it where a row stands as a card.
            const head = heads[i]!;
            const said = typeof head === 'string' ? head : head.textContent ?? '';
            if (said !== '') td.dataset.head = said;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
}
