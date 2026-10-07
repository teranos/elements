/**
 * A panel's grabber, in a real browser.
 *
 * Apple Human Interface Guidelines, Sheets: "Support swiping to dismiss a
 * sheet", and a grabber shows a sheet can be swiped. Krypton opens as a panel;
 * on a touch screen it shows a grabber at the top of its title bar, and with a
 * mouse it does not.
 *
 * Personas:
 * - Tim: Happy path — on a phone the grabber is seen, centred at the panel's top
 * - Spike: Edge cases — with a mouse there is none
 */

import { test, expect } from '@playwright/test';

const KRYPTON = '[data-element-id="panel-specimen"]';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(KRYPTON).waitFor();
});

test('a panel shows a grabber on a touch screen, and none with a mouse', async ({ page, isMobile }) => {
    const krypton = page.locator(KRYPTON);
    await krypton.click();
    await expect(krypton).toHaveAttribute('data-form', 'panel');
    await expect.poll(() => krypton.evaluate((el) => el.classList.contains('morphing'))).toBe(false);

    const grabber = krypton.locator(':scope > .panel-grabber');
    if (!isMobile) {
        await expect(grabber).toHaveCount(0);
        return;
    }
    await expect(grabber).toBeVisible();
    const centred = await grabber.evaluate((el) => {
        const g = el.getBoundingClientRect();
        const panel = el.parentElement!.getBoundingClientRect();
        return Math.abs((g.left + g.right) / 2 - (panel.left + panel.right) / 2) <= 1;
    });
    expect(centred).toBe(true);
});
