/**
 * 「[Opus 5.5] A chat's field is the Claude app's composer, in a real browser.」
 *
 * "making the inputfield take up the entire bottom of the screen for chat elements like claude or pi" (#40). "This i
 * 「[Opus 5.5] want", "I want this only", "LOOK AT THIS THE SHAPE": one pill as wide as the body, the + at its start, what is typed,」
 * 「[Opus 5.5] the → at its end, on one line; the row stays at the bottom of the element while what was said scrolls above it, and」
 * 「[Opus 5.5] on a phone the home bar's strip is the page's, under the pill.」
 *
 * Personas:
 * 「[Opus 5.5] - Tim: Happy path — Xenon's pill is as wide as the body: the +, the words, the → on one line, its presses round」
 * - Spike: Edge cases — what the host put beside it is above it, not squeezing it
 * 「[Opus 5.5] - Jenny: Complex scenarios — scrolled up, over the home bar, the field drawn again or taken away」
 */

import { test, expect, type Page } from '@playwright/test';

const XENON = '[data-element-id="chat-specimen"]';
// 「[Opus 5.5] The Claude app's composer (content/say.ts); literals here, as the page's test cannot import the package.」
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

    // "The pills should be above, and outside of inputfield area": the input field is one line, the + first, the words,
    // 「[Opus 5.5] the → last; its pills in a strip of their own above it, each its words on one line, the strip dragged sideways:」
    // "normally you're able to drag pills sideways in most applications".
    test('one line: the + at its start, the words, the → at its end; its pills above it, outside it, one line; its presses round, SAY_INSET in', async ({ page }) => {
        await open(page);
        await page.locator(`${XENON} [data-say]`).focus();
        const at = await page.locator(PILL).evaluate((pill) => {
            const box = (b: Element) => b.getBoundingClientRect();
            // 「[Opus 5.5] How many lines its words are on: the tops of its text's boxes.」
            const lines = (node: Element) => {
                const range = document.createRange();
                range.selectNodeContents(node);
                return new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top))).size;
            };
            const [attach, send] = Array.from(pill.querySelectorAll(':scope [data-say-press]'));
            const field = pill.querySelector('[data-say]')!;
            const strip = pill.previousElementSibling as HTMLElement;
            const pills = Array.from(strip.querySelectorAll('[data-form="pill"]'));
            const s = getComputedStyle(pill);
            return {
                form: (pill as HTMLElement).dataset.form,
                inside: pill.querySelectorAll('[data-form="pill"]').length,
                pill: box(pill), attach: box(attach!), send: box(send!), field: box(field), strip: box(strip),
                pills: pills.map((p) => ({ box: box(p), lines: lines(p.querySelector('[data-pill-label]')!) })),
                round: getComputedStyle(attach!).borderTopLeftRadius,
                // 「[Opus 5.5] A host may draw the input field an outline: the presses stand SAY_INSET in from inside it.」
                edge: { left: parseFloat(s.borderLeftWidth), right: parseFloat(s.borderRightWidth), bottom: parseFloat(s.borderBottomWidth) },
            };
        });

        expect(at.form).toBe('inputfield');
        expect(at.inside).toBe(0);
        const middle = (r: { top: number; bottom: number }) => (r.top + r.bottom) / 2;
        expect(middle(at.field)).toBeCloseTo(middle(at.attach), 0);
        expect(middle(at.send)).toBeCloseTo(middle(at.attach), 0);
        expect(at.attach.right).toBeLessThanOrEqual(at.field.left);
        expect(at.field.right).toBeLessThanOrEqual(at.send.left);
        expect(at.strip.bottom).toBeLessThanOrEqual(at.pill.top + 1);
        expect(at.pills.length).toBe(3);
        for (let i = 1; i < at.pills.length; i++) {
            expect(middle(at.pills[i]!.box)).toBeCloseTo(middle(at.pills[0]!.box), 0);
            expect(at.pills[i - 1]!.box.right).toBeLessThanOrEqual(at.pills[i]!.box.left);
        }
        for (const pill of at.pills) expect(pill.lines).toBe(1);
        expect(at.attach.width).toBeCloseTo(SAY_PRESS, 0);
        expect(at.attach.height).toBeCloseTo(SAY_PRESS, 0);
        expect(at.round).toBe('50%');
        expect(at.attach.left - at.pill.left - at.edge.left).toBeCloseTo(SAY_INSET, 0);
        expect(at.pill.right - at.send.right - at.edge.right).toBeCloseTo(SAY_INSET, 0);
        expect(at.pill.bottom - at.send.bottom - at.edge.bottom).toBeCloseTo(SAY_INSET, 0);
    });

    test('pills more than the strip holds: it is dragged sideways to the last', async ({ page }, info) => {
        test.skip(info.project.name !== 'phone', 'a finger drags it');
        await open(page);
        await page.locator(`${XENON} [data-say]`).focus();
        const strip = page.locator(`${XENON} [data-say-pills]`);
        // 「[Opus 5.5] A strip narrower than its pills, as a small phone's is.」
        await strip.evaluate((s) => { s.style.setProperty('flex', '0 0 200px', 'important'); s.style.setProperty('width', '200px', 'important'); });
        const wide = await strip.evaluate((s) => ({ scroll: s.scrollWidth, client: s.clientWidth }));
        expect(wide.scroll).toBeGreaterThan(wide.client);
        const last = page.locator(`${XENON} [data-choices="xenon-repositories"]`);
        const seen = () => last.evaluate((p) => { const r = p.getBoundingClientRect(); const s = p.parentElement!.getBoundingClientRect(); return r.right <= s.right + 1; });
        expect(await seen()).toBe(false);
        // 「[Opus 5.5] A finger drags it: the strip scrolls as the platform scrolls it.」
        const b = (await strip.boundingBox())!;
        const y = Math.round(b.y + b.height / 2);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(b.x + b.width - 10), y }] });
        for (let x = Math.round(b.x + b.width - 20); x >= b.x - 200; x -= 10) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.max(1, x), y }] });
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect.poll(seen).toBe(true);
        expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-say') ?? false)).toBe(true);
    });
});

