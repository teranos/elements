/**
 * A panel lays itself out: a title bar over a body, in a box that clips.
 *
 * A window does this itself (window/settle.ts). A panel left it to the page's
 * stylesheet: on a page with no panel rule, Krypton's panel was a block whose
 * body ran past the bottom of the screen and could not be scrolled to its end.
 *
 * Personas:
 * - Tim: Happy path — an open panel is a column that clips, its body the height left under the title bar
 * - Jenny: Complex scenarios — to the tray and back, still a column
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

let animations: Played;
let tray: HTMLElement;
let element: HTMLElement;

async function open(): Promise<void> {
    // What the tray does when a panel comes back to it (tray.ts, reattachElementToIndicator).
    morphDotToPanel(element, krypton(), () => {}, () => {}, (el) => { tray.appendChild(el); });
    await wait(SETTLED);
}

function isAColumnThatClips(el: HTMLElement): void {
    expect(el.style.display).toBe('flex');
    expect(el.style.flexDirection).toBe('column');
    expect(el.style.overflow).toBe('hidden');
}

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
    animations.restore();
});

describe('Tim: an open panel lays itself out', () => {
    test('it is a column that clips, whatever the page\'s stylesheet says', async () => {
        await open();

        expect(getForm(element)).toBe('panel');
        isAColumnThatClips(element);
    });

    test('its body is the scroller, under the title bar', async () => {
        await open();

        const [bar, body] = Array.from(element.children) as HTMLElement[];
        expect(bar!.classList.contains('title-bar')).toBe(true);
        expect(body!.dataset.scroller).toBe('body');
    });
});

describe('Jenny: to the tray and back', () => {
    test('opened again from the tray, it is a column again', async () => {
        await open();
        element.querySelector<HTMLButtonElement>('.title-bar button')!.click();
        await wait(SETTLED);
        expect(getForm(element)).toBe('dot');

        await open();

        isAColumnThatClips(element);
    });
});
