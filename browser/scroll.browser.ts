/**
 * Where an element scrolls, in a real browser.
 *
 * Apple Human Interface Guidelines, Scroll views: "Avoid putting a scroll view
 * inside another scroll view with the same orientation." The test DOMs read
 * only what was written; Chromium and WebKit resolve the cascade, so what a
 * host's stylesheet makes scroll is read here the way a phone reads it.
 *
 * Lithium, the second placement specimen, holds more than a screen: its body scrolls.
 *
 * Personas:
 * - Tim: Happy path — a body that holds more than it shows is the element's scroller
 * - Spike: Edge cases — a body holding a field is not a stop of its own
 * - Jenny: Complex scenarios — a host's stylesheet adds a second scroller, and it is named
 */

import { test, expect, type Page } from '@playwright/test';

const LITHIUM = '[data-element-id="placement-2"]';
const SELENIUM = '[data-element-id="field-specimen"]';

async function open(page: Page, selector: string) {
    const element = page.locator(selector);
    await element.click();
    await expect(element).toHaveAttribute('data-form', 'window');
    await expect.poll(() => element.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
    return { element, body: element.locator(':scope > [data-scroller="body"]') };
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(LITHIUM).waitFor();
});

test.describe('Tim: a body that holds more than it shows', () => {
    test('is the element\'s scroller, and keeps its scroll to itself', async ({ page }) => {
        const { body } = await open(page, LITHIUM);
        // Polled: a window still finding its size has not overflowed yet.
        await expect.poll(() => body.evaluate((el) => {
            const style = getComputedStyle(el);
            return {
                overflowY: style.overflowY,
                overscroll: style.overscrollBehaviorY,
                overflows: el.scrollHeight > el.clientHeight,
            };
        })).toEqual({ overflowY: 'auto', overscroll: 'contain', overflows: true });
    });

    test('can be reached by the keyboard, named for its element', async ({ page }) => {
        const { body } = await open(page, LITHIUM);
        await expect(body).toHaveAttribute('tabindex', '0');
        await expect(body).toHaveAttribute('role', 'region');
        await expect(body).toHaveAttribute('aria-label', 'Lithium');
    });

    test('scrolls under the wheel', async ({ page, isMobile }) => {
        test.skip(isMobile, 'a phone has no wheel');
        const { body } = await open(page, LITHIUM);
        const box = (await body.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, 200);
        await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    });
});

test.describe('Spike: a body holding a field', () => {
    test('is reached through its field, not as a stop of its own', async ({ page }) => {
        const { body } = await open(page, SELENIUM);
        await expect(body).not.toHaveAttribute('tabindex', /.*/);
    });
});

test.describe('Jenny: a host\'s stylesheet adds a second scroller', () => {
    test('it is named where it is', async ({ page }) => {
        const { body } = await open(page, LITHIUM);
        await page.addStyleTag({ content: '.tr-col { overflow-y: auto; max-height: 120px; }' });
        await body.evaluate((el) => {
            const column = document.createElement('div');
            column.className = 'tr-col';
            column.textContent = 'turns';
            el.prepend(column);
        });
        await expect(body.locator('.tr-col')).toHaveAttribute('data-scroller', 'undeclared');
    });

    test('a scroller declared on the canvas still reaches all it holds once lifted to a window', async ({ page }) => {
        const uranium = page.locator('[data-element-id="border-specimen"]');
        const declared = uranium.locator('[data-scroller="declared"]');
        await declared.evaluate((el) => {
            for (let i = 0; i < 60; i++) {
                const line = document.createElement('div');
                line.textContent = `line ${i}`;
                el.appendChild(line);
            }
        });
        await uranium.locator('button', { hasText: '⬆' }).click();
        await expect(uranium).toHaveAttribute('data-form', 'window');
        await expect.poll(() => uranium.evaluate((el) => el.classList.contains('morphing'))).toBe(false);

        // Bounded by the window's body, so it scrolls what the window cannot show.
        await expect.poll(() => declared.evaluate((el) => {
            const body = el.closest('[data-scroller="body"]')!;
            return {
                inside: el.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom + 1,
                scrolls: el.scrollHeight > el.clientHeight,
            };
        })).toEqual({ inside: true, scrolls: true });
    });

    test('nothing the specimens open is named', async ({ page }) => {
        await open(page, LITHIUM);
        await open(page, SELENIUM);
        await expect(page.locator('[data-scroller="undeclared"]')).toHaveCount(0);
    });
});
