/**
 * A window or a panel, and the on-screen keyboard.
 *
 * Apple Human Interface Guidelines, Virtual keyboards: the layout guide "helps
 * you keep important parts of your interface visible while the virtual
 * keyboard is onscreen". A browser has no layout guide. iOS Safari and Chrome
 * on Android leave a fixed window where it is and let the keyboard cover it;
 * what shrinks is the visual viewport (safe-area.ts, visibleArea).
 *
 * So while a field in a window or panel has focus, it answers the visual
 * viewport — a panel on a phone being the whole screen: it rises only as far as it must to be seen whole, title bar first
 * when it cannot be, and goes back to where it stood when the keyboard goes.
 * Where a window stands is a person's to say: one dragged while the keyboard
 * is up stays where it was dragged.
 */

import { visibleArea } from '../safe-area';
import { getForm } from '../dataset';
import { holdPosition } from '../position';

// 「[Sonnet 5.5] A field taking the keyboard zooms nothing: inside an element a field is at 16, whatever a host writes」
// 「[Sonnet 5.5] (text.ts), and the page's scale is the person's. It is not held (browser/zoom.browser.ts).」
// Nor does it move the page under it (position.ts).
holdPosition();

/** Where a window stood before the keyboard came, and what was written over it. */
interface Stood {
    top: string;
    maxHeight: string;
    paddingBottom: string;
    y: number;
    height: number;
    wrote: string;
}

const stood = new Map<HTMLElement, Stood>();
const wired = new WeakSet<HTMLElement>();

/** The window whose field has focus — the one a keyboard is up for. */
let answering: HTMLElement | null = null;

/** The visual viewport being listened to; a page has one, a test may swap it. */
let heard: VisualViewport | null = null;

// Input types a keyboard does not come up for.
const UNTYPED = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit']);

function takesTyping(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el || !el.tagName) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') return !UNTYPED.has((el as HTMLInputElement).type);
    return el.isContentEditable === true;
}

function hear(): void {
    const vv = (window as { visualViewport?: VisualViewport | null }).visualViewport ?? null;
    if (!vv || vv === heard) return;
    heard?.removeEventListener('resize', onViewport);
    heard?.removeEventListener('scroll', onViewport);
    vv.addEventListener('resize', onViewport);
    vv.addEventListener('scroll', onViewport);
    heard = vv;
}

function onViewport(): void {
    for (const el of [...stood.keys()]) {
        if (el !== answering) backFromKeyboard(el);
    }
    if (answering) answer(answering);
    else if (keyboardTakes() <= ROUNDING) before = null;
}

/** Keep a window whose field has focus where the keyboard leaves it seen. */
function answer(element: HTMLElement): void {
    // A window or panel mid-morph is its morph's to place (Morph Axioma).
    const form = getForm(element);
    if (!element.isConnected || (form !== 'window' && form !== 'panel') || element.classList.contains('morphing')) return;

    let before = stood.get(element);
    if (before && element.style.top !== before.wrote) {
        // Moved by a person since: where it is now is where it stands.
        stood.delete(element);
        before = undefined;
    }

    // Where a window stands is its own top, in the coordinates it is placed in.
    // Its rect is not: WebKit measures from the visual viewport, which Safari
    // pans down the page when the keyboard comes. Its height is the same either way.
    const rect = element.getBoundingClientRect();
    const placed = parseFloat(element.style.top);
    const from = before ?? {
        top: element.style.top,
        maxHeight: element.style.maxHeight,
        paddingBottom: element.style.paddingBottom,
        y: Number.isFinite(placed) ? placed : rect.top,
        height: rect.height,
    };

    // 「[Sonnet 5.5] A page a person has pinched in shows less of itself (height = screen / scale), and that is the」
    // 「[Sonnet 5.5] pinch's, not the keyboard's: a window answers none of it. Cut to it, a panel stopped three」
    // 「[Sonnet 5.5] quarters down. What the visual viewport is short of that, a keyboard took (keyboardTakes()).」
    if (pinched() && keyboardTakes() <= ROUNDING) {
        if (before) backFromKeyboard(element);
        return;
    }

    // A panel's background reaches the screen's edges and keeps what is in it off
    // them itself (forms/panel.ts): it answers the keyboard, not the safe area,
    // or the status bar and the home indicator are each kept off it twice.
    const area = form === 'panel' ? keyboardLeaves() : visibleArea();
    const height = Math.min(from.height, area.height);
    const y = Math.min(Math.max(from.y, area.y), area.y + area.height - height);

    if (y === from.y && height === from.height) {
        if (before) backFromKeyboard(element);
        return;
    }

    element.style.top = `${y}px`;
    element.style.maxHeight = height < from.height ? `${height}px` : from.maxHeight;
    // The keyboard covers the home indicator: nothing is held back for it.
    if (form === 'panel') element.style.paddingBottom = '0px';
    stood.set(element, { ...from, wrote: element.style.top });
    keepFieldSeen(element);
}

