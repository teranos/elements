// The tray sits above every window, so a dot opening under the pointer is never behind one.
// "Tray ~Proximity based morph needs to happen at a higher z than where the windows reside"

// Personas:
// - Tim: the tray writes its own layer, with no host stylesheet

import { describe, test, expect } from 'bun:test';
import { tray } from './tray';
import { getTrayZIndex } from '../config';

describe('Tim: the tray owns its layer', () => {
    test('the tray element carries the tray layer inline', () => {
        tray.init();
        const element = document.querySelector('.tray') as HTMLElement;

        expect(element.style.zIndex).toBe(String(getTrayZIndex()));
    });
});

// "i should never be able to get into a situation where i select text of the Proximate expanded elements title text"
describe('Spike: nothing in the tray can be selected', () => {
    test('the tray refuses a selection, wherever it started', () => {
        tray.init();
        const element = document.querySelector('.tray') as HTMLElement;

        expect(element.style.userSelect).toBe('none');
    });
});
