/**
 * A field in a panel, in a real browser, under a finger, with a keyboard.
 *
 * Krypton opens as a panel, the whole screen on a phone, and its last row is a
 * field. Apple Human Interface Guidelines, Virtual keyboards: the layout guide
 * "helps you keep important parts of your interface visible while the virtual
 * keyboard is onscreen".
 *
 * No emulated browser raises a keyboard. What one does to a page is shrink the
 * visual viewport and say so, which is what the page is told here: the height
 * an iPhone 15's keyboard takes, held upright.
 *
 * Personas:
 * - Tim: Happy path — the field and the title bar are both seen above the keyboard
 * - Jenny: Complex scenarios — the keyboard goes, and the panel is the whole screen again
 */

import { test, expect, type Page } from '@playwright/test';

const KRYPTON = '[data-element-id="panel-specimen"]';
const KEYBOARD = 336;

async function keyboardUp(page: Page): Promise<void> {
    await page.evaluate((height) => {
        const vv = window.visualViewport!;
        const left = window.innerHeight - height;
        Object.defineProperty(vv, 'height', { configurable: true, get: () => left });
        vv.dispatchEvent(new Event('resize'));
    }, KEYBOARD);
}

async function keyboardDown(page: Page): Promise<void> {
    await page.evaluate(() => {
        const vv = window.visualViewport!;
        delete (vv as unknown as Record<string, unknown>).height;
        vv.dispatchEvent(new Event('resize'));
    });
}

/** Rects in the coordinates a fixed element is placed in: WebKit measures from the visual viewport. */
const placed = (page: Page, selector: string) => page.evaluate((s) => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position: fixed; top: 0; left: 0; width: 1px; height: 1px; visibility: hidden';
    document.body.appendChild(probe);
    const shift = probe.getBoundingClientRect().top;
    probe.remove();
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { top: r.top - shift, bottom: r.bottom - shift };
}, selector);

const seen = (page: Page) => page.evaluate(() => ({
    top: window.visualViewport!.offsetTop,
    bottom: window.visualViewport!.offsetTop + window.visualViewport!.height,
}));

async function open(page: Page) {
    const krypton = page.locator(KRYPTON);
    await krypton.tap();
    await expect(krypton).toHaveAttribute('data-form', 'panel');
    await expect.poll(() => krypton.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
    return { krypton, field: krypton.locator('input') };
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(KRYPTON).waitFor();
});

test.describe('Tim: the keyboard comes for the field at the end of a panel', () => {
    test('the field and the title bar are both seen above it', async ({ page }) => {
        const { field } = await open(page);
        await field.tap();
        await expect(field).toBeFocused();

        await keyboardUp(page);
        const area = await seen(page);

        await expect.poll(async () => (await placed(page, `${KRYPTON} input`)).bottom).toBeLessThanOrEqual(area.bottom);
        expect((await placed(page, `${KRYPTON} > .title-bar`)).top).toBeGreaterThanOrEqual(area.top);
    });
});

test.describe('Jenny: the keyboard goes', () => {
    test('the panel is the whole screen again, and still a panel', async ({ page }) => {
        const { krypton, field } = await open(page);
        await field.tap();
        await keyboardUp(page);
        await keyboardDown(page);

        const height = await page.evaluate(() => window.innerHeight);
        await expect.poll(async () => (await placed(page, KRYPTON)).bottom).toBeGreaterThanOrEqual(height - 1);
        expect(await krypton.getAttribute('data-form')).toBe('panel');
    });
});
