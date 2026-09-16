/**
 * What form an element records it is in.
 *
 * Personas:
 * - Tim: the element carries the name
 * - Spike: one at a time, and a fresh element carries none
 * - Jenny: the boolean this replaces, and what it could and could not say
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
    setForm,
    getForm,
    isInWindowState,
    setWindowState,
} from './dataset';
import { FORMS, type Form } from './form';

let el: HTMLElement;

beforeEach(() => {
    el = document.createElement('div');
});

const names = Object.keys(FORMS) as Form[];

describe('Tim: the element carries the name', () => {
    test('every form in the table can be recorded and read back', () => {
        for (const name of names) {
            setForm(el, name);
            expect(getForm(el)).toBe(name);
        }
    });

    test('the name is what a stylesheet can select on', () => {
        setForm(el, 'panel');
        expect(el.getAttribute('data-form')).toBe('panel');
    });
});

describe('Spike: one at a time', () => {
    // Element Axioma: one element for the glyph's whole lifetime. It is in one
    // form at a time, so recording a second replaces the first rather
    // than adding to it.
    test('recording a form replaces the one before it', () => {
        setForm(el, 'window');
        setForm(el, 'canvasPlaced');
        expect(getForm(el)).toBe('canvasPlaced');
    });

    test('an element that has never been told is in none', () => {
        expect(getForm(el)).toBeNull();
    });

    test('a name that is not in the table reads as none, not as itself', () => {
        el.setAttribute('data-form', 'fullscreen');
        expect(getForm(el)).toBeNull();
    });
});

describe('Jenny: the boolean this replaces', () => {
    // setWindowState/isInWindowState read and write the same store, so a
    // consumer still on them sees what the ported code writes, and the reverse.
    test('the old setter records the window form', () => {
        setWindowState(el, true);
        expect(getForm(el)).toBe('window');
    });

    test('the old getter is true for window', () => {
        setForm(el, 'window');
        expect(isInWindowState(el)).toBe(true);
    });

    // The boolean was set true by canvas-expanded.ts for a glyph filling the
    // viewport, which is not a window. That is what it meant; the shim keeps
    // meaning it.
    test('the old getter is true for canvasExpanded, as it always was', () => {
        setForm(el, 'canvasExpanded');
        expect(isInWindowState(el)).toBe(true);
    });

    // And what it could never say: panel and workspace were set false, the same
    // answer it gave for a dot resting in the tray.
    test('the old getter cannot tell a panel from a dot', () => {
        setForm(el, 'panel');
        expect(isInWindowState(el)).toBe(false);
        setForm(el, 'dot');
        expect(isInWindowState(el)).toBe(false);
    });

    test('the old getter cannot tell the workspace from a dot', () => {
        setForm(el, 'workspace');
        expect(isInWindowState(el)).toBe(false);
    });

    test('the old clear leaves the element in no form', () => {
        setForm(el, 'window');
        setWindowState(el, false);
        expect(getForm(el)).toBeNull();
        expect(isInWindowState(el)).toBe(false);
    });
});