// 「[Opus 5.5] The choices are one element in Pill Form, in the input field. "I want inputfield to still be there": pressed, it is」
// 「[Opus 5.5] across its row, the words still above it. "it taking focus should let kb stay in place": the field keeps the focus.」
test.describe('Spike: its choices', () => {
    const CHOICES = `${XENON} [data-choices="xenon-choices"]`;
    const REPOSITORIES = `${XENON} [data-choices="xenon-repositories"]`;

    test('are gone while nothing is being said', async ({ page }) => {
        await open(page);
        await expect(page.locator(CHOICES)).toBeHidden();
    });

    test('pressed, the same element across its row, the field still there and still focused; an option taken, a pill again', async ({ page }) => {
        await open(page);
        const field = page.locator(`${XENON} [data-say]`);
        await field.focus();
        const node = await page.locator(CHOICES).elementHandle();
        const focused = () => page.evaluate(() => document.activeElement?.hasAttribute('data-say') ?? false);

        await page.locator(CHOICES).click();
        await expect(page.locator(CHOICES)).toHaveAttribute('data-form', 'pillOpen');
        await expect.poll(() => page.locator(CHOICES).evaluate((el) => el.dataset.pillMoving === undefined)).toBe(true);
        expect(await focused()).toBe(true);
        await expect(field).toBeVisible();
        // 「[Opus 5.5] Across the strip above the input field, the field under it.」
        const strip = await boxOf(page, `${XENON} [data-say-pills]`);
        const open_ = await boxOf(page, CHOICES);
        expect(open_.left).toBeCloseTo(strip.left, 0);
        expect(open_.right).toBeCloseTo(strip.right, 0);
        expect(open_.bottom).toBeLessThanOrEqual((await boxOf(page, `${XENON} [data-say]`)).top);

        await page.locator(CHOICES).getByRole('button', { name: 'max' }).click();
        await expect(page.locator(CHOICES)).toHaveAttribute('data-form', 'pill');
        await expect.poll(() => page.locator(CHOICES).evaluate((el) => el.dataset.pillMoving === undefined)).toBe(true);
        await expect(page.locator(CHOICES)).toHaveText('Opus 5.5 · max');
        expect(await focused()).toBe(true);
        // 「[Opus 5.5] Seen in xenon: let go, the pills squeezed, their words on two lines.」
        const lines = await page.locator(`${XENON} [data-say-pills]`).evaluate((strip) => Array.from(strip.querySelectorAll('[data-pill-label]')).map((label) => {
            const range = document.createRange();
            range.selectNodeContents(label);
            return new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top))).size;
        }));
        expect(lines).toEqual([1, 1, 1]);
        // 「[Opus 5.5] One element all the way (Element Axioma).」
        expect(await node!.evaluate((el) => el === document.querySelector('[data-choices="xenon-choices"]'))).toBe(true);
    });

    // "add another inputfieldpillmenu for attached repositories": any of them; it stays open for the next.
    test('the attached repositories: one taken is attached, it stays open; let go, it says what is attached', async ({ page }) => {
        await open(page);
        await page.locator(`${XENON} [data-say]`).focus();
        const pill = page.locator(REPOSITORIES);
        await expect(pill).toHaveText('QNTX · elements');
        await pill.click();
        await expect.poll(() => pill.evaluate((el) => el.dataset.form === 'pillOpen' && el.dataset.pillMoving === undefined)).toBe(true);
        await pill.getByRole('button', { name: 'ground' }).click();
        await expect(pill).toHaveAttribute('data-form', 'pillOpen');
        await expect(pill.getByRole('button', { name: 'ground' })).toHaveAttribute('aria-pressed', 'true');

        await page.keyboard.press('Escape');
        await expect.poll(() => pill.evaluate((el) => el.dataset.form === 'pill' && el.dataset.pillMoving === undefined)).toBe(true);
        await expect(pill).toHaveText('QNTX +2');
        expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-say') ?? false)).toBe(true);
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

// 「[Opus 5.5] Gemini's, ChatGPT's, Manus's and Claude's composers float above the home bar: the strip under it is the page's.」
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

// 「[Opus 5.5] Qodo on #114: the field a host draws in place of the first (a harness tab pressed), the field taken away. The」
// 「[Opus 5.5] element is held to the field it has now.」
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
        // 「[Opus 5.5] Qodo on #114: "Content loses spacing after chat removal".」
        expect(kept.body).toBeCloseTo(8, 0);
    });
});

