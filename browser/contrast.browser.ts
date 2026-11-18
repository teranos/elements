/**
 * 「[Opus 5.5] Every text an example draws is readable: WCAG contrast of 4.5 to 1 against what it is drawn on.」
 *
 * "Text is not readable like this", "Could you enforce contrast and readability linting for the example?": what was
 * 「[Opus 5.5] typed into xenon's chat field was black on black. "I intend on future sessions to look at the elements work and」
 * 「[Opus 5.5] accept it as exemplary. Like a pattern to copy and use." So every example is opened, every field is typed into, and」
 * 「[Opus 5.5] every text it then shows, its words, what is typed and what a field says before anything is, is held to 4.5: every」
 * 「[Opus 5.5] size here is small text (text.ts).」
 *
 * 「[Opus 5.5] Personas:」
 * 「[Opus 5.5] - Tim: Happy path — the page at rest, every text on it readable」
 * 「[Opus 5.5] - Spike: Edge cases — what is typed into a field, and its placeholder, are text too」
 * 「[Opus 5.5] - Jenny: Complex scenarios — each example opened from the tray, one at a time, read whole」
 */

import { test, expect, type Page } from '@playwright/test';

const AT_LEAST = 4.5;

interface Unreadable { where: string; text: string; fg: string; bg: string; ratio: number }

