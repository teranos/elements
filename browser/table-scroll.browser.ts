/**
 * A table wider than the element holding it scrolls sideways in its own box, and nothing else does.
 *
 * "Be prepared for text-size changes" and a DID that never breaks: a table has columns that cannot give
 * way. WCAG 2.2, Understanding 1.4.10 Reflow: data tables are exempt from not scrolling in two
 * directions, and "presenting the table in its own scrollable container" lets what is around it reflow.
 * W3C design system, Tables: the container is focusable and labelled, so a keyboard can scroll it.
 *
 * Seen on a phone as "TOO WIDE: users-element: its content is 417px wide in 393px": the element dropped
 * dead, and before that its columns were squeezed equal whatever they held.
 *
 * Personas:
 * - Tim: Happy path — Yttrium is alive; its table is a box that scrolls, and the last column is reached
 * - Spike: Edge cases — a table that fits does not scroll and is not a stop; a host's raw table is still fitted
 * - Jenny: Complex scenarios — a keyboard scrolls it, a finger scrolls it, and the element's body never moves sideways
 */

import { test, expect, type Page } from '@playwright/test';

const YTTRIUM = '[data-element-id="users-specimen"]';
const TABLE = `${YTTRIUM} table.users-table`;

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(YTTRIUM).waitFor();
});

/** The element's own edges, the body's width, and the table box's. */
const measure = (page: Page) => page.evaluate(({ yttrium, table }) => {
    const el = document.querySelector(yttrium)!;
    const t = document.querySelector<HTMLElement>(table)!;
    const body = el.querySelector<HTMLElement>('.content-area')!;
    return {
        dead: !!el.querySelector('[data-too-wide-notice]'),
        bodyScrolls: body.scrollWidth > body.clientWidth + 1,
        boxClient: t.clientWidth,
        boxScroll: t.scrollWidth,
        overflowX: getComputedStyle(t).overflowX,
    };
}, { yttrium: YTTRIUM, table: TABLE });

test.describe('Tim: a table wider than its element', () => {
    test('the element is alive, and the body does not scroll sideways', async ({ page }) => {
        const m = await measure(page);
        expect(m.dead).toBe(false);
        expect(m.bodyScrolls).toBe(false);
    });

    test('the table is its own scroll box, and is wider than what it shows', async ({ page }) => {
        const m = await measure(page);
        expect(m.overflowX).toBe('auto');
        expect(m.boxScroll).toBeGreaterThan(m.boxClient + 1);
    });

    test('a DID and a time are read whole, each on one line, as the table says they never break', async ({ page }) => {
        const broken = await page.locator(TABLE).evaluate((t) =>
            Array.from(t.querySelectorAll<HTMLElement>('.element-did, .element-time, .element-pill, th'))
                .filter((cell) => cell.getClientRects().length > 0 && cell.getBoundingClientRect().height > 2.2 * parseFloat(getComputedStyle(cell).lineHeight || '16'))
                .map((cell) => `${cell.tagName.toLowerCase()} "${cell.textContent}" ${Math.round(cell.getBoundingClientRect().height)}px tall`));
        expect(broken).toEqual([]);
    });

    test('no column is squeezed below what it holds', async ({ page }) => {
        const squeezed = await page.locator(TABLE).evaluate((t) =>
            Array.from(t.querySelectorAll<HTMLElement>('td, th'))
                .filter((cell) => cell.scrollWidth > cell.clientWidth + 1)
                .map((cell) => `${cell.tagName.toLowerCase()} "${cell.textContent}"`));
        expect(squeezed).toEqual([]);
    });

    test('scrolled to the end, the last column stands inside the element', async ({ page }) => {
        const inside = await page.locator(TABLE).evaluate((t) => {
            t.scrollLeft = t.scrollWidth;
            const edge = t.closest('[data-element-id]')!.getBoundingClientRect();
            const last = t.querySelector('tbody tr:first-child td:last-child')!.getBoundingClientRect();
            return last.left >= edge.left - 1 && last.right <= edge.right + 1;
        });
        expect(inside).toBe(true);
    });
});

test.describe('Spike: tables that are not too wide', () => {
    test('a table that fits does not scroll, and is not a tab stop', async ({ page }) => {
        await page.locator(YTTRIUM).evaluate((el) => { (el as HTMLElement).style.width = '1400px'; });
        await expect.poll(() => measure(page).then((m) => m.boxScroll <= m.boxClient + 1)).toBe(true);
        expect(await page.locator(TABLE).evaluate((t) => t.hasAttribute('tabindex'))).toBe(false);
    });

    test('a host\'s own table, not the package\'s, is still fitted to the element', async ({ page }) => {
        const fitted = await page.locator(`${YTTRIUM} .content-area`).evaluate((body) => {
            const raw = document.createElement('table');
            raw.innerHTML = `<tr>${'<td style="white-space: nowrap">a cell that would not break</td>'.repeat(4)}</tr>`;
            body.appendChild(raw);
            const style = getComputedStyle(raw);
            return { layout: style.tableLayout, width: raw.getBoundingClientRect().width <= body.clientWidth + 1 };
        });
        expect(fitted).toEqual({ layout: 'fixed', width: true });
    });
});

test.describe('Jenny: reached by a keyboard, and by a finger', () => {
    test('it is a stop, named, and the arrow keys scroll it', async ({ page }) => {
        const table = page.locator(TABLE);
        expect(await table.evaluate((t) => ({ tab: t.getAttribute('tabindex'), name: t.getAttribute('aria-label') })))
            .toEqual({ tab: '0', name: 'users' });
        await table.focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => table.evaluate((t) => t.scrollLeft)).toBeGreaterThan(0);
    });

    test('a finger dragged sideways across the table scrolls it, and the body stays', async ({ page, browserName, isMobile }) => {
        test.skip(browserName !== 'chromium' || !isMobile, 'a real finger is driven through Chrome on a phone');
        // A finger lands on the screen: the specimen is further down a long page.
        await page.locator(TABLE).scrollIntoViewIfNeeded();
        const box = (await page.locator(TABLE).boundingBox())!;
        const x = box.x + box.width - 20;
        const y = box.y + box.height / 2;
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 8; i++) {
            await page.waitForTimeout(20);
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - i * 25, y }] });
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect.poll(() => page.locator(TABLE).evaluate((t) => t.scrollLeft)).toBeGreaterThan(0);
        expect((await measure(page)).bodyScrolls).toBe(false);
    });
});
