/**
 * The tooltip form, in a real browser, with a mouse.
 *
 * "In the galium glyph, there would be text that says Hover Please. Nothing
 * happens to Galium." Hovering the text, after 300ms a tooltip; after 1s more
 * the expanded tooltip; a click takes Window Form. On a phone: "The tap should
 * just open the tooltip, and the tooltip should linger for 1.4 sec. Tap again
 * within those 1.4 sec and it expands, tap again and you get your window."
 *
 * The 300ms and the 1s are the page's own timers, so the page's clock is the
 * test's: it stands still until the test moves it, and what the page does at
 * 299ms and at 300ms is asked of the page, not of how soon the runner happened
 * to look. A test that waited on the wall clock and polled for the result was
 * red on a page that was on time (0-1ms late, in every run it failed): the
 * runner's polls fell on either side of the transition and never saw it, more
 * often with tracing on. How long the page takes under load is a different
 * question and not asked here.
 */

import { test, expect, type Page } from '@playwright/test';

const text = (page: Page) => page.locator('.hover-please');
const tooltips = (page: Page) => page.locator('[data-form="tooltip"]');
const gallium = (page: Page) => page.locator('.canvas-tooltip-specimen');

test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.goto('/');
    await text(page).waitFor();
    // From here the page's time moves only when the test moves it.
    await page.clock.pauseAt(60_000);
});

test('a mouse: 300ms a tooltip, 1s more the bigger picture, a click the window', async ({ page }) => {
    const galliumBefore = await gallium(page).evaluate((el) => el.outerHTML);

    await text(page).hover();
    await page.clock.runFor(299);
    await expect(tooltips(page)).toHaveCount(0);
    await page.clock.runFor(1);
    await expect(tooltips(page)).toHaveCount(1);

    const tip = tooltips(page).first();
    await expect(tip).not.toHaveAttribute('data-expanded', 'true');
    await page.clock.runFor(999);
    await expect(tip).not.toHaveAttribute('data-expanded', 'true');
    await page.clock.runFor(1);
    await expect(tip).toHaveAttribute('data-expanded', 'true');

    // What follows is not about time: the page's own clock runs on.
    await page.clock.resume();
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
    await page.clock.runFor(100);
    await page.mouse.move(600, 700);
    // Past the 300ms it would have said, and the grace it is given to go.
    await page.clock.runFor(1000);
    await expect(tooltips(page)).toHaveCount(0);
});

test('a new element every time', async ({ page }) => {
    const ids: (string | null)[] = [];
    for (let i = 0; i < 2; i++) {
        await text(page).hover();
        await page.clock.runFor(300);
        await expect(tooltips(page)).toHaveCount(1);
        ids.push(await tooltips(page).first().getAttribute('data-element-id'));
        // Left, it is given 120ms to be come back to, and then it goes.
        await page.mouse.move(600, 700);
        await page.clock.runFor(119);
        await expect(tooltips(page)).toHaveCount(1);
        await page.clock.runFor(1);
        await expect(tooltips(page)).toHaveCount(0);
    }
    expect(ids[0]).not.toBe(ids[1]);
});
