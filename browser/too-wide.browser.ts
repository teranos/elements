// "what i wanted is for the thing to just drop dead when this happens"
// An element whose content is wider than it drops dead, in a real browser.

import { test, expect, type Page } from '@playwright/test';

const KRYPTON = '[data-element-id="panel-specimen"]';
const BODY = `${KRYPTON} > [data-scroller="body"]`;

async function open(page: Page) {
    const krypton = page.locator(KRYPTON);
    await krypton.click();
    await expect(krypton).toHaveAttribute('data-form', 'panel');
    await expect.poll(() => krypton.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
}

/** Put this first in Krypton's body, under an id to take it out by. */
const put = (page: Page, html: string) => page.locator(BODY).evaluate((body, html) => {
    const holder = document.createElement('div');
    holder.id = 'put';
    holder.innerHTML = html;
    body.prepend(holder);
}, html);

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(KRYPTON).waitFor();
});

test.describe('Tim: content that fits', () => {
    test('is alive', async ({ page }) => {
        await open(page);
        await put(page, '<p>a line that wraps to the width it has</p>');

        await expect(page.locator(BODY)).not.toHaveAttribute('data-too-wide');
        await expect(page.locator(`${BODY} > [data-too-wide-notice]`)).toHaveCount(0);
    });
});

test.describe('Spike: content wider than the element', () => {
    test('drops it dead: hidden, and it says how wide and what reaches past the edge', async ({ page }) => {
        await open(page);
        // A box placed past the edge stays where it was placed: what the package's fit (fit.ts) cannot move.
        await put(page, '<div style="position: relative"><div class="wide" style="position: absolute; left: 2000px; width: 100px">past any screen</div></div>');

        await expect(page.locator(BODY)).toHaveAttribute('data-too-wide', /^\d+px in \d+px$/);
        const notice = page.locator(`${BODY} > [data-too-wide-notice]`);
        await expect(notice).toBeVisible();
        await expect(notice).toContainText('TOO WIDE');
        expect(await page.locator('#put').evaluate((el) => getComputedStyle(el).visibility)).toBe('hidden');

        await page.locator('#put').evaluate((el) => { el.remove(); });

        await expect(page.locator(BODY)).not.toHaveAttribute('data-too-wide');
        await expect(page.locator(`${BODY} > [data-too-wide-notice]`)).toHaveCount(0);
    });
});

// "no element should have content that isnt accesible"
test.describe('Jenny: a row a host held on one line', () => {
    test('wraps, and stays alive', async ({ page }) => {
        await open(page);
        const press = ['Disable GitHub on the node', 'Set the path', 'Generate a new secret', 'Turn the runner off', 'System’s GitHub'];
        await put(page, `<div style="white-space: nowrap">${[...press, ...press, ...press].map((p) => `<button>${p}</button>`).join('')}</div>`);

        await expect(page.locator(BODY)).not.toHaveAttribute('data-too-wide');
        await expect(page.locator(`${BODY} > [data-too-wide-notice]`)).toHaveCount(0);
        expect(await page.locator(BODY).evaluate((body) => body.scrollWidth <= body.clientWidth + 1)).toBe(true);
    });

    test('every specimen, opened on this screen, fits it', async ({ page }) => {
        test.setTimeout(300_000);
        const ids = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[data-element-id]'), (el) => el.dataset.elementId!));
        const dead: string[] = [];
        for (const id of ids) {
            await page.goto('/');
            const element = page.locator(`[data-element-id="${id}"]`).first();
            await element.click();
            await expect.poll(() => element.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
            const wide = await element.evaluate((el) => Array.from(el.querySelectorAll<HTMLElement>('[data-scroller="body"], [data-scroller="declared"]'))
                .filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => `${s.scrollWidth}px in ${s.clientWidth}px`));
            if (wide.length) dead.push(`${id}: ${wide.join(', ')}`);
        }
        expect(dead).toEqual([]);
    });
});
