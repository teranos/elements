// An overlay opened and swiped down, in a real browser, under a finger.
//
// "IF I PRESS ON IT, IT OPENS UP FULLSCREEN."
// "GETTING OUT OF FULL SCREEN IS ALREADY FUCKING HANDLED"
//
// The finger is Chrome's own input pipeline, as panel-finger.browser.ts drives it.

import { test, expect, type Page } from '@playwright/test';

const ASTATINE = '[data-element-id="astatine-overlay"]';
const shots = process.env.OVERLAY_SHOTS;

async function swipe(page: Page, by: number, steps: number, pause: number): Promise<void> {
    const bar = page.locator(`${ASTATINE} > .title-bar`);
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
    await page.locator(ASTATINE).waitFor();
    await page.locator('[data-element-id="overlay-specimen"]').scrollIntoViewIfNeeded();
});

test('swiped far down, it is back over its element, and not in the tray', async ({ page }) => {
    const astatine = page.locator(ASTATINE);
    const before = (await astatine.boundingBox())!;
    await astatine.tap();
    await expect(astatine).toHaveAttribute('data-form', 'panel');
    await expect.poll(() => astatine.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
    const height = await page.evaluate(() => window.innerHeight);

    await swipe(page, Math.round(height * 0.4), 12, 30);

    await expect(astatine).toHaveAttribute('data-form', 'overlay');
    await expect.poll(() => astatine.evaluate((el) => el.parentElement?.getAttribute('data-element-id'))).toBe('overlay-specimen');
    const after = (await astatine.boundingBox())!;
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
    if (shots) await page.screenshot({ path: `${shots}/phone-4-back.png` });
});

test('a finger drags it up, and it opens nothing', async ({ page }) => {
    const astatine = page.locator(ASTATINE);
    const before = (await astatine.boundingBox())!;
    const x = before.x + before.width / 2;
    const y = before.y + before.height / 2;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 8; i++) {
        await page.waitForTimeout(20);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 15 * i }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(astatine).toHaveAttribute('data-form', 'overlay');
    const after = (await astatine.boundingBox())!;
    expect(before.y - after.y).toBeGreaterThan(100);
    if (shots) await page.screenshot({ path: `${shots}/phone-2-finger-moved-up.png` });
});
