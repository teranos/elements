/**
 * Every text an example draws is readable: WCAG contrast of 4.5 to 1 against what it is drawn on.
 *
 * "Text is not readable like this", "Could you enforce contrast and readability linting for the example?": what was
 * typed into xenon's chat field was black on black. "I intend on future sessions to look at the elements work and
 * accept it as exemplary. Like a pattern to copy and use." So every example is opened, every field is typed into, and
 * every text it then shows, its words, what is typed and what a field says before anything is, is held to 4.5: every
 * size here is small text (text.ts).
 *
 * Personas:
 * - Tim: Happy path — the page at rest, every text on it readable
 * - Spike: Edge cases — what is typed into a field, and its placeholder, are text too
 * - Jenny: Complex scenarios — each example opened from the tray, one at a time, read whole
 */

import { test, expect, type Page } from '@playwright/test';

const AT_LEAST = 4.5;

interface Unreadable { where: string; text: string; fg: string; bg: string; ratio: number }

/** Types into every field under `scope` and reads every text there; what reads under AT_LEAST comes back. */
async function unreadable(page: Page, scope: string): Promise<Unreadable[]> {
    return page.evaluate(([scope, least]) => {
        type RGBA = [number, number, number, number];
        const parse = (c: string): RGBA => {
            // A mixed colour comes back in its own space: color(srgb r g b / a), each from 0 to 1.
            const srgb = c.match(/color\(srgb\s+([^)]+)\)/);
            if (srgb) {
                const p = srgb[1]!.split(/[\s/]+/).filter(Boolean).map(Number);
                return [p[0]! * 255, p[1]! * 255, p[2]! * 255, p[3] ?? 1];
            }
            const m = c.match(/rgba?\(([^)]+)\)/);
            if (!m) return [0, 0, 0, 0];
            const p = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
            return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
        };
        // A colour laid over another, as a browser composites it.
        const over = (top: RGBA, under: RGBA): RGBA => {
            const a = top[3] + under[3] * (1 - top[3]);
            if (a === 0) return [0, 0, 0, 0];
            const mix = (i: number) => (top[i]! * top[3] + under[i]! * under[3] * (1 - top[3])) / a;
            return [mix(0), mix(1), mix(2), a];
        };
        /** What a node is drawn on: its own background and each ancestor's, down to the page's. */
        const ground = (node: Element): RGBA => {
            const layers: RGBA[] = [];
            for (let n: Element | null = node; n; n = n.parentElement) {
                const bg = parse(getComputedStyle(n).backgroundColor);
                if (bg[3] > 0) layers.push(bg);
                if (bg[3] >= 1) break;
            }
            let base: RGBA = [255, 255, 255, 1];
            for (const layer of layers.reverse()) base = over(layer, base);
            return base;
        };
        const lum = ([r, g, b]: RGBA) => {
            const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
            return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
        };
        const ratio = (fg: RGBA, bg: RGBA) => {
            const a = lum(over(fg, bg)), b = lum(bg);
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        };
        const seen = (el: Element) => {
            const s = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0 && r.width > 0 && r.height > 0;
        };
        const name = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
        const out: { where: string; text: string; fg: string; bg: string; ratio: number }[] = [];
        const check = (el: Element, text: string, fg: RGBA) => {
            const bg = ground(el);
            const r = ratio(fg, bg);
            if (r < least) out.push({ where: name(el), text: text.slice(0, 40), fg: `rgba(${fg.join(',')})`, bg: `rgba(${bg.map(Math.round).join(',')})`, ratio: Math.round(r * 100) / 100 });
        };
        for (const root of Array.from(document.querySelectorAll(scope))) {
            for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
                if (!seen(el) || el.closest('svg')) continue;
                if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                    if (el instanceof HTMLInputElement && ['checkbox', 'radio', 'range', 'color', 'file', 'hidden'].includes(el.type)) continue;
                    const placeholder = el.placeholder;
                    if (placeholder) check(el, placeholder, parse(getComputedStyle(el, '::placeholder').color));
                    // What is typed is text too: put some in, read it, take it out.
                    const had = el.value;
                    el.value = 'readable?';
                    check(el, el.value, parse(getComputedStyle(el).color));
                    el.value = had;
                    continue;
                }
                if (el instanceof HTMLSelectElement) {
                    const text = el.selectedOptions[0]?.textContent?.trim();
                    if (text) check(el, text, parse(getComputedStyle(el).color));
                    continue;
                }
                const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('').trim();
                if (own) check(el, own, parse(getComputedStyle(el).color));
            }
        }
        return out;
    }, [scope, AT_LEAST] as const);
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('.dot').first().waitFor();
});

test.describe('Tim: the page at rest', () => {
    test('every text on it is readable', async ({ page }) => {
        expect(await unreadable(page, 'body')).toEqual([]);
    });
});

test.describe('Spike: a field', () => {
    test('what is typed into xenon\'s chat field, and what it says before, are readable', async ({ page }) => {
        const xenon = page.locator('[data-element-id="chat-specimen"]');
        await xenon.click();
        await expect.poll(() => xenon.evaluate((el) => el.dataset.form !== 'dot' && !el.classList.contains('morphing'))).toBe(true);
        expect(await unreadable(page, '[data-element-id="chat-specimen"] [data-say-box]')).toEqual([]);
    });

    test('xenon\'s choices, and their sheet open, are readable', async ({ page }) => {
        const xenon = page.locator('[data-element-id="chat-specimen"]');
        await xenon.click();
        await expect.poll(() => xenon.evaluate((el) => el.dataset.form !== 'dot' && !el.classList.contains('morphing'))).toBe(true);
        await page.locator('[data-element-id="chat-specimen"] [data-say]').focus();
        await page.locator('[data-element-id="chat-specimen"] [data-choices-pill]').click();
        expect(await unreadable(page, '[data-element-id="chat-specimen"] [data-choices]')).toEqual([]);
    });
});

test.describe('Jenny: every example, opened', () => {
    test('each one from the tray reads whole', async ({ page }) => {
        test.setTimeout(240_000);
        const ids = await page.locator('.dot[data-element-id]').evaluateAll((dots) => dots.map((d) => (d as HTMLElement).dataset.elementId!));
        expect(ids.length).toBeGreaterThan(0);
        const found: Record<string, Unreadable[]> = {};
        for (const id of ids) {
            await page.goto('/');
            const el = page.locator(`[data-element-id="${id}"]`);
            await el.waitFor();
            await el.click();
            // What it opens as, settled; one that stays a dot is read as a dot.
            await expect.poll(() => el.evaluate((node) => !node.classList.contains('morphing')), { timeout: 5000 }).toBe(true);
            await page.waitForTimeout(300);
            const bad = await unreadable(page, `[data-element-id="${id}"]`);
            if (bad.length) found[id] = bad;
        }
        expect(found).toEqual({});
    });
});
