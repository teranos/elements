/**
 * Touch browse: a thumb near the tray browses it — unless what it landed on is
 * its own interaction.
 *
 * A touch that starts a browse is prevented, so nothing under it hears it. A
 * field near the tray's edge would never take focus, and its keyboard would
 * never come.
 *
 * Personas:
 * - Tim: Happy path — a thumb on bare page by the tray starts a browse
 * - Spike: Edge cases — a field or a text area by the tray takes the touch
 */

import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { setupTouchBrowse, type TouchBrowseHost } from './touch-browse';

// The tray: a column at the right edge of the screen.
const TRAY = { left: window.innerWidth - 24, right: window.innerWidth - 4, top: 300, bottom: 500 };

let host: TouchBrowseHost & { proximity: { isTouchBrowsing: boolean } };

beforeAll(() => {
    const tray = document.createElement('div');
    tray.getBoundingClientRect = () => ({ ...TRAY, x: TRAY.left, y: TRAY.top, width: 20, height: 200, toJSON() {} }) as DOMRect;
    host = {
        element: tray,
        indicatorContainer: document.createElement('div'),
        proximity: {
            isTouchBrowsing: false,
            setPointerPosition() {},
            calculateProximity: () => ({ proximityRaw: 0 }),
        } as any,
        items: new Map([['selenium', { id: 'selenium', title: 'Selenium', renderContent: () => document.createElement('div') }]]),
        updateProximity() {},
        morphElement() {},
    };
    setupTouchBrowse(host);
});

beforeEach(() => {
    document.body.innerHTML = '';
    host.proximity.isTouchBrowsing = false;
});

/** A thumb put down on `target`, just left of the tray. */
function touchDown(target: EventTarget): Event {
    const e = new (window as any).Event('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'touches', { value: [{ clientX: TRAY.left - 10, clientY: 400 }] });
    target.dispatchEvent(e);
    return e;
}

describe('Tim: a thumb by the tray browses it', () => {
    test('a touch on bare page by the tray starts a browse', () => {
        const e = touchDown(document.body);
        expect(e.defaultPrevented).toBe(true);
        expect(host.proximity.isTouchBrowsing).toBe(true);
    });
});

describe('Spike: a field by the tray takes the touch', () => {
    test('a field by the tray takes the touch, and no browse starts', () => {
        const field = document.createElement('input');
        document.body.appendChild(field);

        const e = touchDown(field);

        expect(e.defaultPrevented).toBe(false);
        expect(host.proximity.isTouchBrowsing).toBe(false);
    });

    test('so does a text area', () => {
        const area = document.createElement('textarea');
        document.body.appendChild(area);

        const e = touchDown(area);

        expect(e.defaultPrevented).toBe(false);
        expect(host.proximity.isTouchBrowsing).toBe(false);
    });
});
