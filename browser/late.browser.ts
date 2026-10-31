// What arrives while a window is still opening is asked about too, in a real browser.
// "You didn't see how the list doesn't use the screenspace available? This suggests miscompliance with elements"

import { test, expect, type Page } from '@playwright/test';

// QNTX-Web's Stories: its list arrived during the opening morph, before anything watched,
// and on a phone it stayed a window as wide as its loading line. Yttrium is that element.
const YTTRIUM = '[data-element-id="late-specimen"]';

async function open(page: Page) {
    const element = page.locator(YTTRIUM);
    await element.click();
    await expect.poll(() => element.evaluate((el) => !el.classList.contains('morphing') && el.dataset.form !== 'dot')).toBe(true);
    // The list has arrived, and whatever it asks for has had its frame.
    await page.waitForTimeout(500);
    await expect.poll(() => element.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
    return element;
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(YTTRIUM).waitFor();
});

test('a list wider than a phone allows, arrived while opening, opens it as a panel there and a window elsewhere', async ({ page }) => {
    const yttrium = await open(page);
    const viewport = page.viewportSize()!;
    if (viewport.width < 600) {
        await expect(yttrium).toHaveAttribute('data-form', 'panel');
    } else {
        await expect(yttrium).toHaveAttribute('data-form', 'window');
        // Wider than its loading line: the window follows what arrived.
        const box = (await yttrium.boundingBox())!;
        expect(box.width).toBeGreaterThan(200);
    }
});
