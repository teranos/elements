/**
 * A finger held still on a canvas is the phone's right-click.
 *
 * "on mobile, can't get into spawn menu"
 *
 * Personas:
 * - Tim: a finger held still fires where it rests
 * - Spike: a finger that moves, a second finger, a field, a lift, a contextmenu from the platform
 * - Jenny: a hold that outlasts any timer, and one that is cut short
 */

import { describe, test, expect, beforeEach, afterEach, jest } from 'bun:test';
import { onTouchHold, HOLD_MS, type TouchHold } from './touch-hold';

// The DOM's own Event: one made by the runtime's has no target when dispatched.
const DomEvent: typeof Event = (window as any).Event;

interface Finger { identifier: number; clientX: number; clientY: number }

function touch(target: EventTarget, type: string, touches: Finger[], changed: Finger[] = touches): Event {
    const e = new DomEvent(type, { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'touches', { value: touches });
    Object.defineProperty(e, 'changedTouches', { value: changed });
    target.dispatchEvent(e);
    return e;
}

const finger = (x = 100, y = 200, identifier = 1): Finger => ({ identifier, clientX: x, clientY: y });
const lift = (target: EventTarget, f: Finger = finger()): Event => touch(target, 'touchend', [], [f]);
const contextmenu = (target: EventTarget): Event => {
    const e = new DomEvent('contextmenu', { bubbles: true, cancelable: true });
    target.dispatchEvent(e);
    return e;
};

let canvas: HTMLElement;
let fired: { x: number; y: number; target: HTMLElement }[];
let hold: TouchHold;

beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '';
    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    fired = [];
    hold = onTouchHold(canvas, (x, y, target) => fired.push({ x, y, target }));
});

afterEach(() => {
    hold.dispose();
    jest.useRealTimers();
});

describe('Tim: a finger held still', () => {
    test('fires where it rests, on what it holds', () => {
        touch(canvas, 'touchstart', [finger(100, 200)]);
        jest.advanceTimersByTime(HOLD_MS);
        expect(fired).toHaveLength(1);
        expect(fired[0].x).toBe(100);
        expect(fired[0].y).toBe(200);
        expect(fired[0].target).toBe(canvas);
    });

    test('does not fire before the hold is long enough', () => {
        touch(canvas, 'touchstart', [finger()]);
        jest.advanceTimersByTime(HOLD_MS - 1);
        expect(fired).toHaveLength(0);
    });

    test('is held from the moment it fired until its finger lifts', () => {
        touch(canvas, 'touchstart', [finger()]);
        expect(hold.isHeld()).toBe(false);
        jest.advanceTimersByTime(HOLD_MS);
        expect(hold.isHeld()).toBe(true);
        lift(canvas);
        expect(hold.isHeld()).toBe(false);
    });

    test('lifting the held finger sends no mouse events after it', () => {
        touch(canvas, 'touchstart', [finger()]);
        jest.advanceTimersByTime(HOLD_MS);
        expect(lift(canvas).defaultPrevented).toBe(true);
    });
});

