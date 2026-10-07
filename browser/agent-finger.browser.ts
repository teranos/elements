/**
 * QNTX's Pi element on a phone, in a real browser, under a finger.
 *
 * Polonium stands in for it (examples/agent.ts): content wider than a phone,
 * so it opens as a full-screen panel. On an iPhone 15 its "Say" box ran past
 * the bottom of the screen, a keyboard covered it, and the tray's dots sat over
 * the words.
 *
 * No emulated browser raises a keyboard; the page is told what one does: the
 * visual viewport loses the height an iPhone 15's keyboard takes, upright.
 *
 * Personas:
 * - Tim: Happy path — it opens full screen, its box on the screen, its words clear of the tray
 * - Jenny: Complex scenarios — the keyboard comes for the box, and goes
 */

import { test, expect, type Page } from '@playwright/test';

const POLONIUM = '[data-element-id="agent-specimen"]';
const KEYBOARD = 336;

async function open(page: Page) {
    const polonium = page.locator(POLONIUM);
    await polonium.tap();
    await expect(polonium).toHaveAttribute('data-form', 'panel');
    await expect.poll(() => polonium.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
    return { polonium, says: polonium.locator('textarea') };
}

/** Where a box ends, in the coordinates a fixed element is placed in (WebKit measures from the visual viewport). */
const bottomOf = (page: Page, selector: string) => page.evaluate((s) => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position: fixed; top: 0; left: 0; width: 1px; height: 1px; visibility: hidden';
    document.body.appendChild(probe);
    const shift = probe.getBoundingClientRect().top;
    probe.remove();
    return document.querySelector(s)!.getBoundingClientRect().bottom - shift;
}, selector);

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(POLONIUM).waitFor();
});

test.describe('Tim: Pi, full screen on a phone', () => {
    test('its box to say something in is on the screen', async ({ page }) => {
        await open(page);
        const height = await page.evaluate(() => window.innerHeight);
        expect(await bottomOf(page, `${POLONIUM} textarea`)).toBeLessThanOrEqual(height);
    });

    test('its words are clear of the tray\'s dots', async ({ page }) => {
        const { polonium } = await open(page);
        const [words, tray] = await Promise.all([
            polonium.locator('.tr-col').evaluate((el) => el.getBoundingClientRect().right),
            page.locator('.tray').evaluate((el) => el.getBoundingClientRect().left),
        ]);
        expect(words).toBeLessThanOrEqual(tray);
    });
});

test.describe('Jenny: the keyboard comes for the box, and goes', () => {
    test('the box stays above the keyboard, and the panel is full screen again after', async ({ page }) => {
        const { polonium, says } = await open(page);
        await says.tap();
        await expect(says).toBeFocused();

        await page.evaluate((height) => {
            const vv = window.visualViewport!;
            const left = window.innerHeight - height;
            Object.defineProperty(vv, 'height', { configurable: true, get: () => left });
            vv.dispatchEvent(new Event('resize'));
        }, KEYBOARD);
        const seen = await page.evaluate(() => window.visualViewport!.offsetTop + window.visualViewport!.height);
        await expect.poll(() => bottomOf(page, `${POLONIUM} textarea`)).toBeLessThanOrEqual(seen);

        await page.evaluate(() => {
            const vv = window.visualViewport!;
            delete (vv as unknown as Record<string, unknown>).height;
            vv.dispatchEvent(new Event('resize'));
        });
        const height = await page.evaluate(() => window.innerHeight);
        await expect.poll(() => bottomOf(page, POLONIUM)).toBeGreaterThanOrEqual(height - 1);
        expect(await polonium.getAttribute('data-form')).toBe('panel');
    });
});
