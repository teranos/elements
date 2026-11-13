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
 * - Jenny: Complex scenarios — a node sized lg is at 14, and a dot's symbol is not the rule's;
 *   the person's larger text size makes it larger, and a host's smaller root makes nothing smaller
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

    test('a field is at 16, even in a node sized from the set', async ({ page }) => {
        await openKrypton(page);
        const body = page.locator(`${KRYPTON} [data-scroller="body"]`);
        await body.evaluate((el) => { (el as HTMLElement).dataset.textSize = 'xs'; });

        expect(await body.locator('input').first().evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
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

// "Be prepared for text-size changes" (Apple HIG, Accessibility). The person's text size is the browser's own
// default (Chromium's font-size setting, set here through the DevTools protocol); a host's root font-size is not it.
test.describe('Jenny: the person\'s text size, and a host\'s root', () => {
    const field = (page: Page) => page.locator(`${KRYPTON} input`).first().evaluate((el) => getComputedStyle(el).fontSize);

    test('a larger text size of the person\'s makes the panel\'s text larger, and its fields with it', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'the browser\'s own font size is set through Chromium\'s DevTools protocol');
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Page.setFontSizes', { fontSizes: { standard: 24, fixed: 20 } });
        await page.reload();
        await page.locator(KRYPTON).waitFor();
        await openKrypton(page);

        expect(await sizeOf(page, `${KRYPTON} [data-scroller="body"] div`)).toBe('16.5px');
        expect(await field(page)).toBe('24px');
    });

    test('a host\'s larger root makes nothing larger: text size inside an element is the package\'s', async ({ page }) => {
        await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
        await openKrypton(page);

        expect(await sizeOf(page, `${KRYPTON} [data-scroller="body"] div`)).toBe('11px');
        expect(await field(page)).toBe('16px');
    });

    test('a host\'s important rules on every span, there before the package measures, change nothing', async ({ page }) => {
        // In the host's own page, in its head, before anything of the package's runs.
        await page.route((url) => url.pathname === '/', async (route) => {
            const response = await route.fetch();
            const html = (await response.text()).replace('</head>', '<style>span { font-size: 24px !important; } * { font-family: monospace !important; }</style></head>');
            await route.fulfill({ response, body: html });
        });
        await page.reload();
        await page.locator(KRYPTON).waitFor();
        await openKrypton(page);

        expect(await sizeOf(page, `${KRYPTON} [data-scroller="body"] div`)).toBe('11px');
        expect(await field(page)).toBe('16px');
    });

    test('a host that names a text scale on an element changes nothing', async ({ page }) => {
        await openKrypton(page);
        await page.locator(KRYPTON).evaluate((el) => { (el as HTMLElement).style.setProperty('--elements-text-scale', '3'); });

        expect(await sizeOf(page, `${KRYPTON} [data-scroller="body"] div`)).toBe('11px');
        expect(await field(page)).toBe('16px');
    });

    test('a host\'s smaller root makes nothing smaller: the package\'s number is the least, a field 16 still', async ({ page }) => {
        await page.evaluate(() => { document.documentElement.style.fontSize = '10px'; });
        await openKrypton(page);

        expect(await sizeOf(page, `${KRYPTON} [data-scroller="body"] div`)).toBe('11px');
        expect(await field(page)).toBe('16px');
    });
});
