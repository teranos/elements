/**
 * The press, in a real browser, measured at every stage it goes through, in Germanium beside Button Form.
 *
 * "I just want a preselection of sizes": its box is one of PRESS_SIZES, picked by the form it stands
 * in, and it is that box, where it stood, at rest, armed, doing, failed and at rest again, to the pixel,
 * with a mouse and with a finger, and with a host stylesheet that tries to say otherwise.
 */

import { test, expect, type Page, type Locator } from '@playwright/test';
import { PRESS_SIZES } from '../forms/press';

const press = (page: Page, id: string) => page.locator(`[data-press="germanium-${id}"]`);

const touching = (): boolean => !!test.info().project.use.hasTouch;

async function hit(target: Locator): Promise<void> {
    if (touching()) await target.tap();
    else await target.click();
}

type Box = { x: number; y: number; width: number; height: number };

// Where it stands is part of its box: a press that kept its size and moved has still jumped.
// Measured from what holds it, so a scroll of the page or the element is not taken for a jump.
async function box(target: Locator): Promise<Box> {
    return target.evaluate((el) => {
        const at = el.getBoundingClientRect();
        const holder = (el.parentElement ?? document.documentElement).getBoundingClientRect();
        return { x: at.left - holder.left, y: at.top - holder.top, width: at.width, height: at.height };
    });
}

const stageOf = (target: Locator) => target.getAttribute('data-stage');

/** Every box it had, through two presses and back to rest: one box, said as many times. */
async function boxesThrough(page: Page, id: string, presses: number): Promise<Box[]> {
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

const sameBox = (boxes: Box[]) => {
    for (const b of boxes) expect(b).toEqual(boxes[0]!);
};

const isPreset = (b: Box, size: keyof typeof PRESS_SIZES) => {
    expect(b.width).toBe(PRESS_SIZES[size].width);
    expect(b.height).toBe(PRESS_SIZES[size].height);
};

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(press(page, 'save')).toBeVisible();
});

test('one press is the same size at rest, doing, and at rest again', async ({ page }) => {
    sameBox(await boxesThrough(page, 'save', 1));
});

test('in an element placed on a canvas a press is the small box, on the bare page the large one', async ({ page }) => {
    for (const id of ['save', 'unbind', 'nuke', 'plus', 'fail']) isPreset(await box(press(page, id)), 'sm');
    isPreset(await box(press(page, 'bare')), 'lg');
});

test('what the second press does is said beside it, and the press stays where it stood', async ({ page }) => {
    const unbind = press(page, 'unbind');
    const before = await box(unbind);
    await hit(unbind);
    await expect(page.locator('[data-press-again="germanium-unbind"]')).toHaveText('again: it is unbound');
    expect(await box(unbind)).toEqual(before);
});

test('two stages are the same size at rest, armed, doing, and at rest again', async ({ page }) => {
    sameBox(await boxesThrough(page, 'unbind', 2));
});

test('the irrevocable one wears the ax frame at rest, red armed, and the same size throughout', async ({ page }) => {
    const nuke = press(page, 'nuke');
    expect(await nuke.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgba(220, 222, 221, 0.4)');
    await hit(nuke);
    expect(await nuke.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgb(220, 38, 38)');
    await hit(nuke);
    await expect(nuke).toHaveAttribute('data-stage', 'rest');
    expect(await nuke.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgba(220, 222, 221, 0.4)');
});

test('a failure is said beside it, and the press keeps its size', async ({ page }) => {
    const send = press(page, 'fail');
    const before = await box(send);
    await hit(send);
    await expect(page.locator('[data-press-said="germanium-fail"]')).toHaveText('502 from the node');
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
    // Scrolled to first: where it stands is measured, and a scroll is not the press moving.
    await press(page, 'bare').scrollIntoViewIfNeeded();
    const before = await box(press(page, 'bare'));
    await page.addStyleTag({ content: HOSTILE });
    const boxes = await boxesThrough(page, 'bare', 2);
    sameBox([before, ...boxes]);
});

test('a press that creates wears the ax frame at rest, green armed, and the same size throughout', async ({ page }) => {
    const plus = press(page, 'plus');
    expect(await plus.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgba(220, 222, 221, 0.4)');
    const before = await box(plus);
    await hit(plus);
    expect(await plus.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgb(74, 222, 128)');
    expect(await box(plus)).toEqual(before);
});
