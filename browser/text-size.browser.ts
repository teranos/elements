/**
 * Text size is the package's, in a real browser.
 *
 * "Text size needs to be owned by Elements entirely and misuse should result
 * into compilation error." The compiler stops a size not in the set; this shows
 * what it cannot see is inert: a host's stylesheet, even important, and a style
 * attribute. Krypton, a panel, is the element.
 *
 * Personas:
 * - Tim: Happy path — a panel's text is at the package's 11, whatever the page's own rules say
 * - Spike: Edge cases — a host's important rule and a style attribute, even important, change nothing
 * - Jenny: Complex scenarios — a node sized lg is at 14, and a dot's symbol is not the rule's
 */

import { test, expect, type Page } from '@playwright/test';

const KRYPTON = '[data-element-id="panel-specimen"]';

async function openKrypton(page: Page) {
    const krypton = page.locator(KRYPTON);
    await krypton.click();
    await expect(krypton).toHaveAttribute('data-form', 'panel');
    await expect.poll(() => krypton.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
    return krypton;
}

const sizeOf = (page: Page, selector: string) =>
    page.locator(selector).first().evaluate((el) => getComputedStyle(el).fontSize);

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(KRYPTON).waitFor();
});

test.describe('Tim: a panel\'s text', () => {
    test('is at 11, the package\'s, title and rows alike', async ({ page }) => {
        await openKrypton(page);

        expect(await sizeOf(page, `${KRYPTON} > .title-bar`)).toBe('11px');
        expect(await sizeOf(page, `${KRYPTON} [data-scroller="body"] div`)).toBe('11px');
    });
});

test.describe('Spike: a host that sizes text anyway', () => {
    test('an important rule of the host\'s changes nothing', async ({ page }) => {
        await page.addStyleTag({ content: '[data-scroller="body"] div { font-size: 30px !important; }' });
        await openKrypton(page);

        expect(await sizeOf(page, `${KRYPTON} [data-scroller="body"] div`)).toBe('11px');
    });

    test('a style attribute set important changes nothing, and is taken off', async ({ page }) => {
        await openKrypton(page);
        const row = page.locator(`${KRYPTON} [data-scroller="body"] div`).first();
        await row.evaluate((el) => { (el as HTMLElement).style.setProperty('font-size', '30px', 'important'); });

        await expect.poll(() => row.evaluate((el) => getComputedStyle(el).fontSize)).toBe('11px');
        expect(await row.evaluate((el) => (el as HTMLElement).style.fontSize)).toBe('');
    });

    test('a node added with its own important size is taken off too', async ({ page }) => {
        await openKrypton(page);
        await page.locator(`${KRYPTON} [data-scroller="body"]`).evaluate((body) => {
            body.insertAdjacentHTML('beforeend', '<p id="loud" style="font-size: 30px !important">loud</p>');
        });

        await expect.poll(() => page.locator('#loud').evaluate((el) => getComputedStyle(el).fontSize)).toBe('11px');
    });

    test('a style attribute changes nothing', async ({ page }) => {
        await openKrypton(page);
        const row = page.locator(`${KRYPTON} [data-scroller="body"] div`).first();
        await row.evaluate((el) => { (el as HTMLElement).style.fontSize = '30px'; });

        expect(await row.evaluate((el) => getComputedStyle(el).fontSize)).toBe('11px');
    });
});

test.describe('Jenny: sized from the set, and a dot', () => {
    test('a node sized lg is at 14, and what it holds too', async ({ page }) => {
        await openKrypton(page);
        const row = page.locator(`${KRYPTON} [data-scroller="body"] div`).first();
        await row.evaluate((el) => { (el as HTMLElement).dataset.textSize = 'lg'; });

        expect(await row.evaluate((el) => getComputedStyle(el).fontSize)).toBe('14px');
        expect(await row.evaluate((el) => getComputedStyle(el.firstElementChild ?? el).fontSize)).toBe('14px');
    });

    test('a dot in the tray is not sized by the rule: its symbol is the tray\'s', async ({ page }) => {
        // A size the rule never gives, so a dot it reached would show it.
        await page.addStyleTag({ content: '.dot .dot-symbol { font-size: 9px; }' });
        await openKrypton(page);
        const symbols = () => page.locator('.dot .dot-symbol').evaluateAll((els) => els.map((el) => getComputedStyle(el).fontSize));

        expect((await symbols()).length).toBeGreaterThan(0);
        expect(new Set(await symbols())).toEqual(new Set(['9px']));
    });
});
