// "no element should have content that isnt accesible"
// Whatever a host writes into an element, every node of it stands inside the element: none past
// its edge, none hidden by dropping dead, on every screen.

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

const LONG = 'the node did not say which templates mail is filled from: /api/mail/templates: HTTP 500 ' +
    '{"id":"ERR-1792245572313-2","error":"template record AS-CLEANAPI-MAILTEMP-CLEANAPI-XEV3IP7S was kept before a template\'s bodies were named"}';

/** Every way a host writes content that will not fit, each as it would write it. */
const HOSTILE: Record<string, string> = {
    'nowrap': `<span style="white-space: nowrap">${LONG}</span>`,
    'nowrap, important': `<span style="white-space: nowrap !important">${LONG}</span>`,
    'pre': `<pre>${LONG}</pre>`,
    'fixed width': `<div style="width: 3000px">${LONG}</div>`,
    'min-width': `<div style="min-width: 3000px">wide by its least</div>`,
    'row that does not give way': `<div style="display: flex">${'<span style="flex: none; width: 400px">a cell</span>'.repeat(6)}</div>`,
    'table': `<table><tr>${`<td style="white-space: nowrap">${LONG}</td>`.repeat(3)}</tr></table>`,
    'ellipsis': `<div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${LONG}</div>`,
    // As QNTX's Database writes its counts on q: tracks in px, wider than a phone.
    'grid tracks': `<div style="display: grid; grid-template-columns: 110px auto 84px 84px 132px 72px 300px">${'<span>12a 345s 678c</span>'.repeat(14)}</div>`,
    // As QNTX's Ground hangs its labels on a line: centred on a point at the line's very end.
    'label hung at the edge': `<div style="position: relative; height: 60px"><div style="position: absolute; left: 100%; transform: translateX(-50%); width: 140px">a label hung here</div><div style="position: absolute; left: 0; transform: translateX(-50%); width: 140px">and here</div></div>`,
    // As a row of presses and icons: each keeps its size, and the row wraps.
    // As QNTX's Plugin writes its badges: rows of a glyph and a word in a row, whose words give way and glyphs cannot.
    'row that squeezes what is in it': `<div style="display: flex; gap: 10px">${'<div style="display: flex; gap: 4px"><span>●</span><span>running</span></div>'.repeat(8)}</div>`,
    'row of things that keep their size':`<div style="display: inline-flex">${'<span style="flex: none; width: 90px; white-space: nowrap">a press</span>'.repeat(8)}</div>`,
};

for (const [name, markup] of Object.entries(HOSTILE)) {
    test(`${name}: every node stands inside the element, and it is alive`, async ({ page }) => {
        await page.goto('/');
        await page.locator(GERMANIUM).waitFor();
        await opened(page);
        await page.locator(`${GERMANIUM} .content-area`).evaluate((area, markup) => {
            const holder = document.createElement('div');
            holder.dataset.hostile = '';
            holder.innerHTML = markup;
            area.appendChild(holder);
        }, markup);
        await expect.poll(() => page.locator(GERMANIUM).evaluate((element) => {
            const edge = element.getBoundingClientRect();
            const past = Array.from(element.querySelectorAll<HTMLElement>('[data-hostile], [data-hostile] *'))
                .filter((node) => {
                    const r = node.getBoundingClientRect();
                    return r.left < edge.left - 1 || r.right > edge.right + 1 || node.scrollWidth > node.clientWidth + 1;
                })
                .map((node) => `${node.tagName.toLowerCase()} ${Math.round(node.getBoundingClientRect().width)}px`);
            const dead = element.querySelector('[data-too-wide]') ? 'dropped dead' : '';
            const off = edge.left < -1 || edge.right > window.innerWidth + 1 ? `the element ${Math.round(edge.left)}..${Math.round(edge.right)} of ${window.innerWidth}` : '';
            return [...past, dead, off].filter((said) => said !== '');
        })).toEqual([]);
    });
}

