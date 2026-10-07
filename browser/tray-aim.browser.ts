/**
 * A tray dot stays where the pointer aimed, in a real browser.
 *
 * Measured on the specimens page: Lithium's dot grew from 20×20 to 220×32 as the
 * pointer reached it, and moved up 52px, because every dot in the column grew
 * and the column, centred on the screen, pushed them apart. The point aimed at was
 * Beryllium's by then: a click there opened Beryllium, or, landing between two
 * dots, nothing. Under load, 9 of 40 clicks on a dot opened nothing.
 *
 * Personas:
 * - Tim: Happy path — the pointer arrives where Lithium's dot was; it is still Lithium, and a click opens it
 * - Spike: Edge cases — the same for the last dot in the column, Krypton
 */

import { test, expect, type Page } from '@playwright/test';

/** Where a dot sits at rest, then the pointer brought there the way a hand brings it: from the left, in steps. */
async function aimAt(page: Page, id: string): Promise<{ x: number; y: number }> {
    const dot = page.locator(`[data-element-id="${id}"]`);
    await dot.waitFor();
    const box = (await dot.boundingBox())!;
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(at.x - 200, at.y);
    await page.mouse.move(at.x, at.y, { steps: 12 });
    await page.waitForTimeout(200);
    return at;
}

const under = (page: Page, at: { x: number; y: number }) => page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return (hit?.closest('[data-element-id]') as HTMLElement | null)?.dataset.elementId ?? hit?.className ?? null;
}, at);

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test.describe('Tim: aimed at, a dot is still there', () => {
    test('the pointer arrives where Lithium was, and it is Lithium that is there, and opens', async ({ page }) => {
        const at = await aimAt(page, 'placement-2');

        expect(await under(page, at)).toBe('placement-2');
        await page.mouse.click(at.x, at.y);
        await expect(page.locator('[data-element-id="placement-2"]')).toHaveAttribute('data-form', /window|panel/);
    });
});

test.describe('Spike: the last dot in the column', () => {
    test('Krypton is still under the pointer that aimed at it', async ({ page }) => {
        const at = await aimAt(page, 'panel-specimen');

        expect(await under(page, at)).toBe('panel-specimen');
    });
});
