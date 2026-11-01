/**
 * The spawn menu is the package's: what a right-click or a finger held still
 * opens on a canvas, what is carried from it, and the morph that puts it down.
 * What can be spawned, and what becomes of it once placed, are the host's.
 *
 * "on mobile, can't get into spawn menu"
 *
 * Personas:
 * - Tim: open, choose, carry, place
 * - Spike: the gestures that are not an open, an empty answer, leaving without placing, an element that is not the carried one
 * - Jenny: a canvas inside a canvas, a hold that outlasts any timer, a morph the host cuts short
 */

import { describe, test, expect, beforeEach, afterEach, jest } from 'bun:test';
import { configureElements, type Logger } from '../config';
import { playAnimations, type Played } from '../test-animations';
import { HOLD_MS } from './touch-hold';
import {
    type SpawnEntry,
    type SpawnHost,
    isSpawnMenuOpen,
    isPlacementActive,
    resetSpawn,
} from './spawn';

const DomEvent: typeof Event = (window as any).Event;
const DomMouseEvent: typeof MouseEvent = (window as any).MouseEvent;

const AX: SpawnEntry = { id: 'ax', symbol: '⋈', title: 'AX', description: 'Query the attestation graph', hint: 'subject predicate' };
const NOTE: SpawnEntry = { id: 'note', symbol: '✎', title: 'Note' };
const THREAD: SpawnEntry = { id: 'thread', symbol: '〽', title: 'Thread' };

interface Finger { identifier: number; clientX: number; clientY: number }
const finger = (x = 100, y = 200, identifier = 1): Finger => ({ identifier, clientX: x, clientY: y });

function touch(target: EventTarget, type: string, touches: Finger[], changed: Finger[] = touches): Event {
    const e = new DomEvent(type, { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'touches', { value: touches });
    Object.defineProperty(e, 'changedTouches', { value: changed });
    target.dispatchEvent(e);
    return e;
}

function rightClick(target: EventTarget, x = 100, y = 200): Event {
    const e = new DomMouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y });
    target.dispatchEvent(e);
    return e;
}

function press(target: EventTarget, x = 0, y = 0, button = 0): Event {
    const e = new DomMouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y, button });
    target.dispatchEvent(e);
    return e;
}

function escape(): void {
    document.dispatchEvent(new (window as any).KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
}

/** Hold a finger still on target until the hold fires. */
function holdOn(target: EventTarget, x = 100, y = 200): void {
    touch(target, 'touchstart', [finger(x, y)]);
    jest.advanceTimersByTime(HOLD_MS);
}

const lift = (target: EventTarget, f: Finger = finger()): Event => touch(target, 'touchend', [], [f]);

/** Promises and the timers they wait on, run to the end. */
async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) await Promise.resolve();
    jest.advanceTimersByTime(1000);
    for (let i = 0; i < 5; i++) await Promise.resolve();
}

/** A canvas as a host builds one: data-canvas-id, no class. */
function canvasIn(parent: HTMLElement, id: string): HTMLElement {
    const canvas = document.createElement('div');
    canvas.dataset.canvasId = id;
    parent.appendChild(canvas);
    return canvas;
}

const menu = (): HTMLElement | null => document.querySelector('[role="menu"]');
const items = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('[role="menu"] [role="menuitem"]'));
const itemFor = (entry: SpawnEntry): HTMLElement => {
    const found = items().find(i => i.textContent?.includes(entry.symbol));
    if (!found) throw new Error(`no menu item for ${entry.title}`);
    return found;
};

interface Placing { entry: SpawnEntry; canvas: HTMLElement; at: { clientX: number; clientY: number }; carried: HTMLElement; symbol: HTMLElement | null; content?: string }

let root: HTMLElement;
let canvas: HTMLElement;
let asked: { target: HTMLElement; canvas: HTMLElement }[];
let placed: Placing[];
let logged: string[];
/** What the host does with a placing; a test replaces it to be the host it needs. */
let does: (p: Placing) => Promise<HTMLElement>;
let answer: (where: { target: HTMLElement; canvas: HTMLElement }) => SpawnEntry[];
let played: Played;

const capturing: Logger = {
    debug() {},
    info() {},
    warn(_s, m) { logged.push(m); },
    error(_s, m) { logged.push(m); },
};

