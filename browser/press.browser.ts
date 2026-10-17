/**
 * The press, in a real browser, measured at every stage it goes through.
 *
 * Its box at rest is its box armed, doing, failed and at rest again, to the pixel,
 * with a mouse and with a finger, and with a host stylesheet that tries to say otherwise.
 */

import { test, expect, type Page, type Locator } from '@playwright/test';

const press = (page: Page, id: string) => page.locator(`[data-press="yttrium-${id}"]`);

const touching = (): boolean => !!test.info().project.use.hasTouch;

async function hit(target: Locator): Promise<void> {
    if (touching()) await target.tap();
    else await target.click();
}

async function box(target: Locator): Promise<{ width: number; height: number }> {
    const b = await target.boundingBox();
    if (!b) throw new Error('the press is not on the page');
    return { width: b.width, height: b.height };
}

const stageOf = (target: Locator) => target.getAttribute('data-stage');

/** Every box it had, through two presses and back to rest: one box, said as many times. */
async function boxesThrough(page: Page, id: string, presses: number): Promise<{ width: number; height: number }[]> {
    const target = press(page, id);
    await target.scrollIntoViewIfNeeded();
    const boxes = [await box(target)];
    for (let i = 0; i < presses; i++) {
        await hit(target);
        boxes.push(await box(target));
    }
    expect(await stageOf(target)).toBe('doing');
    await expect(target).toHaveAttribute('data-stage', 'rest');
    boxes.push(await box(target));
    return boxes;
}

const sameBox = (boxes: { width: number; height: number }[]) => {
    for (const b of boxes) expect(b).toEqual(boxes[0]!);
};

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(press(page, 'save')).toBeVisible();
});

test('one press is the same size at rest, doing, and at rest again', async ({ page }) => {
    sameBox(await boxesThrough(page, 'save', 1));
});

test('two stages are the same size at rest, armed, doing, and at rest again', async ({ page }) => {
    sameBox(await boxesThrough(page, 'unbind', 2));
});

test('the irrevocable one is white at rest, red armed, and the same size throughout', async ({ page }) => {
    const nuke = press(page, 'nuke');
    expect(await nuke.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgb(255, 255, 255)');
    await hit(nuke);
    expect(await nuke.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgb(220, 38, 38)');
    await hit(nuke);
    await expect(nuke).toHaveAttribute('data-stage', 'rest');
    expect(await nuke.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgb(255, 255, 255)');
});

test('a failure is said beside it, and the press keeps its size', async ({ page }) => {
    const send = press(page, 'fail');
    const before = await box(send);
    await hit(send);
    await expect(page.locator('[data-press-said="yttrium-fail"]')).toHaveText('502 from the node');
    expect(await box(send)).toEqual(before);
});

// A host's stylesheet that sizes a press by its stage, and its faces whatever the stage.
const HOSTILE = `[data-stage="armed"], [data-stage="doing"] { padding: 40px !important; border-width: 9px !important; font-size: 30px !important; min-height: 120px !important; line-height: 3 !important; }
[data-stage] [data-face], [data-face] { font-size: 30px !important; padding: 20px !important; display: none !important; }`;

test('a host stylesheet that sizes a press by its stage changes nothing', async ({ page }) => {
    await page.addStyleTag({ content: HOSTILE });
    sameBox(await boxesThrough(page, 'unbind', 2));
});

test('on the bare page, in no element, the same stylesheet changes nothing either', async ({ page }) => {
    const before = await box(press(page, 'bare'));
    await page.addStyleTag({ content: HOSTILE });
    const boxes = await boxesThrough(page, 'bare', 2);
    sameBox([before, ...boxes]);
});
