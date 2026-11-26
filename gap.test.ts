/**
 * The space between things is the package's, entirely.
 *
 * "elements should own gaps right? So no consumers can disagree"
 *
 * The package holds one set of gaps. Inside an element the one way to space
 * things is a container's gap, at a size from that set, by gapAt(). A margin is
 * space too: inside an element it is the package's, and it is none. What the
 * compiler cannot see (a host stylesheet, a style attribute) is inert inside an
 * element: the package's rule outranks it. The sizes are on the page's root as
 * well, for what a host draws outside any element, and no host sets them there.
 *
 * Personas:
 * - Tim: Happy path — the set; a node spaced from it; the rule says it
 * - Spike: Edge cases — a gap not in the set does not compile, and throws for a caller with no types;
 *   a style attribute written important is taken off
 * - Jenny: Complex scenarios — the package's own sizes are the set's; the package spaces nothing but by it
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { GAPS, gapAt } from './gap';
import { TEXT_SIZES, FIELD_TEXT_SIZE, holdTextSize } from './text';
import { takeOffFit } from './fit';
import { SAY_INSET } from './content/say-sizes';
import { TITLE_INSET } from './forms/title-sizes';

const RULE_ID = 'elements-text-size';
const rule = () => document.getElementById(RULE_ID);

beforeEach(() => {
    document.body.innerHTML = '';
    rule()?.remove();
});

describe('Tim: the set, and a node spaced from it', () => {
    test('the gaps are sm 4, md 8, lg 16', () => {
        expect(GAPS).toEqual({ sm: 4, md: 8, lg: 16 });
    });

    test('a node spaced lg says so, and the rule is in the page', () => {
        const node = document.createElement('div');
        gapAt(node, 'lg');

        expect(node.dataset.gap).toBe('lg');
        expect(rule()).not.toBeNull();
    });

    test('inside an element, every box is spaced md and has no margin until said otherwise', () => {
        holdTextSize();
        const css = rule()!.textContent!;

        expect(css).toContain(`[data-element-id]:not(.dot) * { gap: ${GAPS.md}px !important; margin: 0 !important; }`);
    });

    test('what a host puts in an element\'s body stands md apart, spaced by the package', () => {
        holdTextSize();
        const css = rule()!.textContent!;

        expect(css).toContain(`[data-element-id]:not(.dot) [data-scroller="body"] > * + * { margin-block-start: ${GAPS.md}px !important; }`);
    });

    test('each size of the set is a rule of its own', () => {
        holdTextSize();
        const css = rule()!.textContent!;

        for (const [name, px] of Object.entries(GAPS)) {
            expect(css).toContain(`[data-gap="${name}"] { gap: ${px}px !important; }`);
        }
    });

    test('the page\'s root says the gaps and the text sizes, for what a host draws outside an element', () => {
        holdTextSize();
        const css = rule()!.textContent!;

        for (const [name, px] of Object.entries(GAPS)) expect(css).toContain(`--gap-${name}: ${px}px !important;`);
        for (const [name, px] of Object.entries(TEXT_SIZES)) expect(css).toContain(`--font-size-${name}: ${px}px !important;`);
        expect(css).toContain(`--font-size-field: ${FIELD_TEXT_SIZE}px !important;`);
    });

    test('outside an element, a node spaced from the set is spaced all the same', () => {
        const node = document.createElement('div');
        gapAt(node, 'sm');

        expect(node.style.gap).toBe(`${GAPS.sm}px`);
        expect(node.style.getPropertyPriority('gap')).toBe('');
    });
});

/** What tsc says of a host's file that spaces a node with these lines. */
function compile(lines: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'elements-gap-'));
    try {
        writeFileSync(join(dir, 'host.ts'), [
            `import { gapAt } from '${resolve(import.meta.dir, 'gap')}';`,
            `const node = document.createElement('div');`,
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

describe('Spike: a gap not in the set', () => {
    test('a size from the set compiles', () => {
        expect(compile(`gapAt(node, 'md');`)).toBe('');
    });

    test('a size not in the set does not compile', () => {
        expect(compile(`gapAt(node, 'xl');`)).toContain('error TS2345');
    });

    test('a caller with no types is stopped by a TypeError', () => {
        expect(() => gapAt(document.createElement('div'), 'xl' as never)).toThrow(TypeError);
    });

    test('a gap or a margin written important in a style attribute inside an element is taken off', () => {
        const node = document.createElement('div');
        const written = ['gap', 'row-gap', 'column-gap', 'margin-top', 'margin-inline-start'];
        for (const name of written) node.style.setProperty(name, '10px', 'important');
        // JSDOM keeps no priority for a gap (cssstyle): there it is no important style attribute, and the
        // package's rule outranks it as it is (browser/gap.browser.ts sees it in a real browser).
        const important = written.filter((name) => node.style.getPropertyPriority(name) === 'important');
        expect(important).toContain('margin-top');
        takeOffFit(node);

        for (const name of important) expect(node.style.getPropertyValue(name)).toBe('');
    });
});

describe('Jenny: the package itself', () => {
    test('its own insets are sizes of the set', () => {
        expect(SAY_INSET).toBe(GAPS.md);
        expect(TITLE_INSET).toBe(GAPS.sm);
    });

    test('spaces nothing but by the set, and its examples neither', () => {
        const glob = new Bun.Glob('**/*.ts');
        // A gap or a margin written as a number: a margin of 0 is none, and auto is no space.
        const spacing = /\b(gap|row-gap|column-gap|rowGap|columnGap)['"]?\s*[:=]\s*['"]?\d|\bmargin[\w-]*['"]?\s*[:=]\s*['"]?-?[1-9]|setProperty\(\s*['"](gap|row-gap|column-gap|margin[\w-]*)['"]/i;
        const found: string[] = [];
        for (const file of glob.scanSync({ cwd: import.meta.dir })) {
            // The examples are the pattern a host copies: they space by the set too.
            if (file.startsWith('node_modules/') || file.startsWith('browser/')) continue;
            if (file.endsWith('.test.ts') || file === 'gap.ts') continue;
            readFileSync(resolve(import.meta.dir, file), 'utf8').split('\n').forEach((line, i) => {
                if (spacing.test(line)) found.push(`${file}:${i + 1}: ${line.trim()}`);
            });
        }
        expect(found).toEqual([]);
    });
});
