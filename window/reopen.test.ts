// "lost my work"
//
// 「[Opus 5.5] A window opened again from the tray shows what it showed. An element may build its body」
// 「[Opus 5.5] once and hand that same body back every time it is asked (tweak does). Opening again,」
// 「[Opus 5.5] the window measured itself by asking for the body, which pulled that body out of the」
// 「[Opus 5.5] stash it waited in and dropped it: the window came back over nothing.」
//
// Personas:
// - Jenny: opened, minimized, opened again: the same body, never asked for twice

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { morphDotToWindow, morphWindowToDot } from './window';
import { getForm } from '../dataset';
import type { Element } from '../element';
import { playAnimations, type Played } from '../test-animations';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// A morph finishes on the next turn (test-animations.ts); this is well past it.
const SETTLED = 15;

let animations: Played;
let element: HTMLElement;
let tray: HTMLElement;
let asked = 0;
let body: HTMLElement | null = null;

// Builds its body once, and hands back that one body every time.
const once = (): Element => ({
    id: 'tweak',
    title: 'tweak',
    opensAs: 'window',
    renderContent: () => {
        asked++;
        if (!body) {
            body = document.createElement('div');
            body.className = 'tuned';
            body.textContent = 'glow 150';
        }
        return body;
    },
});

const toTray = (el: HTMLElement) => { tray.appendChild(el); };

beforeEach(() => {
    document.body.innerHTML = '';
    animations = playAnimations();
    asked = 0;
    body = null;
    tray = document.createElement('div');
    tray.className = 'tray-dots';
    document.body.appendChild(tray);
    element = document.createElement('div');
    element.dataset.elementId = 'tweak';
    tray.appendChild(element);
});

afterEach(() => {
    animations.restore();
});

describe('Jenny: opened again from the tray', () => {
    test('the window holds the body it held, and the body was asked for once', async () => {
        const item = once();
        morphDotToWindow(element, item, () => {}, () => {}, toTray);
        await wait(SETTLED);
        expect(element.querySelector('.tuned')).not.toBeNull();

        morphWindowToDot(element, item, () => {}, toTray);
        await wait(SETTLED);
        expect(getForm(element)).toBe('dot');

        morphDotToWindow(element, item, () => {}, () => {}, toTray);
        await wait(SETTLED);

        expect(getForm(element)).toBe('window');
        expect(element.querySelector('.tuned')).toBe(body);
        expect(element.textContent).not.toContain('nothing was drawn');
        expect(asked).toBe(1);
    });
});
