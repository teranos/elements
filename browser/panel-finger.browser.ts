/**
 * A panel swiped down by its title bar, in a real browser, under a finger.
 *
 * Krypton opens as a panel. Apple Human Interface Guidelines, Sheets: "Support
 * swiping to dismiss a sheet." The finger is Chrome's own input pipeline
 * (DevTools Input.dispatchTouchEvent), so passive listeners, the page's own
 * scrolling and the browser's gesture handling all take part, as they do for a person.
 * Playwright's touchscreen only taps, and WebKit has no such pipeline to drive:
 * this runs on the phone project.
 *
 * Personas:
 * - Tim: Happy path — swiped far down, it goes to the tray
 * - Spike: Edge cases — swiped a little and slowly, it stays a panel
 */

import { test, expect, type Page } from '@playwright/test';

const KRYPTON = '[data-element-id="panel-specimen"]';

async function open(page: Page) {
    const krypton = page.locator(KRYPTON);
    await krypton.tap();
    await expect(krypton).toHaveAttribute('data-form', 'panel');
    await expect.poll(() => krypton.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
    return krypton;
}

/** A finger down on the title bar's left part, moved `by` px down in `steps`, `pause` ms apart, then lifted. */
async function swipe(page: Page, by: number, steps: number, pause: number): Promise<void> {
    const bar = page.locator(`${KRYPTON} > .title-bar`);
    const box = (await bar.boundingBox())!;
    const x = box.x + 40;
    const y = box.y + box.height / 2;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= steps; i++) {
        await page.waitForTimeout(pause);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (by * i) / steps }] });
    }
    await page.waitForTimeout(pause);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.beforeEach(async ({ page, browserName, isMobile }) => {
    test.skip(browserName !== 'chromium' || !isMobile, 'a real finger is driven through Chrome on a phone');
    await page.goto('/');
    await page.locator(KRYPTON).waitFor();
});

test.describe('Tim: swiped down by its title bar', () => {
    test('far down, it goes back to the tray', async ({ page }) => {
        const krypton = await open(page);
        const height = await page.evaluate(() => window.innerHeight);

        await swipe(page, Math.round(height * 0.4), 12, 30);

        await expect(krypton).toHaveAttribute('data-form', 'dot');
    });
});

test.describe('Spike: short of it', () => {
    test('a little, slowly, and it stays a panel where it was', async ({ page }) => {
        const krypton = await open(page);

        await swipe(page, 60, 12, 60);
        await page.waitForTimeout(400);

        await expect(krypton).toHaveAttribute('data-form', 'panel');
        expect(await krypton.evaluate((el) => el.style.transform)).toBe('');
    });
});
