/**
 * A panel on a touch screen has no title bar row: the bar is the grabber's strip.
 *
 * "Inefficient use of space." In a real browser, browser/panel-strip.browser.ts.
 *
 * Personas:
 * - Tim: Happy path — on a touch screen the bar is a 16px strip, written important
 * - Spike: Edge cases — with a mouse the bar is left a row
 * - Jenny: Complex scenarios — to the tray, the bar goes a row again, and comes back a strip
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
    renderContent: () => document.createElement('div'),
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

const toTray = (el: HTMLElement) => { tray.appendChild(el); };
async function open(): Promise<void> {
    morphDotToPanel(element, krypton(), () => {}, () => {}, toTray);
    await wait(SETTLED);
}
const bar = () => element.querySelector<HTMLElement>('.title-bar')!;

beforeEach(() => {
    document.body.innerHTML = '';
    animations = playAnimations();
    tray = document.createElement('div');
    document.body.appendChild(tray);
    element = document.createElement('div');
    element.dataset.elementId = 'krypton';
    tray.appendChild(element);
});

afterEach(() => {
    restorePointer();
    restorePointer = () => {};
    animations.restore();
});

describe('Tim: on a touch screen', () => {
    test('the title bar is a 16px strip, written important', async () => {
        restorePointer = pointer('coarse');
        await open();

        expect(bar().style.height).toBe('16px');
        expect(bar().style.getPropertyPriority('height')).toBe('important');
    });
});

describe('Spike: with a mouse', () => {
    test('the title bar is left a row', async () => {
        restorePointer = pointer('fine');
        await open();

        expect(bar().style.height).toBe('');
    });
});

describe('Jenny: to the tray and back', () => {
    test('the bar goes a row again, and comes back a strip', async () => {
        restorePointer = pointer('coarse');
        await open();
        const held = bar();
        morphPanelToDot(element, krypton(), () => {}, toTray);
        await wait(SETTLED);

        expect(held.style.height).toBe('');
        await open();
        expect(bar().style.height).toBe('16px');
    });
});
