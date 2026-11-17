/**
 * A chat's field takes the bottom, in a real browser.
 *
 * "making the inputfield take up the entire bottom of the screen for chat
 * elements like claude or pi" (#40), and a red cross over a choice that left the
 * field "Say somethi". The field a host declares (`declareSay`) has the bottom
 * line of its row to itself, the whole width, and the row stays at the bottom of
 * the element while what was said scrolls above it.
 *
 * Personas:
 * - Tim: Happy path — Xenon's field is as wide as the body, on the bottom line of its row
 * - Spike: Edge cases — what the host put beside it is above it, not squeezing it
 * - Jenny: Complex scenarios — scrolled up to the start, the row is still at the bottom
 */

import { test, expect, type Page } from '@playwright/test';

const XENON = '[data-element-id="chat-specimen"]';

async function open(page: Page) {
    const xenon = page.locator(XENON);
    await xenon.click();
    await expect(xenon).not.toHaveAttribute('data-form', 'dot');
    await expect.poll(() => xenon.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
    return xenon;
}

const boxOf = (page: Page, selector: string) => page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
});

/** The body's inside: where its content can be, and how far down it is seen. */
const insideOf = (page: Page) => page.locator(`${XENON} [data-scroller="body"]`).evaluate((body) => {
    const r = body.getBoundingClientRect();
    const s = getComputedStyle(body);
    return {
        left: r.left + parseFloat(s.paddingLeft),
        right: r.right - parseFloat(s.paddingRight),
        bottom: r.top + body.clientHeight,
    };
});

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(XENON).waitFor();
});

test.describe('Tim: the field', () => {
    test('is as wide as the body, on the bottom line of its row', async ({ page }) => {
        await open(page);
        const field = await boxOf(page, `${XENON} [data-say]`);
        const inside = await insideOf(page);

        expect(field.left).toBeCloseTo(inside.left, 0);
        expect(field.right).toBeCloseTo(inside.right, 0);
    });
});

test.describe('Spike: what the host put beside it', () => {
    test('is above it, not squeezing it', async ({ page }) => {
        await open(page);
        const field = await boxOf(page, `${XENON} [data-say]`);
        const choice = await boxOf(page, `${XENON} select`);

        // Its own presses are in it (Tim: the field's presses); what else the host put beside it is above it.
        expect(choice.bottom).toBeLessThanOrEqual(field.top);
    });
});

test.describe('Jenny: scrolled up to the start', () => {
    test('the row is still at the bottom', async ({ page }) => {
        await open(page);
        await page.locator(`${XENON} [data-scroller="body"]`).evaluate((s) => { s.scrollTop = 0; });
        await page.waitForTimeout(100);
        const field = await boxOf(page, `${XENON} [data-say]`);
        const inside = await insideOf(page);

        expect(field.bottom).toBeLessThanOrEqual(inside.bottom + 1);
        expect(field.bottom).toBeGreaterThan(inside.bottom - 80);
    });
});

// "missed opportunity", in red, under the field, five times: on a phone the field stopped short of the home bar's
// strip, and what lay below it was nothing. The strip is the field's: its box reaches the screen's edge, and what is
// typed in it stays above the home bar.
test.describe('Jenny: over the home bar', () => {
    test('the field reaches the bottom of the screen, its words above the bar', async ({ page }, info) => {
        test.skip(info.project.name !== 'phone', 'a home bar is a phone\'s');
        await page.evaluate(() => document.documentElement.style.setProperty('--elements-safe-area-bottom', '34px'));
        await open(page);
        const at = await page.locator(`${XENON} [data-say]`).evaluate((field) => {
            const r = field.getBoundingClientRect();
            const s = getComputedStyle(field);
            return { bottom: r.bottom, words: r.bottom - parseFloat(s.paddingBottom) - parseFloat(s.borderBottomWidth), screen: window.innerHeight };
        });

        expect(at.bottom).toBeCloseTo(at.screen, 0);
        expect(at.words).toBeLessThanOrEqual(at.screen - 34);
    });
});