beforeEach(() => {
    jest.useFakeTimers();
    played = playAnimations();
    document.body.innerHTML = '';
    root = document.createElement('div');
    document.body.appendChild(root);
    canvas = canvasIn(root, 'canvas-workspace');
    asked = [];
    placed = [];
    logged = [];
    does = async (p) => p.carried;
    answer = ({ target }) => (target.closest('.symbol') ? [THREAD] : [AX, NOTE]);
    const host: SpawnHost = {
        entries: (where) => { asked.push(where); return answer(where); },
        place: (p) => { placed.push(p); return does(p); },
    };
    configureElements({ logger: capturing, spawn: host });
});

afterEach(() => {
    resetSpawn();
    played.restore();
    jest.useRealTimers();
});

describe('Tim: a right-click opens what can be spawned', () => {
    test('one menu, one item per entry the host answers, each showing its symbol', () => {
        rightClick(canvas);
        expect(menu()).not.toBeNull();
        expect(isSpawnMenuOpen()).toBe(true);
        expect(items().map(i => i.textContent)).toEqual([
            expect.stringContaining(AX.symbol),
            expect.stringContaining(NOTE.symbol),
        ]);
    });

    test('the host is asked what was pressed and which canvas it stands on', () => {
        const symbol = document.createElement('span');
        symbol.className = 'symbol';
        canvas.appendChild(symbol);
        rightClick(symbol);
        expect(asked).toHaveLength(1);
        expect(asked[0].target).toBe(symbol);
        expect(asked[0].canvas).toBe(canvas);
        expect(items().map(i => i.textContent)).toEqual([expect.stringContaining(THREAD.symbol)]);
    });

    test('the menu opens where the pointer is', () => {
        rightClick(canvas, 140, 260);
        expect(menu()!.style.left).toBe('140px');
        expect(menu()!.style.top).toBe('260px');
    });

    test('the page\'s own menu is kept from it', () => {
        expect(rightClick(canvas).defaultPrevented).toBe(true);
    });

    test('a finger held still opens the same menu where it rests', () => {
        holdOn(canvas, 80, 90);
        expect(menu()).not.toBeNull();
        expect(menu()!.style.left).toBe('80px');
        expect(menu()!.style.top).toBe('90px');
        expect(items()).toHaveLength(2);
    });

    test('a description is said as plain text, and a title is never read as markup', () => {
        answer = () => [{ id: 'x', symbol: 'x', title: '<img src=x onerror=alert(1)>', description: '<b>bold</b>' }];
        rightClick(canvas);
        expect(menu()!.querySelector('img')).toBeNull();
        expect(menu()!.querySelector('b')).toBeNull();
        expect(menu()!.textContent).toContain('<b>bold</b>');
    });

    test('choosing an entry closes the menu and carries a cursor with its symbol', () => {
        rightClick(canvas);
        press(itemFor(AX));
        expect(isSpawnMenuOpen()).toBe(false);
        expect(isPlacementActive()).toBe(true);
        const cursor = document.querySelector<HTMLElement>('.cursor');
        expect(cursor).not.toBeNull();
        expect(cursor!.parentElement).toBe(document.body);
        expect(cursor!.textContent).toContain(AX.symbol);
    });

    test('the item chosen is the element carried: button, cursor, placed, one element', async () => {
        rightClick(canvas);
        const item = itemFor(AX);
        press(item);
        press(canvas, 300, 400);
        await settle();
        expect(placed).toHaveLength(1);
        expect(placed[0].carried).toBe(item);
    });

    test('pressing the canvas puts it down, and the host is told what, where, on which canvas', async () => {
        rightClick(canvas);
        press(itemFor(NOTE));
        press(canvas, 300, 400);
        await settle();
        expect(placed).toHaveLength(1);
        expect(placed[0].entry).toEqual(NOTE);
        expect(placed[0].canvas).toBe(canvas);
        expect(placed[0].at).toEqual({ clientX: 300, clientY: 400 });
        expect(isPlacementActive()).toBe(false);
        expect(document.querySelector('[data-spawn-scrim]')).toBeNull();
    });

    test('a placed element is no longer a cursor', async () => {
        rightClick(canvas);
        const item = itemFor(AX);
        press(item);
        press(canvas, 300, 400);
        await settle();
        expect(item.classList.contains('cursor')).toBe(false);
        expect(item.style.position).not.toBe('fixed');
    });

    test('Escape closes the menu and nothing is placed', async () => {
        rightClick(canvas);
        escape();
        await settle();
        expect(menu()).toBeNull();
        expect(isSpawnMenuOpen()).toBe(false);
        expect(placed).toHaveLength(0);
    });
});

