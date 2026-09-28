/**
 * Every morph names both ends.
 *
 * Personas:
 * - Tim: the new name is the one to call
 * - Spike: the old name is gone
 */

// "we can also remove the depcreatted things in elements"

import { describe, test, expect } from 'bun:test';
import { beginMorphToCanvasPlaced } from './morph-transaction';
import * as elements from './index';

const exported = elements as unknown as Record<string, unknown>;

describe('Tim: the new name', () => {
    test('beginMorphToCanvasPlaced is what the package exports', () => {
        expect(elements.beginMorphToCanvasPlaced).toBe(beginMorphToCanvasPlaced);
    });

    // AXIOMAS.md: a morph is a transition between forms. The names say which two.
    test.each([
        'morphDotToWindow', 'morphWindowToDot',
        'morphDotToWorkspace', 'morphWorkspaceToDot',
        'morphDotToPanel', 'morphPanelToDot',
        'beginMorphToDot', 'beginMorphToCanvasPlaced',
    ])('%s is exported', (name) => {
        expect(typeof exported[name]).toBe('function');
    });
});

describe('Spike: the old names are gone in 2.0', () => {
    test.each([
        'morphToWindow', 'morphFromWindow',
        'morphToCanvas', 'morphFromCanvas',
        'morphToPanel', 'morphFromPanel',
        'beginMinimizeMorph', 'beginRestoreMorph',
        'isInWindowState', 'setWindowState',
    ])('%s is not exported', (name) => {
        expect(name in exported).toBe(false);
    });
});
