/**
 * A field, in a real browser, under a finger.
 *
 * Selenium, the next element after the sparkline's Arsenic, opens as a window
 * holding one field. Apple Human Interface Guidelines, Virtual keyboards: the
 * layout guide "helps you keep important parts of your interface visible while
 * the virtual keyboard is onscreen" — without it, "the keyboard covers part of
 * the bottom text field".
 *
 * No emulated browser raises a keyboard. What one does to a page is shrink the
 * visual viewport and say so, which is what the page is told here: the height
 * an iPhone 15's keyboard takes, held upright.
 *
 * Personas:
 * - Tim: Happy path — the field takes a tap, at a size iOS does not zoom for
 * - Spike: Edge cases — a field by the tray takes a tap, not a browse
 * - Jenny: Complex scenarios — a window low on the screen when the keyboard comes, and goes
 */

import { test, expect, type Page } from '@playwright/test';

const SELENIUM = '[data-element-id="field-specimen"]';
const KEYBOARD = 336;

/** The keyboard comes up: the visual viewport loses its height, and says so. */
async function keyboardUp(page: Page): Promise<void> {
    await page.evaluate((height) => {
        const vv = window.visualViewport!;
        const left = window.innerHeight - height;
        Object.defineProperty(vv, 'height', { configurable: true, get: () => left });
        vv.dispatchEvent(new Event('resize'));
    }, KEYBOARD);
}

/** The keyboard goes: the visual viewport is the browser's own again. */
async function keyboardDown(page: Page): Promise<void> {
    await page.evaluate(() => {
        const vv = window.visualViewport!;
        delete (vv as unknown as Record<string, unknown>).height;
        vv.dispatchEvent(new Event('resize'));
    });
}

async function openSelenium(page: Page) {
    const selenium = page.locator(SELENIUM);
    await selenium.tap();
    await expect(selenium).toHaveAttribute('data-form', 'window');
    // data-form is written as the morph starts; the window is where it stands once it ends.
    await expect.poll(() => selenium.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
    const field = selenium.locator('input');
    await expect(field).toBeVisible();
    return { selenium, field };
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(SELENIUM).waitFor();
});

test.describe('Tim: a field takes a tap', () => {
    test('Selenium opens as a window, and its field takes the tap', async ({ page }) => {
        const { field } = await openSelenium(page);
        await field.tap();
        await expect(field).toBeFocused();
    });

    test('at a size iOS Safari does not zoom the page for', async ({ page }) => {
        const { field } = await openSelenium(page);
        const size = await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(size).toBeGreaterThanOrEqual(16);
    });
});

test.describe('Spike: a field by the tray', () => {
    test('takes a tap, and no browse starts', async ({ page }) => {
        // A host's own field, on bare page beside the tray.
        await page.evaluate(() => {
            const field = document.createElement('input');
            field.id = 'by-the-tray';
            field.style.cssText = 'position: fixed; right: 30px; top: 50%; width: 60px; font-size: 16px;';
            document.body.appendChild(field);
        });
        const field = page.locator('#by-the-tray');
        await field.tap();
        await expect(field).toBeFocused();
    });
});

test.describe('Jenny: a window low on the screen when the keyboard comes', () => {
    test('rises so its field and title bar are seen, and goes back after', async ({ page }) => {
        const { selenium, field } = await openSelenium(page);

        // Dragged by its title bar until it sits on the bottom of the screen,
        // whole: where a keyboard comes.
        const bar = selenium.locator('.title-bar');
        const opened = (await selenium.boundingBox())!;
        const grip = (await bar.boundingBox())!;
        const drop = page.viewportSize()!.height - 8 - (opened.y + opened.height);
        await page.mouse.move(grip.x + 20, grip.y + grip.height / 2);
        await page.mouse.down();
        await page.mouse.move(grip.x + 20, grip.y + grip.height / 2 + drop, { steps: 8 });
        await page.mouse.up();

        const stood = (await selenium.boundingBox())!;
        const seen = page.viewportSize()!.height - KEYBOARD;
        expect(stood.y + stood.height).toBeGreaterThan(seen);

        await field.tap();
        await keyboardUp(page);

        const risen = (await selenium.boundingBox())!;
        expect(risen.y + risen.height).toBeLessThanOrEqual(seen);
        const f = (await field.boundingBox())!;
        expect(f.y + f.height).toBeLessThanOrEqual(seen);
        const b = (await bar.boundingBox())!;
        expect(b.y).toBeGreaterThanOrEqual(0);
        await expect(field).toBeFocused();

        await keyboardDown(page);
        const back = (await selenium.boundingBox())!;
        expect(back.y).toBe(stood.y);
    });
});
