/**
 * The button form, in a real browser.
 *
 * "It really feels like a button. Until you click it and your entire conceptual
 * model of what UI could be shatters." Every bug here was first found by hand:
 * the first frame started somewhere it never was, ↓ after the tray opened it
 * again, two taps on the hole only located, and the label was thrown away on
 * open. Each is asked of the browser itself, with a mouse and with a finger.
 */

import { test, expect, type Page } from '@playwright/test';

const ID = 'germanium-button';
const element = (page: Page) => page.locator(`[data-element-id="${ID}"]`);
const hole = (page: Page) => page.locator('.button-gap');
const down = (page: Page) => element(page).locator('[aria-label="Back to its place"]');
const formOf = (page: Page) => element(page).getAttribute('data-form');

/** Whether this device is a finger. */
const touching = (): boolean => !!test.info().project.use.hasTouch;

/** A press as this device makes one: a finger taps, a mouse clicks. */
async function press(page: Page, target: ReturnType<Page['locator']>): Promise<void> {
    if (touching()) await target.tap();
    else await target.click();
}

/** "An element is exactly one DOM element for its entire lifetime." Asked in the page. */
async function expectAxiom(page: Page): Promise<void> {
    const held = await page.evaluate((id) => {
        const all = document.querySelectorAll(`[data-element-id="${id}"]`);
        const kept = (window as unknown as { held?: Element }).held;
        return { count: all.length, same: all[0] === kept };
    }, ID);
    expect(held.count).toBe(1);
    expect(held.same).toBe(true);
}

/** Its own words, one node for its whole life. */
async function expectSameLabel(page: Page): Promise<void> {
    const same = await page.evaluate((id) => {
        const el = document.querySelector(`[data-element-id="${id}"]`);
        const kept = (window as unknown as { label?: Element }).label;
        return !!kept && !!el && el.contains(kept) && kept.textContent === 'Press Please';
    }, ID);
    expect(same).toBe(true);
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await element(page).waitFor();
    // Held from the start, so every later step can ask whether it is still the one.
    await page.evaluate((id) => {
        const el = document.querySelector(`[data-element-id="${id}"]`)!;
        (window as unknown as { held: Element }).held = el;
        (window as unknown as { label: Element | null }).label = el.querySelector('.button-label');
    }, ID);
});

test('a press: the button itself becomes the window, and a hole is where it was', async ({ page }) => {
    await press(page, element(page));
    await expect(element(page)).toHaveAttribute('data-form', /window|panel/);
    await expect(hole(page)).toHaveCount(1);
    await expectAxiom(page);
    await expectSameLabel(page);
    // A hole through Germanium, not a gap on top of it.
    const pierced = await page.evaluate(() => {
        const holder = document.querySelector('.button-gap')!.closest('.canvas-button-specimen') as HTMLElement;
        const style = getComputedStyle(holder);
        return (style.maskImage || style.getPropertyValue('-webkit-mask-image')) !== 'none';
    });
    expect(pierced).toBe(true);
});

test('the first frame starts where the button is', async ({ page }) => {
    const was = await element(page).boundingBox();
    await press(page, element(page));
    // Frozen at its very first frame, whatever the clock did meanwhile.
    const at = await page.evaluate((id) => {
        const el = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement;
        const road = el.getAnimations().find((a) => (a.effect as KeyframeEffect).getKeyframes().some((k) => 'left' in k));
        if (!road) return null;
        road.pause();
        road.currentTime = 0;
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
    }, ID);
    expect(at).not.toBeNull();
    expect(Math.abs(at!.x - was!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(at!.y - was!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(at!.width - was!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(at!.height - was!.height)).toBeLessThanOrEqual(1);
});

test('↓ brings it back to its place as a button', async ({ page }) => {
    await press(page, element(page));
    await expect(down(page)).toBeVisible();
    await press(page, down(page));
    await expect(element(page)).toHaveAttribute('data-form', 'button');
    await expect(hole(page)).toHaveCount(0);
    await expect(element(page)).toHaveText('Press Please');
    await expectAxiom(page);
    await expectSameLabel(page);
});

test('through the tray and out again, ↓ still brings it back to its place', async ({ page }) => {
    await press(page, element(page));
    await press(page, element(page).locator('[aria-label="Minimize"]'));
    await expect(element(page)).toHaveAttribute('data-form', 'dot');
    await press(page, element(page));
    await expect(element(page)).toHaveAttribute('data-form', /window|panel/);
    if (!touching()) {
        // A person leaves the dot they pressed and comes to ↓ across the window,
        // so the tray they left is no longer reaching out under the pointer.
        const body = await element(page).boundingBox();
        const arrow = await down(page).boundingBox();
        await page.mouse.move(body!.x + 10, body!.y + body!.height - 10, { steps: 10 });
        await page.mouse.move(arrow!.x + arrow!.width / 2, arrow!.y + arrow!.height / 2, { steps: 10 });
    }
    await press(page, down(page));
    await expect(element(page)).toHaveAttribute('data-form', 'button');
    // Not opened again by the same press.
    await page.waitForTimeout(800);
    expect(await formOf(page)).toBe('button');
    await expectAxiom(page);
    await expectSameLabel(page);
});

test('twice on the hole, as this device does it twice, brings it back', async ({ page }) => {
    await press(page, element(page));
    await expect(hole(page)).toHaveCount(1);
    // Opened, not opening: until then the window is still on its way to where it settles.
    await expect(down(page)).toBeVisible();
    // The window may lie over the hole; the hole is pressed where it is, as a person would after moving the window.
    await page.evaluate((id) => {
        const el = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement;
        el.style.left = `${window.innerWidth - el.offsetWidth}px`;
        el.style.top = `${window.innerHeight - el.offsetHeight}px`;
    }, ID);
    if (touching()) {
        // A thumb's double tap: two taps on the same spot, with nothing between
        // them. Each locator tap waits for the page to settle first, which on a
        // slow runner put more than the hole's 300ms between them.
        const at = await hole(page).boundingBox();
        const x = at!.x + at!.width / 2;
        const y = at!.y + at!.height / 2;
        const started = Date.now();
        await page.touchscreen.tap(x, y);
        await page.touchscreen.tap(x, y);
        expect(Date.now() - started, 'the two taps were a double tap').toBeLessThan(300);
    } else {
        await hole(page).dblclick();
    }
    await expect(element(page)).toHaveAttribute('data-form', 'button');
    await expect(hole(page)).toHaveCount(0);
    await expectAxiom(page);
});

test('once on the hole: the window blinks its border twice where it is', async ({ page }) => {
    await press(page, element(page));
    await expect(down(page)).toBeVisible();
    await page.evaluate((id) => {
        const el = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement;
        el.style.left = `${window.innerWidth - el.offsetWidth}px`;
        el.style.top = `${window.innerHeight - el.offsetHeight}px`;
    }, ID);
    await press(page, hole(page));
    const blinked = await page.waitForFunction((id) => {
        const el = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement;
        return el.getAnimations().some((a) =>
            (a.effect as KeyframeEffect).getKeyframes().filter((k) => k.borderColor === 'transparent').length === 2);
    }, ID);
    expect(await blinked.jsonValue()).toBe(true);
    expect(await formOf(page)).toMatch(/window|panel/);
});