// "Button should never take up element full-width"
const STRETCHED: Record<string, string> = {
    'a column that stretches what is in it': '<div style="display: flex; flex-direction: column"><button>Generate a new secret</button></div>',
    'a grid cell': '<div style="display: grid"><button>Generate a new secret</button></div>',
    'width 100%': '<button style="width: 100%">Generate a new secret</button>',
    'width 100%, important': '<button style="width: 100% !important">Generate a new secret</button>',
    'flex 1 in a row': '<div style="display: flex"><button style="flex: 1">Generate a new secret</button></div>',
    'a block': '<button style="display: block">Generate a new secret</button>',
};

for (const [name, markup] of Object.entries(STRETCHED)) {
    test(`a button in ${name} is as wide as what it says, never the element's width`, async ({ page }) => {
        await page.goto('/');
        await page.locator(GERMANIUM).waitFor();
        await opened(page);
        await page.locator(`${GERMANIUM} .content-area`).evaluate((area, markup) => {
            const holder = document.createElement('div');
            holder.dataset.hostile = '';
            holder.innerHTML = markup;
            area.appendChild(holder);
        }, markup);
        await expect.poll(() => page.locator(`${GERMANIUM} [data-hostile] button`).evaluate((button) => {
            const holder = button.closest('[data-hostile]')!.getBoundingClientRect().width;
            const text = document.createRange();
            text.selectNodeContents(button);
            const cs = getComputedStyle(button);
            const needs = text.getBoundingClientRect().width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
                + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
            const width = button.getBoundingClientRect().width;
            return width <= needs + 1 && width < holder - 1 ? 'as wide as it says' : `${Math.round(width)} wide for ${Math.round(needs)} in ${Math.round(holder)}`;
        })).toBe('as wide as it says');
    });
}

// "buttons in row's should be consistnetly placed and alligned"
test('the presses in a list of rows stand in one place, whichever row ran out of room', async ({ page }) => {
    await page.goto('/');
    await page.locator(GERMANIUM).waitFor();
    await opened(page);
    // As QNTX's GitHub lists where each namespace calls from: a name, and its press at the far end.
    await page.locator(`${GERMANIUM} .content-area`).evaluate((area) => {
        const holder = document.createElement('div');
        holder.dataset.hostile = '';
        const row = (name: string) => `<div class="from-row" style="display: flex; justify-content: space-between; gap: 8px"><span style="white-space: nowrap">${name}:</span><button style="white-space: nowrap">System's GitHub</button></div>`;
        holder.innerHTML = [row('AWS'), row('a namespace whose name runs on and on'), row('Clean')].join('');
        area.appendChild(holder);
    });
    await expect.poll(() => page.locator(`${GERMANIUM} [data-hostile]`).evaluate((holder) =>
        Array.from(holder.querySelectorAll('button')).map((b) => Math.round(b.getBoundingClientRect().left)).filter((left, i, all) => all.indexOf(left) === i).length,
    )).toBe(1);
});

// As QNTX's Claude writes its transcript: a row as tall as it is given, a scroller in it, more said than it shows.
test('a row that fits keeps its scroller as tall as the row, and the scroller scrolls', async ({ page }) => {
    await page.goto('/');
    await page.locator(GERMANIUM).waitFor();
    await opened(page);
    const held = await page.locator(`${GERMANIUM} .content-area`).evaluate((area) => {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; height: 120px';
        const scroller = document.createElement('div');
        scroller.style.cssText = 'flex: 1; overflow-y: auto';
        scroller.innerHTML = '<div>a line said</div>'.repeat(40);
        row.appendChild(scroller);
        area.appendChild(row);
        return new Promise<string>((done) => requestAnimationFrame(() => requestAnimationFrame(() =>
            done(`${scroller.clientHeight} of ${scroller.scrollHeight}`))));
    });
    const [shown, all] = held.split(' of ').map(Number);
    expect(shown, held).toBeLessThanOrEqual(121);
    expect(all!, held).toBeGreaterThan(shown!);
});