describe('Spike: what is not a hold', () => {
    test('a tap lets go before the hold', () => {
        touch(canvas, 'touchstart', [finger()]);
        lift(canvas);
        jest.advanceTimersByTime(HOLD_MS * 2);
        expect(fired).toHaveLength(0);
    });

    test('a tap is left its mouse events', () => {
        touch(canvas, 'touchstart', [finger()]);
        expect(lift(canvas).defaultPrevented).toBe(false);
    });

    test('a finger that moves is panning', () => {
        touch(canvas, 'touchstart', [finger(100, 200)]);
        touch(canvas, 'touchmove', [finger(140, 200)]);
        jest.advanceTimersByTime(HOLD_MS * 2);
        expect(fired).toHaveLength(0);
    });

    test('a tremble within the slop still holds', () => {
        touch(canvas, 'touchstart', [finger(100, 200)]);
        touch(canvas, 'touchmove', [finger(103, 202)]);
        jest.advanceTimersByTime(HOLD_MS);
        expect(fired).toHaveLength(1);
        expect(fired[0].x).toBe(100);
        expect(fired[0].y).toBe(200);
    });

    test('two fingers are pinching', () => {
        touch(canvas, 'touchstart', [finger(100, 200)]);
        touch(canvas, 'touchstart', [finger(100, 200), finger(200, 300, 2)]);
        jest.advanceTimersByTime(HOLD_MS * 2);
        expect(fired).toHaveLength(0);
    });

    test('a hold in a field is the field\'s', () => {
        for (const tag of ['input', 'textarea', 'select']) {
            const field = document.createElement(tag);
            canvas.appendChild(field);
            touch(field, 'touchstart', [finger()]);
            jest.advanceTimersByTime(HOLD_MS * 2);
            lift(field);
        }
        const editable = document.createElement('div');
        editable.setAttribute('contenteditable', 'true');
        canvas.appendChild(editable);
        touch(editable, 'touchstart', [finger()]);
        jest.advanceTimersByTime(HOLD_MS * 2);
        expect(fired).toHaveLength(0);
    });

    test('a cancelled touch lets go', () => {
        touch(canvas, 'touchstart', [finger()]);
        touch(canvas, 'touchcancel', [], [finger()]);
        jest.advanceTimersByTime(HOLD_MS * 2);
        expect(fired).toHaveLength(0);
    });

    test('a contextmenu the platform sends first is the one that counts', () => {
        touch(canvas, 'touchstart', [finger()]);
        contextmenu(canvas);
        jest.advanceTimersByTime(HOLD_MS * 2);
        expect(fired).toHaveLength(0);
    });

    test('disposed, it hears nothing', () => {
        hold.dispose();
        touch(canvas, 'touchstart', [finger()]);
        jest.advanceTimersByTime(HOLD_MS * 2);
        expect(fired).toHaveLength(0);
    });
});

describe('Jenny: a hold that outlasts the timers', () => {
    // PR 29 stopped listening for the lift after 5 s, so a finger held longer
    // sent its mouse events after all, and they closed the menu it had opened.
    test('a finger held for a minute is still held, and its lift still sends no mouse events', () => {
        touch(canvas, 'touchstart', [finger()]);
        jest.advanceTimersByTime(HOLD_MS);
        jest.advanceTimersByTime(60_000);
        expect(hold.isHeld()).toBe(true);
        expect(lift(canvas).defaultPrevented).toBe(true);
        expect(hold.isHeld()).toBe(false);
    });

    test('a lift off something the page took out of the canvas is still heard', () => {
        const inner = document.createElement('span');
        canvas.appendChild(inner);
        touch(inner, 'touchstart', [finger()]);
        jest.advanceTimersByTime(HOLD_MS);
        document.body.appendChild(inner);
        expect(lift(inner).defaultPrevented).toBe(true);
    });

    test('a lift off something removed from the page is heard by the cancel that follows it', () => {
        const inner = document.createElement('span');
        canvas.appendChild(inner);
        touch(inner, 'touchstart', [finger()]);
        jest.advanceTimersByTime(HOLD_MS);
        inner.remove();
        expect(hold.isHeld()).toBe(true);
        touch(document.body, 'touchcancel', [], [finger()]);
        expect(hold.isHeld()).toBe(false);
    });

    test('a new press ends a hold whose lift was never heard', () => {
        touch(canvas, 'touchstart', [finger()]);
        jest.advanceTimersByTime(HOLD_MS);
        expect(hold.isHeld()).toBe(true);
        touch(canvas, 'touchstart', [finger(10, 10, 7)]);
        expect(hold.isHeld()).toBe(false);
    });

    test('a hold after a hold fires again, each where it rests', () => {
        touch(canvas, 'touchstart', [finger(100, 200)]);
        jest.advanceTimersByTime(HOLD_MS);
        lift(canvas);
        touch(canvas, 'touchstart', [finger(30, 40)]);
        jest.advanceTimersByTime(HOLD_MS);
        expect(fired.map(f => [f.x, f.y])).toEqual([[100, 200], [30, 40]]);
    });
});