/** Types into every field under `scope` and reads every text there; what reads under AT_LEAST comes back. */
async function unreadable(page: Page, scope: string): Promise<Unreadable[]> {
    return page.evaluate(([scope, least]) => {
        type RGBA = [number, number, number, number];
        const parse = (c: string): RGBA => {
            // 「[Opus 5.5] A mixed colour comes back in its own space: color(srgb r g b / a), each from 0 to 1.」
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
        // 「[Opus 5.5] A colour laid over another, as a browser composites it.」
        const over = (top: RGBA, under: RGBA): RGBA => {
            const a = top[3] + under[3] * (1 - top[3]);
            if (a === 0) return [0, 0, 0, 0];
            const mix = (i: number) => (top[i]! * top[3] + under[i]! * under[3] * (1 - top[3])) / a;
            return [mix(0), mix(1), mix(2), a];
        };
        // 「[Opus 5.5] CodeRabbit on #115: "Composite opacity groups before calculating contrast." What an element holds is drawn」
        // 「[Opus 5.5] over its own background, then the whole is faded by its opacity and laid over what is under it: one picture」
        // 「[Opus 5.5] per element, from the text out to the page.」
        const drawn = (node: Element, top: RGBA): RGBA => {
            let acc = top;
            for (let n: Element | null = node; n; n = n.parentElement) {
                const s = getComputedStyle(n);
                acc = over(acc, parse(s.backgroundColor));
                const o = parseFloat(s.opacity);
                acc = [acc[0], acc[1], acc[2], acc[3] * o];
            }
            return over(acc, [255, 255, 255, 1]);
        };
        /** What a node is drawn on, as the browser draws it. */
        const ground = (node: Element): RGBA => drawn(node, [0, 0, 0, 0]);
        const lum = ([r, g, b]: RGBA) => {
            const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
            return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
        };
        const ratio = (fg: RGBA, bg: RGBA) => {
            const a = lum(fg), b = lum(bg);
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        };
        const seen = (el: Element) => {
            const s = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0 && r.width > 0 && r.height > 0;
        };
        const name = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
        const out: { where: string; text: string; fg: string; bg: string; ratio: number }[] = [];
        const check = (el: Element, text: string, color: RGBA) => {
            const bg = ground(el);
            const fg = drawn(el, color);
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
                    // 「[Opus 5.5] What is typed is text too: put some in, read it, take it out.」
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

    test('xenon\'s choices, at rest and open, are readable', async ({ page }) => {
        const xenon = page.locator('[data-element-id="chat-specimen"]');
        await xenon.click();
        await expect.poll(() => xenon.evaluate((el) => el.dataset.form !== 'dot' && !el.classList.contains('morphing'))).toBe(true);
        await page.locator('[data-element-id="chat-specimen"] [data-say]').focus();
        expect(await unreadable(page, '[data-element-id="chat-specimen"] [data-choices]')).toEqual([]);
        // 「[Opus 5.5] Each pill open, as it is read there.」
        for (const id of ['xenon-choices', 'xenon-repositories']) {
            const pill = page.locator(`[data-choices="${id}"]`);
            await pill.click();
            await expect(pill).toHaveAttribute('data-form', 'pillOpen');
            await expect.poll(() => pill.evaluate((el) => el.dataset.pillMoving === undefined)).toBe(true);
            expect(await unreadable(page, `[data-choices="${id}"]`)).toEqual([]);
            await page.keyboard.press('Escape');
            await expect.poll(() => pill.evaluate((el) => el.dataset.form === 'pill' && el.dataset.pillMoving === undefined)).toBe(true);
        }
    });

    test('what waits in xenon, at rest, open, and with one chosen, is readable', async ({ page }) => {
        const xenon = page.locator('[data-element-id="chat-specimen"]');
        await xenon.click();
        await expect.poll(() => xenon.evaluate((el) => el.dataset.form !== 'dot' && !el.classList.contains('morphing'))).toBe(true);
        const outbox = page.locator('[data-outbox="xenon-outbox"]');
        expect(await unreadable(page, '[data-outbox="xenon-outbox"]')).toEqual([]);
        await outbox.click();
        await expect.poll(() => outbox.evaluate((el) => el.dataset.form === 'pillOpen' && el.dataset.pillMoving === undefined)).toBe(true);
        expect(await unreadable(page, '[data-outbox="xenon-outbox"]')).toEqual([]);
        await outbox.locator('[data-waits]').first().click();
        expect(await unreadable(page, '[data-outbox="xenon-outbox"]')).toEqual([]);
    });
});

// 「[Opus 5.5] Held, a press says why it is held when pressed; it is still read: "A colour that fails it is fixed, never excused."」
test.describe('Spike: a press held back', () => {
    test('selenium\'s Invite, held, is readable', async ({ page }) => {
        const selenium = page.locator('[data-element-id="field-specimen"], .dot[data-symbol="Se"]').first();
        const id = await selenium.getAttribute('data-element-id');
        const el = page.locator(`[data-element-id="${id}"]`);
        await el.click();
        await expect.poll(() => el.evaluate((node) => node.dataset.form !== 'dot' && !node.classList.contains('morphing'))).toBe(true);
        await expect(page.locator('[data-press="selenium-invite"]')).toHaveAttribute('aria-disabled', 'true');
        expect(await unreadable(page, '[data-press="selenium-invite"]')).toEqual([]);
    });
});

// 「[Opus 5.5] CodeRabbit on #115: "Composite opacity groups before calculating contrast." An element's opacity fades it and all it」
// 「[Opus 5.5] holds as one picture: white on black at 0.6 over a white page reads 5.74 to 1, not the 3.22 a second fading gives.」
test.describe('Spike: what opacity does', () => {
    const fixture = (page: Page, opacity: number) => page.evaluate((o) => {
        document.getElementById('opacity-fixture')?.remove();
        const page = document.createElement('div');
        page.id = 'opacity-fixture';
        page.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:60px;background:#fff;z-index:99999';
        const group = document.createElement('div');
        group.style.cssText = `background:#000;color:#fff;opacity:${o};padding:8px`;
        group.textContent = 'faded together';
        page.appendChild(group);
        document.body.appendChild(page);
    }, opacity);

    test('white on black at 0.6 over white reads, as the browser draws it', async ({ page }) => {
        await fixture(page, 0.6);
        expect(await unreadable(page, '#opacity-fixture')).toEqual([]);
    });

    test('at 0.3 it does not, and is said', async ({ page }) => {
        await fixture(page, 0.3);
        const bad = await unreadable(page, '#opacity-fixture');
        expect(bad.map((b) => b.text)).toEqual(['faded together']);
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
            // 「[Opus 5.5] What it opens as, settled; one that stays a dot is read as a dot.」
            await expect.poll(() => el.evaluate((node) => !node.classList.contains('morphing')), { timeout: 5000 }).toBe(true);
            await page.waitForTimeout(300);
            const bad = await unreadable(page, `[data-element-id="${id}"]`);
            if (bad.length) found[id] = bad;
        }
        expect(found).toEqual({});
    });
});
