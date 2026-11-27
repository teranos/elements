/**
 * 「[Fable 5.2] In the page, under the harness at /pill: open xenon, then say what happens to the pill of what one agent said —」
 * 「[Fable 5.2] every touch, focus coming and going, the visual viewport resizing, and twice a second where things stand — to」
 * 「[Fable 5.2] /report. A finger opens the pill and presses in it; the page only tells.」
 */

import { openXenon, pillState } from './scene';

function post(event: string, extra: Record<string, unknown> = {}): void {
    void fetch('/report', {
        method: 'POST',
        body: JSON.stringify({
            scene: 'pill',
            event,
            at: Math.round(performance.now()),
            screen: { width: screen.width, height: screen.height },
            state: pillState(),
            ...extra,
        }),
    });
}

document.addEventListener('touchstart', (e) => {
    const t = e.touches[0]!;
    post('touch', { touch: { x: t.clientX, y: t.clientY } });
}, { capture: true });
document.addEventListener('focusin', () => post('focusin'));
document.addEventListener('focusout', () => setTimeout(() => post('focusout'), 0));

// The keyboard animates in; say where things settled, not where they passed.
let settling: ReturnType<typeof setTimeout> | undefined;
const settle = () => {
    clearTimeout(settling);
    settling = setTimeout(() => post('viewport'), 400);
};
window.visualViewport?.addEventListener('resize', settle);
window.visualViewport?.addEventListener('scroll', settle);

void (async () => {
    await new Promise((r) => setTimeout(r, 500));
    const opened = await openXenon();
    setTimeout(() => post('ready', { opened }), 300);
    // A pill moves across its row with no event the page hears: where it stands is said as it goes.
    setInterval(() => post('tick'), 500);
})();
