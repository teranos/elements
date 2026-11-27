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
    // Rects in the coordinates a fixed element is placed in. WebKit measures from
    // the visual viewport, Chrome from the layout one: a fixed probe at top 0 says
    // which. Where to tap stays as measured, since touches are measured alike.
    const probe = document.createElement('div');
    probe.style.cssText = 'position: fixed; top: 0; left: 0; width: 1px; height: 1px; visibility: hidden';
    document.body.appendChild(probe);
    const shift = probe.getBoundingClientRect().top;
    probe.remove();
    return {
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
    // "You tap a box to type, and the only thing that should happen is the keyboard coming up."
    if (up.visualViewport.scale !== before.visualViewport.scale) {
        failed.push(`the page zoomed: scale ${before.visualViewport.scale} before the tap, ${up.visualViewport.scale} with the keyboard up`);
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

// 「[Fable 5.2] ── The pill of what one agent said, in xenon ───────────────────────────」
//
// 「[Fable 5.2] The same question, asked of a pill in a chat's field: a finger on edit brings the keyboard and nothing else,」
// 「[Fable 5.2] and a finger on delay reaches the device's own date and time setter.」

/** Xenon opens from the tray and settles as a panel. */
export async function openXenon(): Promise<boolean> {
    const el = document.querySelector('[data-element-id="chat-specimen"]') as HTMLElement;
    el.click();
    for (let i = 0; i < 100; i++) {
        if (el.dataset.form === 'panel' && !el.classList.contains('morphing')) return true;
        await new Promise((r) => setTimeout(r, 50));
    }
    return false;
}

/** What the page can say about the pill: where a finger finds it and its presses, and what has the focus. */
export function pillState(): Record<string, unknown> {
    const pill = document.querySelector('[data-said="rowan"]') as HTMLElement | null;
    const vv = window.visualViewport!;
    const probe = document.createElement('div');
    probe.style.cssText = 'position: fixed; top: 0; left: 0; width: 1px; height: 1px; visibility: hidden';
    document.body.appendChild(probe);
    const shift = probe.getBoundingClientRect().top;
    probe.remove();
    const middle = (node: Element | null | undefined) => {
        if (!node) return null;
        const r = node.getBoundingClientRect();
        return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
    };
    const field = pill?.querySelector('textarea') ?? null;
    const setter = pill?.querySelector('input[type="datetime-local"]') ?? null;
    const f = field?.getBoundingClientRect();
    return {
        innerHeight: window.innerHeight,
        visualViewport: { height: vv.height, offsetTop: vv.offsetTop, scale: vv.scale },
        pill: { form: pill?.dataset.form ?? null, moving: pill?.dataset.pillMoving !== undefined, at: middle(pill) },
        edit: middle(pill?.querySelector('[data-act="edit"]')),
        delay: middle(pill?.querySelector('[data-act="delay"]')),
        field: f ? { top: f.top - shift, bottom: f.bottom - shift } : null,
        fieldFocused: field !== null && document.activeElement === field,
        setterFocused: setter !== null && document.activeElement === setter,
        devicePixelRatio: window.devicePixelRatio,
    };
}

export interface PillState {
    innerHeight: number;
    visualViewport: { height: number; offsetTop: number; scale: number };
    pill: { form: string | null; moving: boolean; at: { x: number; y: number } | null };
    edit: { x: number; y: number } | null;
    delay: { x: number; y: number } | null;
    field: { top: number; bottom: number } | null;
    fieldFocused: boolean;
    setterFocused: boolean;
    devicePixelRatio: number;
}

/**
 * 「[Fable 5.2] What a real finger on the pill must leave true: `open` is the pill pressed open, `setter` after a tap on delay, `up`」
 * 「[Fable 5.2] after a tap on edit. Returns what failed, empty when nothing did.」
 */
export function judgePill(open: PillState, setter: PillState, up: PillState): string[] {
    const failed: string[] = [];
    if (open.pill.form !== 'pillOpen') failed.push(`a tap on the pill did not open it: it is ${open.pill.form}`);
    if (!setter.setterFocused) failed.push('a tap on delay did not reach the date and time setter');
    if (!up.field) {
        failed.push('a tap on edit made no field of what was said');
        return failed;
    }
    const seenBottom = up.visualViewport.offsetTop + up.visualViewport.height;
    if (!(up.visualViewport.height < open.visualViewport.height - 100)) {
        failed.push(`no keyboard came: the visual viewport stayed ${up.visualViewport.height} tall (was ${open.visualViewport.height})`);
    }
    if (up.visualViewport.scale !== open.visualViewport.scale) {
        failed.push(`the page zoomed: scale ${open.visualViewport.scale} before the tap, ${up.visualViewport.scale} with the keyboard up`);
    }
    if (!up.fieldFocused) failed.push('the field did not take the cursor');
    if (!(up.field.bottom <= seenBottom + 1)) {
        failed.push(`the field ends at ${up.field.bottom}, under the keyboard, which begins at ${seenBottom}`);
    }
    return failed;
}
