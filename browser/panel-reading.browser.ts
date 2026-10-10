/**
 * A panel on a phone reads at a phone's size, in a real browser.
 *
 * "QNTX's text and message box sized like Claude's on the phone, owned by
 * Elements so no host has to remember it."
 *
 * Krypton opens as a panel. On a touch screen the page's text in it is seen at
 * 17 (Apple Human Interface Guidelines, Typography: body text at the default
 * size), whatever size the page draws it at; with a mouse it is seen at the
 * page's own size. What is measured is the box a line of the page's text takes
 * on screen, so it is what a person sees and not what a stylesheet says.
 *
 * Personas:
 * - Tim: Happy path — on a phone the panel's text is seen at 17
 * - Spike: Edge cases — with a mouse it is seen at the page's own size
 */

import { test, expect } from '@playwright/test';

const KRYPTON = '[data-element-id="panel-specimen"]';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(KRYPTON).waitFor();
});

test('a panel\'s text is seen at 17 on a touch screen, and at the page\'s size with a mouse', async ({ page, isMobile }) => {
    const krypton = page.locator(KRYPTON);
    await krypton.click();
    await expect(krypton).toHaveAttribute('data-form', 'panel');
    await expect.poll(() => krypton.evaluate((el) => el.classList.contains('morphing'))).toBe(false);

    // A line of the page's own text, one em tall, measured where it is drawn.
    const seen = await krypton.evaluate((el) => {
        const body = el.querySelector<HTMLElement>(':scope > [data-scroller="body"]')!;
        const line = document.createElement('span');
        line.textContent = 'H';
        line.style.display = 'inline-block';
        line.style.lineHeight = '1';
        body.appendChild(line);
        const height = line.getBoundingClientRect().height;
        const drawnAt = parseFloat(getComputedStyle(body).fontSize);
        line.remove();
        return { height, drawnAt };
    });

    if (isMobile) {
        expect(seen.height).toBeCloseTo(17, 0);
    } else {
        expect(seen.height).toBeCloseTo(seen.drawnAt, 0);
    }
});
