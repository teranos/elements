/**
 * A chat's field takes the bottom, in a real browser.
 *
 * "making the inputfield take up the entire bottom of the screen for chat
 * elements like claude or pi" (#40), and a red cross over a choice that left the
 * field "Say somethi". The field a host declares (`declareSay`) has the bottom
 * line of its row to itself, the whole width, and the row stays at the bottom of
 * the element while what was said scrolls above it.
 *
 * Personas:
 * - Tim: Happy path — Xenon's field is as wide as the body, on the bottom line of its row
 * - Spike: Edge cases — what the host put beside it is above it, not squeezing it
 * - Jenny: Complex scenarios — scrolled up to the start, the row is still at the bottom
 */

import { test, expect, type Page } from '@playwright/test';

const XENON = '[data-element-id="chat-specimen"]';

async function open(page: Page) {
    const xenon = page.locator(XENON);
    await xenon.click();
    await expect(xenon).not.toHaveAttribute('data-form', 'dot');
    await expect.poll(() => xenon.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
    return xenon;
}

const boxOf = (page: Page, selector: string) => page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
});

/** The body's inside: where its content can be, and how far down it is seen. */
const insideOf = (page: Page) => page.locator(`${XENON} [data-scroller="body"]`).evaluate((body) => {
    const r = body.getBoundingClientRect();
    const s = getComputedStyle(body);
    return {
        left: r.left + parseFloat(s.paddingLeft),
        right: r.right - parseFloat(s.paddingRight),
        bottom: r.top + body.clientHeight,
    };
});

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(XENON).waitFor();
});

test.describe('Tim: the field', () => {
    test('is as wide as the body, on the bottom line of its row', async ({ page }) => {
        await open(page);
        const field = await boxOf(page, `${XENON} [data-say]`);
        const inside = await insideOf(page);

        expect(field.left).toBeCloseTo(inside.left, 0);
        expect(field.right).toBeCloseTo(inside.right, 0);
    });
});

test.describe('Spike: what the host put beside it', () => {
    test('is above it, not squeezing it', async ({ page }) => {
        await open(page);
        const field = await boxOf(page, `${XENON} [data-say]`);
        const choice = await boxOf(page, `${XENON} select`);
        const button = await boxOf(page, `${XENON} [data-say] ~ button, ${XENON} button:not(.title-bar button)`);

        expect(choice.bottom).toBeLessThanOrEqual(field.top);
        expect(button.bottom).toBeLessThanOrEqual(field.top);
    });
});

test.describe('Jenny: scrolled up to the start', () => {
    test('the row is still at the bottom', async ({ page }) => {
        await open(page);
        await page.locator(`${XENON} [data-scroller="body"]`).evaluate((s) => { s.scrollTop = 0; });
        await page.waitForTimeout(100);
        const field = await boxOf(page, `${XENON} [data-say]`);
        const inside = await insideOf(page);

        expect(field.bottom).toBeLessThanOrEqual(inside.bottom + 1);
        expect(field.bottom).toBeGreaterThan(inside.bottom - 80);
    });
});
