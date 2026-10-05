/**
 * In the page, under the harness: open Selenium low on the screen, then say
 * what happens — every touch, focus coming and going, the visual viewport
 * resizing, typing — to /report.
 */

import { openSelenium, placeLow, state } from './scene';

function post(event: string, extra: Record<string, unknown> = {}): void {
    void fetch('/report', {
        method: 'POST',
        body: JSON.stringify({
            event,
            at: Math.round(performance.now()),
            screen: { width: screen.width, height: screen.height },
            state: state(),
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
document.addEventListener('input', () => post('input'));

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
    const opened = await openSelenium();
    placeLow();
    setTimeout(() => post('ready', { opened }), 300);
})();
