/**
 * A person can zoom the page, and a field still zooms nothing.
 *
 * "Be prepared for text-size changes. People use Dynamic Type to increase text size to be more
 * readable ... Apps that don't respond to this setting can be difficult or impossible to use for
 * people who rely on this feature." (Apple Human Interface Guidelines, Accessibility)
 *
 * The package once held `maximum-scale=1` on every viewport line so iOS Safari would not zoom onto a
 * small field. Measured in a Chromium phone, that hold takes pinch zoom away entirely: a pinch of
 * 2.5 leaves the scale at 1, and without it the same pinch reaches 2.5. What keeps a field from
 * zooming iOS is its size: inside an element a field is at 16 whatever a host writes (text.ts), so
 * the hold was a second lock on a door that was already shut, and it locked people out of zoom.
 *
 * Personas:
 * - Tim: Happy path — a pinch zooms the page; the page's own viewport line is left as the host wrote it
 * - Spike: Edge cases — a host that says maximum-scale itself keeps what it said
 * - Jenny: Complex scenarios — a field a host dresses small is still at 16 in an element
 */

import { test, expect, type Page } from '@playwright/test';

function lines(page: Page): Promise<string[]> {
    return page.evaluate(() =>
        [...document.querySelectorAll<HTMLMetaElement>('meta[name="viewport"]')].map((m) => m.content),
    );
}

const KRYPTON = '[data-element-id="panel-specimen"]';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-element-id="field-specimen"]').waitFor();
});

test.describe('Tim: the page is the person\'s to zoom', () => {
    test('a pinch zooms the page', async ({ page, browserName, isMobile }) => {
        // A pinch is raised through the DevTools protocol, which only Chromium answers.
        test.skip(browserName !== 'chromium' || !isMobile, 'a pinch gesture is synthesised in Chromium on a phone');
        const cdp = await page.context().newCDPSession(page);
        expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
        await cdp.send('Input.synthesizePinchGesture', { x: 195, y: 400, scaleFactor: 2.5, relativeSpeed: 300 });
        await expect.poll(() => page.evaluate(() => visualViewport!.scale)).toBeGreaterThan(1);
    });

    test('the viewport line is the one the host wrote', async ({ page }) => {
        expect(await lines(page)).toEqual(['width=device-width, initial-scale=1, viewport-fit=cover']);
    });
});

test.describe('Spike: what a host says about scale is the host\'s', () => {
    test('a host\'s own maximum-scale is left as it is', async ({ page }) => {
        await page.evaluate(() => {
            document.querySelector<HTMLMetaElement>('meta[name="viewport"]')!.content = 'width=device-width, maximum-scale=3';
        });
        // Long enough for an observer to have said anything.
        await page.waitForTimeout(300);
        expect(await lines(page)).toEqual(['width=device-width, maximum-scale=3']);
    });
});

test.describe('Jenny: a field, small by a host, in an element', () => {
    test('is at 16, the size iOS Safari does not zoom the page for', async ({ page }) => {
        await page.addStyleTag({ content: 'input, textarea, select { font-size: 12px; }' });
        const krypton = page.locator(KRYPTON);
        await krypton.click();
        await expect(krypton).toHaveAttribute('data-form', 'panel');
        await expect.poll(() => krypton.evaluate((el) => el.classList.contains('morphing'))).toBe(false);

        const sizes = await krypton.locator('input').evaluateAll((fields) => fields.map((el) => getComputedStyle(el).fontSize));
        expect(sizes.length).toBeGreaterThan(0);
        expect(sizes.every((size) => size === '16px')).toBe(true);
    });
});
