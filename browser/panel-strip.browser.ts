/**
 * A panel on a phone has no title bar row, in a real browser.
 *
 * Two red crosses over a phone's panel: "inefficient use of space". The row of
 * title and minimize button said nothing the grabber and the swipe do not, and
 * took 32 to 44 points of the screen. On a touch screen the bar is the grabber's
 * strip: the swipe is still taken there, the minimize button is still there for a
 * screen reader, and no page can make it a row again.
 *
 * Personas:
 * - Tim: Happy path — on a phone the bar is a 16px strip, with no title or button seen
 * - Spike: Edge cases — a page that makes title bars 44px high changes nothing; with a mouse the bar is a row
 * - Jenny: Complex scenarios — the minimize button is still there for a screen reader, and the body starts under the strip
 */

import { test, expect, type Page } from '@playwright/test';

const KRYPTON = '[data-element-id="panel-specimen"]';
const STRIP = 16;

async function openKrypton(page: Page) {
    const krypton = page.locator(KRYPTON);
    await krypton.click();
    await expect(krypton).toHaveAttribute('data-form', 'panel');
    await expect.poll(() => krypton.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
    return krypton;
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(KRYPTON).waitFor();
});

test.describe('Tim: a panel on a phone', () => {
    test('its title bar is a 16px strip, no title or button seen', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'a touch screen');
        const krypton = await openKrypton(page);
        const bar = krypton.locator(':scope > .title-bar');

        expect((await bar.boundingBox())!.height).toBe(STRIP);
        for (const box of await bar.locator(':scope > *').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) {
            expect(box).toBeLessThanOrEqual(1);
        }
    });
});

test.describe('Spike: a page\'s own title bar, and a mouse', () => {
    test('a page that makes title bars 44px high changes nothing', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'a touch screen');
        await page.addStyleTag({ content: '.title-bar { height: 44px !important; } .title-bar button { width: 44px !important; height: 44px !important; }' });
        const krypton = await openKrypton(page);

        expect((await krypton.locator(':scope > .title-bar').boundingBox())!.height).toBe(STRIP);
    });

    test('with a mouse, the title bar is a row with its title and button', async ({ page, isMobile }) => {
        test.skip(isMobile, 'a mouse');
        const krypton = await openKrypton(page);
        const bar = krypton.locator(':scope > .title-bar');

        expect((await bar.boundingBox())!.height).toBeGreaterThan(STRIP);
        await expect(bar.getByRole('button', { name: 'Minimize' })).toBeVisible();
    });
});

test.describe('Jenny: what the strip still holds', () => {
    test('the minimize button is there for a screen reader, and the body starts under the strip', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'a touch screen');
        const krypton = await openKrypton(page);
        const bar = krypton.locator(':scope > .title-bar');

        await expect(bar.getByRole('button', { name: 'Minimize' })).toHaveCount(1);
        const barBottom = (await bar.boundingBox())!.y + STRIP;
        const bodyTop = (await krypton.locator(':scope > [data-scroller="body"]').boundingBox())!.y;
        expect(bodyTop).toBe(barBottom);
    });
});