describe('Spike: gestures that are not an open', () => {
    test('a right-click on no canvas is left to the page', () => {
        const outside = document.createElement('div');
        document.body.appendChild(outside);
        expect(rightClick(outside).defaultPrevented).toBe(false);
        expect(menu()).toBeNull();
        expect(asked).toHaveLength(0);
    });

    test('a host with nothing to spawn opens no menu and no scrim', () => {
        answer = () => [];
        rightClick(canvas);
        expect(menu()).toBeNull();
        expect(isSpawnMenuOpen()).toBe(false);
        expect(document.querySelector('[data-spawn-scrim]')).toBeNull();
    });

    test('with no host at all, a canvas has no menu', () => {
        resetSpawn();
        expect(rightClick(canvas).defaultPrevented).toBe(false);
        expect(menu()).toBeNull();
    });

    test('a right-click while the menu is open dismisses it and opens no second', async () => {
        rightClick(canvas);
        jest.advanceTimersByTime(1);
        rightClick(canvas, 10, 10);
        await settle();
        expect(document.querySelectorAll('[role="menu"]')).toHaveLength(0);
        expect(isSpawnMenuOpen()).toBe(false);
    });

    test('a press outside the menu dismisses it', async () => {
        rightClick(canvas);
        jest.advanceTimersByTime(1);
        press(canvas, 5, 5);
        await settle();
        expect(menu()).toBeNull();
        expect(placed).toHaveLength(0);
    });

    test('a press on the menu itself does not dismiss it', () => {
        rightClick(canvas);
        jest.advanceTimersByTime(1);
        press(menu()!);
        expect(menu()).not.toBeNull();
    });

    test('a right-click while carrying cancels, and the cursor goes', async () => {
        rightClick(canvas);
        press(itemFor(AX));
        rightClick(canvas);
        await settle();
        expect(isPlacementActive()).toBe(false);
        expect(document.querySelector('.cursor')).toBeNull();
        expect(placed).toHaveLength(0);
    });

    test('Escape while carrying cancels', async () => {
        rightClick(canvas);
        press(itemFor(AX));
        escape();
        await settle();
        expect(isPlacementActive()).toBe(false);
        expect(document.querySelector('.cursor')).toBeNull();
    });

    test('a hold while carrying cancels, since a phone has neither a right-click nor an Escape', async () => {
        rightClick(canvas);
        press(itemFor(AX));
        holdOn(canvas);
        await settle();
        expect(isPlacementActive()).toBe(false);
        expect(document.querySelector('.cursor')).toBeNull();
        expect(menu()).toBeNull();
        expect(placed).toHaveLength(0);
    });

    test('a hold in a field opens nothing', () => {
        const field = document.createElement('textarea');
        canvas.appendChild(field);
        holdOn(field);
        expect(menu()).toBeNull();
    });

    test('a hold on the menu itself opens nothing', () => {
        rightClick(canvas);
        const before = asked.length;
        holdOn(itemFor(AX));
        expect(asked).toHaveLength(before);
    });

    test('a finger that pans, or a second finger that pinches, opens nothing', () => {
        touch(canvas, 'touchstart', [finger(100, 200)]);
        touch(canvas, 'touchmove', [finger(160, 200)]);
        jest.advanceTimersByTime(HOLD_MS * 2);
        lift(canvas);
        touch(canvas, 'touchstart', [finger(100, 200)]);
        touch(canvas, 'touchstart', [finger(100, 200), finger(200, 300, 2)]);
        jest.advanceTimersByTime(HOLD_MS * 2);
        expect(menu()).toBeNull();
    });

    test('the lift of the finger that opened it sends no mouse events after it', () => {
        holdOn(canvas);
        expect(lift(canvas).defaultPrevented).toBe(true);
        expect(menu()).not.toBeNull();
    });

    test('a contextmenu the platform sends after the hold opened it does not dismiss it', async () => {
        holdOn(canvas);
        jest.advanceTimersByTime(1);
        rightClick(canvas);
        await settle();
        expect(menu()).not.toBeNull();
        expect(isSpawnMenuOpen()).toBe(true);
    });

    test('a contextmenu the platform sends before the hold opens one menu, and the hold gives way', () => {
        touch(canvas, 'touchstart', [finger()]);
        rightClick(canvas);
        jest.advanceTimersByTime(HOLD_MS * 2);
        expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1);
        expect(asked).toHaveLength(1);
    });

    test('once the finger has lifted, a right-click is a right-click again', async () => {
        holdOn(canvas);
        lift(canvas);
        jest.advanceTimersByTime(1);
        rightClick(canvas);
        await settle();
        expect(menu()).toBeNull();
    });

    test('an entry chosen and a host that throws are said, and nothing is left carried', async () => {
        does = async () => { throw new Error('no room'); };
        rightClick(canvas);
        const item = itemFor(AX);
        press(item);
        press(canvas, 1, 1);
        await settle();
        expect(logged.some(m => /no room/.test(m))).toBe(true);
        expect(isPlacementActive()).toBe(false);
        expect(document.body.contains(item)).toBe(false);
        expect(document.querySelector('[data-spawn-scrim]')).toBeNull();
    });

    test('an element that is not the one carried is an error, and the carried one is not left behind', async () => {
        const other = document.createElement('div');
        does = async () => other;
        rightClick(canvas);
        const item = itemFor(AX);
        press(item);
        press(canvas, 1, 1);
        await settle();
        expect(logged.some(m => /carried/i.test(m))).toBe(true);
        expect(document.body.contains(item)).toBe(false);
        expect(isPlacementActive()).toBe(false);
    });
});

