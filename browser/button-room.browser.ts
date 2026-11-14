/**
 * A button in an element is never squeezed around its words, in a real browser.
 *
 * "NO MORE SQUEEZED BUTTONS PLEASE": a host's 4px by 8px left its words touching its edges; a finger's 44 tall on
 * 14px words was wasted space. In an element's body a button's words are an em in from each side, half an em from its
 * top and bottom (fit.ts).
 *
 * Personas:
 * - Tim: Happy path — a host's tight button in Xenon's body: its words an em in, half an em from top and bottom
 * - Spike: Edge cases — the title bar's controls keep their own box
 */

import { test, expect, type Page } from '@playwright/test';

const XENON = '[data-element-id="chat-specimen"]';

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
    test('has its words an em in from each side, half an em from its top and bottom', async ({ page }) => {
        await open(page);
        const at = await page.locator(`${XENON} [data-scroller="body"]`).evaluate(async (body) => {
            const tight = document.createElement('button');
            tight.textContent = 'codex';
            tight.style.padding = '4px 8px';
            body.prepend(tight);
            await new Promise((resolve) => setTimeout(resolve, 50));
            const s = getComputedStyle(tight);
            return { top: parseFloat(s.paddingTop), bottom: parseFloat(s.paddingBottom), left: parseFloat(s.paddingLeft), right: parseFloat(s.paddingRight), em: parseFloat(s.fontSize) };
        });

        expect(at.top).toBeCloseTo(at.em / 2, 0);
        expect(at.bottom).toBeCloseTo(at.em / 2, 0);
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
