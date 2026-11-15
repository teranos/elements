/**
 * An approval's options, in a real browser.
 *
 * "Why do these always seem to become inconsistent?" Each option was as wide as its words: the package's fit wrote
 * every button in an element `fit-content`, and an option asked to share its row. "I don't like how constantly meaning
 * is conveyed with words while visually you could use standard stuff": the percentages, the seconds and "checks
 * running" were words under each label, and an option was as tall as what it said.
 *
 * Personas:
 * - Tim: Happy path — the options of an approval share its row evenly
 * - Spike: Edge cases — two options or three, a mark or words: the same height
 * - Jenny: Complex scenarios — every approval in the roll: one height for every option
 */

import { test, expect, type Page } from '@playwright/test';

const RUBIDIUM = '[data-element-id="approve-specimen"]';

async function open(page: Page) {
    const rb = page.locator(RUBIDIUM);
    await rb.click();
    await expect(rb).not.toHaveAttribute('data-form', 'dot');
    await expect.poll(() => rb.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
}

/** Each approval's options, as they stand. */
const rows = (page: Page) => page.evaluate((rb) => Array.from(document.querySelectorAll(`${rb} section`)).map((card) => ({
    title: card.querySelector('[data-title]')?.textContent ?? '',
    options: Array.from(card.querySelectorAll<HTMLButtonElement>('button[data-own-box]')).map((b) => {
        const r = b.getBoundingClientRect();
        return { label: b.getAttribute('aria-label'), width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top) };
    }),
})).filter((r) => r.options.length), RUBIDIUM);

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(RUBIDIUM).waitFor();
});

test.describe('Tim: an approval\'s options', () => {
    test('share its row evenly, whatever each says', async ({ page }) => {
        await open(page);
        const all = await rows(page);
        expect(all.length).toBeGreaterThanOrEqual(3);
        for (const { title, options } of all) {
            const widths = options.map((o) => o.width);
            expect([title, Math.max(...widths) - Math.min(...widths) <= 1]).toEqual([title, true]);
        }
    });
});

test.describe('Jenny: the roll', () => {
    test('every option is the same height, two or three, a mark or words', async ({ page }) => {
        await open(page);
        const heights = (await rows(page)).flatMap((r) => r.options.map((o) => [r.title, o.label, o.height] as const));
        const tallest = Math.max(...heights.map(([, , h]) => h));
        for (const [title, label, h] of heights) expect([title, label, h]).toEqual([title, label, tallest]);
    });

    test('Yes, No and Merge are drawn, said to a screen reader; Skip and log is words', async ({ page }) => {
        await open(page);
        const yes = page.locator(`${RUBIDIUM} button[aria-label="Yes"]`).first();
        await expect(yes.locator('svg[data-mark="yes"]')).toHaveCount(1);
        await expect(yes).toHaveAccessibleName('Yes');
        await expect(page.locator(`${RUBIDIUM} button[aria-label="Merge"]`).first().locator('svg[data-mark="merge"]')).toHaveCount(1);
        await expect(page.locator(`${RUBIDIUM} button[aria-label="Skip and log"]`)).toContainText('Skip and log');
    });
});
