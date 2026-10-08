/**
 * A panel's body does not scroll sideways, in a real browser, under a finger.
 *
 * Seen on a phone: a panel whose content was wider than the screen could be
 * panned left and right. Krypton opens as a panel; a row wider than the screen
 * is put in its body, and a finger drags across it. The finger is Chrome's own
 * input pipeline (DevTools Input.dispatchTouchEvent); WebKit has no such
 * pipeline to drive, so this runs on the phone project.
 *
 * Personas:
 * - Tim: Happy path — a finger dragged sideways across wide content moves nothing
 */

import { test, expect } from '@playwright/test';

const KRYPTON = '[data-element-id="panel-specimen"]';

test.beforeEach(async ({ page, browserName, isMobile }) => {
    test.skip(browserName !== 'chromium' || !isMobile, 'a real finger is driven through Chrome on a phone');
    await page.goto('/');
    await page.locator(KRYPTON).waitFor();
});

test('a finger dragged sideways across content wider than the screen moves nothing', async ({ page }) => {
    const krypton = page.locator(KRYPTON);
    await krypton.tap();
    await expect(krypton).toHaveAttribute('data-form', 'panel');
    await expect.poll(() => krypton.evaluate((el) => el.classList.contains('morphing'))).toBe(false);

    const body = krypton.locator(':scope > [data-scroller="body"]');
    await body.evaluate((el) => {
        const wide = document.createElement('div');
        wide.style.cssText = 'width: 3000px; height: 200px';
        wide.textContent = 'wider than the screen';
        el.prepend(wide);
    });
    const box = (await body.boundingBox())!;
    const y = box.y + 100;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width - 60, y }] });
    for (let i = 1; i <= 10; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width - 60 - i * 25, y }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);

    expect(await body.evaluate((el) => el.scrollLeft)).toBe(0);
});
