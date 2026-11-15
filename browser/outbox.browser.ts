/**
 * What waits to be said, in a chat's input field, in a real browser.
 *
 * "IF THERE ARE MESSAGES PENDING TO BE SENT, AS A COLLECTED BATCH, I SEE IT". It was an overlay that, pressed, took the
 * whole screen: "About it taking over everything for no good reason?" "I want you to use the pills for it instead".
 * Pressed, it is across its row: the words, the keyboard and what was said stay where they are; what waits is a short
 * list, each saying what it says, and what is done with it is said once.
 *
 * Personas:
 * - Tim: Happy path — seen at rest though nothing is being said; pressed, across its row, the chat still there
 * - Spike: Edge cases — Escape lets it go and the chat stays open; nothing left, it is gone
 * - Jenny: Complex scenarios — some taken away, it says how many wait
 */

import { test, expect, type Page } from '@playwright/test';

const XENON = '[data-element-id="chat-specimen"]';
const OUTBOX = `${XENON} [data-outbox="xenon-outbox"]`;

async function open(page: Page) {
    const xenon = page.locator(XENON);
    await xenon.click();
    await expect(xenon).not.toHaveAttribute('data-form', 'dot');
    await expect.poll(() => xenon.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
}

const still = (page: Page) => expect.poll(() => page.locator(OUTBOX).evaluate((el) => el.dataset.pillMoving === undefined)).toBe(true);

async function press(page: Page) {
    await page.locator(OUTBOX).click();
    await expect(page.locator(OUTBOX)).toHaveAttribute('data-form', 'pillOpen');
    await still(page);
}

const focused = (page: Page) => page.evaluate(() => document.activeElement?.hasAttribute('data-say') ?? false);

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(XENON).waitFor();
});

test.describe('Tim: what waits', () => {
    test('is a pill above the input field, saying how many wait and when they go, seen though nothing is being said', async ({ page }) => {
        await open(page);
        const outbox = page.locator(OUTBOX);
        await expect(outbox).toBeVisible();
        await expect(outbox).toHaveAttribute('data-form', 'pill');
        await expect(outbox).toHaveText('8 wait · 00:40');
        expect(await outbox.evaluate((el) => el.closest('[data-say-pills]') !== null && el.closest('[data-say-box]') === null)).toBe(true);
    });

    test('pressed, it is across its row: the words, the keyboard and what was said stay where they are', async ({ page }) => {
        await open(page);
        const field = page.locator(`${XENON} [data-say]`);
        await field.focus();
        await press(page);

        expect(await focused(page)).toBe(true);
        await expect(field).toBeVisible();
        const at = await page.evaluate(({ xenon, outbox }) => {
            const box = (el: Element) => el.getBoundingClientRect();
            const open = document.querySelector(outbox)!;
            const field = document.querySelector(`${xenon} [data-say]`)!;
            const log = document.querySelector(`${xenon} .content`)!;
            return { open: box(open), field: box(field), log: box(log), screen: window.innerHeight };
        }, { xenon: XENON, outbox: OUTBOX });
        // "The pills should be above, and outside of inputfield area": above the words, not over them; what was said is
        // still seen above it.
        expect(at.open.bottom).toBeLessThanOrEqual(at.field.top + 1);
        expect(at.log.bottom).toBeGreaterThan(at.log.top);
        // "taking over everything for no good reason": it takes no more than half of what is seen.
        expect(at.open.height).toBeLessThanOrEqual(at.screen / 2);
    });

    test('each that waits says what it says, and what is done with them is said once', async ({ page }) => {
        await open(page);
        await press(page);
        const rows = page.locator(`${OUTBOX} [data-waits]`);
        await expect(rows).toHaveCount(8);
        const said = await rows.allTextContents();
        expect(new Set(said).size).toBe(8);
        for (const title of ['Send now', 'Later', 'Cancel']) {
            await expect(page.locator(`${OUTBOX} [data-press]`, { hasText: title })).toHaveCount(1);
        }
        // Said once, on one line: not "huge and split across three rows".
        const tops = await page.locator(`${OUTBOX} [data-press]`).evaluateAll((ps) => ps.map((p) => Math.round(p.getBoundingClientRect().top)));
        expect(new Set(tops).size).toBe(1);
    });

    test('opens at what waits first', async ({ page }) => {
        await open(page);
        await press(page);
        const list = page.locator(`${OUTBOX} [data-scroller="declared"]`);
        expect(await list.evaluate((l) => l.scrollTop)).toBe(0);
    });
});

test.describe('Spike: letting it go', () => {
    test('Escape: a pill again, the chat still open, the field still focused', async ({ page }) => {
        await open(page);
        const field = page.locator(`${XENON} [data-say]`);
        await field.focus();
        await press(page);
        await page.keyboard.press('Escape');
        await expect(page.locator(OUTBOX)).toHaveAttribute('data-form', 'pill');
        await expect(page.locator(XENON)).toHaveAttribute('data-form', 'panel');
        expect(await focused(page)).toBe(true);
    });

    test('sent now, nothing waits: it is gone', async ({ page }) => {
        await open(page);
        await press(page);
        await page.locator(`${OUTBOX} [data-press="xenon-outbox-now"]`).click();
        await expect(page.locator(OUTBOX)).toBeHidden();
        await expect(page.locator(XENON)).toHaveAttribute('data-form', 'panel');
    });
});

test.describe('Jenny: some taken away', () => {
    // What is chosen is what Cancel takes; nothing chosen, it takes them all.
    test('two chosen and cancelled: it says six wait, and stays open for more', async ({ page }) => {
        await open(page);
        await press(page);
        const rows = page.locator(`${OUTBOX} [data-waits]`);
        await rows.nth(0).click();
        await rows.nth(2).click();
        await expect(rows.nth(0)).toHaveAttribute('aria-pressed', 'true');
        const cancel = page.locator(`${OUTBOX} [data-press="xenon-outbox-cancel"]`);
        // Never sent can't be undone: armed by the first press, done by the second.
        await cancel.click();
        await cancel.click();
        await expect(rows).toHaveCount(6);
        await expect(page.locator(OUTBOX)).toHaveAttribute('data-form', 'pillOpen');
        await page.keyboard.press('Escape');
        await expect(page.locator(OUTBOX)).toHaveText('6 wait · 00:40');
    });
});