describe('Jenny: canvases inside canvases, holds that last, morphs that end', () => {
    test('the canvas pressed is the nearest one, and only its host answers are asked', async () => {
        const inner = canvasIn(canvas, 'subcanvas-1');
        rightClick(inner, 50, 60);
        expect(asked).toHaveLength(1);
        expect(asked[0].canvas).toBe(inner);
        press(itemFor(AX));
        press(inner, 70, 80);
        await settle();
        expect(placed[0].canvas).toBe(inner);
    });

    test('a hold on the outer canvas beside the inner is the outer\'s', () => {
        canvasIn(canvas, 'subcanvas-1');
        holdOn(canvas);
        expect(asked[0].canvas).toBe(canvas);
    });

    test('an element standing on the canvas opens the canvas\'s menu for its symbol', () => {
        const element = document.createElement('div');
        element.className = 'canvas-element';
        const symbol = document.createElement('span');
        symbol.className = 'symbol';
        element.appendChild(symbol);
        canvas.appendChild(element);
        holdOn(symbol);
        expect(asked[0].target).toBe(symbol);
        expect(asked[0].canvas).toBe(canvas);
    });

    test('a finger held for a minute and lifted does not close the menu it opened', async () => {
        holdOn(canvas);
        jest.advanceTimersByTime(60_000);
        expect(lift(canvas).defaultPrevented).toBe(true);
        await settle();
        expect(menu()).not.toBeNull();
        expect(isSpawnMenuOpen()).toBe(true);
    });

    test('a menu opened by a hold can be chosen from by a tap, then placed by another', async () => {
        holdOn(canvas);
        lift(canvas);
        jest.advanceTimersByTime(1);
        const item = itemFor(NOTE);
        touch(item, 'touchstart', [finger(5, 5)]);
        lift(item, finger(5, 5));
        press(item);
        touch(canvas, 'touchstart', [finger(300, 400)]);
        lift(canvas, finger(300, 400));
        press(canvas, 300, 400);
        await settle();
        expect(placed).toHaveLength(1);
        expect(placed[0].entry).toEqual(NOTE);
        expect(placed[0].at).toEqual({ clientX: 300, clientY: 400 });
    });

    test('putting down is a road the carried element takes, and it takes it once', async () => {
        rightClick(canvas);
        const item = itemFor(AX);
        press(item);
        press(canvas, 300, 400);
        await settle();
        expect(played.of(item)).toHaveLength(1);
    });

    test('the road never has a number that is not one, even where nothing has a size', async () => {
        rightClick(canvas);
        const item = itemFor(AX);
        press(item);
        press(canvas, 300, 400);
        await settle();
        const road = JSON.stringify(played.of(item));
        expect(road).not.toMatch(/NaN|Infinity/);
    });

    test('the host hears of the placing once, however many presses follow', async () => {
        rightClick(canvas);
        press(itemFor(AX));
        press(canvas, 300, 400);
        press(canvas, 310, 410);
        press(canvas, 320, 420);
        await settle();
        expect(placed).toHaveLength(1);
    });

    test('a second menu opens after the first has been placed', async () => {
        rightClick(canvas);
        press(itemFor(AX));
        press(canvas, 300, 400);
        await settle();
        rightClick(canvas, 20, 30);
        expect(menu()).not.toBeNull();
        expect(menu()!.style.left).toBe('20px');
    });
});
