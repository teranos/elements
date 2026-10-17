/**
 * One scrollbar, the package's, in a real browser (#2).
 *
 * "i want one cemtrally managed elements owned scrollbar and they the elements
 * are only allowed to use that one" — "there should not be a system one".
 *
 * Xenon is a chat of sixty lines that opens at its end; Krypton is a panel.
 *
 * Personas:
 * - Tim: Happy path — Xenon's body draws no system bar and shows the package's, at its end
 * - Spike: Edge cases — a host's scrollbar styling changes nothing; content that fits shows no bar
 * - Jenny: Complex scenarios — scrolling moves the bar; dragging the bar scrolls
 */

import { test, expect, type Page } from '@playwright/test';

const XENON = '[data-element-id="chat-specimen"]';
const KRYPTON = '[data-element-id="panel-specimen"]';

async function open(page: Page, selector: string) {
    const element = page.locator(selector);
    await element.click();
    await expect(element).not.toHaveAttribute('data-form', 'dot');
    await expect.poll(() => element.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
    return element;
}

const body = (page: Page, selector: string) => page.locator(`${selector} [data-scroller="body"]`);
const bar = (page: Page, selector: string) => page.locator(`${selector} > [data-scrollbar]`);

/**
 * Whether the body draws a system bar, as the page's styles say. Headless Chromium hides its bars
 * whatever a page says, so the width a bar takes says nothing there; what was asked for does.
 */
const systemBar = (page: Page, selector: string) => body(page, selector).evaluate((s) => getComputedStyle(s).scrollbarWidth);

/** Where the bar is in the body's height, 0 at its top and 1 at its end. */
const barAt = (page: Page, selector: string) => page.evaluate((selector) => {
    const scroller = document.querySelector(`${selector} [data-scroller="body"]`)!.getBoundingClientRect();
    const thumb = document.querySelector(`${selector} > [data-scrollbar]`)!.getBoundingClientRect();
    return (thumb.top - scroller.top) / (scroller.height - thumb.height);
}, selector);

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(XENON).waitFor();
});

test.describe('Tim: a chat of sixty lines', () => {
    test('draws no system bar, and shows the package\'s at its end', async ({ page }) => {
        await open(page, XENON);

        expect(await systemBar(page, XENON)).toBe('none');
        await expect(bar(page, XENON)).toBeVisible();
        await expect.poll(() => barAt(page, XENON)).toBeGreaterThan(0.95);
    });
});

test.describe('Spike: a host, and content that fits', () => {
    test('a host\'s scrollbar styling changes nothing', async ({ page }) => {
        await page.addStyleTag({ content: '* { scrollbar-width: auto !important; } *::-webkit-scrollbar { display: block !important; width: 20px !important; }' });
        await open(page, XENON);

        expect(await systemBar(page, XENON)).toBe('none');
    });

    test('content that fits shows no bar', async ({ page }) => {
        await open(page, KRYPTON);
        await body(page, KRYPTON).evaluate((s) => { s.replaceChildren(Object.assign(document.createElement('p'), { textContent: 'one line' })); });

        await expect(bar(page, KRYPTON)).toBeHidden();
    });
});

test.describe('Jenny: the bar and the body move together', () => {
    test('scrolling to the top moves the bar to the top', async ({ page }) => {
        await open(page, XENON);
        await body(page, XENON).evaluate((s) => { s.scrollTop = 0; });

        await expect.poll(() => barAt(page, XENON)).toBeLessThan(0.05);
    });

    test('dragging the bar to the top scrolls to the top', async ({ page, isMobile }) => {
        test.skip(isMobile, 'a mouse drag');
        await open(page, XENON);
        await expect.poll(() => barAt(page, XENON)).toBeGreaterThan(0.95);
        const thumb = (await bar(page, XENON).boundingBox())!;
        const top = (await body(page, XENON).boundingBox())!.y;

        await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
        await page.mouse.down();
        await page.mouse.move(thumb.x + thumb.width / 2, top - 200, { steps: 8 });
        await page.mouse.up();

        await expect.poll(() => body(page, XENON).evaluate((s) => s.scrollTop)).toBe(0);
    });
});
