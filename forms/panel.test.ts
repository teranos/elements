/**
 * A panel on a phone.
 *
 * An element whose content is wider than the screen opens as a panel
 * (window/window.ts, fitsAsWindow): on a phone, that is QNTX's Pi element,
 * full screen. Measured on an iPhone 15, it ran its body 29px past the screen's
 * bottom edge, and a keyboard brought up for its field covered the field.
 *
 * Neither test DOM has layout or a visual viewport: the panel is given a
 * screen-sized box, and a keyboard that takes the bottom of it.
 *
 * Personas:
 * - Tim: Happy path — a panel holds its body; a field in it stays above the keyboard
 * - Spike: Edge cases — Safari panning the page under the keyboard; a button is not a field
 * - Jenny: Complex scenarios — minimized with the keyboard up, then opened again
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { morphDotToPanel, morphPanelToDot } from './panel';
import { getForm } from '../dataset';
import type { Element } from '../element';
import { playAnimations, type Played } from '../test-animations';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
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

const pi = (): Element => ({
    id: 'pi-element',
    title: 'Pi',
    symbol: 'π',
    opensAs: 'panel',
    renderContent: () => {
        const body = document.createElement('div');
        body.className = 'claude';
        const says = document.createElement('textarea');
        says.className = 'claude-says';
        const send = document.createElement('button');
        send.textContent = 'Say';
        body.append(says, send);
        return body;
    },
});

/** A panel open, its box laid out as the style it was given says. */
async function openPanel(): Promise<HTMLElement> {
    const element = document.createElement('div');
    element.dataset.elementId = 'pi-element';
    document.body.appendChild(element);
    element.getBoundingClientRect = () => {
        const top = parseFloat(element.style.top) || 0;
        const height = Math.min(parseFloat(element.style.height) || 0, parseFloat(element.style.maxHeight) || Infinity);
        return { x: 0, y: top, left: 0, top, width: SCREEN.width, height, right: SCREEN.width, bottom: top + height, toJSON() {} } as DOMRect;
    };
    morphDotToPanel(element, pi(), () => {}, () => {}, () => {});
    await wait(SETTLED);
    return element;
}

const bottom = (el: HTMLElement) => el.getBoundingClientRect().bottom;

let animations: Played;

beforeEach(() => {
    document.body.innerHTML = '';
    // A panel opens and rests along a road (morph-transaction.ts) the test DOMs cannot play.
    animations = playAnimations();
});

afterEach(() => {
    animations.restore();
    (document.activeElement as HTMLElement | null)?.blur?.();
    delete (window as any).visualViewport;
});

describe('Tim: a panel holds its body', () => {
    test('a panel is a column that clips: its body has the height left under the title bar, no more', async () => {
        const panel = await openPanel();

        expect(getForm(panel)).toBe('panel');
        expect(panel.style.display).toBe('flex');
        expect(panel.style.flexDirection).toBe('column');
        expect(panel.style.overflow).toBe('hidden');
    });

    test('a field in a full-screen panel stays above the keyboard', async () => {
        const vv = giveVisualViewport();
        const panel = await openPanel();

        panel.querySelector('textarea')!.focus();
        keyboardUp(vv);

        expect(bottom(panel)).toBe(SCREEN.height - KEYBOARD);
    });

    test('when the keyboard goes, the panel is full screen again', async () => {
        const vv = giveVisualViewport();
        const panel = await openPanel();
        const height = panel.style.height;

        panel.querySelector('textarea')!.focus();
        keyboardUp(vv);
        keyboardDown(vv);

        expect(panel.style.top).toBe('0px');
        expect(panel.style.height).toBe(height);
        expect(bottom(panel)).toBe(SCREEN.height);
    });
});

/** The tray, as a host's stylesheet places it: dots down one edge of the screen. */
function trayAt(left: number, width: number, empty = false): HTMLElement {
    const tray = document.createElement('div');
    tray.className = 'tray';
    tray.setAttribute('data-empty', String(empty));
    tray.getBoundingClientRect = () =>
        ({ x: left, y: 89, left, top: 89, width, height: 482, right: left + width, bottom: 571, toJSON() {} } as DOMRect);
    document.body.appendChild(tray);
    return tray;
}

describe('Tim: the tray does not cover what a panel holds', () => {
    test('a panel keeps its content clear of the tray\'s dots, as it does of the device\'s edges', async () => {
        trayAt(SCREEN.width - 24, 20);
        const panel = await openPanel();

        expect(panel.style.paddingRight).toBe('24px');
    });
});

describe('Spike: what Safari does, and what is not a field', () => {
    test('an empty tray takes nothing from a panel', async () => {
        trayAt(SCREEN.width - 24, 20, true);
        const panel = await openPanel();

        expect(panel.style.paddingRight).toBe('0px');
    });

    test('a tray down the left edge is kept clear on the left', async () => {
        trayAt(4, 20);
        const panel = await openPanel();

        expect(panel.style.paddingLeft).toBe('24px');
    });

    test('Safari panning the page under the keyboard: the panel is what is seen, title bar at the top of it', async () => {
        const vv = giveVisualViewport();
        const panel = await openPanel();

        panel.querySelector('textarea')!.focus();
        keyboardUp(vv, 310);

        expect(parseFloat(panel.style.top)).toBe(310);
        expect(bottom(panel)).toBe(310 + SCREEN.height - KEYBOARD);
    });

    test('a button pressed brings no keyboard, and the panel stays as it is', async () => {
        const vv = giveVisualViewport();
        const panel = await openPanel();

        panel.querySelector('button')!.focus();
        keyboardUp(vv);

        expect(bottom(panel)).toBe(SCREEN.height);
    });
});

describe('Jenny: minimized with the keyboard up', () => {
    test('it goes to the tray, and opens again full screen', async () => {
        const vv = giveVisualViewport();
        const panel = await openPanel();
        let rested = false;

        panel.querySelector('textarea')!.focus();
        keyboardUp(vv);
        morphPanelToDot(panel, pi(), () => {}, () => { rested = true; });
        await wait(SETTLED);
        keyboardDown(vv);

        expect(rested).toBe(true);
        expect(panel.style.maxHeight).toBe('');
    });
});
