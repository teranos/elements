/**
 * A chat opens at its end, in a real browser.
 *
 * "claude element should not start at top when opening requiring user to scroll
 * down every single time" (#40). An element that says `opensAt: 'end'` opens
 * scrolled to what was said last, and stays there as more is said, unless the
 * person has scrolled up to read.
 *
 * Xenon is a chat of sixty lines, more than any screen here shows.
 *
 * Personas:
 * - Tim: Happy path — Xenon opens with its last line in sight
 * - Spike: Edge cases — Krypton, which says nothing, still opens at its top
 * - Jenny: Complex scenarios — a line said at the end is followed; a person scrolled up is left reading
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

/** How far from its end the element's scroller is, in px. */
const fromEnd = (page: Page, selector: string) => page.locator(`${selector} [data-scroller="body"]`).evaluate((s) => s.scrollHeight - s.clientHeight - s.scrollTop);

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(XENON).waitFor();
});

test.describe('Tim: a chat', () => {
    test('opens with its last line in sight', async ({ page }) => {
        const xenon = await open(page, XENON);

        await expect.poll(() => fromEnd(page, XENON)).toBeLessThanOrEqual(1);
        await expect(xenon.getByText('line 60 ·')).toBeInViewport();
    });
});

test.describe('Spike: an element that says nothing', () => {
    test('opens at its top', async ({ page }) => {
        await open(page, KRYPTON);

        expect(await page.locator(`${KRYPTON} [data-scroller="body"]`).evaluate((s) => s.scrollTop)).toBe(0);
    });
});

test.describe('Jenny: more is said', () => {
    test('at the end, the new line is followed', async ({ page }) => {
        await open(page, XENON);
        await expect.poll(() => fromEnd(page, XENON)).toBeLessThanOrEqual(1);
        await page.locator(`${XENON} [data-scroller="body"] .content`).evaluate((log) => {
            for (let i = 61; i <= 70; i++) {
                const line = document.createElement('div');
                line.textContent = `line ${i} · said just now`;
                log.appendChild(line);
            }
        });

        await expect.poll(() => fromEnd(page, XENON)).toBeLessThanOrEqual(1);
    });

    test('scrolled up to read, the person is left reading', async ({ page }) => {
        await open(page, XENON);
        await expect.poll(() => fromEnd(page, XENON)).toBeLessThanOrEqual(1);
        const body = page.locator(`${XENON} [data-scroller="body"]`);
        await body.evaluate((s) => { s.scrollTop = 0; s.dispatchEvent(new Event('scroll')); });
        await page.waitForTimeout(100);
        await page.locator(`${XENON} [data-scroller="body"] .content`).evaluate((log) => {
            const line = document.createElement('div');
            line.textContent = 'line 61 · said just now';
            log.appendChild(line);
        });
        await page.waitForTimeout(200);

        expect(await body.evaluate((s) => s.scrollTop)).toBe(0);
    });
});
