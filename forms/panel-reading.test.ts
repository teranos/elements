/**
 * A panel on a phone shows the host's text at the host's size.
 *
 * "text too big on mobile, unusable" (#40). The panel scaled what it held until
 * the host's text read at 17, layout and all; on a phone that made it unusable.
 * Now the panel scales nothing: what the host draws is what is seen.
 *
 * Personas:
 * - Tim: Happy path — a panel on a touch screen holds the host's 11px text at 11
 * - Spike: Edge cases — with a mouse, the same
 * - Jenny: Complex scenarios — to the tray and back, still at the host's size
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { morphDotToPanel, morphPanelToDot } from './panel';
import type { Element } from '../element';
import { playAnimations, type Played } from '../test-animations';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// A morph finishes on the next turn (test-animations.ts); this is well past it.
const SETTLED = 15;

const krypton = (): Element => ({
    id: 'krypton',
    title: 'Krypton',
    symbol: 'Kr',
    opensAs: 'panel',
    renderContent: () => {
        const content = document.createElement('div');
        content.textContent = 'schedule 1 · ACTIVE · every 1m';
        return content;
    },
});

/** What the screen is pointed at with: a finger is coarse, a mouse is fine. */
function pointer(kind: 'coarse' | 'fine'): () => void {
    const had = window.matchMedia;
    (window as any).matchMedia = (query: string) => ({ matches: query.includes(`pointer: ${kind}`), media: query });
    return () => { (window as any).matchMedia = had; };
}

let animations: Played;
let tray: HTMLElement;
let element: HTMLElement;
let restorePointer: () => void = () => {};

async function open(): Promise<void> {
    morphDotToPanel(element, krypton(), () => {}, () => {}, (el) => { tray.appendChild(el); });
    await wait(SETTLED);
}

/** The size the host's stylesheet draws its text at, inside any panel. */
function hostDrawsAt(size: string): void {
    const style = document.createElement('style');
    style.id = 'host-size';
    style.textContent = `[data-scroller="body"] { font-size: ${size}; }`;
    document.head.appendChild(style);
}

const body = () => element.querySelector<HTMLElement>(':scope > [data-scroller="body"]')!;

/** The size the host's text is seen at: its own size, times any scale on the body. */
const seenAt = () => parseFloat(getComputedStyle(body()).fontSize) * (parseFloat(body().style.zoom) || 1);

beforeEach(() => {
    document.body.innerHTML = '';
    animations = playAnimations();
    tray = document.createElement('div');
    tray.className = 'tray-dots';
    document.body.appendChild(tray);
    element = document.createElement('div');
    element.dataset.elementId = 'krypton';
    tray.appendChild(element);
});

afterEach(() => {
    document.getElementById('host-size')?.remove();
    restorePointer();
    restorePointer = () => {};
    animations.restore();
});

describe('Tim: a panel on a touch screen', () => {
    test('the host\'s 11px text is seen at 11', async () => {
        restorePointer = pointer('coarse');
        hostDrawsAt('11px');
        await open();

        expect(seenAt()).toBe(11);
    });
});

describe('Spike: with a mouse', () => {
    test('the host\'s 11px text is seen at 11', async () => {
        restorePointer = pointer('fine');
        hostDrawsAt('11px');
        await open();

        expect(seenAt()).toBe(11);
    });
});

describe('Jenny: to the tray and back', () => {
    test('opened again, the host\'s text is still at the host\'s size', async () => {
        restorePointer = pointer('coarse');
        hostDrawsAt('11px');
        await open();
        morphPanelToDot(element, krypton(), () => {}, (el) => { tray.appendChild(el); });
        await wait(SETTLED);
        await open();

        expect(seenAt()).toBe(11);
    });
});
