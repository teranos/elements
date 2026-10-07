/**
 * A panel and the on-screen keyboard.
 *
 * Apple Human Interface Guidelines, Virtual keyboards: the layout guide "helps
 * you keep important parts of your interface visible while the virtual
 * keyboard is onscreen." A window answers the keyboard (window/keyboard.ts); a
 * panel did not. On a phone a panel is the whole screen: Chrome on Android lets
 * the keyboard cover its bottom, and Safari pans the page to show the field,
 * taking the title bar off the top.
 *
 * Neither test DOM has layout or a visual viewport: the panel's box is the
 * style it was given, and the keyboard takes the bottom of the screen.
 *
 * Personas:
 * - Tim: Happy path — the keyboard comes for a field in a panel, and goes
 * - Spike: Edge cases — Safari panning the page; a button is not a field
 * - Jenny: Complex scenarios — swiped to the tray with the keyboard up, and opened again
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { morphDotToPanel } from './panel';
import { getForm } from '../dataset';
import type { Element } from '../element';
import { playAnimations, type Played } from '../test-animations';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// A morph finishes on the next turn (test-animations.ts); this is well past it.
const SETTLED = 15;
const SCREEN = { width: window.innerWidth, height: window.innerHeight };
const KEYBOARD = 336;

interface FakeViewport extends EventTarget {
    offsetLeft: number;
    offsetTop: number;
    width: number;
    height: number;
    scale: number;
}

function giveVisualViewport(): FakeViewport {
    const vv = new (window as any).EventTarget() as FakeViewport;
    vv.offsetLeft = 0;
    vv.offsetTop = 0;
    vv.width = SCREEN.width;
    vv.height = SCREEN.height;
    vv.scale = 1;
    (window as any).visualViewport = vv;
    return vv;
}

function keyboardUp(vv: FakeViewport, offsetTop = 0): void {
    vv.offsetTop = offsetTop;
    vv.height = SCREEN.height - KEYBOARD;
    vv.dispatchEvent(new (window as any).Event('resize'));
}

function keyboardDown(vv: FakeViewport): void {
    vv.offsetTop = 0;
    vv.height = SCREEN.height;
    vv.dispatchEvent(new (window as any).Event('resize'));
}

const krypton = (): Element => ({
    id: 'krypton',
    title: 'Krypton',
    symbol: 'Kr',
    opensAs: 'panel',
    renderContent: () => {
        const body = document.createElement('div');
        const field = document.createElement('input');
        field.type = 'text';
        body.appendChild(field);
        return body;
    },
});

let animations: Played;
let tray: HTMLElement;
let element: HTMLElement;
let rested = 0;

/** A panel open, its box laid out as the style it was given says. */
async function open(): Promise<HTMLElement> {
    // What the tray does when a panel comes back to it (tray.ts, reattachElementToIndicator).
    morphDotToPanel(element, krypton(), () => {}, () => {}, (el) => { rested++; tray.appendChild(el); });
    await wait(SETTLED);
    return element;
}

const top = (el: HTMLElement) => el.getBoundingClientRect().top;
const bottom = (el: HTMLElement) => el.getBoundingClientRect().bottom;

beforeEach(() => {
    document.body.innerHTML = '';
    animations = playAnimations();
    rested = 0;
    tray = document.createElement('div');
    tray.className = 'tray-dots';
    document.body.appendChild(tray);
    element = document.createElement('div');
    element.dataset.elementId = 'krypton';
    element.getBoundingClientRect = () => {
        const t = parseFloat(element.style.top) || 0;
        const height = Math.min(parseFloat(element.style.height) || 0, parseFloat(element.style.maxHeight) || Infinity);
        return { x: 0, y: t, left: 0, top: t, width: SCREEN.width, height, right: SCREEN.width, bottom: t + height, toJSON() {} } as DOMRect;
    };
    tray.appendChild(element);
});

afterEach(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    delete (window as any).visualViewport;
    animations.restore();
});

describe('Tim: the keyboard comes for a field in a panel, and goes', () => {
    test('the panel ends where the keyboard begins, its title bar at the top', async () => {
        const vv = giveVisualViewport();
        const panel = await open();

        panel.querySelector('input')!.focus();
        keyboardUp(vv);

        expect(top(panel)).toBe(0);
        expect(bottom(panel)).toBe(SCREEN.height - KEYBOARD);
    });

    test('when the keyboard goes, the panel is the whole screen again', async () => {
        const vv = giveVisualViewport();
        const panel = await open();
        const height = panel.style.height;

        panel.querySelector('input')!.focus();
        keyboardUp(vv);
        keyboardDown(vv);

        expect(panel.style.top).toBe('0px');
        expect(panel.style.height).toBe(height);
        expect(bottom(panel)).toBe(SCREEN.height);
    });
});

describe('Spike: Safari, and what is not a field', () => {
    test('Safari panning the page: the panel is what is seen, title bar at the top of it', async () => {
        const vv = giveVisualViewport();
        const panel = await open();

        panel.querySelector('input')!.focus();
        keyboardUp(vv, 310);

        expect(top(panel)).toBe(310);
        expect(bottom(panel)).toBe(310 + SCREEN.height - KEYBOARD);
    });

    test('a button pressed brings no keyboard, and the panel stays as it is', async () => {
        const vv = giveVisualViewport();
        const panel = await open();
        const button = panel.querySelector<HTMLButtonElement>('.title-bar button')!;

        button.focus();
        keyboardUp(vv);

        expect(bottom(panel)).toBe(SCREEN.height);
    });
});

describe('Jenny: to the tray with the keyboard up, and back', () => {
    test('minimized with the keyboard up, it opens again the whole screen', async () => {
        const vv = giveVisualViewport();
        let panel = await open();

        panel.querySelector('input')!.focus();
        keyboardUp(vv);
        panel.querySelector<HTMLButtonElement>('.title-bar button')!.click();
        await wait(SETTLED);
        keyboardDown(vv);
        expect(rested).toBe(1);
        expect(getForm(element)).toBe('dot');

        panel = await open();

        expect(panel.style.maxHeight).toBe('');
        expect(bottom(panel)).toBe(SCREEN.height);
    });
});
