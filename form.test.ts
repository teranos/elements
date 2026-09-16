/**
 * Tests for the form list.
 *
 * Personas:
 * - Tim: Happy path — the table is what the package's own files say it is
 * - Spike: Edge cases — the tray's destinations are derived, not kept by hand
 * - Jenny: Complex scenarios — recognising a name at runtime
 */

import { describe, test, expect } from 'bun:test';
import {
    FORMS,
    TRAY_DESTINATIONS,
    isForm,
    isTrayDestination,
    type Form,
    type TrayDestination,
} from './form';

const names = Object.keys(FORMS) as Form[];

describe('Tim: the table', () => {
    test('names every form the package implements', () => {
        expect([...names].sort()).toEqual([
            'canvasExpanded',
            'canvasPlaced',
            'cursor',
            'dot',
            'panel',
            'proximity',
            'window',
            'workspace',
        ]);
    });

    test('holds the sequence proximity.ts documents: dot to proximity to window to dot', () => {
        for (const name of ['dot', 'proximity', 'window'] as const) {
            expect(names).toContain(name);
        }
    });

    test('is frozen — the table is read, never edited at runtime', () => {
        expect(Object.isFrozen(FORMS)).toBe(true);
        expect(Object.isFrozen(TRAY_DESTINATIONS)).toBe(true);
    });

    test('every row is frozen too, or the table and its subset can disagree', () => {
        for (const name of names) {
            expect(Object.isFrozen(FORMS[name])).toBe(true);
        }
    });

    test('a write to a row is refused, so isTrayDestination cannot outvote TRAY_DESTINATIONS', () => {
        // TRAY_DESTINATIONS is computed once at load; isTrayDestination reads the
        // table live. A mutable row lets the two answer differently for one name.
        expect(() => {
            (FORMS.dot as { opensFromTray: boolean }).opensFromTray = true;
        }).toThrow();
        expect(isTrayDestination('dot')).toBe(false);
        expect(TRAY_DESTINATIONS).not.toContain('dot' as TrayDestination);
    });

    test('every entry says whether a tray dot opens as it', () => {
        for (const name of names) {
            expect(typeof FORMS[name].opensFromTray).toBe('boolean');
        }
    });
});

describe('Spike: the tray opens onto a subset', () => {
    test('a dot morphs into window, panel or workspace', () => {
        expect([...TRAY_DESTINATIONS].sort()).toEqual(['panel', 'window', 'workspace']);
    });

    test('the subset is derived from the table, not kept beside it', () => {
        const marked = names.filter(m => FORMS[m].opensFromTray);
        expect([...TRAY_DESTINATIONS]).toEqual(marked);
    });

    test('dot is not a destination — it is where the morph starts', () => {
        expect(FORMS.dot.opensFromTray).toBe(false);
    });

    test('proximity is not a destination — it is the way there', () => {
        expect(FORMS.proximity.opensFromTray).toBe(false);
    });

    test('cursor is not a destination — cursor.ts says it stays outside the tray morph lifecycle', () => {
        expect(FORMS.cursor.opensFromTray).toBe(false);
    });

    test('canvasPlaced is not a destination — it is reached by placing, not by opening a dot', () => {
        expect(FORMS.canvasPlaced.opensFromTray).toBe(false);
    });

    test('canvasExpanded is not a destination — it is reached from a placed glyph', () => {
        expect(FORMS.canvasExpanded.opensFromTray).toBe(false);
    });
});

describe('Jenny: recognising a name', () => {
    test('isForm accepts each name in the table', () => {
        for (const name of names) {
            expect(isForm(name)).toBe(true);
        }
    });

    test('isForm rejects a name that is not in it', () => {
        expect(isForm('fullscreen')).toBe(false);
        expect(isForm('canvas-placed')).toBe(false);
        expect(isForm('')).toBe(false);
    });

    // The word the workspace used to answer to. Three forms reach the
    // viewport's edges, so neither 'canvas' nor 'fullscreen' picks one out.
    test('isForm rejects canvas, the name workspace replaced', () => {
        expect(isForm('canvas')).toBe(false);
    });

    test('isForm does not accept an inherited property', () => {
        expect(isForm('toString')).toBe(false);
        expect(isForm('constructor')).toBe(false);
    });

    test('isTrayDestination narrows to what a dot may open as', () => {
        expect(isTrayDestination('panel')).toBe(true);
        expect(isTrayDestination('dot')).toBe(false);
        expect(isTrayDestination('cursor')).toBe(false);
    });

    test('a TrayDestination is assignable from the derived list', () => {
        const d: TrayDestination = TRAY_DESTINATIONS[0];
        expect(isTrayDestination(d)).toBe(true);
    });
});
