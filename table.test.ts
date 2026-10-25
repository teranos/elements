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
            { cells: [tableCell('2026-09-24 14:03:11', 'element-time', 'AS-1'), 'tim@example.com', 'Welkom', outcome(false, 'MessageRejected: Email address is not verified')], onPress: () => {} },
            { cells: [tableCell('2026-09-24 14:03:11', 'element-time', 'AS-2'), 'tim@example.com', 'Welkom', outcome(true, '0100019a-ses')], onPress: () => {} },
        ]));
        const rows = container.querySelectorAll('tbody tr');
        expect(rows.length).toBe(2);
        expect(rows[0]!.textContent).toContain('refused');
        expect(rows[0]!.textContent).toContain('MessageRejected');
        expect(rows[1]!.textContent).toContain('sent');
        expect(rows[1]!.textContent).toContain('0100019a-ses');
        expect(rows[1]!.textContent).toContain('tim@example.com');
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

// "You can clearly see how this element is not usable on mobile right ?"
describe('Jenny: four columns on a phone', () => {
    test('each cell carries its head, for a row that stands as a card', () => {
        const t = createTable('users', ['Name', 'Level', 'Created', 'Status'], [
            { cells: ['grace', 'USER', '2026-01-03 11:00:00', 'on'] },
        ]);
        expect([...t.querySelectorAll('tbody td')].map(td => (td as HTMLElement).dataset.head))
            .toEqual(['Name', 'Level', 'Created', 'Status']);
    });

    test('a head the host built whole lends its text', () => {
        const th = document.createElement('th');
        th.textContent = 'When';
        const t = createTable('mail', [th, 'To'], [{ cells: ['2026-09-24', 'tim@example.com'] }]);
        expect((t.querySelector('tbody td') as HTMLElement).dataset.head).toBe('When');
    });

    test('the stylesheet stacks a row on a narrow screen', () => {
        createTable('users', ['Name'], []);
        expect(document.getElementById(STYLE_ID)!.textContent).toContain('@media (max-width: 600px)');
    });
});
