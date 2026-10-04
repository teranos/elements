/**
 * The safe area, in a real browser.
 *
 * "It just takes over the entire screen and isn't pressable." Apple Human
 * Interface Guidelines, Layout: "place foreground elements like interactive
 * controls within the safe area", and let background elements fill the
 * available space.
 *
 * Emulated browsers report no insets, so the page is told an iPhone 15's, held
 * upright: 59px for the status bar and Dynamic Island, 34px for the home
 * indicator (--elements-safe-area-*, safe-area.ts).
 */

import { test, expect, type Page } from '@playwright/test';

const TOP = 59;
const BOTTOM = 34;

async function asAnIPhone(page: Page): Promise<void> {
    await page.addStyleTag({
        content: `:root { --elements-safe-area-top: ${TOP}px; --elements-safe-area-bottom: ${BOTTOM}px; }`,
    });
}

/** Where a control is, and whether a press there reaches it. */
async function reachable(page: Page, selector: string): Promise<{ top: number; bottom: number; pressable: boolean }> {
    return page.evaluate((selector) => {
        const el = document.querySelector(selector) as HTMLElement;
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { top: r.top, bottom: r.bottom, pressable: !!hit && el.contains(hit) };
    }, selector);
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-element-id="germanium-button"]').waitFor();
    await asAnIPhone(page);
});

test('full screen, it fills the screen, and its controls are inside the safe area', async ({ page }) => {
    // Krypton opens as a panel: the whole screen.
    const krypton = page.locator('[data-element-id="panel-specimen"]');
    await krypton.tap();
    await expect(krypton).toHaveAttribute('data-form', 'panel');
    await expect(krypton.locator('[aria-label="Minimize"]')).toBeVisible();

    // The background goes under the device's edges.
    const box = await krypton.boundingBox();
    expect(box!.y).toBe(0);
    expect(box!.height).toBe(page.viewportSize()!.height);

    // Every control is where a finger can reach it.
    const minimize = await reachable(page, '[data-element-id="panel-specimen"] [aria-label="Minimize"]');
    expect(minimize.top).toBeGreaterThanOrEqual(TOP);
    expect(minimize.pressable).toBe(true);

    const edge = await reachable(page, '[data-element-id="panel-specimen"] .panel-resize-handle');
    expect(edge.top).toBeGreaterThanOrEqual(TOP);
    expect(edge.bottom).toBeLessThanOrEqual(page.viewportSize()!.height - BOTTOM);

    // And the way out works.
    await krypton.locator('[aria-label="Minimize"]').tap();
    await expect(krypton).toHaveAttribute('data-form', 'dot');
});

test('a window opens inside the safe area, and is not dragged out of it', async ({ page }) => {
    const germanium = page.locator('[data-element-id="germanium-button"]');
    await germanium.tap();
    await expect(germanium.locator('[aria-label="Back to its place"]')).toBeVisible();

    const opened = await germanium.boundingBox();
    expect(opened!.y).toBeGreaterThanOrEqual(TOP);

    // Dragged by its title bar as high and as low as a finger goes.
    const bar = germanium.locator('.title-bar');
    const grip = await bar.boundingBox();
    const x = grip!.x + 20;
    const y = grip!.y + grip!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, 0, { steps: 8 });
    await page.mouse.up();
    const up = await bar.boundingBox();
    expect(up!.y).toBeGreaterThanOrEqual(TOP);

    await page.mouse.move(x, up!.y + up!.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, page.viewportSize()!.height, { steps: 8 });
    await page.mouse.up();
    const down = await bar.boundingBox();
    expect(down!.y + down!.height).toBeLessThanOrEqual(page.viewportSize()!.height - BOTTOM);

    const back = await reachable(page, '[data-element-id="germanium-button"] [aria-label="Back to its place"]');
    expect(back.pressable).toBe(true);
});
