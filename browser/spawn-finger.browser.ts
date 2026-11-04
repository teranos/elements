/**
 * The spawn menu, in a real browser, under a finger.
 *
 * "on mobile, can't get into spawn menu"
 *
 * The unit tests have no layout and no pointer. Found by hand with a finger: held
 * still on the canvas the menu opened, and tapping an entry in it chose nothing. The
 * touch landed on the entry, but the mouse events the browser makes of a tap were
 * hit-tested again and went to what stands under the menu, which took them for a press
 * outside it and closed it. The entries were drawn away from the menu by their
 * transform alone, and a tap does not find an element there.
 *
 * Chromium's finger only: a hold is a touch that stays down, and only the devtools
 * protocol can keep one down.
 *
 * Personas:
 * - Tim: hold on the canvas, tap an entry, the entry is carried
 * - Spike: every entry takes the tap, the first and the last, drawn far from where the finger was held
 */

import { test, expect, type Page } from '@playwright/test';

const CANVAS = '[data-canvas-id="spawn-canvas"]';
const MENU = '.elements-spawn-menu[role="menu"]';
const ITEM = (title: string) => `.elements-spawn-item[aria-label="${title}"]`;
const CARRYING = '[data-spawn-scrim="carrying"]';

test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'a held touch is a devtools protocol touch');
    // The page's own clock: the hold is a timer, and the drift that moves the entries is a frame.
    await page.clock.install({ time: 0 });
    await page.goto('/');
    await page.locator(CANVAS).waitFor();
    await page.clock.pauseAt(60_000);
});

async function finger(page: Page) {
    const cdp = await page.context().newCDPSession(page);
    const send = (type: 'touchStart' | 'touchEnd', x = 0, y = 0) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    return { down: (x: number, y: number) => send('touchStart', x, y), up: () => send('touchEnd') };
}

/** Hold a finger on the canvas until the menu opens, lift, and let the entries drift a few frames. */
async function openByHolding(page: Page) {
    const touch = await finger(page);
    await page.locator(CANVAS).scrollIntoViewIfNeeded();
    const box = (await page.locator(CANVAS).boundingBox())!;
    await touch.down(box.x + box.width / 2, box.y + box.height / 2);
    await page.clock.runFor(500);
    await expect(page.locator(MENU)).toHaveCount(1);
    await touch.up();
    await page.clock.runFor(100);
    return touch;
}

/** Tap the middle of an entry, where the finger would go. */
async function tapEntry(page: Page, touch: Awaited<ReturnType<typeof finger>>, title: string) {
    const box = (await page.locator(ITEM(title)).boundingBox())!;
    await touch.down(box.x + box.width / 2, box.y + box.height / 2);
    await page.clock.runFor(60);
    await touch.up();
    await page.clock.runFor(50);
}

test.describe('Tim: a finger holds the canvas and taps an entry', () => {
    test('the entry is carried', async ({ page }) => {
        const touch = await openByHolding(page);

        await tapEntry(page, touch, 'Subcanvas');

        await expect(page.locator(CARRYING)).toHaveCount(1);
    });
});

test.describe('Spike: entries drawn far from the finger', () => {
    for (const title of ['Note', 'Subcanvas']) {
        test(`${title} takes the tap`, async ({ page }) => {
            const touch = await openByHolding(page);

            await tapEntry(page, touch, title);

            await expect(page.locator(CARRYING)).toHaveCount(1);
        });
    }
});
