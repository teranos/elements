/**
 * A panel on a touch screen shows a grabber.
 *
 * Apple Human Interface Guidelines, Sheets: "Support swiping to dismiss a
 * sheet", and a grabber shows that a sheet can be swiped. A panel swiped down
 * by its title bar goes to the tray (forms/panel.ts); nothing showed it could.
 *
 * Personas:
 * - Tim: Happy path — on a touch screen an open panel shows a grabber at its top that takes no touches
 * - Spike: Edge cases — with a mouse there is no grabber
 * - Jenny: Complex scenarios — to the tray and back, one grabber, and none in the tray
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { morphDotToPanel } from './panel';
import { getForm } from '../dataset';
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
        const body = document.createElement('div');
        body.textContent = 'schedule 1 · ACTIVE · every 1m';
        return body;
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
    // What the tray does when a panel comes back to it (tray.ts, reattachElementToIndicator).
    morphDotToPanel(element, krypton(), () => {}, () => {}, (el) => { tray.appendChild(el); });
    await wait(SETTLED);
}

const grabbers = () => element.querySelectorAll<HTMLElement>('.panel-grabber');

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
    restorePointer();
    restorePointer = () => {};
    animations.restore();
});

describe('Tim: on a touch screen', () => {
    test('an open panel shows a grabber at its top, centred, that takes no touches', async () => {
        restorePointer = pointer('coarse');
        await open();

        expect(grabbers()).toHaveLength(1);
        const grabber = grabbers()[0]!;
        expect(grabber.style.position).toBe('absolute');
        expect(grabber.style.left).toBe('50%');
        // The swipe is the title bar's: a finger on the grabber lands on the bar under it.
        expect(grabber.style.pointerEvents).toBe('none');
        expect(grabber.getAttribute('aria-hidden')).toBe('true');
    });
});

describe('Spike: with a mouse', () => {
    test('there is no grabber', async () => {
        restorePointer = pointer('fine');
        await open();

        expect(getForm(element)).toBe('panel');
        expect(grabbers()).toHaveLength(0);
    });
});

describe('Jenny: to the tray and back', () => {
    test('one grabber when open, none while it rests in the tray', async () => {
        restorePointer = pointer('coarse');
        await open();
        element.querySelector<HTMLButtonElement>('.title-bar button')!.click();
        await wait(SETTLED);
        expect(getForm(element)).toBe('dot');
        expect(grabbers()).toHaveLength(0);

        await open();

        expect(grabbers()).toHaveLength(1);
    });
});
