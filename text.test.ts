/**
 * Text size is the package's, entirely.
 *
 * "Text size needs to be owned by Elements entirely and misuse should result
 * into compilation error."
 *
 * The package holds one set of sizes. Inside an element, the one way to size
 * text is sizeText() with a name from that set: any other size does not compile.
 * What the compiler cannot see (a host stylesheet, a style attribute, an em) is
 * inert inside an element: the package's rule outranks it.
 *
 * Personas:
 * - Tim: Happy path — the set; a node sized from it; the rule in the page once
 * - Spike: Edge cases — a size not in the set does not compile, and throws for a caller with no types
 * - Jenny: Complex scenarios — an element taking a form, or placed on a canvas, brings the rule; a dot is not sized;
 *   the package itself sizes text nowhere but here
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { TEXT_SIZES, FIELD_TEXT_SIZE, sizeText } from './text';
import { setForm } from './dataset';
import { canvasPlaced } from './canvas/placed';

const RULE_ID = 'elements-text-size';
const rule = () => document.getElementById(RULE_ID);

beforeEach(() => {
    document.body.innerHTML = '';
    rule()?.remove();
});

describe('Tim: the set, and a node sized from it', () => {
    test('the sizes are xs 10, sm 11, md 13, lg 14', () => {
        expect(TEXT_SIZES).toEqual({ xs: 10, sm: 11, md: 13, lg: 14 });
    });

    test('a node sized lg says so, and the rule is in the page', () => {
        const node = document.createElement('span');
        sizeText(node, 'lg');

        expect(node.dataset.textSize).toBe('lg');
        expect(rule()).not.toBeNull();
    });

    test('a field is at 16, a size iOS does not zoom the page for', () => {
        sizeText(document.createElement('span'), 'sm');
        const css = rule()!.textContent!;

        expect(FIELD_TEXT_SIZE).toBe(16);
        expect(css).toContain(':is(input, textarea, select)');
        expect(css).toContain(`font-size: max(${FIELD_TEXT_SIZE / 16}rem, ${FIELD_TEXT_SIZE}px) !important`);
    });

    test('an editor (contenteditable) is at 16 too, and what is written in it', () => {
        sizeText(document.createElement('span'), 'sm');
        const css = rule()!.textContent!;

        expect(css).toContain('[contenteditable]:not([contenteditable="false"])');
        expect(css).toMatch(/\[contenteditable\]:not\(\[contenteditable="false"\]\)[^{]*\{ font-size: max\(1rem, 16px\) !important; \}/);
    });

    // "Be prepared for text-size changes" (Apple HIG, Accessibility): a size follows the person's text size (rem,
    // the browser's own) and is never smaller than the package's number, whatever a host writes on its root.
    test('a size follows the person\'s text size, and is never smaller than the package\'s', () => {
        sizeText(document.createElement('span'), 'sm');
        const css = rule()!.textContent!;

        expect(css).toContain('font-size: max(0.6875rem, 11px) !important');
        expect(css).toContain('font-size: max(0.625rem, 10px) !important');
        expect(css).toContain('font-size: max(0.8125rem, 13px) !important');
        expect(css).toContain('font-size: max(0.875rem, 14px) !important');
        // A field never under 16, the size iOS Safari zooms the page for, whatever the root is.
        expect(css).toContain('font-size: max(1rem, 16px) !important');
        // No size is written in px alone any more.
        expect(css).not.toMatch(/font-size: \d+px !important/);
    });

    test('text breaks to the width it has, a word too long anywhere in it', () => {
        sizeText(document.createElement('span'), 'sm');
        const css = rule()!.textContent!;

        expect(css).toContain('overflow-wrap: anywhere !important');
        expect(css).toContain('word-break: normal !important');
    });

    test('the rule is in the page once, however many nodes are sized', () => {
        sizeText(document.createElement('span'), 'xs');
        sizeText(document.createElement('span'), 'md');

        expect(document.querySelectorAll(`#${RULE_ID}`)).toHaveLength(1);
    });

    test('the rule outranks a host: layered and important, every size from the set', () => {
        sizeText(document.createElement('span'), 'sm');
        const css = rule()!.textContent!;

        expect(css).toContain('@layer');
        for (const [name, px] of Object.entries(TEXT_SIZES)) {
            expect(css).toContain(`[data-text-size="${name}"]`);
            expect(css).toContain(`font-size: max(${px / 16}rem, ${px}px) !important`);
        }
    });
});

/** What tsc says of a host's file that sizes text with these lines. */
function compile(lines: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'elements-text-'));
    try {
        writeFileSync(join(dir, 'host.ts'), [
            `import { sizeText } from '${resolve(import.meta.dir, 'text')}';`,
            `const node = document.createElement('span');`,
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

describe('Tim: a surface the package draws itself', () => {
    // The spawn menu and the cursor carried from it stand outside any element,
    // and are sized from the same set: the package's rule reaches them by name.
    test('text on a surface is sized by the same set, and the rule says so', () => {
        const surface = document.createElement('div');
        surface.setAttribute('data-text-surface', '');
        const node = document.createElement('span');
        surface.appendChild(node);
        sizeText(node, 'lg');
        const css = rule()!.textContent!;

        expect(css).toContain('[data-text-surface] [data-text-size="lg"]');
        expect(css).toContain('[data-text-surface][data-text-size="lg"]');
        expect(css).toContain(`font-size: max(${TEXT_SIZES.lg / 16}rem, ${TEXT_SIZES.lg}px) !important`);
    });
});

describe('Spike: a size not in the set', () => {
    test('a size from the set compiles', () => {
        expect(compile(`sizeText(node, 'lg');`)).toBe('');
    }, 30000);

    test('a size in pixels does not compile', () => {
        expect(compile(`sizeText(node, '30px');`)).toContain('error TS2345');
    }, 30000);

    test('a name not in the set does not compile', () => {
        expect(compile(`sizeText(node, 'xl');`)).toContain('error TS2345');
    }, 30000);

    test('a caller with no types is stopped too', () => {
        const node = document.createElement('span');
        expect(() => sizeText(node, '30px' as never)).toThrow(TypeError);
        expect(node.dataset.textSize).toBeUndefined();
    });
});

describe('Jenny: an element taking a form, or placed', () => {
    test('a window brings the rule, with no node sized', () => {
        setForm(document.createElement('div'), 'window');

        expect(rule()).not.toBeNull();
    });

    test('a size written on what it holds is taken off when it takes a form', () => {
        const element = document.createElement('div');
        element.innerHTML = '<p style="font-size: 30px !important; color: red">loud</p>';
        setForm(element, 'window');
        const p = element.querySelector('p')!;

        expect(p.style.fontSize).toBe('');
        expect(p.style.color).toBe('red');
    });

    test('an element placed on a canvas brings the rule', () => {
        canvasPlaced({
            item: { id: 'strontium', title: 'Strontium', renderContent: () => document.createElement('div') },
            className: 'canvas-table-specimen',
            defaults: { x: 0, y: 0, width: 200, height: 100 },
            logLabel: 'TextSize',
        });

        expect(rule()).not.toBeNull();
    });

    test('the rule leaves a dot\'s symbol to the tray', () => {
        setForm(document.createElement('div'), 'window');
        const css = rule()!.textContent!;

        expect(css).toContain('[data-element-id]:not(.dot)');
    });
});

describe('Jenny: the package itself', () => {
    test('sizes text nowhere but text.ts', () => {
        const glob = new Bun.Glob('**/*.ts');
        // A size, by name or in the font shorthand; inheriting is not a size.
        const sizing = /\.fontSize\s*=|font-size\s*:|setProperty\(\s*['"]font-size|\.style\.font\s*=(?!\s*['"]inherit['"])/;
        const found: string[] = [];
        for (const file of glob.scanSync({ cwd: import.meta.dir })) {
            if (file.startsWith('node_modules/') || file.startsWith('browser/')) continue;
            if (file.endsWith('.test.ts') || file === 'text.ts') continue;
            readFileSync(resolve(import.meta.dir, file), 'utf8').split('\n').forEach((line, i) => {
                if (sizing.test(line)) found.push(`${file}:${i + 1}: ${line.trim()}`);
            });
        }
        expect(found).toEqual([]);
    });
});
