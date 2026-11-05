// "the very non standard way of positioning things in elements itself, and it starts at the example"
// A canvas-placed element lands where it says it does, in a real browser. The test DOMs have no
// layout, so a left and a top written on an element that nothing positioned looked right in every one.

import { test, expect, type Page } from '@playwright/test';

/** The specimens that are canvas-placed (examples/), each in the canvas it stands in. */
const PLACED = ['border-specimen', 'tooltip-specimen', 'button-specimen', 'sparkline-specimen', 'table-specimen'];

/** Where an element says it stands, from what it carries, and where it is, from where the browser put it. */
async function declaredAndLanded(page: Page, id: string) {
    return page.locator(`[data-element-id="${id}"]`).evaluate((element) => {
        const canvas = element.parentElement!.getBoundingClientRect();
        const box = element.getBoundingClientRect();
        const style = (element as HTMLElement).style;
        return {
            said: { x: parseFloat(style.left), y: parseFloat(style.top), width: parseFloat(style.width), height: parseFloat(style.height) },
            landed: { x: Math.round(box.x - canvas.x), y: Math.round(box.y - canvas.y), width: Math.round(box.width), height: Math.round(box.height) },
            position: getComputedStyle(element).position,
        };
    });
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-element-id="border-specimen"]').waitFor();
});

test.describe('Tim: a canvas-placed element lands where it says', () => {
    for (const id of PLACED) {
        test(`${id} stands at its left and top in its canvas`, async ({ page }) => {
            const { said, landed, position } = await declaredAndLanded(page, id);
            expect(position).toBe('absolute');
            expect(landed).toEqual(said);
        });
    }
});

test.describe('Spike: what a page says does not move it', () => {
    test('a page that says nothing about position still gets it where it said', async ({ page }) => {
        // The specimens page writes no rule for a canvas-placed element's position. The package does.
        const rules = await page.evaluate(() => Array.from(document.styleSheets)
            .flatMap((sheet) => { try { return Array.from(sheet.cssRules); } catch { return []; } })
            .map((rule) => rule.cssText)
            .filter((text) => text.includes('canvas-element') && text.includes('position')));
        expect(rules).toEqual([]);
        expect((await declaredAndLanded(page, 'border-specimen')).position).toBe('absolute');
    });
});

test.describe('Spike: one stage for every specimen', () => {
    // Each example once built its own box: position, a literal height, a canvas id. One does it.
    for (const id of PLACED) {
        test(`${id} stands in a stage`, async ({ page }) => {
            const stage = await page.locator(`[data-element-id="${id}"]`).evaluate((element) => {
                const canvas = element.parentElement!;
                return { staged: canvas.hasAttribute('data-stage'), position: getComputedStyle(canvas).position, canvasId: canvas.dataset.canvasId };
            });
            expect(stage.staged).toBe(true);
            expect(stage.position).toBe('relative');
            expect(stage.canvasId).toMatch(/-canvas$/);
        });
    }
});

test.describe('Jenny: out to a window and back', () => {
    test('Uranium opened as a window and put back lands where it started', async ({ page }) => {
        const before = await declaredAndLanded(page, 'border-specimen');
        const uranium = page.locator('[data-element-id="border-specimen"]');
        await uranium.getByTitle('Expand to window').click();
        await expect(uranium).toHaveAttribute('data-form', 'window');
        await expect.poll(() => uranium.evaluate((el) => el.classList.contains('morphing'))).toBe(false);

        // The window's own close puts it back on its canvas.
        await uranium.locator('.title-bar button').last().click();
        await expect(uranium).toHaveAttribute('data-form', 'canvasPlaced');
        await expect.poll(() => uranium.evaluate((el) => el.classList.contains('morphing'))).toBe(false);

        const after = await declaredAndLanded(page, 'border-specimen');
        expect(after.position).toBe('absolute');
        expect(after.landed).toEqual(before.landed);
    });
});
