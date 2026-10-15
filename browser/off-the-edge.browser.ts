/**
 * Nothing in an element runs off its edge, in a real browser.
 *
 * "This, I never want to have happen": a status line in a panel on a phone ran
 * off the right edge, cut off, and the version it said could not be read. Since
 * nothing scrolls sideways, what does not fit was simply gone. Inside an element,
 * text breaks to the width it has, and no host makes it run on.
 *
 * Personas:
 * - Tim: Happy path — a line of one long word in Krypton is seen whole
 * - Spike: Edge cases — a host that says never break changes nothing
 * - Jenny: Complex scenarios — a row of items side by side, each long, is seen whole
 */

import { test, expect, type Page } from '@playwright/test';

const KRYPTON = '[data-element-id="panel-specimen"]';
const URL = 'did:key:z6MkoP1H4cbfRLshm2kZN9D3Agpi8tfh7pnj8y1v7TmAU3Xqez6MkoP1H4cbfRLshm2kZN9D3Agpi8tfh7pnj8y1v7TmAU3Xqe';

async function open(page: Page) {
    const krypton = page.locator(KRYPTON);
    await krypton.click();
    await expect(krypton).toHaveAttribute('data-form', 'panel');
    await expect.poll(() => krypton.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
}

/** Put this in Krypton's body, first, and say whether all of it is inside the body. */
const seenWhole = (page: Page, html: string) => page.locator(`${KRYPTON} [data-scroller="body"]`).evaluate((body, html) => {
    const holder = document.createElement('div');
    holder.innerHTML = html;
    body.prepend(holder);
    const inside = body.getBoundingClientRect();
    return [...holder.querySelectorAll('*'), holder].every((el) => el.getBoundingClientRect().right <= inside.right + 0.5);
}, html);

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(KRYPTON).waitFor();
});

test.describe('Tim: one long word', () => {
    test('is seen whole', async ({ page }) => {
        await open(page);

        expect(await seenWhole(page, `<span>${URL}</span>`)).toBe(true);
    });
});

test.describe('Spike: a host that says never break', () => {
    test('changes nothing', async ({ page }) => {
        await page.addStyleTag({ content: `${KRYPTON} * { overflow-wrap: normal !important; word-break: keep-all !important; }` });
        await open(page);

        expect(await seenWhole(page, `<span>${URL}</span>`)).toBe(true);
    });
});

test.describe('Jenny: a row of long items side by side', () => {
    test('is seen whole', async ({ page }) => {
        await open(page);

        expect(await seenWhole(page, `<div style="display: flex; gap: 8px"><span>+ cleanAPI 0.6.12</span><span>+ datapunt 0.3.12-f95f8b2dd930fbfd</span><span>+ inbox ${URL}</span></div>`)).toBe(true);
    });
});
