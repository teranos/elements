/**
 * A chat's field is the Claude app's composer, in a real browser.
 *
 * "making the inputfield take up the entire bottom of the screen for chat elements like claude or pi" (#40). "This i
 * want", "I want this only", "LOOK AT THIS THE SHAPE": one pill as wide as the body, the + at its start, what is typed,
 * the → at its end, on one line; the row stays at the bottom of the element while what was said scrolls above it, and
 * on a phone the home bar's strip is the page's, under the pill.
 *
 * Personas:
 * - Tim: Happy path — Xenon's pill is as wide as the body: the +, the words, the → on one line, its presses round
 * - Spike: Edge cases — what the host put beside it is above it, not squeezing it
 * - Jenny: Complex scenarios — scrolled up, over the home bar, the field drawn again or taken away
 */

import { test, expect, type Page } from '@playwright/test';

const XENON = '[data-element-id="chat-specimen"]';
// The Claude app's composer (content/say.ts); literals here, as the page's test cannot import the package.
const SAY_PRESS = 36;
const SAY_INSET = 8;

async function open(page: Page) {
    const xenon = page.locator(XENON);
    await xenon.click();
    await expect(xenon).not.toHaveAttribute('data-form', 'dot');
    await expect.poll(() => xenon.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
    return xenon;
}

const boxOf = (page: Page, selector: string) => page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
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

const PILL = `${XENON} [data-say-box]`;

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(XENON).waitFor();
});

test.describe('Tim: the pill', () => {
    test('is as wide as the body', async ({ page }) => {
        await open(page);
        const pill = await boxOf(page, PILL);
        const inside = await insideOf(page);

        expect(pill.left).toBeCloseTo(inside.left, 0);
        expect(pill.right).toBeCloseTo(inside.right, 0);
    });

    test('the + at its start, the words, the → at its end, on one line; its presses round, SAY_INSET in', async ({ page }) => {
        await open(page);
        const at = await page.locator(PILL).evaluate((pill) => {
            const box = (b: Element) => b.getBoundingClientRect();
            const [attach, send] = Array.from(pill.querySelectorAll('button'));
            const field = pill.querySelector('[data-say]')!;
            const s = getComputedStyle(pill);
            return {
                pill: box(pill), attach: box(attach!), send: box(send!), field: box(field),
                round: getComputedStyle(attach!).borderTopLeftRadius,
                // A host may draw the pill an outline: the presses stand SAY_INSET in from inside it.
                edge: { left: parseFloat(s.borderLeftWidth), right: parseFloat(s.borderRightWidth) },
            };
        });

        expect(at.attach.right).toBeLessThanOrEqual(at.field.left);
        expect(at.field.right).toBeLessThanOrEqual(at.send.left);
        const middle = (r: { top: number; bottom: number }) => (r.top + r.bottom) / 2;
        expect(middle(at.attach)).toBeCloseTo(middle(at.pill), 0);
        expect(middle(at.send)).toBeCloseTo(middle(at.pill), 0);
        expect(middle(at.field)).toBeCloseTo(middle(at.pill), 0);
        expect(at.attach.width).toBeCloseTo(SAY_PRESS, 0);
        expect(at.attach.height).toBeCloseTo(SAY_PRESS, 0);
        expect(at.round).toBe('50%');
        expect(at.attach.left - at.pill.left - at.edge.left).toBeCloseTo(SAY_INSET, 0);
        expect(at.pill.right - at.send.right - at.edge.right).toBeCloseTo(SAY_INSET, 0);
    });
});

