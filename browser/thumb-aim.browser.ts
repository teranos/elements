/**
 * A thumb browsing the tray sees which dot it will open, in a real browser.
 *
 * Apple Human Interface Guidelines, Gestures: "As people perform a gesture in
 * your app, provide feedback that helps them predict its results." The finger
 * is Chrome's own input pipeline (DevTools Input.dispatchTouchEvent); WebKit
 * has no such pipeline to drive, so this runs on the phone project.
 *
 * Personas:
 * - Tim: Happy path — a thumb by Lithium marks Lithium, and lifting it opens Lithium
 * - Spike: Edge cases — slid on to Beryllium, the mark moves with it
 */

import { test, expect, type Page, type CDPSession } from '@playwright/test';

const dot = (id: string) => `[data-element-id="${id}"]`;
const LITHIUM = 'placement-2';
const BERYLLIUM = 'placement-3';

/** Where a dot's row is, at rest: the thumb goes just left of the column, level with it. */
async function beside(page: Page, id: string): Promise<{ x: number; y: number }> {
    const box = (await page.locator(dot(id)).boundingBox())!;
    return { x: box.x - 6, y: box.y + box.height / 2 };
}

const marked = (page: Page) => page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.dot[data-aimed]')].map((el) => el.dataset.elementId));

async function finger(page: Page): Promise<CDPSession> {
    return page.context().newCDPSession(page);
}

test.beforeEach(async ({ page, browserName, isMobile }) => {
    test.skip(browserName !== 'chromium' || !isMobile, 'a real finger is driven through Chrome on a phone');
    await page.goto('/');
    await page.locator(dot(LITHIUM)).waitFor();
});

test.describe('Tim: the dot a thumb will open is marked, and opens', () => {
    test('by Lithium, Lithium alone is marked; lifted, Lithium opens', async ({ page }) => {
        const at = await beside(page, LITHIUM);
        const cdp = await finger(page);

        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: at.x - 1, y: at.y }] });
        await expect.poll(() => marked(page)).toEqual([LITHIUM]);

        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect(page.locator(dot(LITHIUM))).toHaveAttribute('data-form', /window|panel/);
    });
});

test.describe('Spike: the mark follows the thumb', () => {
    test('slid from Lithium on to Beryllium, Beryllium alone is marked', async ({ page }) => {
        const from = await beside(page, LITHIUM);
        const to = await beside(page, BERYLLIUM);
        const cdp = await finger(page);

        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
        for (let i = 1; i <= 6; i++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x, y: from.y + ((to.y - from.y) * i) / 6 }] });
        }
        await expect.poll(() => marked(page)).toEqual([BERYLLIUM]);

        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    });
});
