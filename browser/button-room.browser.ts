/**
 * A button in an element is never squeezed around its words, in a real browser.
 *
 * "NO MORE SQUEEZED BUTTONS PLEASE": a host's 4px by 8px left its words touching its edges. In an element's body a
 * button is a finger tall (FINGER, fit.ts), its words an em in from each side.
 *
 * Personas:
 * - Tim: Happy path — a host's tight button in Xenon's body is a finger tall, its words an em in
 * - Spike: Edge cases — the title bar's controls keep their own box
 */

import { test, expect, type Page } from '@playwright/test';

const XENON = '[data-element-id="chat-specimen"]';
const FINGER = 44;

async function open(page: Page) {
    const xenon = page.locator(XENON);
    await xenon.click();
    await expect(xenon).not.toHaveAttribute('data-form', 'dot');
    await expect.poll(() => xenon.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(XENON).waitFor();
});

test.describe('Tim: a host\'s tight button', () => {
    test('is a finger tall, its words an em in from each side', async ({ page }) => {
        await open(page);
        const at = await page.locator(`${XENON} [data-scroller="body"]`).evaluate(async (body) => {
            const tight = document.createElement('button');
            tight.textContent = 'codex';
            tight.style.padding = '4px 8px';
            body.prepend(tight);
            await new Promise((resolve) => setTimeout(resolve, 50));
            const s = getComputedStyle(tight);
            return { height: tight.getBoundingClientRect().height, left: parseFloat(s.paddingLeft), right: parseFloat(s.paddingRight), em: parseFloat(s.fontSize) };
        });

        expect(at.height).toBeGreaterThanOrEqual(FINGER - 0.5);
        expect(at.left).toBeCloseTo(at.em, 0);
        expect(at.right).toBeCloseTo(at.em, 0);
    });
});

test.describe('Spike: the title bar', () => {
    test('its controls keep their own box', async ({ page }) => {
        await open(page);
        const padding = await page.locator(XENON).evaluate((el) => {
            const control = el.querySelector<HTMLElement>(':scope > :not([data-scroller]) button');
            return control ? getComputedStyle(control).paddingLeft : null;
        });

        expect(padding).not.toBe('1em');
    });
});
