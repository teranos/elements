/**
 * The tooltip form, in a real browser, with a finger.
 *
 * "In the galium glyph, there would be text that says Hover Please. Nothing
 * happens to Galium." Hovering the text, after 300ms a tooltip; after 1s more
 * the expanded tooltip; a click takes Window Form. On a phone: "The tap should
 * just open the tooltip, and the tooltip should linger for 1.4 sec. Tap again
 * within those 1.4 sec and it expands, tap again and you get your window."
 *
 * The 1.4s is the page's own timer, so the page's clock is the test's: it
 * stands still until the test moves it. "Tap again within those 1.4 sec" is
 * then true at 1399ms and not at 1400ms, instead of true when the runner was
 * quick enough, and "lingers 1.4s, then goes" is asked at 1399 and at 1400
 * instead of at whenever a wait and a poll happened to land.
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

test('a finger: tap the tooltip, tap again the bigger picture, tap again the window', async ({ page }) => {
    await text(page).tap();
    await expect(tooltips(page)).toHaveCount(1);
    const tip = tooltips(page).first();
    const id = await tip.getAttribute('data-element-id');

    // The last moment "again" still counts.
    await page.clock.runFor(1399);
    await tip.tap();
    await expect(tip).toHaveAttribute('data-expanded', 'true');

    // What follows is not about time: the page's own clock runs on, for the morph into a window.
    await page.clock.resume();
    await tip.tap();
    const win = page.locator(`[data-element-id="${id}"]`);
    await expect(win).toHaveAttribute('data-form', /window|panel/);
    await expect(win).toHaveCount(1);
});

test('a finger: a tap left alone lingers 1.4s, then goes', async ({ page }) => {
    await text(page).tap();
    await expect(tooltips(page)).toHaveCount(1);
    await page.clock.runFor(1399);
    // Still there to be tapped: going leaves the element in the page while it travels, and untouchable.
    await expect(tooltips(page)).toHaveCount(1);
    await expect(tooltips(page).first()).toHaveCSS('pointer-events', 'auto');
    await page.clock.runFor(1);
    await expect(tooltips(page)).toHaveCount(0);
});

test('a finger resting on the text selects nothing', async ({ page }) => {
    const select = await text(page).evaluate((el) => getComputedStyle(el).userSelect || getComputedStyle(el).getPropertyValue('-webkit-user-select'));
    expect(select).toBe('none');
});
