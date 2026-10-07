/**
 * What happens on the page while a real device's keyboard comes and goes.
 *
 * The subject is Selenium, a window, or with ?subject=agent Polonium, QNTX's Pi
 * element as a phone shows it: a full-screen panel.
 *
 * Each function runs inside the page — in Mobile Safari through WebDriver, in
 * Chrome on Android through Playwright — so each stands alone: no imports, no
 * closures, sent as its own source.
 */

/** The subject opens from the tray and settles: Selenium as a window, Polonium as a full-screen panel. */
export async function openSubject(): Promise<boolean> {
    // Which specimen: ?subject=agent is Polonium, a full-screen panel; otherwise Selenium, a window.
    const agent = new URLSearchParams(location.search).get('subject') === 'agent';
    const el = document.querySelector(agent ? '[data-element-id="agent-specimen"]' : '[data-element-id="field-specimen"]') as HTMLElement;
    el.click();
    for (let i = 0; i < 100; i++) {
        if (el.dataset.form === (agent ? 'panel' : 'window') && !el.classList.contains('morphing')) return true;
        await new Promise((r) => setTimeout(r, 50));
    }
    return false;
}

/** Where a drag to the bottom of the screen leaves a window, whole: where a keyboard comes. A panel is the whole screen already. */
export function placeLow(): number {
    // Which specimen: ?subject=agent is Polonium, a full-screen panel; otherwise Selenium, a window.
    const agent = new URLSearchParams(location.search).get('subject') === 'agent';
    const el = document.querySelector(agent ? '[data-element-id="agent-specimen"]' : '[data-element-id="field-specimen"]') as HTMLElement;
    const r = el.getBoundingClientRect();
    if (agent) return Math.round(r.top);
    const top = Math.round(window.innerHeight - 8 - r.height);
    el.style.top = `${top}px`;
    return top;
}

/** What the page can say about itself: the visual viewport, the window, the field. */
export function state(): Record<string, unknown> {
    // Which specimen: ?subject=agent is Polonium, a full-screen panel; otherwise Selenium, a window.
    const agent = new URLSearchParams(location.search).get('subject') === 'agent';
    const el = document.querySelector(agent ? '[data-element-id="agent-specimen"]' : '[data-element-id="field-specimen"]') as HTMLElement;
    const field = el.querySelector('input, textarea') as HTMLInputElement;
    const vv = window.visualViewport!;
    const w = el.getBoundingClientRect();
    const f = field.getBoundingClientRect();
    // Rects in the coordinates a fixed element is placed in. WebKit measures from
    // the visual viewport, Chrome from the layout one: a fixed probe at top 0 says
    // which. Where to tap stays as measured, since touches are measured alike.
    const probe = document.createElement('div');
    probe.style.cssText = 'position: fixed; top: 0; left: 0; width: 1px; height: 1px; visibility: hidden';
    document.body.appendChild(probe);
    const shift = probe.getBoundingClientRect().top;
    probe.remove();
    return {
        subject: agent ? 'agent' : 'field',
        innerHeight: window.innerHeight,
        visualViewport: { height: vv.height, offsetTop: vv.offsetTop, scale: vv.scale },
        window: { top: w.top - shift, bottom: w.bottom - shift },
        field: { top: f.top - shift, bottom: f.bottom - shift, centerX: (f.left + f.right) / 2, centerY: (f.top + f.bottom) / 2 },
        focused: document.activeElement === field,
        value: field.value,
        devicePixelRatio: window.devicePixelRatio,
    };
}

/** The next touch, where the page saw it — to learn where the page sits on the screen. */
export function listenForTouch(): void {
    (window as unknown as { seenTouch: unknown }).seenTouch = null;
    document.addEventListener('touchstart', (e) => {
        const t = e.touches[0]!;
        (window as unknown as { seenTouch: unknown }).seenTouch = { x: t.clientX, y: t.clientY };
    }, { capture: true, once: true });
}

export function seenTouch(): { x: number; y: number } | null {
    return (window as unknown as { seenTouch: { x: number; y: number } | null }).seenTouch;
}

export interface PageState {
    subject: string;
    innerHeight: number;
    visualViewport: { height: number; offsetTop: number; scale: number };
    window: { top: number; bottom: number };
    field: { top: number; bottom: number; centerX: number; centerY: number };
    focused: boolean;
    value: string;
    devicePixelRatio: number;
}

/**
 * What a real keyboard must leave true. Returns what failed, empty when
 * nothing did.
 */
export function judge(before: PageState, up: PageState, gone: PageState): string[] {
    const failed: string[] = [];
    const seenBottom = up.visualViewport.offsetTop + up.visualViewport.height;
    if (!(up.visualViewport.height < before.visualViewport.height - 100)) {
        failed.push(`${up.subject}: no keyboard came: the visual viewport stayed ${up.visualViewport.height} tall (was ${before.visualViewport.height})`);
    }
    if (!up.focused) failed.push(`${up.subject}: the field did not keep focus`);
    // iOS Safari zooms the page in on a field whose text is under 16px, and every element moves with it.
    if (Math.abs(up.visualViewport.scale - 1) > 0.01) {
        failed.push(`${up.subject}: the page zoomed to ${up.visualViewport.scale} when the field took focus: its text is under 16px`);
    }
    if (!(up.field.bottom <= seenBottom + 1)) {
        failed.push(`${up.subject}: the field ends at ${up.field.bottom}, under the keyboard, which begins at ${seenBottom}`);
    }
    if (!(up.window.top >= up.visualViewport.offsetTop - 1)) {
        failed.push(`${up.subject}: the title bar is above what is seen: ${up.window.top} < ${up.visualViewport.offsetTop}`);
    }
    if (Math.abs(gone.window.top - before.window.top) > 1) {
        failed.push(`${up.subject}: after the keyboard, it stands at ${gone.window.top}, not where it stood (${before.window.top})`);
    }
    return failed;
}
