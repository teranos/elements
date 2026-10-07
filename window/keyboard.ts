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

/** Where a window stood before the keyboard came, and what was written over it. */
interface Stood {
    top: string;
    maxHeight: string;
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
        y: Number.isFinite(placed) ? placed : rect.top,
        height: rect.height,
    };

    const area = visibleArea();
    const height = Math.min(from.height, area.height);
    const y = Math.min(Math.max(from.y, area.y), area.y + area.height - height);

    if (y === from.y && height === from.height) {
        if (before) backFromKeyboard(element);
        return;
    }

    element.style.top = `${y}px`;
    element.style.maxHeight = height < from.height ? `${height}px` : from.maxHeight;
    stood.set(element, { ...from, wrote: element.style.top });
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
        answering = element;
        hear();
        answer(element);
    });

    element.addEventListener('focusout', (e) => {
        const next = (e as FocusEvent).relatedTarget as Node | null;
        if (answering === element && !(next && element.contains(next))) answering = null;
    });
}
