/**
 * A person can zoom the page, and a field still zooms nothing.
 *
 * "Be prepared for text-size changes. People use Dynamic Type to increase text size to be more
 * readable ... Apps that don't respond to this setting can be difficult or impossible to use for
 * people who rely on this feature." (Apple Human Interface Guidelines, Accessibility)
 *
 * The package once held `maximum-scale=1` on every viewport line so iOS Safari would not zoom onto a
 * small field. Measured in a Chromium phone, that hold takes pinch zoom away entirely: a pinch of
 * 2.5 leaves the scale at 1, and without it the same pinch reaches 2.5. What keeps a field from
 * zooming iOS is its size: inside an element a field is at 16 whatever a host writes (text.ts), so
 * the hold was a second lock on a door that was already shut, and it locked people out of zoom.
 *
 * Personas:
 * - Tim: Happy path — a pinch zooms the page; the page's own viewport line is left as the host wrote it
 * - Spike: Edge cases — a host that says maximum-scale itself keeps what it said
 * - Jenny: Complex scenarios — a field, an editor, or a field in a shadow root, a host dresses small is still at 16 in an element;
 *   a keyboard over a page that is pinched is answered, a pinch alone is not
 */

import { test, expect, type Page } from '@playwright/test';

function lines(page: Page): Promise<string[]> {
    return page.evaluate(() =>
        [...document.querySelectorAll<HTMLMetaElement>('meta[name="viewport"]')].map((m) => m.content),
    );
}

const KRYPTON = '[data-element-id="panel-specimen"]';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-element-id="field-specimen"]').waitFor();
});

test.describe('Tim: the page is the person\'s to zoom', () => {
    test('a pinch zooms the page', async ({ page, browserName, isMobile }) => {
        // A pinch is raised through the DevTools protocol, which only Chromium answers.
        test.skip(browserName !== 'chromium' || !isMobile, 'a pinch gesture is synthesised in Chromium on a phone');
        const cdp = await page.context().newCDPSession(page);
        expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
        await cdp.send('Input.synthesizePinchGesture', { x: 195, y: 400, scaleFactor: 2.5, relativeSpeed: 300 });
        await expect.poll(() => page.evaluate(() => visualViewport!.scale)).toBeGreaterThan(1);
    });

    test('the viewport line is the one the host wrote', async ({ page }) => {
        expect(await lines(page)).toEqual(['width=device-width, initial-scale=1, viewport-fit=cover']);
    });
});

test.describe('Spike: what a host says about scale is the host\'s', () => {
    test('a host\'s own maximum-scale is left as it is', async ({ page }) => {
        await page.evaluate(() => {
            document.querySelector<HTMLMetaElement>('meta[name="viewport"]')!.content = 'width=device-width, maximum-scale=3';
        });
        // Long enough for an observer to have said anything.
        await page.waitForTimeout(300);
        expect(await lines(page)).toEqual(['width=device-width, maximum-scale=3']);
    });
});

