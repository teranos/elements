/**
 * A window by the tray keeps its buttons, in a real browser.
 *
 * The tray sits above every window, and its dots grow toward a pointer near
 * them. Selenium against the right edge, beside the tray: going for its
 * Minimize brought the pointer near the dots, they grew over it, and the press
 * opened a dot instead. A pointer on an open element is on that element.
 *
 * Personas:
 * - Tim: Happy path — Selenium against the right edge is minimized by its own Minimize
 * - Jenny: Complex scenarios — off the window and onto a dot, the dots grow again
 */

import { test, expect, type Page } from '@playwright/test';

const SELENIUM = '[data-element-id="field-specimen"]';

/** Selenium open, its right edge against the screen's, its title bar level with the tray. */
async function besideTheTray(page: Page) {
    const selenium = page.locator(SELENIUM);
    await selenium.click();
    await expect(selenium).toHaveAttribute('data-form', 'window');
    await expect.poll(() => selenium.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
    await selenium.evaluate((el) => {
        const tray = document.querySelector('.dot')!.parentElement!.getBoundingClientRect();
        el.style.left = `${innerWidth - el.getBoundingClientRect().width}px`;
        el.style.top = `${tray.top + tray.height / 2 - 16}px`;
    });
    return selenium;
}

/** From one point to another in about 400ms, as a hand moves: the dots have time to answer. */
async function moveAsAHand(page: Page, x0: number, y0: number, x1: number, y1: number) {
    for (let i = 1; i <= 12; i++) {
        await page.mouse.move(x0 + ((x1 - x0) * i) / 12, y0 + ((y1 - y0) * i) / 12);
        await page.waitForTimeout(30);
    }
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(SELENIUM).waitFor();
});

test.describe('Tim: a window against the right edge', () => {
    test('its Minimize, reached with the mouse, minimizes it', async ({ page }) => {
        const selenium = await besideTheTray(page);
        const minimize = (await selenium.locator('[aria-label="Minimize"]').boundingBox())!;

        // From the window's far side, past the tray's reach, as a person comes to it.
        const box = (await selenium.boundingBox())!;
        await page.mouse.move(box.x + 8, box.y + box.height / 2, { steps: 6 });
        // The dots grown for the press that opened it are back at rest by the time a hand moves.
        await expect.poll(() => page.locator('.dot').first().evaluate((d) => d.getBoundingClientRect().width)).toBeLessThan(11);
        await moveAsAHand(page, box.x + 8, box.y + box.height / 2, minimize.x + minimize.width / 2, minimize.y + minimize.height / 2);
        await page.mouse.down();
        await page.mouse.up();

        await expect(selenium).toHaveAttribute('data-form', 'dot');
    });
});

test.describe('Jenny: off the window and onto a dot', () => {
    test('the dots grow again', async ({ page }) => {
        await besideTheTray(page);
        const dot = page.locator('.dot').first();
        const rest = (await dot.boundingBox())!.width;
        const at = (await dot.boundingBox())!;

        await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2, { steps: 6 });

        await expect.poll(async () => (await dot.boundingBox())!.width).toBeGreaterThan(rest);
    });
});