// Purple arrows: the + into the field's bottom-left corner, the → into its bottom-right.
test.describe('Tim: the field\'s presses', () => {
    test('the + and the → are in the field, at its bottom corners, above the home bar, under its words', async ({ page }, info) => {
        test.skip(info.project.name !== 'phone', 'a home bar is a phone\'s');
        await page.evaluate(() => document.documentElement.style.setProperty('--elements-safe-area-bottom', '34px'));
        await open(page);
        const at = await page.locator(XENON).evaluate((element) => {
            const field = element.querySelector<HTMLElement>('[data-say]')!;
            const box = (b: Element) => b.getBoundingClientRect();
            const [attach, send] = Array.from(field.parentElement!.querySelectorAll('button'));
            const s = getComputedStyle(field);
            return {
                field: box(field), attach: box(attach), send: box(send),
                words: box(field).bottom - parseFloat(s.paddingBottom),
                screen: window.innerHeight,
            };
        });

        // Inside the field's box.
        expect(at.attach.left).toBeGreaterThanOrEqual(at.field.left);
        expect(at.send.right).toBeLessThanOrEqual(at.field.right);
        expect(at.attach.bottom).toBeLessThanOrEqual(at.field.bottom);
        // At its corners: the + to the left, the → to the right, on one line.
        expect(at.attach.left - at.field.left).toBeLessThan(16);
        expect(at.field.right - at.send.right).toBeLessThan(16);
        expect(at.attach.top).toBeCloseTo(at.send.top, 0);
        // Above the home bar, and under the words.
        expect(at.attach.bottom).toBeLessThanOrEqual(at.screen - 34);
        expect(at.attach.top).toBeGreaterThanOrEqual(at.words - 1);
        // The field still reaches the bottom of the screen.
        expect(at.field.bottom).toBeCloseTo(at.screen, 0);
    });
});

// Qodo on #114: the field a host draws in place of the first (a harness tab pressed), the field taken away, a press
// that grows. The element is held to the field it has now.
test.describe('Jenny: the field changes while the panel is open', () => {
    const fieldAt = (page: Page) => page.locator(XENON).evaluate((element) => {
        const field = element.querySelector<HTMLElement>('[data-say]')!;
        const r = field.getBoundingClientRect();
        const s = getComputedStyle(field);
        return { bottom: r.bottom, words: r.bottom - parseFloat(s.paddingBottom) - parseFloat(s.borderBottomWidth), screen: window.innerHeight };
    });

    test('a field drawn in place of the first reaches the bottom, its words above the bar', async ({ page }, info) => {
        test.skip(info.project.name !== 'phone', 'a home bar is a phone\'s');
        await page.evaluate(() => document.documentElement.style.setProperty('--elements-safe-area-bottom', '34px'));
        await open(page);
        await page.locator(XENON).evaluate((element) => {
            const old = element.querySelector<HTMLElement>('[data-say]')!;
            const row = old.closest('[data-say-box]')?.parentElement ?? old.parentElement!;
            const next = document.createElement('div');
            const field = document.createElement('textarea');
            field.dataset.say = '';
            next.appendChild(field);
            row.replaceWith(next);
        });
        await page.waitForTimeout(100);
        const at = await fieldAt(page);

        expect(at.bottom).toBeCloseTo(at.screen, 0);
        expect(at.words).toBeLessThanOrEqual(at.screen - 34);
    });

    test('with the field taken away, the panel keeps the home bar\'s strip again', async ({ page }, info) => {
        test.skip(info.project.name !== 'phone', 'a home bar is a phone\'s');
        await page.evaluate(() => document.documentElement.style.setProperty('--elements-safe-area-bottom', '34px'));
        await open(page);
        const kept = await page.locator(XENON).evaluate(async (element) => {
            const field = element.querySelector<HTMLElement>('[data-say]')!;
            (field.closest('[data-say-box]')?.parentElement ?? field.parentElement!).remove();
            await new Promise((resolve) => setTimeout(resolve, 100));
            const body = element.querySelector<HTMLElement>(':scope > [data-scroller="body"]')!;
            return { panel: parseFloat(getComputedStyle(element).paddingBottom), body: parseFloat(getComputedStyle(body).paddingBottom) };
        });

        expect(kept.panel).toBeCloseTo(34, 0);
        // And the body its own padding back (Qodo on #114: "Content loses spacing after chat removal").
        expect(kept.body).toBeCloseTo(8, 0);
    });

    test('a press that grows keeps the words above it', async ({ page }, info) => {
        test.skip(info.project.name !== 'phone', 'a home bar is a phone\'s');
        await page.evaluate(() => document.documentElement.style.setProperty('--elements-safe-area-bottom', '34px'));
        await open(page);
        const at = await page.locator(XENON).evaluate(async (element) => {
            const field = element.querySelector<HTMLElement>('[data-say]')!;
            const send = field.parentElement!.querySelectorAll('button')[1]!;
            send.style.setProperty('height', '72px', 'important');
            await new Promise((resolve) => setTimeout(resolve, 200));
            const s = getComputedStyle(field);
            return { press: send.getBoundingClientRect().top, words: field.getBoundingClientRect().bottom - parseFloat(s.paddingBottom) };
        });

        expect(at.press).toBeGreaterThanOrEqual(at.words - 1);
    });
});
