/**
 * What form an element records it is in.
 *
 * Personas:
 * - Tim: the element carries the name
 * - Spike: one at a time, and a fresh element carries none
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
    setForm,
    getForm,
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
    // Element Axioma: one element for the element's whole lifetime. It is in one
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
