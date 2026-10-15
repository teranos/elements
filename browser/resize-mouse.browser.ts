/**
 * A window takes the size it is dragged to, and what it holds fills it, in a real browser.
 *
 * "want to be able to rezise it and have it actually respect my resize,
 * horizontally and vertically" (#40). A host that gives its content a fixed size
 * (520 by 640 in the one this came from) left the content that size inside a
 * window dragged bigger. Once a person gives a window a size, what it holds fills it.
 *
 * Personas:
 * - Tim: Happy path — dragged bigger both ways, the host's fixed-size content fills it
 * - Spike: Edge cases — before a drag, the content is the size the host drew it
 * - Jenny: Complex scenarios — to the tray and back, it opens at the dragged size, filled
 */

import { test, expect, type Page } from '@playwright/test';

const SELENIUM = '[data-element-id="field-specimen"]';

async function open(page: Page) {
    const selenium = page.locator(SELENIUM);
    await selenium.click();
    await expect(selenium).toHaveAttribute('data-form', 'window');
    await expect.poll(() => selenium.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
    return selenium;
}

/** The host's content, and the room the body gives it. */
const fit = (page: Page) => page.locator(`${SELENIUM} [data-scroller="body"]`).evaluate((body) => {
    const content = body.firstElementChild as HTMLElement;
    const style = getComputedStyle(body);
    return {
        width: content.getBoundingClientRect().width,
        height: content.getBoundingClientRect().height,
        roomWidth: body.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        roomHeight: body.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
    };
});

async function dragCorner(page: Page, dx: number, dy: number) {
    const corner = (await page.locator(`${SELENIUM} > .resize-handle`).boundingBox())!;
    const x = corner.x + corner.width / 2;
    const y = corner.y + corner.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(SELENIUM).waitFor();
    // A host that sizes its content itself.
    await page.addStyleTag({ content: `${SELENIUM} [data-scroller="body"] > * { width: 240px; height: 120px; }` });
});

test.describe('Tim: dragged bigger both ways', () => {
    test('the host\'s fixed-size content fills the window', async ({ page }) => {
        await open(page);
        await dragCorner(page, 200, 150);

        const at = await fit(page);
        expect(at.width).toBeCloseTo(at.roomWidth, 0);
        expect(at.height).toBeGreaterThanOrEqual(at.roomHeight - 1);
    });
});

test.describe('Spike: before a drag', () => {
    test('the content is the size the host drew it', async ({ page }) => {
        await open(page);

        const at = await fit(page);
        expect(at.width).toBe(240);
        expect(at.height).toBe(120);
    });
});

test.describe('Jenny: to the tray and back', () => {
    test('it opens at the dragged size, filled', async ({ page }) => {
        const selenium = await open(page);
        await dragCorner(page, 200, 150);
        const dragged = (await selenium.boundingBox())!;
        await selenium.locator('[aria-label="Minimize"]').click();
        await expect(selenium).toHaveAttribute('data-form', 'dot');
        await open(page);

        const back = (await selenium.boundingBox())!;
        expect(back.width).toBeCloseTo(dragged.width, 0);
        expect(back.height).toBeCloseTo(dragged.height, 0);
        const at = await fit(page);
        expect(at.width).toBeCloseTo(at.roomWidth, 0);
    });
});
