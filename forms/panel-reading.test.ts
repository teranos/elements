/**
 * A panel on a phone reads at a phone's size.
 *
 * "QNTX's text and message box sized like Claude's on the phone, owned by
 * Elements so no host has to remember it."
 *
 * Apple Human Interface Guidelines, Typography: body text is 17 points at the
 * default size. A host draws its content at whatever size it draws it; on a
 * touch screen the panel shows that content scaled until the host's text reads
 * at 17, and a field in it scales with it. The host has no say.
 *
 * Personas:
 * - Tim: Happy path — a panel on a touch screen holds the host's 11px text at 17
 * - Spike: Edge cases — with a mouse nothing is scaled; text already at 17 or more is not made smaller
 * - Jenny: Complex scenarios — to the tray and back, read at 17 again, not scaled twice
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { morphDotToPanel, morphPanelToDot } from './panel';
import type { Element } from '../element';
import { playAnimations, type Played } from '../test-animations';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// A morph finishes on the next turn (test-animations.ts); this is well past it.
const SETTLED = 15;

const claude = (): Element => ({
    id: 'claude',
    title: 'Claude',
    symbol: '✻',
    opensAs: 'panel',
    renderContent: () => {
        const content = document.createElement('div');
        content.textContent = 'Say something to the ROOT agent';
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
    morphDotToPanel(element, claude(), () => {}, () => {}, (el) => { tray.appendChild(el); });
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

/** The size the host's text is seen at: its own size, times the panel's scale. */
const seenAt = () => parseFloat(getComputedStyle(body()).fontSize) * (parseFloat(body().style.zoom) || 1);

beforeEach(() => {
    document.body.innerHTML = '';
    animations = playAnimations();
    tray = document.createElement('div');
    tray.className = 'tray-dots';
    document.body.appendChild(tray);
    element = document.createElement('div');
    element.dataset.elementId = 'claude';
    tray.appendChild(element);
});

afterEach(() => {
    document.getElementById('host-size')?.remove();
    restorePointer();
    restorePointer = () => {};
    animations.restore();
});

describe('Tim: a panel on a touch screen', () => {
    test('the host\'s 11px text is seen at 17', async () => {
        restorePointer = pointer('coarse');
        hostDrawsAt('11px');
        await open();

        expect(seenAt()).toBeCloseTo(17, 5);
    });
});

describe('Spike: what is not scaled', () => {
    test('with a mouse, the panel shows the host\'s text at the host\'s size', async () => {
        restorePointer = pointer('fine');
        hostDrawsAt('11px');
        await open();

        expect(body().style.zoom).toBe('');
        expect(seenAt()).toBe(11);
    });

    test('text already at 17 or more is not made smaller', async () => {
        restorePointer = pointer('coarse');
        hostDrawsAt('20px');
        await open();

        expect(body().style.zoom).toBe('');
        expect(seenAt()).toBe(20);
    });
});

describe('Jenny: to the tray and back', () => {
    test('the panel opened again reads at 17, not scaled twice', async () => {
        restorePointer = pointer('coarse');
        hostDrawsAt('11px');
        await open();
        morphPanelToDot(element, claude(), () => {}, (el) => { tray.appendChild(el); });
        await wait(SETTLED);
        await open();

        expect(seenAt()).toBeCloseTo(17, 5);
    });
});
