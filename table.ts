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
const STYLE = `
/* The table is its own box: wider than its element, it scrolls sideways here and nothing around it does
   (WCAG 2.2, Understanding 1.4.10 Reflow). A time, a DID, a status and a head keep to one line (fit.ts). */
.element-table {
    display: block;
    overflow-x: auto;
    max-width: 100%;
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

/** What a column is shown at: always, or only where the screen is Regular (not Compact, compact.ts). */
export type TableShow = 'always' | 'regular';

/** One say a column, as many as the heads: one more or one fewer does not compile. */
export type TableShows<H extends TableHeads = TableHeads> = { readonly [K in keyof H]: TableShow };

/**
 * 「[Sonnet 5.5] One table, named: the heads in one row, a row each below, as wide as the heads. `shows` says, a column」
 * 「[Sonnet 5.5] each, which a Compact screen has no room for: a `regular` column is not shown there (fit.ts), the rows」
 * 「[Sonnet 5.5] a host adds later with it.」
 */
export function createTable<const H extends TableHeads>(name: string, heads: H, rows: readonly TableRow<NoInfer<H>>[], shows?: TableShows<NoInfer<H>>): HTMLTableElement {
    // A caller with no types reaches here with any width; it is stopped the same.
    if (heads.length < 1 || heads.length > MAX_TABLE_COLUMNS) {
        throw new TypeError(`table "${name}" has ${heads.length} columns; a table has 1 to ${MAX_TABLE_COLUMNS}`);
    }
    for (const row of rows) {
        if (row.cells.length !== heads.length) {
            throw new TypeError(`a row of table "${name}" has ${row.cells.length} cells; its heads are ${heads.length}`);
        }
    }
    if (shows !== undefined && shows.length !== heads.length) {
        throw new TypeError(`table "${name}" says ${shows.length} columns of ${heads.length}; a say each`);
    }
    ensureStyle();
    const table = document.createElement('table');
    table.className = `element-table ${name}-table`;
    // 「[Sonnet 5.5] A block no longer says it is a table to every screen reader: it says so, and what it is called.」
    table.setAttribute('role', 'table');
    // 「[Sonnet 5.5] It scrolls sideways; a browser resolves its other axis to auto too, which is no second scroller (content/scroll.ts).」
    table.dataset.scroller = 'sideways';
    table.setAttribute('aria-label', name);

    // 「[Sonnet 5.5] Said by place, for the package's rule in fit.ts to find (a table has four places at most).」
    const regular = shows === undefined ? [] : shows.flatMap((show, at) => (show === 'regular' ? [at + 1] : []));
    if (regular.length > 0) table.dataset.regular = regular.join(' ');

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
    keepReachable(table, thead, tbody);
    return table;
}

/**
 * 「[Sonnet 5.5] A box that scrolls is a stop a keyboard can reach, and one that does not scroll is not a stop」
 * 「[Sonnet 5.5] (W3C design system, Tables). Chrome makes the stop itself; Safari does not. A tabindex the host set is the host's.」
 */
function keepReachable(table: HTMLTableElement, ...parts: HTMLElement[]): void {
    if (typeof ResizeObserver === 'undefined') return;
    let given = false;
    const look = (): void => {
        const scrolls = table.scrollWidth > table.clientWidth + 1;
        if (scrolls && !given && !table.hasAttribute('tabindex')) {
            table.tabIndex = 0;
            given = true;
        } else if (!scrolls && given) {
            // 「[Sonnet 5.5] What the package wrote it takes back; a value the host has put there since is the host's.」
            if (table.getAttribute('tabindex') === '0') table.removeAttribute('tabindex');
            given = false;
        }
    };
    // 「[Sonnet 5.5] The box's own size, and what is in it: a row added or a text changed moves the heads and the body.」
    const watch = new ResizeObserver(look);
    for (const node of [table, ...parts]) watch.observe(node);
}
