/**
 * A panel, swiped down by its title bar, goes back to the tray.
 *
 * Apple Human Interface Guidelines, Sheets: "Support swiping to dismiss a sheet."
 * Gestures: "avoid creating a unique gesture to perform a standard action".
 * On a phone a panel is the whole screen, and the minimize button is one small
 * target in a corner; the swipe is the standard way down.
 *
 * Far enough is a quarter of the screen's height, or a flick faster than
 * 0.5px/ms that has gone at least 24px. The HIG gives no numbers; these are ours.
 *
 * Personas:
 * - Tim: Happy path — the panel follows the finger; far enough goes to the tray, short of it comes back
 * - Spike: Edge cases — a button, an upward drag, a jitter, two fingers; Reduce Motion
 * - Jenny: Complex scenarios — a flick; opened again from the tray, one swipe is one dismissal
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { morphDotToPanel } from './panel';
import { getForm } from '../dataset';
import type { Element } from '../element';
import { playAnimations, type Played } from '../test-animations';
import { expectAxiom } from '../test-axiom';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// A morph finishes on the next turn (test-animations.ts); this is well past it.
const SETTLED = 15;
const FAR = Math.ceil(window.innerHeight / 4) + 1;

let animations: Played;
let rested = 0;

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

async function open(element: HTMLElement): Promise<HTMLElement> {
    // What the tray does when a panel comes back to it (tray.ts, reattachElementToIndicator).
    morphDotToPanel(element, krypton(), () => {}, () => {}, (el) => { rested++; tray.appendChild(el); });
    await wait(SETTLED);
    return element.querySelector<HTMLElement>(':scope > .title-bar')!;
}

/** A finger event, as the page receives one. */
function finger(target: HTMLElement, type: string, ys: number[]): void {
    const event = new (window as any).Event(type, { bubbles: true, cancelable: true });
    const touches = ys.map((y) => ({ clientX: 100, clientY: y, target }));
    Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : touches });
    Object.defineProperty(event, 'changedTouches', { value: touches });
    target.dispatchEvent(event);
}

const down = (target: HTMLElement, y: number) => finger(target, 'touchstart', [y]);
const move = (target: HTMLElement, y: number) => finger(target, 'touchmove', [y]);
const up = (target: HTMLElement, y: number) => finger(target, 'touchend', [y]);

let element: HTMLElement;
let tray: HTMLElement;

beforeEach(() => {
    document.body.innerHTML = '';
    animations = playAnimations();
    rested = 0;
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

describe('Tim: swiped down by its title bar', () => {
    test('the panel follows the finger down', async () => {
        const bar = await open(element);

        down(bar, 20);
        move(bar, 140);

        expect(element.style.transform).toBe('translateY(120px)');
    });

    test('let go far enough down, it goes back to the tray', async () => {
        const bar = await open(element);

        down(bar, 20);
        move(bar, 20 + FAR);
        await wait(200);
        up(bar, 20 + FAR);
        await wait(SETTLED);

        expect(rested).toBe(1);
        expect(getForm(element)).toBe('dot');
        expectAxiom('krypton', element);
    });

    test('let go short of it, it comes back and stays a panel', async () => {
        const bar = await open(element);

        down(bar, 20);
        move(bar, 80);
        await wait(200);
        up(bar, 80);
        await wait(SETTLED);

        expect(rested).toBe(0);
        expect(getForm(element)).toBe('panel');
        expect(element.style.transform).toBe('');
    });
});

describe('Spike: what is not a swipe', () => {
    test('a finger on the minimize button is a press, not a swipe', async () => {
        const bar = await open(element);
        const button = bar.querySelector<HTMLElement>('button')!;

        down(button, 20);
        move(button, 20 + FAR);

        expect(element.style.transform).toBe('');
    });

    test('dragged up, the panel stays where it is', async () => {
        const bar = await open(element);

        down(bar, 200);
        move(bar, 100);

        expect(element.style.transform).toBe('translateY(0px)');
    });

    test('a quick jitter of a few pixels is not a flick', async () => {
        const bar = await open(element);

        down(bar, 20);
        move(bar, 30);
        up(bar, 30);
        await wait(SETTLED);

        expect(rested).toBe(0);
        expect(getForm(element)).toBe('panel');
    });

    test('two fingers are not a swipe', async () => {
        const bar = await open(element);

        finger(bar, 'touchstart', [20, 60]);
        finger(bar, 'touchmove', [20 + FAR, 60 + FAR]);

        expect(element.style.transform).toBe('');
    });
});

/** The person's setting for motion, as the page reads it. */
function reduceMotion(reduce: boolean): () => void {
    const had = window.matchMedia;
    (window as any).matchMedia = (query: string) => ({ matches: reduce && query.includes('prefers-reduced-motion: reduce'), media: query });
    return () => { (window as any).matchMedia = had; };
}

/** The roads the panel took that slid it back up from where the finger left it. */
const slidBack = (el: HTMLElement) => animations.of(el).filter((frames) => String(frames[0]?.transform ?? '').startsWith('translateY('));

describe('Spike: let go short, with Reduce Motion on', () => {
    test('it slides back when motion is welcome', async () => {
        const restore = reduceMotion(false);
        const bar = await open(element);

        down(bar, 20);
        move(bar, 80);
        await wait(200);
        up(bar, 80);
        restore();

        expect(slidBack(element)).toHaveLength(1);
    });

    test('it is simply back, with no slide, when Reduce Motion is on', async () => {
        const restore = reduceMotion(true);
        const bar = await open(element);

        down(bar, 20);
        move(bar, 80);
        await wait(200);
        up(bar, 80);
        restore();

        expect(slidBack(element)).toHaveLength(0);
        expect(element.style.transform).toBe('');
        expect(getForm(element)).toBe('panel');
    });
});

describe('Jenny: a flick, and out of the tray again', () => {
    test('a quick flick down goes to the tray, short of a quarter of the screen', async () => {
        const bar = await open(element);

        down(bar, 20);
        move(bar, 80);
        up(bar, 80);
        await wait(SETTLED);

        expect(rested).toBe(1);
        expect(getForm(element)).toBe('dot');
    });

    test('opened again from the tray, one swipe is one trip to the tray', async () => {
        let bar = await open(element);
        down(bar, 20);
        move(bar, 20 + FAR);
        up(bar, 20 + FAR);
        await wait(SETTLED);

        bar = await open(element);
        expectAxiom('krypton', element);
        down(bar, 20);
        move(bar, 20 + FAR);
        up(bar, 20 + FAR);
        await wait(SETTLED);

        expect(rested).toBe(2);
        expect(getForm(element)).toBe('dot');
    });
});
