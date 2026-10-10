/**
 * A panel on a phone reads at a phone's size, in a real browser.
 *
 * "QNTX's text and message box sized like Claude's on the phone, owned by
 * Elements so no host has to remember it."
 *
 * Krypton opens as a panel. On a touch screen the page's text in it is seen at
 * 17 (Apple Human Interface Guidelines, Typography: body text at the default
 * size), whatever size the page draws it at; with a mouse it is seen at the
 * page's own size. What is measured is a block ten ems tall, counted in the
 * pixels of a screenshot, so it is what a person sees and not what a stylesheet
 * or an engine's boxes say.
 *
 * Personas:
 * - Tim: Happy path — on a phone the panel's text is seen at 17
 * - Spike: Edge cases — with a mouse it is seen at the page's own size
 */

import { test, expect } from '@playwright/test';

const KRYPTON = '[data-element-id="panel-specimen"]';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(KRYPTON).waitFor();
});

test('a panel\'s text is seen at 17 on a touch screen, and at the page\'s size with a mouse', async ({ page, isMobile }) => {
    const krypton = page.locator(KRYPTON);
    await krypton.click();
    await expect(krypton).toHaveAttribute('data-form', 'panel');
    await expect.poll(() => krypton.evaluate((el) => el.classList.contains('morphing'))).toBe(false);

    // A block ten ems of the page's text tall, in a colour nothing else wears,
    // measured off a screenshot: what is drawn, whatever an engine says of its
    // boxes to a script.
    const drawnAt = await krypton.evaluate((el) => {
        const body = el.querySelector<HTMLElement>(':scope > [data-scroller="body"]')!;
        const em = document.createElement('div');
        em.id = 'one-em';
        em.style.width = '1em';
        // Ten, so an edge row a screenshot blends is a tenth of a pixel, not one.
        em.style.height = '10em';
        em.style.background = 'rgb(255, 0, 255)';
        body.prepend(em);
        return parseFloat(getComputedStyle(body).fontSize);
    });
    // At the device's own pixels, so an edge is not blended away, then back to CSS pixels.
    const shot = (await page.screenshot({ scale: 'device' })).toString('base64');
    const ratio = await page.evaluate(() => window.devicePixelRatio);
    const height = await page.evaluate(async (png) => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, img.width, img.height);
        let rows = 0;
        for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
                const i = (y * img.width + x) * 4;
                if (data[i] > 240 && data[i + 1] < 15 && data[i + 2] > 240) { rows++; break; }
            }
        }
        return rows;
    }, shot);
    const seen = { height: height / ratio / 10, drawnAt };

    if (isMobile) {
        expect(seen.height).toBeCloseTo(17, 0);
    } else {
        expect(seen.height).toBeCloseTo(seen.drawnAt, 0);
    }
});
