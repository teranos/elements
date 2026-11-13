// The overlay form, in a real browser.
//
// "IF THERE ARE MESSAGES PENDING TO BE SENT, AS A COLLECTED BATCH, I SEE IT BOTTOM LEFTSIDE. SLIGHTLY TRANSPARENT. AND I CAN MOVE IT UP IF IT WANT TO."
// "IF I PRESS ON IT, IT OPENS UP FULLSCREEN."
// "AND IS ALAYS ASSOCIATED WITH ONE OTHER ELEMENT"

import { test, expect, type Page } from '@playwright/test';

const ID = 'astatine-overlay';
const overlay = (page: Page) => page.locator(`[data-element-id="${ID}"]`);
const under = (page: Page) => page.locator('[data-element-id="overlay-specimen"]');
const down = (page: Page) => overlay(page).locator('[aria-label="Back to its place"]');
const shots = process.env.OVERLAY_SHOTS;

const touching = (): boolean => !!test.info().project.use.hasTouch;
async function press(page: Page, target: ReturnType<Page['locator']>): Promise<void> {
    if (touching()) await target.tap();
    else await target.click();
}
async function shot(page: Page, name: string): Promise<void> {
    if (shots) await page.screenshot({ path: `${shots}/${test.info().project.name}-${name}.png` });
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(overlay(page)).toHaveAttribute('data-form', 'overlay');
    await under(page).scrollIntoViewIfNeeded();
    await page.evaluate((id) => {
        (window as unknown as { held?: Element | null }).held = document.querySelector(`[data-element-id="${id}"]`);
    }, ID);
});

async function expectAxiom(page: Page): Promise<void> {
    const held = await page.evaluate((id) => {
        const all = document.querySelectorAll(`[data-element-id="${id}"]`);
        return { count: all.length, same: all[0] === (window as unknown as { held?: Element }).held };
    }, ID);
    expect(held).toEqual({ count: 1, same: true });
}

test('it rests bottom left of the element it is over, slightly transparent', async ({ page }) => {
    const mine = (await overlay(page).boundingBox())!;
    const held = (await under(page).boundingBox())!;
    expect(mine.x - held.x).toBeLessThan(16);
    expect(held.y + held.height - (mine.y + mine.height)).toBeLessThan(16);
    expect(mine.x).toBeGreaterThanOrEqual(held.x);
    // Its ground lets through a little of what is behind it.
    const ground = await overlay(page).evaluate((el) => getComputedStyle(el).backgroundColor);
    const alpha = Number(ground.slice(ground.lastIndexOf(',') + 1).replace(')', ''));
    expect(alpha).toBeLessThan(1);
    expect(alpha).toBeGreaterThan(0.5);
    // What is behind it is light and shade, not words under its own.
    expect(await overlay(page).evaluate((el) => getComputedStyle(el).getPropertyValue('backdrop-filter') || getComputedStyle(el).getPropertyValue('-webkit-backdrop-filter'))).toContain('blur');
    await shot(page, '1-at-rest');
});

test('a drag moves it up, inside its element, and opens nothing', async ({ page }) => {
    const mine = (await overlay(page).boundingBox())!;
    const held = (await under(page).boundingBox())!;
    await page.mouse.move(mine.x + mine.width / 2, mine.y + mine.height / 2);
    await page.mouse.down();
    await page.mouse.move(mine.x + mine.width / 2, mine.y - 120, { steps: 6 });
    await page.mouse.up();
    await expect(overlay(page)).toHaveAttribute('data-form', 'overlay');
    const moved = (await overlay(page).boundingBox())!;
    expect(mine.y - moved.y).toBeGreaterThan(100);
    expect(moved.y).toBeGreaterThanOrEqual(held.y);
    await shot(page, '2-moved-up');
    // Dragged past the top, it stops at its element's edge.
    await page.mouse.move(moved.x + moved.width / 2, moved.y + moved.height / 2);
    await page.mouse.down();
    await page.mouse.move(moved.x + moved.width / 2, -400, { steps: 6 });
    await page.mouse.up();
    const stopped = (await overlay(page).boundingBox())!;
    expect(stopped.y).toBeGreaterThanOrEqual(held.y - 1);
    await expectAxiom(page);
});

test('a press opens it fullscreen, and the down arrow brings it back over its element', async ({ page }) => {
    const before = (await overlay(page).boundingBox())!;
    await press(page, overlay(page));
    await expect(overlay(page)).toHaveAttribute('data-form', 'panel');
    await expect(overlay(page).locator('[data-press="astatine-now"]')).toBeVisible();
    const view = page.viewportSize()!;
    await expect.poll(async () => (await overlay(page).boundingBox())!.width).toBeGreaterThanOrEqual(view.width - 1);
    await expectAxiom(page);
    await page.waitForTimeout(400);
    await shot(page, '3-open');
    // A finger swipes it down (overlay-finger.browser.ts): a phone shows no down arrow.
    if (touching()) return;
    await down(page).click();
    await expect(overlay(page)).toHaveAttribute('data-form', 'overlay');
    await expect.poll(async () => overlay(page).evaluate((el) => el.parentElement?.getAttribute('data-element-id'))).toBe('overlay-specimen');
    const after = (await overlay(page).boundingBox())!;
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
    await expectAxiom(page);
    await shot(page, '4-back');
});

test('Escape brings it back over its element, never to the tray', async ({ page }) => {
    test.skip(touching(), 'a finger has no Escape');
    await press(page, overlay(page));
    await expect(overlay(page)).toHaveAttribute('data-form', 'panel');
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await expect(overlay(page)).toHaveAttribute('data-form', 'overlay');
    await expect.poll(async () => overlay(page).evaluate((el) => el.parentElement?.getAttribute('data-element-id'))).toBe('overlay-specimen');
});