test.describe('Jenny: a field, small by a host, in an element', () => {
    test('is at 16, the size iOS Safari does not zoom the page for', async ({ page }) => {
        await page.addStyleTag({ content: 'input, textarea, select { font-size: 12px; }' });
        const krypton = page.locator(KRYPTON);
        await krypton.click();
        await expect(krypton).toHaveAttribute('data-form', 'panel');
        await expect.poll(() => krypton.evaluate((el) => el.classList.contains('morphing'))).toBe(false);

        const sizes = await krypton.locator('input').evaluateAll((fields) => fields.map((el) => getComputedStyle(el).fontSize));
        expect(sizes.length).toBeGreaterThan(0);
        expect(sizes.every((size) => size === '16px')).toBe(true);
    });

    test('an editor (contenteditable), and the text in it, is at 16 too', async ({ page }) => {
        await page.addStyleTag({ content: '.host-editor, .host-editor * { font-size: 11px; }' });
        const krypton = page.locator(KRYPTON);
        await krypton.click();
        await expect(krypton).toHaveAttribute('data-form', 'panel');
        await expect.poll(() => krypton.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
        // The shape CodeMirror gives a page: a div that takes typing, with a line in it.
        await krypton.evaluate((el) => {
            const editor = document.createElement('div');
            editor.className = 'host-editor';
            editor.contentEditable = 'true';
            const line = document.createElement('div');
            line.textContent = 'x = 1';
            editor.appendChild(line);
            const plain = document.createElement('div');
            plain.className = 'host-editor';
            plain.contentEditable = 'false';
            plain.textContent = 'not for typing';
            el.append(editor, plain);
        });

        const sizes = await krypton.evaluate((el) => ({
            editor: getComputedStyle(el.querySelector('.host-editor[contenteditable="true"]')!).fontSize,
            line: getComputedStyle(el.querySelector('.host-editor[contenteditable="true"] > div')!).fontSize,
            plain: getComputedStyle(el.querySelector('.host-editor[contenteditable="false"]')!).fontSize,
        }));
        expect(sizes).toEqual({ editor: '16px', line: '16px', plain: '11px' });
    });

    test('a field in a shadow root is at 16 too, the root attached before or after', async ({ page }) => {
        const krypton = page.locator(KRYPTON);
        await krypton.click();
        await expect(krypton).toHaveAttribute('data-form', 'panel');
        await expect.poll(() => krypton.evaluate((el) => el.classList.contains('morphing'))).toBe(false);

        const sizes = await krypton.evaluate(async (el) => {
            const make = () => {
                const host = document.createElement('div');
                const root = host.attachShadow({ mode: 'open' });
                root.innerHTML = '<style>input { font-size: 11px; }</style><input type="text">';
                return { host, root };
            };
            const early = make();
            el.appendChild(early.host);
            const late = make();
            await new Promise((done) => setTimeout(done, 100));
            el.appendChild(late.host);
            await new Promise((done) => setTimeout(done, 100));
            const size = (r: ShadowRoot) => getComputedStyle(r.querySelector('input')!).fontSize;
            return { early: size(early.root), late: size(late.root) };
        });
        expect(sizes).toEqual({ early: '16px', late: '16px' });
    });

    test('a pinched page with a keyboard over it: the panel ends above the keyboard; a pinch alone moves nothing', async ({ page, browserName, isMobile }) => {
        test.skip(browserName !== 'chromium' || !isMobile, 'a pinch gesture is synthesised in Chromium on a phone');
        const krypton = page.locator(KRYPTON);
        await krypton.click();
        await expect(krypton).toHaveAttribute('data-form', 'panel');
        await expect.poll(() => krypton.evaluate((el) => el.classList.contains('morphing'))).toBe(false);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.synthesizePinchGesture', { x: 195, y: 400, scaleFactor: 2, relativeSpeed: 300 });
        await expect.poll(() => page.evaluate(() => visualViewport!.scale)).toBeGreaterThan(1.5);
        const cap = await krypton.evaluate((el) => el.style.maxHeight);

        // A pinch alone: the panel is not cut to what the zoom shows.
        await krypton.locator('input').last().focus();
        await page.waitForTimeout(200);
        expect(await krypton.evaluate((el) => el.style.maxHeight)).toBe(cap);

        // The keyboard comes up over the pinched page: height = (screen - keyboard) / scale.
        await page.evaluate((keyboard) => {
            const vv = visualViewport!;
            const shown = (window.innerHeight - keyboard) / vv.scale;
            Object.defineProperty(vv, 'height', { configurable: true, get: () => shown });
            vv.dispatchEvent(new Event('resize'));
        }, 336);
        await expect.poll(() => krypton.evaluate((el) => el.style.maxHeight)).not.toBe(cap);
        const seen = await page.evaluate(() => ({ top: visualViewport!.offsetTop, height: visualViewport!.height }));
        const panel = await krypton.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, vvTop: visualViewport!.offsetTop };
        });
        expect(panel.bottom - panel.vvTop).toBeLessThanOrEqual(seen.height + 2);
    });
});