// "Not as an overlay, but as a generalised 'pills above inputfields' form": the choices are one element in Pill Form.
// "we would not be using the inputfield while in the pill choosing something": pressed, it takes the field's place.
test.describe('Spike: its choices', () => {
    const CHOICES = `${XENON} [data-choices]`;

    test('are gone while nothing is being said', async ({ page }) => {
        await open(page);
        await expect(page.locator(CHOICES)).toBeHidden();
    });

    test('while something is, rest as a pill above the field\'s, not squeezing it', async ({ page }) => {
        await open(page);
        await page.locator(`${XENON} [data-say]`).focus();
        const pill = await boxOf(page, PILL);
        const choices = await boxOf(page, CHOICES);

        expect(choices.bottom).toBeLessThanOrEqual(pill.top);
        expect(choices.left).toBeCloseTo(pill.left, 0);
    });

    test('pressed, it is the same element in the field\'s place; an option taken, a pill again, saying it', async ({ page }) => {
        await open(page);
        await page.locator(`${XENON} [data-say]`).focus();
        const before = await boxOf(page, PILL);
        const node = await page.locator(CHOICES).elementHandle();
        await page.locator(CHOICES).click();
        await expect(page.locator(CHOICES)).toHaveAttribute('data-form', 'pillOpen');
        await expect.poll(() => page.locator(CHOICES).evaluate((el) => el.dataset.pillMoving === undefined)).toBe(true);

        // Where the field was, the field stood aside.
        await expect(page.locator(PILL)).toBeHidden();
        const open_ = await boxOf(page, CHOICES);
        expect(open_.bottom).toBeCloseTo(before.bottom, 0);
        expect(open_.left).toBeCloseTo(before.left, 0);
        expect(open_.right).toBeCloseTo(before.right, 0);

        await page.locator(CHOICES).getByRole('button', { name: 'max' }).click();
        await expect(page.locator(CHOICES)).toHaveAttribute('data-form', 'pill');
        await expect.poll(() => page.locator(CHOICES).evaluate((el) => el.dataset.pillMoving === undefined)).toBe(true);
        await expect(page.locator(CHOICES)).toHaveText('Opus 5.5 · max');
        await expect(page.locator(PILL)).toBeVisible();
        expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-say'))).toBe(true);
        // One element all the way (Element Axioma).
        expect(await node!.evaluate((el) => el === document.querySelector('[data-choices]'))).toBe(true);
    });
});

test.describe('Jenny: scrolled up to the start', () => {
    test('the row is still at the bottom', async ({ page }) => {
        await open(page);
        await page.locator(`${XENON} [data-scroller="body"]`).evaluate((s) => { s.scrollTop = 0; });
        await page.waitForTimeout(100);
        const pill = await boxOf(page, PILL);
        const inside = await insideOf(page);

        expect(pill.bottom).toBeLessThanOrEqual(inside.bottom + 1);
        expect(pill.bottom).toBeGreaterThan(inside.bottom - 80);
    });
});

// Gemini's, ChatGPT's, Manus's and Claude's composers float above the home bar: the strip under it is the page's.
test.describe('Jenny: over the home bar', () => {
    test('the pill stands above the home bar\'s strip', async ({ page }, info) => {
        test.skip(info.project.name !== 'phone', 'a home bar is a phone\'s');
        await page.evaluate(() => document.documentElement.style.setProperty('--elements-safe-area-bottom', '34px'));
        await open(page);
        const pill = await boxOf(page, PILL);
        const screen = await page.evaluate(() => window.innerHeight);

        expect(pill.bottom).toBeLessThanOrEqual(screen - 34 + 1);
        expect(pill.bottom).toBeGreaterThan(screen - 34 - 16);
    });
});

// Qodo on #114: the field a host draws in place of the first (a harness tab pressed), the field taken away. The
// element is held to the field it has now.
test.describe('Jenny: the field changes while the panel is open', () => {
    test('a field drawn in place of the first stands above the bar', async ({ page }, info) => {
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
        const field = await boxOf(page, `${XENON} [data-say]`);
        const screen = await page.evaluate(() => window.innerHeight);

        expect(field.bottom).toBeLessThanOrEqual(screen - 34 + 1);
    });

    test('with the field taken away, the body has its own padding back', async ({ page }, info) => {
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
        // Qodo on #114: "Content loses spacing after chat removal".
        expect(kept.body).toBeCloseTo(8, 0);
    });
});
