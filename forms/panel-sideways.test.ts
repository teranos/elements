/**
 * A panel's body does not scroll sideways.
 *
 * Seen on a phone: content wider than the screen opened as a panel
 * (window/fits.ts), the panel the screen's width, and its body scrolled
 * sideways: every body scrolled both ways (content/body.ts), so a thumb panned
 * the content left and right. No body scrolls sideways now, in any form.
 *
 * Personas:
 * - Tim: Happy path — an open panel's body does not scroll sideways
 * - Spike: Edge cases — gone from the panel, the body still does not
 * - Jenny: Complex scenarios — to the tray and back, it still does not
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { morphDotToPanel } from './panel';
import { getForm } from '../dataset';
import type { Element } from '../element';
import { playAnimations, type Played } from '../test-animations';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// A morph finishes on the next turn (test-animations.ts); this is well past it.
const SETTLED = 15;

let animations: Played;
let tray: HTMLElement;
let element: HTMLElement;

const parity = (): Element => ({
    id: 'parity',
    title: 'Parity',
    opensAs: 'panel',
    renderContent: () => {
        const body = document.createElement('div');
        const wide = document.createElement('div');
        wide.style.width = '900px';
        body.appendChild(wide);
        return body;
    },
});

async function open(): Promise<HTMLElement> {
    // What the tray does when a panel comes back to it (tray.ts, reattachElementToIndicator).
    morphDotToPanel(element, parity(), () => {}, () => {}, (el) => { tray.appendChild(el); });
    await wait(SETTLED);
    return element.querySelector<HTMLElement>(':scope > [data-scroller="body"]')!;
}

async function toTheTray(): Promise<void> {
    element.querySelector<HTMLButtonElement>('.title-bar button')!.click();
    await wait(SETTLED);
}

beforeEach(() => {
    document.body.innerHTML = '';
    animations = playAnimations();
    tray = document.createElement('div');
    tray.className = 'tray-dots';
    document.body.appendChild(tray);
    element = document.createElement('div');
    element.dataset.elementId = 'parity';
    tray.appendChild(element);
});

afterEach(() => {
    animations.restore();
});

describe('Tim: an open panel', () => {
    test('its body does not scroll sideways', async () => {
        const body = await open();

        expect(body.style.overflowX).toBe('hidden');
    });
});

describe('Spike: when the panel goes', () => {
    test('the body still does not scroll sideways', async () => {
        const body = await open();

        await toTheTray();

        expect(getForm(element)).toBe('dot');
        expect(body.style.overflowX).toBe('hidden');
    });
});

describe('Jenny: to the tray and back', () => {
    test('opened again, its body still does not scroll sideways', async () => {
        await open();
        await toTheTray();

        const body = await open();

        expect(getForm(element)).toBe('panel');
        expect(body.style.overflowX).toBe('hidden');
    });
});
