/**
 * Tooltip form.
 *
 * "tooltip is a form an element can be in." Hovering the text: after 300ms a
 * tooltip, after 1s more the expanded tooltip, and a click takes Window Form.
 * "ITS A NEW ELEMENT EVERY FUCKING TIME."
 *
 * Personas:
 * - Tim: Happy path — hover, tooltip, expanded, click, window
 * - Spike: Edge cases — leaving early, clicking early, the anchor untouched
 * - Jenny: Complex scenarios — onto the tooltip, and hovering again after a window
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { tooltipFrom } from './tooltip';
import { getForm, getElementId } from '../dataset';
import type { Element } from '../element';
import { hasStash } from '../content/stash';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const realm = () => globalThis.window as unknown as { Event: typeof Event; MouseEvent: typeof MouseEvent };

const TIMING = { delay: 10, expandAfter: 30, grace: 5, linger: 40 };

let anchor: HTMLElement;
let owner: HTMLElement;
let made = 0;
let release: () => void;

function make(): Element {
    made++;
    return {
        id: `said-${made}`,
        title: 'Said',
        symbol: 'Sd',
        renderContent: () => {
            const body = document.createElement('div');
            body.className = 'said-body';
            body.textContent = 'the bigger picture';
            return body;
        },
    };
}

const enter = (el: HTMLElement) => el.dispatchEvent(new (realm().Event)('pointerenter'));
const leave = (el: HTMLElement) => el.dispatchEvent(new (realm().Event)('pointerleave'));
const click = (el: HTMLElement) => el.dispatchEvent(new (realm().MouseEvent)('click', { bubbles: true }));
// A finger: the pointer says it is a touch, and a tap ends in a click.
const touched = (el: EventTarget, type: string) => {
    const ev = new (realm().Event)(type, { bubbles: type !== 'pointerenter' && type !== 'pointerleave' });
    Object.defineProperty(ev, 'pointerType', { value: 'touch' });
    el.dispatchEvent(ev);
};
const tap = (el: HTMLElement) => {
    touched(el, 'pointerenter');
    touched(el, 'pointerdown');
    touched(el, 'pointerup');
    click(el);
};
const tooltips = () => Array.from(document.querySelectorAll<HTMLElement>('[data-form="tooltip"]'));

beforeEach(() => {
    document.body.innerHTML = '';
    made = 0;
    owner = document.createElement('div');
    owner.className = 'owner';
    anchor = document.createElement('span');
    anchor.textContent = 'Hover Please';
    owner.appendChild(anchor);
    document.body.appendChild(owner);
    release = tooltipFrom(anchor, make, TIMING);
});

afterEach(() => release());

describe('Tim: hover, tooltip, expanded, window', () => {
    test('after the delay a new element takes tooltip form', async () => {
        enter(anchor);
        expect(tooltips()).toHaveLength(0);
        await wait(TIMING.delay + 5);
        const [tip] = tooltips();
        expect(tip).toBeDefined();
        expect(getElementId(tip!)).toBe('said-1');
        expect(tip!.textContent).toContain('Said');
        expect(tip!.textContent).not.toContain('the bigger picture');
    });

    test('a longer hover grows the same element into the bigger picture', async () => {
        enter(anchor);
        await wait(TIMING.delay + 5);
        const [tip] = tooltips();
        await wait(TIMING.expandAfter + 5);
        expect(tooltips()).toEqual([tip!]);
        expect(tip!.dataset.expanded).toBe('true');
        expect(tip!.textContent).toContain('the bigger picture');
    });

    test('a click on the expanded tooltip takes Window Form, the same element', async () => {
        enter(anchor);
        await wait(TIMING.delay + TIMING.expandAfter + 10);
        const [tip] = tooltips();
        const body = tip!.querySelector('.said-body');
        enter(tip!);
        click(tip!);
        expect(getForm(tip!)).toBe('window');
        expect(document.querySelectorAll('[data-element-id="said-1"]')).toHaveLength(1);
        // The content it grew into is kept for the window, not drawn again: it
        // waits in the stash the window restores from when the morph commits.
        expect(body).not.toBeNull();
        expect(hasStash(tip!)).toBe(true);
        expect(tip!.contains(body)).toBe(false);
    });
});

describe('Spike: what does not happen', () => {
    test('leaving before the delay makes nothing', async () => {
        enter(anchor);
        leave(anchor);
        await wait(TIMING.delay + 10);
        expect(tooltips()).toHaveLength(0);
        expect(made).toBe(0);
    });

    test('leaving abandons the tooltip: the element that never committed is gone', async () => {
        enter(anchor);
        await wait(TIMING.delay + 5);
        expect(tooltips()).toHaveLength(1);
        leave(anchor);
        await wait(TIMING.grace + 5);
        expect(tooltips()).toHaveLength(0);
        expect(document.querySelector('[data-element-id="said-1"]')).toBeNull();
    });

    test('a click before it has grown commits nothing', async () => {
        enter(anchor);
        await wait(TIMING.delay + 5);
        const [tip] = tooltips();
        click(tip!);
        expect(getForm(tip!)).toBe('tooltip');
    });

    test('the text and what holds it are untouched throughout', async () => {
        const before = owner.outerHTML;
        enter(anchor);
        await wait(TIMING.delay + TIMING.expandAfter + 10);
        expect(owner.outerHTML).toBe(before);
    });

    test('every hover is a new element', async () => {
        enter(anchor);
        await wait(TIMING.delay + 5);
        const [first] = tooltips();
        leave(anchor);
        await wait(TIMING.grace + 5);
        enter(anchor);
        await wait(TIMING.delay + 5);
        const [second] = tooltips();
        expect(second).not.toBe(first);
        expect(getElementId(second!)).toBe('said-2');
    });
});

describe('Jenny: moving and coming back', () => {
    test('moving from the text onto the expanded tooltip keeps it', async () => {
        enter(anchor);
        await wait(TIMING.delay + TIMING.expandAfter + 10);
        leave(anchor);
        enter(tooltips()[0]!);
        await wait(TIMING.grace + 5);
        expect(tooltips()).toHaveLength(1);
    });

    test('after one became a window, hovering again makes another, and the window stays', async () => {
        enter(anchor);
        await wait(TIMING.delay + TIMING.expandAfter + 10);
        const [tip] = tooltips();
        enter(tip!);
        click(tip!);
        leave(tip!);
        leave(anchor);
        await wait(TIMING.grace + 5);
        enter(anchor);
        await wait(TIMING.delay + 5);
        expect(getForm(tip!)).toBe('window');
        expect(tooltips().map((t) => getElementId(t))).toEqual(['said-2']);
    });
});

describe('Touch: "The tap should just open the tooltip, and the tooltip should linger for 1.4 sec"', () => {
    test('a tap opens the tooltip at once', () => {
        tap(anchor);
        expect(tooltips()).toHaveLength(1);
        expect(tooltips()[0]!.dataset.expanded).toBeUndefined();
    });

    test('it lingers, then goes', async () => {
        tap(anchor);
        await wait(TIMING.linger - 20);
        expect(tooltips()).toHaveLength(1);
        await wait(40);
        expect(tooltips()).toHaveLength(0);
    });

    test('"Tap again within those 1.4 sec and it expands"', async () => {
        tap(anchor);
        const [tip] = tooltips();
        tap(tip!);
        expect(tip!.dataset.expanded).toBe('true');
        // Expanded, it stays for the next tap rather than lingering out.
        await wait(TIMING.linger + 10);
        expect(tooltips()).toEqual([tip!]);
    });

    test('"tap again and you get your window"', () => {
        tap(anchor);
        const [tip] = tooltips();
        tap(tip!);
        tap(tip!);
        expect(getForm(tip!)).toBe('window');
    });

    test('tapping the text again counts as tapping the tooltip', () => {
        tap(anchor);
        const [tip] = tooltips();
        tap(anchor);
        expect(tip!.dataset.expanded).toBe('true');
        tap(anchor);
        expect(getForm(tip!)).toBe('window');
    });

    test('a finger resting on the text does not start the hover timer', async () => {
        touched(anchor, 'pointerenter');
        await wait(TIMING.delay + TIMING.expandAfter + 10);
        expect(tooltips()).toHaveLength(0);
    });

    test('a tap somewhere else lets it go', async () => {
        tap(anchor);
        touched(document.body, 'pointerdown');
        await wait(1);
        expect(tooltips()).toHaveLength(0);
    });

    test('resting a finger on the text selects nothing', () => {
        expect(anchor.style.userSelect).toBe('none');
    });
});

describe('Motion: "it grows out of its place" (VISION.md), and back', () => {
    type Played = { element: HTMLElement; keyframes: Keyframe[] };
    let played: Played[] = [];
    const proto = (globalThis.window as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement.prototype;
    const had = (proto as unknown as { animate?: unknown }).animate;

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
        anchor.getBoundingClientRect = () => ({ left: 10, top: 20, width: 80, height: 14, right: 90, bottom: 34, x: 10, y: 20, toJSON: () => ({}) }) as DOMRect;
    });

    afterEach(() => {
        (proto as unknown as { animate: unknown }).animate = had;
    });

    const along = (el: HTMLElement) => played.filter((p) => p.element === el).map((p) => p.keyframes);

    test('the tooltip grows out of the text, unseen at first', async () => {
        enter(anchor);
        await wait(TIMING.delay + 5);
        const [tip] = tooltips();
        const [appear] = along(tip!);
        expect(appear![0]).toMatchObject({ left: '10px', top: '20px', width: '80px', height: '14px', opacity: '0' });
        expect(appear![appear!.length - 1]!.opacity).toBe('1');
    });

    test('growing into the bigger picture is a road too, from what it said', async () => {
        enter(anchor);
        await wait(TIMING.delay + TIMING.expandAfter + 10);
        const [tip] = tooltips();
        const roads = along(tip!);
        expect(roads).toHaveLength(2);
        expect(roads[1]![0]!.opacity).toBe('1');
        expect(roads[1]![1]!.opacity).toBe('1');
    });

    test('left, it goes back into the text, and is gone once it arrives', async () => {
        enter(anchor);
        await wait(TIMING.delay + 5);
        const [tip] = tooltips();
        leave(anchor);
        await wait(TIMING.grace + 1);
        const roads = along(tip!);
        const back = roads[roads.length - 1]!;
        expect(back[back.length - 1]).toMatchObject({ left: '10px', top: '20px', width: '80px', height: '14px', opacity: '0' });
        await wait(10);
        expect(tip!.isConnected).toBe(false);
    });
});

describe('Says: "For one changing value, direct view of time and value"', () => {
    let saysRelease: () => void;
    let asked: number[] = [];
    const along = (x: number) => anchor.dispatchEvent(new (realm().MouseEvent)('pointermove', { clientX: x, bubbles: true }));
    const enterAt = (x: number) => anchor.dispatchEvent(new (realm().MouseEvent)('pointerenter', { clientX: x }));

    beforeEach(() => {
        release();
        asked = [];
        saysRelease = tooltipFrom(anchor, make, TIMING, (at) => {
            asked.push(at.x);
            return at.x < 50 ? '10:00 · 1' : '11:00 · 4';
        });
    });

    afterEach(() => saysRelease());

    test('what it says is what is under the pointer, not the title', async () => {
        enterAt(10);
        await wait(TIMING.delay + 5);
        const [tip] = tooltips();
        expect(tip!.querySelector('.tooltip-title')!.textContent).toBe('10:00 · 1');
    });

    test('and it follows the pointer', async () => {
        enterAt(10);
        await wait(TIMING.delay + 5);
        along(90);
        expect(tooltips()[0]!.querySelector('.tooltip-title')!.textContent).toBe('11:00 · 4');
    });

    test('once grown it holds still, and the element keeps its own title', async () => {
        enterAt(10);
        await wait(TIMING.delay + TIMING.expandAfter + 10);
        const [tip] = tooltips();
        const said = tip!.querySelector('.tooltip-said')!.textContent;
        along(90);
        expect(tip!.querySelector('.tooltip-said')!.textContent).toBe(said);
        expect(tip!.textContent).toContain('the bigger picture');
    });

    test('a tap says what is under the finger', () => {
        const ev = new (realm().MouseEvent)('click', { clientX: 90, bubbles: true });
        touched(anchor, 'pointerdown');
        anchor.dispatchEvent(ev);
        expect(tooltips()[0]!.querySelector('.tooltip-title')!.textContent).toBe('11:00 · 4');
    });
});
