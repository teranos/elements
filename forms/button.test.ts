/**
 * Button form.
 *
 * "It really feels like a button. Until you click it and your entire conceptual
 * model of what UI could be shatters." No intermediary stage and no hover
 * expand: a click takes Window Form, the same element, and where it was is a
 * transparent hole, a gap. Click once on the gap to locate, click twice to
 * bring it back to its original button position. The window has a down arrow.
 *
 * Personas:
 * - Tim: Happy path — button, window, gap, down arrow, button again
 * - Spike: Edge cases — hovering does nothing, the gap is no element, one click is not two
 * - Jenny: Complex scenarios — locating and bringing it back out of the tray, content kept
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { buttonFrom } from './button';
import { getForm } from '../dataset';
import type { Element } from '../element';
import { tray } from '../tray/tray';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const realm = () => globalThis.window as unknown as { Event: typeof Event; MouseEvent: typeof MouseEvent; HTMLElement: typeof HTMLElement };

const BETWEEN = 20;
// A morph finishes on the next turn (the stand-in below); this is well past it.
const SETTLED = 15;

type Played = { element: HTMLElement; keyframes: Keyframe[] };
let played: Played[] = [];
const proto = realm().HTMLElement.prototype;
const had = (proto as unknown as { animate?: unknown }).animate;

let rendered = 0;
let host: HTMLElement;
let before: HTMLElement;
let after: HTMLElement;
let button: HTMLElement;

function item(): Element {
    return {
        id: 'bismuth',
        title: 'Press Me',
        symbol: 'Bi',
        renderContent: () => {
            rendered++;
            const body = document.createElement('div');
            body.className = 'bismuth-body';
            body.textContent = 'what the button was all along';
            return body;
        },
    };
}

const click = (el: HTMLElement, detail = 1) =>
    el.dispatchEvent(new (realm().MouseEvent)('click', { bubbles: true, detail }));
const twice = (el: HTMLElement) => {
    click(el, 1);
    click(el, 2);
};
const enter = (el: HTMLElement) => el.dispatchEvent(new (realm().Event)('pointerenter'));
const gaps = () => Array.from(document.querySelectorAll<HTMLElement>('.button-gap'));
const down = (el: HTMLElement) => el.querySelector<HTMLElement>('.window-controls [aria-label="Back to its place"]');
const minimize = (el: HTMLElement) => el.querySelector<HTMLElement>('.window-controls [aria-label="Minimize"]');

beforeEach(() => {
    played = [];
    // A stand-in for the Web Animations API, which the test DOMs lack: it
    // records the road and finishes on the next turn.
    (proto as unknown as { animate: unknown }).animate = function (this: HTMLElement, keyframes: Keyframe[]) {
        played.push({ element: this, keyframes });
        const handlers: Record<string, (() => void)[]> = {};
        const animation = {
            addEventListener: (type: string, fn: () => void) => { (handlers[type] ??= []).push(fn); },
            removeEventListener: () => {},
            cancel: () => { (handlers.cancel ?? []).forEach((fn) => fn()); },
        };
        setTimeout(() => (handlers.finish ?? []).forEach((fn) => fn()), 1);
        return animation;
    };

    document.body.innerHTML = '';
    tray.init();
    rendered = 0;
    host = document.createElement('div');
    before = document.createElement('span');
    after = document.createElement('span');
    button = buttonFrom(item(), { className: 'host-button', between: BETWEEN });
    host.append(before, button, after);
    // What holds the button has a surface of its own, for the hole to go through.
    host.style.backgroundColor = 'rgb(34, 34, 34)';
    host.getBoundingClientRect = () => ({ left: 30, top: 50, width: 240, height: 110, right: 270, bottom: 160, x: 30, y: 50, toJSON: () => ({}) }) as DOMRect;
    document.body.appendChild(host);
    button.getBoundingClientRect = () => ({ left: 40, top: 60, width: 90, height: 24, right: 130, bottom: 84, x: 40, y: 60, toJSON: () => ({}) }) as DOMRect;
});

afterEach(() => {
    (proto as unknown as { animate: unknown }).animate = had;
    if (tray.has('bismuth')) tray.remove('bismuth');
});

describe('Tim: button, window, gap, button again', () => {
    test('it is a button: its label, its role, and nothing that gives it away', () => {
        expect(getForm(button)).toBe('button');
        expect(button.textContent).toBe('Press Me');
        expect(button.getAttribute('role')).toBe('button');
        expect(button.className).toBe('host-button');
        expect(button.querySelector('.title-bar')).toBeNull();
    });

    test('a click takes Window Form straight away: the same element', async () => {
        click(button);
        expect(getForm(button)).toBe('window');
        await wait(SETTLED);
        expect(getForm(button)).toBe('window');
        expect(button.querySelector('.bismuth-body')).not.toBeNull();
        expect(document.querySelectorAll('[data-element-id="bismuth"]')).toHaveLength(1);
    });

    test('what it says is one node for its whole life: into the title bar, and back', async () => {
        const label = button.querySelector('.button-label');
        expect(label).not.toBeNull();
        expect(label!.textContent).toBe('Press Me');
        click(button);
        // From the first frame, not once it has arrived.
        expect(button.querySelector('.title-bar .button-label')).toBe(label);
        await wait(SETTLED);
        expect(button.querySelector('.title-bar .button-label')).toBe(label);
        down(button)!.click();
        // On the way back it still says it.
        expect(button.contains(label)).toBe(true);
        await wait(SETTLED);
        expect(button.firstChild).toBe(label);
        expect(button.textContent).toBe('Press Me');
    });

    test('it starts its road on the page itself, where a holder cannot move its first frame', () => {
        // A holder that is a containing block (a transform, a filter) measures a
        // fixed element from itself: pinned inside it, the button reads as
        // somewhere it never was.
        button.getBoundingClientRect = () => {
            const pinnedInHolder = button.style.position === 'fixed' && button.parentElement !== document.body;
            const left = pinnedInHolder ? 56 : 40;
            const top = pinnedInHolder ? 620 : 60;
            return { left, top, width: 90, height: 24, right: left + 90, bottom: top + 24, x: left, y: top, toJSON: () => ({}) } as DOMRect;
        };
        played = [];
        click(button);
        expect(button.parentElement).toBe(document.body);
        const road = played.find((p) => p.element === button)!;
        expect(road.keyframes[0]).toMatchObject({ left: '40px', top: '60px', width: '90px', height: '24px' });
    });

    test('the body travels with it from the first frame, drawn once', async () => {
        click(button);
        expect(button.querySelector('.bismuth-body')).not.toBeNull();
        await wait(SETTLED);
        expect(rendered).toBe(1);
        expect(button.querySelectorAll('.title-bar')).toHaveLength(1);
        expect(button.querySelectorAll('.bismuth-body')).toHaveLength(1);
    });

    test('where it was is a transparent gap, the size it was', () => {
        click(button);
        const [gap] = gaps();
        expect(gap).toBeDefined();
        expect(gap!.previousSibling).toBe(before);
        expect(gap!.nextSibling).toBe(after);
        expect(gap!.style.width).toBe('90px');
        expect(gap!.style.height).toBe('24px');
        expect(gap!.style.visibility).not.toBe('hidden');
        expect(gap!.textContent).toBe('');
    });

    test('the gap is a transparent hole 🕳️ through what holds it, where the button was', () => {
        click(button);
        expect(host.style.getPropertyValue('mask-size')).toBe('100% 100%, 90px 24px');
        expect(host.style.getPropertyValue('mask-position')).toBe('0px 0px, 10px 10px');
        expect(host.style.getPropertyValue('mask-composite')).toBe('exclude');
    });

    test('back in its place, the hole closes', async () => {
        click(button);
        await wait(SETTLED);
        down(button)!.click();
        await wait(SETTLED);
        expect(host.style.getPropertyValue('mask-size')).toBe('');
        expect(host.style.getPropertyValue('mask-image')).toBe('');
    });

    test('the window has a down arrow, which brings it back to its place as a button', async () => {
        click(button);
        await wait(SETTLED);
        const arrow = down(button);
        expect(arrow).not.toBeNull();
        expect(arrow!.textContent).toBe('↓');
        arrow!.click();
        await wait(SETTLED);
        expect(getForm(button)).toBe('button');
        expect(button.previousSibling).toBe(before);
        expect(button.nextSibling).toBe(after);
        expect(button.textContent).toBe('Press Me');
        expect(button.className).toBe('host-button');
        expect(gaps()).toHaveLength(0);
    });

    test('two clicks on the gap bring it back from wherever it is to its place', async () => {
        click(button);
        await wait(SETTLED);
        twice(gaps()[0]!);
        await wait(SETTLED);
        expect(getForm(button)).toBe('button');
        expect(button.previousSibling).toBe(before);
        expect(gaps()).toHaveLength(0);
    });

    test('two taps on the hole bring it back too, though a finger numbers each tap the first', async () => {
        click(button);
        await wait(SETTLED);
        const gap = gaps()[0]!;
        click(gap, 1);
        await wait(5);
        click(gap, 1);
        await wait(BETWEEN + SETTLED);
        expect(getForm(button)).toBe('button');
        expect(button.previousSibling).toBe(before);
        expect(gaps()).toHaveLength(0);
    });

    test('coming back is a road too, ending where the gap is', async () => {
        click(button);
        await wait(SETTLED);
        const gap = gaps()[0]!;
        gap.getBoundingClientRect = () => ({ left: 40, top: 60, width: 90, height: 24, right: 130, bottom: 84, x: 40, y: 60, toJSON: () => ({}) }) as DOMRect;
        played = [];
        twice(gap);
        const road = played.find((p) => p.element === button)!;
        expect(road.keyframes[road.keyframes.length - 1]).toMatchObject({ left: '40px', top: '60px', width: '90px', height: '24px' });
    });
});

describe('Spike: what does not happen', () => {
    test('hovering the button does nothing', async () => {
        enter(button);
        await wait(1200);
        expect(getForm(button)).toBe('button');
        expect(document.querySelectorAll('[data-form="tooltip"]')).toHaveLength(0);
        expect(gaps()).toHaveLength(0);
    }, 3000);

    test('the gap is a hole, not a second element standing for the first', () => {
        click(button);
        const [gap] = gaps();
        expect(gap!.hasAttribute('data-element-id')).toBe(false);
        expect(gap!.getAttribute('data-form')).toBeNull();
    });

    test('the hole goes through the nearest thing with a surface, not through one without', () => {
        const bare = document.createElement('div');
        const lone = buttonFrom({ ...item(), id: 'lone' }, { between: BETWEEN });
        bare.appendChild(lone);
        host.appendChild(bare);
        click(lone);
        expect(bare.style.getPropertyValue('mask-image')).toBe('');
        expect(host.style.getPropertyValue('mask-image')).not.toBe('');
    });

    test('a click on the window is not a click on the button', async () => {
        click(button);
        await wait(SETTLED);
        click(button);
        await wait(SETTLED);
        expect(getForm(button)).toBe('window');
        expect(gaps()).toHaveLength(1);
    });

    test('one click on the gap locates: it stays where it is, in front', async () => {
        click(button);
        await wait(SETTLED);
        const gap = gaps()[0]!;
        const was = Number(button.style.zIndex);
        played = [];
        click(gap, 1);
        await wait(BETWEEN + 10);
        expect(getForm(button)).toBe('window');
        expect(Number(button.style.zIndex)).toBeGreaterThan(was);
        expect(gaps()).toHaveLength(1);
    });

    test('locating blinks the borders and the title bar twice', async () => {
        click(button);
        await wait(SETTLED);
        played = [];
        click(gaps()[0]!, 1);
        await wait(BETWEEN + 10);
        const onBorder = played.find((p) => p.element === button)!;
        const onTitle = played.find((p) => p.element.classList.contains('title-bar'))!;
        expect(onBorder.keyframes.filter((k) => k.borderColor === 'transparent')).toHaveLength(2);
        expect(onTitle.keyframes.filter((k) => k.opacity !== '1')).toHaveLength(2);
    });

    test('the first of two clicks does not locate', async () => {
        click(button);
        await wait(SETTLED);
        played = [];
        twice(gaps()[0]!);
        await wait(BETWEEN + 10);
        expect(played.some((p) => p.element.classList.contains('title-bar'))).toBe(false);
    });
});

describe('Jenny: out of the tray, and everything kept', () => {
    test('minimized, it rests in the tray, and its window still has the down arrow', async () => {
        click(button);
        await wait(SETTLED);
        minimize(button)!.click();
        await wait(SETTLED);
        expect(getForm(button)).toBe('dot');
        expect(tray.has('bismuth')).toBe(true);
        tray.open('bismuth');
        await wait(SETTLED);
        expect(getForm(button)).toBe('window');
        expect(down(button)).not.toBeNull();
    });

    test('opened out of the tray, the down arrow still brings it back to its place', async () => {
        click(button);
        await wait(SETTLED);
        minimize(button)!.click();
        await wait(SETTLED);
        tray.open('bismuth');
        await wait(SETTLED);
        down(button)!.click();
        await wait(SETTLED);
        expect(getForm(button)).toBe('button');
        expect(button.previousSibling).toBe(before);
        expect(tray.has('bismuth')).toBe(false);
        expect(gaps()).toHaveLength(0);
    });

    test('through the tray and back, it is still the same words', async () => {
        const label = button.querySelector('.button-label');
        click(button);
        await wait(SETTLED);
        minimize(button)!.click();
        await wait(SETTLED);
        tray.open('bismuth');
        await wait(SETTLED);
        expect(button.querySelector('.title-bar .button-label')).toBe(label);
        expect(button.querySelectorAll('.title-bar')).toHaveLength(1);
        twice(gaps()[0]!);
        await wait(SETTLED);
        expect(button.firstChild).toBe(label);
    });

    test('one click on the gap moves it out of the tray', async () => {
        click(button);
        await wait(SETTLED);
        minimize(button)!.click();
        await wait(SETTLED);
        click(gaps()[0]!, 1);
        await wait(BETWEEN + SETTLED);
        expect(getForm(button)).toBe('window');
    });

    test('two clicks on the gap bring it back from the tray to its place', async () => {
        click(button);
        await wait(SETTLED);
        minimize(button)!.click();
        await wait(SETTLED);
        twice(gaps()[0]!);
        await wait(SETTLED);
        expect(getForm(button)).toBe('button');
        expect(tray.has('bismuth')).toBe(false);
        expect(button.previousSibling).toBe(before);
        expect(button.className).toBe('host-button');
        expect(document.querySelectorAll('[data-element-id="bismuth"]')).toHaveLength(1);
    });

    test('opened again, it is the content it had, not drawn again', async () => {
        click(button);
        await wait(SETTLED);
        const body = button.querySelector('.bismuth-body');
        down(button)!.click();
        await wait(SETTLED);
        const drawn = rendered;
        click(button);
        await wait(SETTLED);
        expect(button.querySelector('.bismuth-body')).toBe(body);
        expect(rendered).toBeLessThanOrEqual(drawn + 1);
    });

    test('Enter on the button is a click', async () => {
        const key = new (realm().Event)('keydown', { bubbles: true });
        Object.defineProperty(key, 'key', { value: 'Enter' });
        button.dispatchEvent(key);
        expect(getForm(button)).toBe('window');
    });
});
