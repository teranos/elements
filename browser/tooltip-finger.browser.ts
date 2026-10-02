/**
 * The tooltip form, in a real browser, with a finger.
 *
 * "In the galium glyph, there would be text that says Hover Please. Nothing
 * happens to Galium." Hovering the text, after 300ms a tooltip; after 1s more
 * the expanded tooltip; a click takes Window Form. On a phone: "The tap should
 * just open the tooltip, and the tooltip should linger for 1.4 sec. Tap again
 * within those 1.4 sec and it expands, tap again and you get your window."
 */

import { test, expect, type Page } from '@playwright/test';

const text = (page: Page) => page.locator('.hover-please');
const tooltips = (page: Page) => page.locator('[data-form="tooltip"]');
const gallium = (page: Page) => page.locator('.canvas-tooltip-specimen');

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await text(page).waitFor();
});

test('a finger: tap the tooltip, tap again the bigger picture, tap again the window', async ({ page }) => {
    await text(page).tap();
    await expect(tooltips(page)).toHaveCount(1);
    const tip = tooltips(page).first();
    const id = await tip.getAttribute('data-element-id');

    await tip.tap();
    await expect(tip).toHaveAttribute('data-expanded', 'true');
    await tip.tap();
    const win = page.locator(`[data-element-id="${id}"]`);
    await expect(win).toHaveAttribute('data-form', /window|panel/);
    await expect(win).toHaveCount(1);
});

test('a finger: a tap left alone lingers 1.4s, then goes', async ({ page }) => {
    await text(page).tap();
    await expect(tooltips(page)).toHaveCount(1);
    await page.waitForTimeout(1000);
    await expect(tooltips(page)).toHaveCount(1);
    await expect(tooltips(page)).toHaveCount(0, { timeout: 1500 });
});

test('a finger resting on the text selects nothing', async ({ page }) => {
    const select = await text(page).evaluate((el) => getComputedStyle(el).userSelect || getComputedStyle(el).getPropertyValue('-webkit-user-select'));
    expect(select).toBe('none');
});
