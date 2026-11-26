// "elements should own gaps right? So no consumers can disagree"
// Whatever a host writes inside an element, the space between things there is a gap of the package's set,
// and a margin is none: a stylesheet, important or not, and a style attribute, important or not, change nothing.

import { test, expect, type Page } from '@playwright/test';

const GERMANIUM = '[data-element-id="germanium-button"]';

const touching = (): boolean => !!test.info().project.use.hasTouch;

async function opened(page: Page): Promise<void> {
    const element = page.locator(GERMANIUM);
    if (touching()) await element.tap();
    else await element.click();
    await expect.poll(() => element.evaluate((el) => (el as HTMLElement).dataset.form)).not.toBe('dot');
    await expect.poll(() => element.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
}

/** Puts markup inside the open element, with a stylesheet of the host's in the page, and says each gap between its rows. */
async function spaced(page: Page, markup: string, sheet = ''): Promise<number[]> {
    await page.goto('/');
    await page.locator(GERMANIUM).waitFor();
    await opened(page);
    return page.locator(`${GERMANIUM} .content-area`).evaluate(async (area, [markup, sheet]) => {
        if (sheet) {
            const style = document.createElement('style');
            style.textContent = sheet;
            document.head.appendChild(style);
        }
        const holder = document.createElement('div');
        holder.innerHTML = markup;
        area.appendChild(holder);
        // What the person sees: after the package's watch has answered what was written (a MutationObserver's callback).
        await new Promise((done) => requestAnimationFrame(() => done(null)));
        const rows = Array.from(holder.querySelectorAll<HTMLElement>('[data-row]'));
        return rows.slice(1).map((row, i) => Math.round(row.getBoundingClientRect().top - rows[i]!.getBoundingClientRect().bottom));
    }, [markup, sheet] as const);
}

const COLUMN = (attributes: string, row = '') =>
    `<div ${attributes}><div data-row ${row}>one</div><div data-row ${row}>two</div><div data-row ${row}>three</div></div>`;

test('Tim: a column inside an element is spaced md, 8', async ({ page }) => {
    expect(await spaced(page, COLUMN('style="display: flex; flex-direction: column"'))).toEqual([8, 8]);
});

test('Tim: a column spaced lg is 16 apart, sm 4', async ({ page }) => {
    expect(await spaced(page, COLUMN('style="display: flex; flex-direction: column" data-gap="lg"'))).toEqual([16, 16]);
    expect(await spaced(page, COLUMN('style="display: flex; flex-direction: column" data-gap="sm"'))).toEqual([4, 4]);
});

test('Spike: a host\'s gap and margins, in a style attribute, important or not, change nothing', async ({ page }) => {
    expect(await spaced(page, COLUMN('style="display: flex; flex-direction: column; gap: 30px !important"', 'style="margin: 12px !important"'))).toEqual([8, 8]);
    expect(await spaced(page, COLUMN('style="display: flex; flex-direction: column; gap: 30px"', 'style="margin-top: 12px"'))).toEqual([8, 8]);
});

test('Spike: a host\'s stylesheet, important, changes nothing', async ({ page }) => {
    const sheet = '.host-column { gap: 30px !important; row-gap: 30px !important; } .host-column > div { margin-block: 12px !important; }';
    expect(await spaced(page, COLUMN('class="host-column" style="display: flex; flex-direction: column"'), sheet)).toEqual([8, 8]);
});

// As the field specimen writes it, and any host: what it puts in an element's body, spaced by a margin of its own.
test('Tim: what a host puts in an element\'s body stands md apart, its own margin or none', async ({ page }) => {
    await page.goto('/');
    await page.locator(GERMANIUM).waitFor();
    await opened(page);
    const apart = await page.locator(`${GERMANIUM} [data-scroller="body"]`).evaluate(async (body) => {
        const first = document.createElement('div');
        first.textContent = 'a field';
        const second = document.createElement('div');
        second.textContent = 'its presses';
        second.style.marginTop = '12px';
        body.append(first, second);
        await new Promise((done) => requestAnimationFrame(() => done(null)));
        return Math.round(second.getBoundingClientRect().top - first.getBoundingClientRect().bottom);
    });
    expect(apart).toBe(8);
});

// As renderContent hands one root of the host's, which the package puts in the body: the field specimen's own.
// What the host lays out is spaced by the host asking for a gap of the set (gapAt); its margin is none either way.
test('Tim: a host\'s root laid out as a column at md stands md apart, its own margin or none', async ({ page }) => {
    await page.goto('/');
    await page.locator(GERMANIUM).waitFor();
    await opened(page);
    const apart = await page.locator(`${GERMANIUM} [data-scroller="body"]`).evaluate(async (body) => {
        body.replaceChildren();
        const root = document.createElement('div');
        root.style.display = 'flex';
        root.style.flexDirection = 'column';
        root.dataset.gap = 'md';
        const first = document.createElement('div');
        first.textContent = 'a field';
        const second = document.createElement('div');
        second.textContent = 'its presses';
        second.style.marginTop = '12px';
        root.append(first, second);
        body.append(root);
        await new Promise((done) => requestAnimationFrame(() => done(null)));
        return Math.round(second.getBoundingClientRect().top - first.getBoundingClientRect().bottom);
    });
    expect(apart).toBe(8);
});

// A body a host lays out itself, a column spaced by gapAt: spaced once, by its gap, not its gap and the body's spacing.
test('Spike: a body spaced by a gap of its own stands md apart, not twice that', async ({ page }) => {
    await page.goto('/');
    await page.locator(GERMANIUM).waitFor();
    await opened(page);
    const apart = await page.locator(`${GERMANIUM} [data-scroller="body"]`).evaluate(async (body) => {
        body.replaceChildren();
        body.style.display = 'flex';
        body.style.flexDirection = 'column';
        body.dataset.gap = 'md';
        const first = document.createElement('div');
        first.textContent = 'what went wrong';
        const second = document.createElement('div');
        second.textContent = 'and why';
        body.append(first, second);
        await new Promise((done) => requestAnimationFrame(() => done(null)));
        return Math.round(second.getBoundingClientRect().top - first.getBoundingClientRect().bottom);
    });
    expect(apart).toBe(8);
});

test('Spike: a block of rows spaced by margins alone has none', async ({ page }) => {
    expect(await spaced(page, COLUMN('', 'style="margin-top: 10px; margin-bottom: 6px"'))).toEqual([0, 0]);
});

// As tweak writes its window on elements 1.36.2 (teranos/tweak#1): rows a grid at 10, groups a margin of 4 and 6.
test('Jenny: tweak\'s window spaces its rows at the package\'s gap, not its own', async ({ page }) => {
    const sheet = `.tweak-row { display: grid; grid-template-columns: minmax(90px, 140px) 1fr 44px; gap: 10px; align-items: center; min-height: 24px; }
.tweak-group { margin: 4px 0 6px; opacity: 0.55; }
.tweak-rows { display: flex; flex-direction: column; }`;
    const markup = `<div class="tweak-rows"><div data-row class="tweak-group">shape</div>${'<div data-row class="tweak-row"><span>zoom</span><input type="range"><span>1.00</span></div>'.repeat(2)}</div>`;
    expect(await spaced(page, markup, sheet)).toEqual([8, 8]);
});

test('Jenny: the page\'s root says the gaps, and a host\'s important rule does not move them', async ({ page }) => {
    await page.goto('/');
    await page.locator(GERMANIUM).waitFor();
    const said = await page.evaluate(() => {
        const style = document.createElement('style');
        style.textContent = ':root { --gap-sm: 1px !important; --gap-md: 3px !important; --gap-lg: 5px !important; }';
        document.head.appendChild(style);
        const root = getComputedStyle(document.documentElement);
        return ['sm', 'md', 'lg'].map((name) => root.getPropertyValue(`--gap-${name}`).trim());
    });
    expect(said).toEqual(['4px', '8px', '16px']);
});