/** The page is zoomed in: what is seen of it is smaller than the screen, keyboard or not. */
function pinched(): boolean {
    const vv = (window as { visualViewport?: VisualViewport | null }).visualViewport;
    return !!vv && vv.scale > 1.01;
}

// 「[Sonnet 5.5] px: a visual viewport reports fractions; less than this is not a keyboard.」
const ROUNDING = 2;

/**
 * 「[Sonnet 5.5] How much of the layout the visual viewport showed before any keyboard: its height over its scale, and」
 * 「[Sonnet 5.5] its width over it. A pinch leaves both as they were (size = layout / scale); a keyboard lowers the」
 * 「[Sonnet 5.5] height. window.innerHeight is no baseline: Safari shrinks it with the keyboard (safe-area.ts).」
 * 「[Sonnet 5.5] It only ever rises while fields take focus (a keyboard already up cannot lower it, as focus moves」
 * 「[Sonnet 5.5] between windows), and goes when no keyboard is up. A field focused with a keyboard already up that」
 * 「[Sonnet 5.5] this page did not raise has no before to compare with: on a pinched page it is answered as no keyboard.」
 */
let before: { height: number; width: number } | null = null;

function shown(): { height: number; width: number } | null {
    const vv = (window as { visualViewport?: VisualViewport | null }).visualViewport;
    return vv ? { height: vv.height * vv.scale, width: vv.width * vv.scale } : null;
}

/** What the keyboard takes, in px: what the visual viewport shows now, short of what it showed before. */
function keyboardTakes(): number {
    const now = shown();
    if (before === null || now === null) return 0;
    // 「[Sonnet 5.5] Another shape of screen (a rotation): what was seen before says nothing of this one.」
    if (Math.abs(now.width - before.width) > ROUNDING) { before = null; return 0; }
    return before.height - now.height;
}

/** What the keyboard leaves of the screen: the visual viewport, edges and all. */
function keyboardLeaves(): { y: number; height: number } {
    const vv = (window as { visualViewport?: VisualViewport | null }).visualViewport;
    if (!vv) return visibleArea();
    return { y: vv.offsetTop, height: vv.height };
}

/**
 * A body made shorter for the keyboard can leave its focused field below what
 * it shows. Its scroller brings the field back into view, only as far as it
 * must (Apple Human Interface Guidelines, Scroll views: "only as much as
 * necessary to help people retain context").
 */
function keepFieldSeen(element: HTMLElement): void {
    const field = document.activeElement as HTMLElement | null;
    if (!field || field === element || !element.contains(field)) return;
    const scroller = field.closest<HTMLElement>('[data-scroller="body"], [data-scroller="declared"]');
    if (!scroller || !element.contains(scroller)) return;
    const seen = scroller.getBoundingClientRect();
    const at = field.getBoundingClientRect();
    // Whole pixels, rounded up: a browser snaps scrollTop to device pixels, and a snap down left the field under the keyboard by 0.34px.
    if (at.bottom > seen.bottom) scroller.scrollTop += Math.ceil(at.bottom - seen.bottom);
    else if (at.top < seen.top) scroller.scrollTop -= Math.ceil(seen.top - at.top);
}

/**
 * Put a window back where it stood before the keyboard came. A window a person
 * moved since stays where they put it. Called on the way out of the window form,
 * so the place it remembers is its own and not the keyboard's.
 */
export function backFromKeyboard(element: HTMLElement): void {
    const s = stood.get(element);
    if (!s) return;
    stood.delete(element);
    if (element.style.top !== s.wrote) return;
    element.style.top = s.top;
    element.style.maxHeight = s.maxHeight;
    element.style.paddingBottom = s.paddingBottom;
}

/** A field pressed in this window brings the keyboard; wired once per element (Element Axioma). */
export function keepClearOfKeyboard(element: HTMLElement): void {
    if (wired.has(element)) return;
    wired.add(element);

    element.addEventListener('focusin', (e) => {
        if (!takesTyping(e.target)) return;
        for (const el of [...stood.keys()]) {
            if (el !== element) backFromKeyboard(el);
        }
        // 「[Sonnet 5.5] The keyboard has not come yet when a field first takes focus: what the page shows is the baseline.」
        const now = shown();
        if (now && (before === null || now.height > before.height)) before = now;
        answering = element;
        hear();
        answer(element);
    });

    element.addEventListener('focusout', (e) => {
        const next = (e as FocusEvent).relatedTarget as Node | null;
        if (answering === element && !(next && element.contains(next))) {
            answering = null;
            // 「[Sonnet 5.5] Focus moving to a field in another window keeps the keyboard up; one that leaves for good does not.」
            if (keyboardTakes() <= ROUNDING) before = null;
        }
    });
}