// CodeRabbit on #115: "Preserve focus when pills trigger field wrapping." Moved in the page, a field that has the focus
// loses it in a real browser; wrapped in its input field, it keeps it, and where the caret was.
test.describe('Spike: a field that has the focus when its pills are given', () => {
    test('keeps the focus and the caret when it is wrapped', async ({ page }) => {
        const kept = await page.evaluate(async () => {
            const { declareSay, renderContent } = await import('/package.js' as string);
            // As QNTX-Web's Node Agent does: the field is put in, focused, and declared after.
            const field = document.createElement('textarea');
            field.value = 'half a sentence';
            const element = document.createElement('div');
            element.dataset.elementId = 'focus-specimen';
            document.body.appendChild(element);
            renderContent(element, { id: 'focus-specimen', title: 'Focus', renderContent: () => field }, 'Test');
            field.focus();
            field.setSelectionRange(4, 6);
            declareSay(field, { pills: [document.createElement('div')] });
            await new Promise((resolve) => setTimeout(resolve, 50));
            return { wrapped: field.parentElement?.dataset.sayBox === '', focused: document.activeElement === field, at: [field.selectionStart, field.selectionEnd] };
        });
        expect(kept).toEqual({ wrapped: true, focused: true, at: [4, 6] });
    });
});

