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
        expect(css).toContain(`font-size: ${FIELD_TEXT_SIZE}px !important`);
    });

    test('an editor (contenteditable) is at 16 too, and what is written in it', () => {
        sizeText(document.createElement('span'), 'sm');
        const css = rule()!.textContent!;

        expect(css).toContain('[contenteditable]:not([contenteditable="false"])');
        expect(css).toMatch(/\[contenteditable\]:not\(\[contenteditable="false"\]\)[^{]*\{ font-size: 16px !important; \}/);
    });

    // "Be prepared for text-size changes" (Apple HIG, Accessibility): a size follows the person's text size, which is
    // what `font-size: medium` is (the browser's own default), and is never smaller than the package's number. The
    // scale is measured once and written into every size as a number: nothing in the page resolves it again, so no
    // host's root, custom property or rule moves it.
    function measuring(px: string): () => void {
        const had = window.getComputedStyle;
        (window as any).getComputedStyle = (node: Element) => {
            const real = had.call(window, node);
            return (node as HTMLElement).style?.fontSize === 'medium' ? { ...real, fontSize: px } : real;
        };
        return () => { (window as any).getComputedStyle = had; };
    }

    test('the person\'s larger text size is written into every size, a number and nothing to resolve', () => {
        const restore = measuring('24px');
        try {
            sizeText(document.createElement('span'), 'sm');
            const css = rule()!.textContent!;
            for (const [px, at] of [[10, 15], [11, 16.5], [13, 19.5], [14, 21], [16, 24]]) {
                expect(css).toContain(`font-size: ${at}px !important`);
                expect(css).not.toContain(`font-size: ${px}px !important`);
            }
            expect(css).not.toContain('--elements-text-scale');
            expect(css).not.toContain('rem');
        } finally { restore(); }
    });

    test('a smaller one makes nothing smaller: the package\'s numbers are the least', () => {
        const restore = measuring('12px');
        try {
            sizeText(document.createElement('span'), 'sm');
            const css = rule()!.textContent!;
            for (const px of [10, 11, 13, 14, 16]) expect(css).toContain(`font-size: ${px}px !important`);
        } finally { restore(); }
    });

    test('where `medium` measures nothing (a test DOM), the sizes are the package\'s numbers', () => {
        sizeText(document.createElement('span'), 'sm');
        const css = rule()!.textContent!;
        for (const px of [10, 11, 13, 14, 16]) expect(css).toContain(`font-size: ${px}px !important`);
    });

    test('`medium` is measured where no page rule reaches: inside a shadow root of the package\'s', () => {
        const seen: string[] = [];
        const had = window.getComputedStyle;
        (window as any).getComputedStyle = (node: Element) => {
            if ((node as HTMLElement).style?.fontSize === 'medium') seen.push(node.getRootNode() === document ? 'page' : 'shadow');
            return had.call(window, node);
        };
        try {
            sizeText(document.createElement('span'), 'sm');
            expect(seen).toEqual(['shadow']);
        } finally { (window as any).getComputedStyle = had; }
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
            expect(css).toContain(`font-size: ${px}px !important`);
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
        expect(css).toContain(`font-size: ${TEXT_SIZES.lg}px !important`);
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
