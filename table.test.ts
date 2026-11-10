// "The elements package should own Tables"
// The table's shape and look are the package's; what each cell says and what a press opens are the host's.
// "TABLES BEING MAX 4 col": a fifth column, or a row of another width, does not compile.
// Personas: Tim (heads, rows, cells, a press), Spike (no press, no id, no rows, one stylesheet; a fifth column,
// a row of another width), Jenny (a host's tables).

import { describe, test, expect, beforeEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { createTable, tableCell } from './table';
import { fitRule } from './fit';

const STYLE_ID = 'elements-table-style';

beforeEach(() => {
    document.body.innerHTML = '';
    document.getElementById(STYLE_ID)?.remove();
});

describe('Tim: a table of heads and rows', () => {
    test('one table, its name beside the package\'s class', () => {
        const t = createTable('tokens', ['Label', 'Kind'], [{ cells: ['pond-sensor', 'ATTESTOR'] }]);
        expect(t.tagName).toBe('TABLE');
        expect(t.className).toBe('element-table tokens-table');
    });

    test('the heads are th in one thead row, the rows tr in the tbody', () => {
        const t = createTable('roles', ['Line', 'by', 'at'], [
            { cells: ['spike is role:granted WORKER of default', 'root', '2026-09-07 10:00:00'] },
            { cells: ['tim is role:granted WORKER of default', 'root', '2026-09-07 11:00:00'] },
        ]);
        expect([...t.querySelectorAll('thead tr th')].map(th => th.textContent)).toEqual(['Line', 'by', 'at']);
        const rows = [...t.querySelectorAll('tbody tr')];
        expect(rows).toHaveLength(2);
        expect([...rows[1]!.querySelectorAll('td')].map(td => td.textContent))
            .toEqual(['tim is role:granted WORKER of default', 'root', '2026-09-07 11:00:00']);
    });

    test('a cell carries its class and its hover', () => {
        const td = tableCell('2026-09-14', 'element-time', '2026-09-14 00:43:56');
        expect(td.tagName).toBe('TD');
        expect(td.className).toBe('element-time');
        expect(td.textContent).toBe('2026-09-14');
        expect(td.title).toBe('2026-09-14 00:43:56');
    });

    test('a row pressed opens its item', () => {
        let opened = 0;
        const t = createTable('mail-sent', ['When'], [{ cells: ['2026-09-24 14:03:11'], onPress: () => { opened++; } }]);
        const tr = t.querySelector<HTMLTableRowElement>('tbody tr')!;
        expect(tr.style.cursor).toBe('pointer');
        tr.click();
        expect(opened).toBe(1);
    });

    test('a row carries its id', () => {
        const t = createTable('roles', ['Line'], [{ cells: ['a line'], id: 'AS-1' }]);
        expect(t.querySelector<HTMLTableRowElement>('tbody tr')!.dataset.id).toBe('AS-1');
    });

    test('the look is the package\'s: one stylesheet in the head', () => {
        createTable('tokens', ['Label'], []);
        const style = document.getElementById(STYLE_ID);
        expect(style?.tagName).toBe('STYLE');
        expect(style?.parentElement).toBe(document.head);
        const css = style!.textContent ?? '';
        expect(css).toContain('.element-table {');
        expect(css).toContain('.element-table th {');
        expect(css).toContain('.element-table td {');
        expect(css).toContain('.element-table .element-time');
    });
});

describe('Tim: a table wider than its element scrolls in its own box', () => {
    test('the table is the box: a block that scrolls sideways, the screen\'s width at most', () => {
        createTable('users', ['User'], []);
        const css = document.getElementById(STYLE_ID)!.textContent ?? '';
        const rule = css.slice(css.indexOf('.element-table {'), css.indexOf('}', css.indexOf('.element-table {')));
        expect(rule).toContain('display: block');
        expect(rule).toContain('overflow-x: auto');
        expect(rule).toContain('max-width: 100%');
    });

    test('it says it scrolls sideways, so the host is not told it is a second scroller', () => {
        const t = createTable('users', ['User'], []);
        expect(t.dataset.scroller).toBe('sideways');
    });

    test('it is named, for a screen reader and for the stop a keyboard makes of it', () => {
        const t = createTable('users', ['User'], []);
        expect(t.getAttribute('aria-label')).toBe('users');
        expect(t.getAttribute('role')).toBe('table');
    });

    test('inside an element the fit keeps its hands off the package\'s table, and off what must not break', () => {
        const css = fitRule('[data-element-id]');
        // A host's table is fitted, equal columns at the element's width; the package's is its own box.
        expect(css).toContain('[data-element-id] table:not(.element-table) { table-layout: fixed !important; width: 100% !important; }');
        // Text in it breaks between words, not inside them: a column is never narrower than its longest word,
        // and what does not fit scrolls ('anywhere' would let a name be cut to a letter a line).
        expect(css).toMatch(/\.element-table, \[data-element-id\] \.element-table \*[^{]*\{[^}]*overflow-wrap: break-word !important/);
        // A DID, a time, a pill and a head hold their line, wherever they stand in a package table.
        expect(css).toMatch(/\.element-table :is\(\.element-did, \.element-time, \.element-pill, th\)[^{]*\{[^}]*text-wrap-mode: nowrap !important/);
        expect(css).toMatch(/\.element-table :is\(\.element-did, \.element-time, \.element-pill, th\)[^{]*\{[^}]*overflow-wrap: normal !important/);
    });
});

describe('Tim: a column a compact screen has no room for', () => {
    // "Some kinds of col, I just don't want to display depending on how much width the screen gives us"
    const rows = [{ cells: ['Tim', 'did:key:z6Mk', 'on'] as const }];

    test('the table says which of its columns are for Regular screens only, by place', () => {
        const t = createTable('users', ['User', 'DID', 'Status'], rows, ['always', 'regular', 'always']);
        expect(t.dataset.regular).toBe('2');
        const two = createTable('users', ['A', 'B', 'C', 'D'], [], ['regular', 'always', 'regular', 'always']);
        expect(two.dataset.regular).toBe('1 3');
    });

    test('inside an element a compact screen hides those cells, by the package\'s own rule, whatever a host writes', () => {
        const css = fitRule('[data-element-id]');
        expect(css).toContain('@media (max-width: 768px)');
        // A rule for each place a table can have (four): a head and every row of it, later rows too, in every engine
        // (WebKit does not collapse a col).
        for (const place of [1, 2, 3, 4]) {
            expect(css).toContain(`[data-element-id] .element-table[data-regular~="${place}"] > :is(thead, tbody, tfoot) > tr > :nth-child(${place})`);
        }
        expect(css).toMatch(/:nth-child\(2\)[^{]*\{[^}]*display: none !important/);
    });

    test('the heads and rows are the ones that were given: nothing is taken out of them', () => {
        const t = createTable('users', ['User', 'DID', 'Status'], rows, ['always', 'regular', 'always']);
        expect(t.rows).toHaveLength(2);
        expect(t.rows[1]!.cells).toHaveLength(3);
    });
});

describe('Spike: no say about columns', () => {
    test('a table that says nothing says nothing, as before', () => {
        const t = createTable('users', ['User'], [{ cells: ['Tim'] }]);
        expect(t.hasAttribute('data-regular')).toBe(false);
        expect(createTable('users', ['User'], [{ cells: ['Tim'] }], ['always']).hasAttribute('data-regular')).toBe(false);
    });

    test('a say as long as the heads compiles; another length, or another word, does not', () => {
        expect(compile(`createTable('u', ['A', 'B'], [], ['always', 'regular']);`)).toBe('');
        expect(compile(`createTable('u', ['A', 'B'], [], ['always']);`)).toContain('error TS');
        expect(compile(`createTable('u', ['A', 'B'], [], ['always', 'sometimes']);`)).toContain('error TS');
    }, 30000);

    test('a caller with no types and a say of another length is stopped the same', () => {
        expect(() => createTable('u', ['A', 'B'], [], ['always'] as never)).toThrow(TypeError);
    });
});

describe('Jenny: a stop the package made, and a host that has its own say', () => {
    /** A table that measures as the test says, and the callback the package gave its observer. */
    function watched(): { t: HTMLTableElement; measure: (scrollWidth: number, clientWidth: number) => void; look: () => void; restore: () => void } {
        const had = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
        let look: () => void = () => {};
        (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
            constructor(callback: () => void) { look = callback; }
            observe(): void {}
            disconnect(): void {}
        };
        const t = createTable('users', ['User'], [{ cells: ['Tim'] }]);
        const measure = (scrollWidth: number, clientWidth: number): void => {
            Object.defineProperty(t, 'scrollWidth', { configurable: true, value: scrollWidth });
            Object.defineProperty(t, 'clientWidth', { configurable: true, value: clientWidth });
        };
        const restore = (): void => { (globalThis as { ResizeObserver?: unknown }).ResizeObserver = had; };
        return { t, measure, look: () => look(), restore };
    }

    test('a table that scrolls is a stop, and one that fits again is not', () => {
        const { t, measure, look, restore } = watched();
        try {
            measure(600, 300);
            look();
            expect(t.getAttribute('tabindex')).toBe('0');
            measure(300, 300);
            look();
            expect(t.hasAttribute('tabindex')).toBe(false);
        } finally { restore(); }
    });

    test('a tabindex the host set after the package made its own is the host\'s: it stays when the table fits', () => {
        const { t, measure, look, restore } = watched();
        try {
            measure(600, 300);
            look();
            t.setAttribute('tabindex', '-1');
            measure(300, 300);
            look();
            expect(t.getAttribute('tabindex')).toBe('-1');
            // And it is the host's from then on: scrolling again does not take it back.
            measure(600, 300);
            look();
            expect(t.getAttribute('tabindex')).toBe('-1');
        } finally { restore(); }
    });
});

describe('Spike: what is not a scroll box', () => {
    test('it is a table still: rows and cells are what the host reads', () => {
        const t = createTable('users', ['User', 'DID'], [{ cells: ['Tim', 'did:key:z6Mk'] }]);
        expect(t.rows).toHaveLength(2);
        expect(t.rows[1]!.cells[1]!.textContent).toBe('did:key:z6Mk');
    });
});

describe('Spike: what is not given', () => {
    test('a row with nothing to open is not a pointer', () => {
        const t = createTable('github-taken', ['When'], [{ cells: ['2026-09-24 14:03:11'] }]);
        expect(t.querySelector<HTMLTableRowElement>('tbody tr')!.style.cursor).toBe('');
    });

    test('a row with no id carries none', () => {
        const t = createTable('github-taken', ['When'], [{ cells: ['2026-09-24 14:03:11'] }]);
        expect(t.querySelector<HTMLTableRowElement>('tbody tr')!.hasAttribute('data-id')).toBe(false);
    });

    test('a cell with no hover has none', () => {
        const td = tableCell('ATTESTOR');
        expect(td.hasAttribute('title')).toBe(false);
        expect(td.className).toBe('');
    });

    test('no rows is the heads and an empty tbody', () => {
        const t = createTable('users', ['Name', 'Level'], []);
        expect(t.querySelectorAll('th')).toHaveLength(2);
        expect(t.querySelector('tbody')?.children).toHaveLength(0);
    });

    test('a cell holding markup says it as text', () => {
        const t = createTable('mail-templates', ['Subject'], [{ cells: ['<b>Welkom</b>'] }]);
        expect(t.querySelector('tbody td')!.textContent).toBe('<b>Welkom</b>');
        expect(t.querySelector('tbody td b')).toBeNull();
    });

    test('two tables, one stylesheet', () => {
        createTable('tokens', ['Label'], []);
        createTable('users', ['Name'], []);
        expect(document.head.querySelectorAll(`#${STYLE_ID}`)).toHaveLength(1);
    });
});

describe('Jenny: the tables a host draws', () => {
    /** A Status head with a switch in it, the way a host builds one. */
    function statusHead(liveOnly: boolean, onToggle: () => void): HTMLTableCellElement {
        const th = document.createElement('th');
        th.append('Status ');
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'tokens-live-only';
        toggle.textContent = liveOnly ? 'live only' : 'all';
        toggle.addEventListener('click', onToggle);
        th.appendChild(toggle);
        return th;
    }

    // "I wish the status col would give me a way to filter out everything revoked and expired."
    test('a head the host built stays where it stands, its switch working', () => {
        const container = document.createElement('div');
        const tokens = [{ label: 'live', ended: false }, { label: 'revoked', ended: true }, { label: 'expired', ended: true }];
        let liveOnly = false;
        const render = () => {
            container.innerHTML = '';
            const shown = tokens.filter(t => !liveOnly || !t.ended);
            container.appendChild(createTable('tokens', ['Label', 'Kind', 'Created', statusHead(liveOnly, () => { liveOnly = !liveOnly; render(); })],
                shown.map(t => ({ cells: [t.label, 'ATTESTOR', '2026-09-14', 'active'] }))));
        };
        render();

        // Last used is no longer a column of its own.
        const headers = [...container.querySelectorAll('th')].map(th => th.firstChild?.textContent?.trim());
        expect(headers).toEqual(['Label', 'Kind', 'Created', 'Status']);

        const labels = () => [...container.querySelectorAll('tbody tr td:first-child')].map(td => td.textContent);
        expect(labels()).toEqual(['live', 'revoked', 'expired']);
        container.querySelector<HTMLButtonElement>('.tokens-live-only')!.click();
        expect(labels()).toEqual(['live']);
        container.querySelector<HTMLButtonElement>('.tokens-live-only')!.click();
        expect(labels()).toEqual(['live', 'revoked', 'expired']);
    });

    test('the label is the way in to the token: a cell the host built keeps its press', () => {
        let opened = '';
        const label = document.createElement('td');
        label.textContent = 'laptop-cron';
        label.title = 'press to open this token';
        label.addEventListener('click', () => { opened = 'AT_1'; });
        const t = createTable('tokens', ['Label', 'Kind'], [{ cells: [label, 'ATTESTOR'] }]);
        const first = t.querySelector<HTMLElement>('tbody td')!;
        expect(first).toBe(label);
        expect(first.title).toBe('press to open this token');
        first.click();
        expect(opened).toBe('AT_1');
    });

    // Sent and refused alike, each pill the host's.
    test('a sent mail carries its message id and a refused one what the transport said', () => {
        const outcome = (sent: boolean, said: string) => {
            const td = document.createElement('td');
            const pill = document.createElement('span');
            pill.className = `element-pill ${sent ? 'element-pill-on' : 'element-pill-off'}`;
            pill.textContent = sent ? 'sent' : 'refused';
            td.appendChild(pill);
            const why = document.createElement(sent ? 'span' : 'div');
            why.textContent = said;
            td.appendChild(why);
            return td;
        };
        const container = document.createElement('div');
        container.appendChild(createTable('mail-sent', ['When', 'To', 'Subject', 'Outcome'], [
            { cells: [tableCell('2026-09-24 14:03:11', 'element-time', 'AS-1'), 'tim@defacile.nl', 'Welkom', outcome(false, 'MessageRejected: Email address is not verified')], onPress: () => {} },
            { cells: [tableCell('2026-09-24 14:03:11', 'element-time', 'AS-2'), 'tim@defacile.nl', 'Welkom', outcome(true, '0100019a-ses')], onPress: () => {} },
        ]));
        const rows = container.querySelectorAll('tbody tr');
        expect(rows.length).toBe(2);
        expect(rows[0]!.textContent).toContain('refused');
        expect(rows[0]!.textContent).toContain('MessageRejected');
        expect(rows[1]!.textContent).toContain('sent');
        expect(rows[1]!.textContent).toContain('0100019a-ses');
        expect(rows[1]!.textContent).toContain('tim@defacile.nl');
    });

    // One row per line, in the order the node answered, and nothing folded.
    test('every line is a row, superseded ones included', () => {
        const container = document.createElement('div');
        container.appendChild(createTable('roles', ['Line', 'by', 'at'], [
            { id: 'AS-2', cells: ['spike is role:revoked WORKER of default', 'root', '2026-09-07 10:00:00'] },
            { id: 'AS-1', cells: ['spike is role:granted WORKER of default', 'root', '2026-09-07 09:00:00'] },
        ]));
        const rows = [...container.querySelectorAll('tr[data-id]')].map(r => r.querySelector('td')?.textContent);
        expect(rows).toEqual(['spike is role:revoked WORKER of default', 'spike is role:granted WORKER of default']);
    });

    test('two tables in one element are found by their names', () => {
        const container = document.createElement('div');
        container.appendChild(createTable('github-namespaces', ['Namespace', 'Login', 'Auth', 'Rate'], [
            { cells: ['clean', 'tim', 'ok', '4999 / 5000'] },
        ]));
        container.appendChild(createTable('github-taken', ['When', 'Plugin', 'Digest', 'Changed'], [
            { cells: ['2026-09-24 14:03:11', 'garden', 'sha256:ab', 'yes'] },
            { cells: ['2026-09-24 13:03:11', 'garden', 'sha256:aa', 'no, older than installed'] },
        ]));
        expect(container.querySelectorAll('.github-taken-table tbody tr')).toHaveLength(2);
        expect(container.querySelectorAll('.github-namespaces-table tbody tr')).toHaveLength(1);
    });

    // "TABLES BEING MAX 4 col." A host's Users list of eight heads is not drawn.
    test('eight heads are refused', () => {
        const eight = ['Name', 'Level', 'Door', 'Reached by', 'Email', 'Phone', 'Created', 'Status'];
        expect(() => createTable('users', eight as never, [])).toThrow(TypeError);
    });
});

/** What tsc says of a host's file that draws a table with these lines. */
function compile(lines: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'elements-table-'));
    try {
        writeFileSync(join(dir, 'host.ts'), [
            `import { createTable, tableCell } from '${resolve(import.meta.dir, 'table')}';`,
            `void tableCell;`,
            lines,
        ].join('\n'));
        writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({
            compilerOptions: {
                noEmit: true, strict: true, target: 'ES2020', module: 'ESNext',
                moduleResolution: 'bundler', lib: ['ES2020', 'DOM'], types: [],
            },
            files: ['host.ts'],
        }));
        const tsc = Bun.spawnSync([resolve(import.meta.dir, 'node_modules/.bin/tsc'), '-p', dir]);
        return tsc.stdout.toString() + tsc.stderr.toString();
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

describe('Spike: four columns at most, every row as wide as the heads', () => {
    test('four heads and rows of four compile', () => {
        expect(compile(`createTable('mail', ['When', 'To', 'Subject', 'Outcome'], [{ cells: ['a', 'b', 'c', 'd'] }]);`)).toBe('');
    }, 30000);

    test('rows built from a list compile, as a host builds them', () => {
        expect(compile([
            `const mails: [string, string][] = [['2026-09-24', 'Welkom']];`,
            `createTable('mail', ['When', 'Subject'], mails.map(([when, subject]) => ({ cells: [tableCell(when, 'element-time'), subject], onPress: () => {} })));`,
        ].join('\n'))).toBe('');
    }, 30000);

    test('a fifth column does not compile', () => {
        expect(compile(`createTable('mail', ['When', 'User', 'To', 'Subject', 'Outcome'], []);`)).toContain('error TS');
    }, 30000);

    test('a row narrower than the heads does not compile', () => {
        expect(compile(`createTable('mail', ['When', 'To', 'Subject'], [{ cells: ['a', 'b'] }]);`)).toContain('error TS');
    }, 30000);

    test('a row wider than the heads does not compile', () => {
        expect(compile(`createTable('mail', ['When', 'To'], [{ cells: ['a', 'b', 'c'] }]);`)).toContain('error TS');
    }, 30000);

    test('no heads does not compile', () => {
        expect(compile(`createTable('mail', [], []);`)).toContain('error TS');
    }, 30000);

    test('a caller with no types is stopped too: a fifth column, and a row of another width', () => {
        expect(() => createTable('mail', ['a', 'b', 'c', 'd', 'e'] as never, [])).toThrow(TypeError);
        expect(() => createTable('mail', ['a', 'b'], [{ cells: ['a'] } as never])).toThrow(TypeError);
    });
});
