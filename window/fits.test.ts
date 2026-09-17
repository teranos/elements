/**
 * Whether an element has the room to be a window.
 *
 * A window is a box with screen around it. Where the content wants more room
 * than a window may take, the element is a panel and takes the screen.
 */

import { describe, test, expect } from 'bun:test';
import { fitsAsWindow } from './fits';

describe('Tim', () => {
    test('a small element on a laptop is a window', () => {
        expect(fitsAsWindow(600, 1440)).toBe(true);
    });

    test('an element that wants exactly what a window may take is a window', () => {
        expect(fitsAsWindow(1152, 1440)).toBe(true);
    });
});

describe('Spike', () => {
    test('an element wanting more room than a window may take is a panel', () => {
        expect(fitsAsWindow(1300, 1440)).toBe(false);
    });

    test('an ordinary element on a phone is a panel', () => {
        expect(fitsAsWindow(600, 420)).toBe(false);
    });

    test('an element with no measured content is a window', () => {
        // Nothing was measured, so nothing says it needs the screen.
        expect(fitsAsWindow(0, 1440)).toBe(true);
    });
});

describe('Jenny', () => {
    test('the same element is a window on a laptop and a panel on a phone', () => {
        const wants = 700;
        expect(fitsAsWindow(wants, 1440)).toBe(true);
        expect(fitsAsWindow(wants, 420)).toBe(false);
    });
});
