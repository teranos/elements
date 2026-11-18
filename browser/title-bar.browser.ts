/**
 * 「[Opus 5.5] The presses in an element's title bar, in a real browser.」
 *
 * "NO MORE SQUEEZED BUTTONS PLEASE, the header. Uttons of elements have the same issue". "Those buttons are supposed
 * 「[Opus 5.5] to be square and equally sized and margin and alignment within the header". "You can see how it's broken in what」
 * 「[Opus 5.5] should have been the exemplar": Uranium's ⬆ was 17 by 22, Helium's and Cobalt's − 12 by 22, each as wide as its」
 * 「[Opus 5.5] glyph.」
 *
 * 「[Opus 5.5] Personas:」
 * 「[Opus 5.5] - Tim: Happy path — every press in a title bar is a square, all the same size」
 * 「[Opus 5.5] - Spike: Edge cases — a host's own press beside the package's: the same square, in the same row」
 * 「[Opus 5.5] - Jenny: Complex scenarios — at the end of the bar, as far in from its edge as from its top and bottom, evenly apart」
 */

import { test, expect, type Page } from '@playwright/test';

interface Bar {
    id: string;
    bar: { left: number; right: number; top: number; bottom: number; borderRight: number; borderTop: number; borderBottom: number };
    presses: { left: number; right: number; top: number; bottom: number; width: number; height: number; says: string }[];
}

/** Every title bar that holds a press, with its presses, as they stand. */
const bars = (page: Page): Promise<Bar[]> => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[data-element-id] .title-bar'))
    .filter((bar) => bar.querySelector('button') && bar.getBoundingClientRect().width > 0)
    .map((bar) => {
        const r = bar.getBoundingClientRect();
        const s = getComputedStyle(bar);
        return {
            id: bar.closest<HTMLElement>('[data-element-id]')!.dataset.elementId!,
            bar: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, borderRight: parseFloat(s.borderRightWidth), borderTop: parseFloat(s.borderTopWidth), borderBottom: parseFloat(s.borderBottomWidth) },
            presses: Array.from(bar.querySelectorAll('button')).map((b) => {
                const p = b.getBoundingClientRect();
                return { left: p.left, right: p.right, top: p.top, bottom: p.bottom, width: p.width, height: p.height, says: b.textContent ?? '' };
            }),
        };
    }));

async function opened(page: Page, symbols: string[]) {
    for (const symbol of symbols) {
        const id = await page.locator(`.dot[data-symbol="${symbol}"]`).getAttribute('data-element-id');
        const element = page.locator(`[data-element-id="${id}"]`);
        await element.click();
        await expect(element).not.toHaveAttribute('data-form', 'dot');
        // 「[Opus 5.5] Opened, its controls are in its bar.」
        await expect(element.locator('.title-bar .window-controls button').first()).toBeVisible();
        await expect.poll(() => page.evaluate(() => document.querySelector('.morphing') === null)).toBe(true);
    }
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-element-id="border-specimen"]').waitFor();
});

test.describe('Tim: the presses in a title bar', () => {
    test('are squares, all the same size', async ({ page }) => {
        await opened(page, ['He']);
        const all = await bars(page);
        const presses = all.flatMap((b) => b.presses.map((p) => ({ ...p, id: b.id })));
        expect(presses.length).toBeGreaterThanOrEqual(2);
        for (const p of presses) expect([p.id, p.says, Math.round(p.width)]).toEqual([p.id, p.says, Math.round(p.height)]);
        expect(new Set(presses.map((p) => Math.round(p.width))).size).toBe(1);
    });
});

test.describe('Spike: a host\'s own press', () => {
    test('Uranium\'s ⬆ is the same square as the package\'s −', async ({ page }) => {
        await opened(page, ['He']);
        const all = await bars(page);
        const uranium = all.find((b) => b.id === 'border-specimen')!.presses[0]!;
        const helium = all.find((b) => b.id !== 'border-specimen')!.presses.at(-1)!;
        expect(Math.round(uranium.width)).toBe(Math.round(helium.width));
        expect(Math.round(uranium.height)).toBe(Math.round(helium.height));
    });
});

test.describe('Jenny: where they stand in the bar', () => {
    test('at its end, as far in from its edge as from its top and bottom, evenly apart', async ({ page }) => {
        await opened(page, ['He']);
        for (const { id, bar, presses } of await bars(page)) {
            const last = presses.at(-1)!;
            const inside = { right: bar.right - bar.borderRight, top: bar.top + bar.borderTop, bottom: bar.bottom - bar.borderBottom };
            const above = last.top - inside.top;
            const below = inside.bottom - last.bottom;
            expect([id, Math.round(above)]).toEqual([id, Math.round(below)]);
            expect([id, Math.round(inside.right - last.right)]).toEqual([id, Math.round(above)]);
            for (let i = 1; i < presses.length; i++) {
                expect([id, Math.round(presses[i]!.left - presses[i - 1]!.right)]).toEqual([id, Math.round(above)]);
                expect([id, Math.round(presses[i]!.top)]).toEqual([id, Math.round(last.top)]);
            }
        }
    });
});

// 「[Opus 5.5] Seen on the squares: the − above their middle. A glyph sits where its font puts it; the package draws its own.」
test.describe('Jenny: what the package\'s presses say', () => {
    test('is drawn in the middle of each square', async ({ page }) => {
        await opened(page, ['He', 'Co']);
        const off = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[data-element-id] .window-controls button')).map((b) => {
            const mark = b.querySelector('svg');
            if (!mark) return [b.getAttribute('aria-label'), 'no mark'];
            const r = b.getBoundingClientRect();
            const m = mark.getBoundingClientRect();
            return [b.getAttribute('aria-label'), Math.abs((m.left + m.right) / 2 - (r.left + r.right) / 2) < 0.6 && Math.abs((m.top + m.bottom) / 2 - (r.top + r.bottom) / 2) < 0.6];
        }));
        expect(off.length).toBeGreaterThanOrEqual(2);
        for (const [label, centred] of off) expect([label, centred]).toEqual([label, true]);
    });
});
