/**
 * The tooltip form, in a real browser, with a mouse.
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

test('a mouse: 300ms a tooltip, 1s more the bigger picture, a click the window', async ({ page }) => {
    const galliumBefore = await gallium(page).evaluate((el) => el.outerHTML);

    await text(page).hover();
    await page.waitForTimeout(150);
    await expect(tooltips(page)).toHaveCount(0);
    await expect(tooltips(page)).toHaveCount(1, { timeout: 600 });

    const tip = tooltips(page).first();
    await expect(tip).not.toHaveAttribute('data-expanded', 'true');
    await expect(tip).toHaveAttribute('data-expanded', 'true', { timeout: 1600 });

    const id = await tip.getAttribute('data-element-id');
    await tip.hover();
    await tip.click();
    const win = page.locator(`[data-element-id="${id}"]`);
    await expect(win).toHaveAttribute('data-form', /window|panel/);
    await expect(win).toHaveCount(1);
    // Nothing happens to Gallium.
    expect(await gallium(page).evaluate((el) => el.outerHTML)).toBe(galliumBefore);
});

test('a mouse that leaves early makes nothing', async ({ page }) => {
    await text(page).hover();
    await page.waitForTimeout(100);
    await page.mouse.move(600, 700);
    await page.waitForTimeout(600);
    await expect(tooltips(page)).toHaveCount(0);
});

test('a new element every time', async ({ page }) => {
    const ids: (string | null)[] = [];
    for (let i = 0; i < 2; i++) {
        await text(page).hover();
        await expect(tooltips(page)).toHaveCount(1, { timeout: 800 });
        ids.push(await tooltips(page).first().getAttribute('data-element-id'));
        await page.mouse.move(600, 700);
        await expect(tooltips(page)).toHaveCount(0, { timeout: 1000 });
    }
    expect(ids[0]).not.toBe(ids[1]);
});
