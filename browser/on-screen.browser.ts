// "if it overflows width, hard fail, die"
// A window stands whole on its screen, whatever it is given to hold after it opened.

import { test, expect, type Page } from '@playwright/test';

const GERMANIUM = '[data-element-id="germanium-button"]';

const touching = (): boolean => !!test.info().project.use.hasTouch;

async function openWindow(page: Page) {
    const button = page.locator(GERMANIUM);
    if (touching()) await button.tap();
    else await button.click();
    await expect(button).toHaveAttribute('data-form', 'window');
    await expect.poll(() => button.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
}

const edges = (page: Page) => page.locator(GERMANIUM).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, width: r.width, screen: window.innerWidth };
});

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(GERMANIUM).waitFor();
});

test('a window given a long line after it opened, standing at the right, stays whole on its screen', async ({ page }) => {
    await openWindow(page);
    // Where the Mail window stood: well right of the middle.
    await page.locator(GERMANIUM).evaluate((el) => { el.style.left = `${Math.floor(window.innerWidth * 0.47)}px`; });
    await page.locator(`${GERMANIUM} .content-area`).evaluate((area) => {
        const line = document.createElement('div');
        line.textContent = 'the node did not say which templates mail is filled from: /api/mail/templates: HTTP 500 ' +
            '{"id":"ERR-1792245572313-2","error":"the mail templates could not be read: template record AS-CLEANAPI-MAILTEMP-CLEANAPI-XEV3IP7S was kept before a template\'s bodies were named"}';
        area.appendChild(line);
    });
    await expect.poll(async () => {
        const e = await edges(page);
        return e.right <= e.screen + 1 && e.left >= -1;
    }).toBe(true);
});

test('a window stays whole when its screen narrows under it', async ({ page }) => {
    await openWindow(page);
    await page.locator(GERMANIUM).evaluate((el) => { el.style.left = `${Math.floor(window.innerWidth * 0.6)}px`; });
    const size = page.viewportSize()!;
    await page.setViewportSize({ width: Math.floor(size.width * 0.7), height: size.height });
    await expect.poll(async () => {
        const e = await edges(page);
        return e.right <= e.screen + 1 && e.left >= -1;
    }).toBe(true);
});
