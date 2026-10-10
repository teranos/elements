/**
 * The page's scale, in a real browser.
 *
 * "You tap a box to type, and the only thing that should happen is the keyboard
 * coming up. Nothing on the screen should move, zoom or refocus."
 *
 * The specimens page writes its own viewport line, as a host does; the package
 * holds the scale in it (scale.ts), and keeps holding it whatever the page does
 * to the line after. A browser's observers are what keep it, so a browser is
 * where that is shown. That Safari then zooms nothing is the real keyboard run's
 * to show (browser/keyboard).
 *
 * Personas:
 * - Tim: Happy path — the page's own line, held from the start
 * - Jenny: Complex scenarios — the page rewriting its line, or putting another in its place
 */

import { test, expect, type Page } from '@playwright/test';

function lines(page: Page): Promise<string[]> {
    return page.evaluate(() =>
        [...document.querySelectorAll<HTMLMetaElement>('meta[name="viewport"]')].map((m) => m.content),
    );
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-element-id="field-specimen"]').waitFor();
});

test.describe('Tim: the page\'s own line, held', () => {
    test('the line the page wrote also holds the scale', async ({ page }) => {
        expect(await lines(page)).toEqual(['width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1']);
    });
});

test.describe('Jenny: a page that changes its line after the package held it', () => {
    test('a rewritten line is held again', async ({ page }) => {
        await page.evaluate(() => {
            document.querySelector<HTMLMetaElement>('meta[name="viewport"]')!.content = 'width=device-width, maximum-scale=3';
        });
        await expect.poll(() => lines(page)).toEqual(['width=device-width, maximum-scale=1']);
    });

    test('a line put in place of the old one is held too', async ({ page }) => {
        await page.evaluate(() => {
            for (const meta of document.querySelectorAll('meta[name="viewport"]')) meta.remove();
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1';
            document.head.appendChild(meta);
        });
        await expect.poll(() => lines(page)).toEqual(['width=device-width, initial-scale=1, maximum-scale=1']);
    });
});
