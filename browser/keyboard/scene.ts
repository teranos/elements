/**
 * What happens on the page while a real device's keyboard comes and goes.
 *
 * Each function runs inside the page — in Mobile Safari through WebDriver, in
 * Chrome on Android through Playwright — so each stands alone: no imports, no
 * closures, sent as its own source.
 */

/** Selenium opens from the tray and settles as a window. */
export async function openSelenium(): Promise<boolean> {
    const el = document.querySelector('[data-element-id="field-specimen"]') as HTMLElement;
    el.click();
    for (let i = 0; i < 100; i++) {
        if (el.dataset.form === 'window' && !el.classList.contains('morphing')) return true;
        await new Promise((r) => setTimeout(r, 50));
    }
    return false;
}

/** Where a drag to the bottom of the screen leaves it, whole: where a keyboard comes. */
export function placeLow(): number {
    const el = document.querySelector('[data-element-id="field-specimen"]') as HTMLElement;
    const r = el.getBoundingClientRect();
    const top = Math.round(window.innerHeight - 8 - r.height);
    el.style.top = `${top}px`;
    return top;
}

/** What the page can say about itself: the visual viewport, the window, the field. */
export function state(): Record<string, unknown> {
    const el = document.querySelector('[data-element-id="field-specimen"]') as HTMLElement;
    const field = el.querySelector('input') as HTMLInputElement;
    const vv = window.visualViewport!;
    const w = el.getBoundingClientRect();
    const f = field.getBoundingClientRect();
    return {
        innerHeight: window.innerHeight,
        visualViewport: { height: vv.height, offsetTop: vv.offsetTop, scale: vv.scale },
        window: { top: w.top, bottom: w.bottom },
        field: { top: f.top, bottom: f.bottom, centerX: (f.left + f.right) / 2, centerY: (f.top + f.bottom) / 2 },
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
        failed.push(`no keyboard came: the visual viewport stayed ${up.visualViewport.height} tall (was ${before.visualViewport.height})`);
    }
    if (!up.focused) failed.push('the field did not keep focus');
    if (!(up.field.bottom <= seenBottom + 1)) {
        failed.push(`the field ends at ${up.field.bottom}, under the keyboard, which begins at ${seenBottom}`);
    }
    if (!(up.window.top >= up.visualViewport.offsetTop - 1)) {
        failed.push(`the title bar is above what is seen: ${up.window.top} < ${up.visualViewport.offsetTop}`);
    }
    if (Math.abs(gone.window.top - before.window.top) > 1) {
        failed.push(`after the keyboard, the window stands at ${gone.window.top}, not where it stood (${before.window.top})`);
    }
    return failed;
}
