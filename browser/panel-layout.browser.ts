/**
 * A panel lays itself out, in a real browser.
 *
 * Krypton opens as a panel and holds forty rows, more than an iPhone 15 shows. On a page
 * with no panel rule of its own (this one), its body ran past the bottom of the
 * screen and could not be scrolled to its end.
 *
 * Personas:
 * - Tim: Happy path — the body ends inside the screen, and scrolls to its last row
 */

import { test, expect } from '@playwright/test';

const KRYPTON = '[data-element-id="panel-specimen"]';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(KRYPTON).waitFor();
});

test.describe('Tim: Krypton, a panel of forty rows', () => {
    test('its body ends inside the screen, and its last row can be scrolled to', async ({ page }) => {
        const krypton = page.locator(KRYPTON);
        await krypton.click();
        await expect(krypton).toHaveAttribute('data-form', 'panel');
        await expect.poll(() => krypton.evaluate((el) => el.classList.contains('morphing'))).toBe(false);

        const body = krypton.locator(':scope > [data-scroller="body"]');
        // Inside the panel, which is the screen. Whether it then scrolls is the screen's
        // height: forty rows fit a Pixel 7's 839px and not an iPhone 15's 659px.
        const ends = await body.evaluate((el) =>
            el.getBoundingClientRect().bottom <= el.closest<HTMLElement>('[data-form="panel"]')!.getBoundingClientRect().bottom + 1);
        expect(ends).toBe(true);

        const last = body.getByText('schedule 40 ·');
        await last.scrollIntoViewIfNeeded();
        await expect(last).toBeInViewport();
    });
});
