// A window opened on "Loading…", and four columns arriving after, on a phone.

// "You can clearly see how this element is not usable on mobile right ?"

// Personas:
// - Tim: Happy path — once the table is in, nothing in it is broken across lines

import { test, expect } from '@playwright/test';

const YTTRIUM = '[data-element-id="late-table-specimen"]';

test('Tim: the table arrives, and no word in it is broken across lines', async ({ page }) => {
    await page.goto('/');
    const yttrium = page.locator(YTTRIUM);
    await yttrium.tap();
    await expect(yttrium.locator('table')).toBeVisible();
    await expect.poll(() => yttrium.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
    const said = await yttrium.evaluate((el) => {
        const broken: string[] = [];
        // The heads are kept for a screen reader, clipped to nothing: the rows are what is read.
        const walker = document.createTreeWalker(el.querySelector('tbody')!, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
            const range = document.createRange();
            range.selectNodeContents(node);
            const tops = new Set(Array.from(range.getClientRects()).filter((r) => r.width > 0).map((r) => Math.round(r.top)));
            if (tops.size > 1) broken.push(node.textContent ?? '');
        }
        return { form: (el as HTMLElement).dataset.form, width: Math.round(el.getBoundingClientRect().width), screen: window.innerWidth, broken };
    });
    expect(said, JSON.stringify(said)).toMatchObject({ broken: [] });
});
