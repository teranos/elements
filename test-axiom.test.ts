/**
 * The axioms, asked of an element in a test (AXIOMAS.md).
 *
 * Personas:
 * - Tim: Happy path — one element, in a form the table names, passes
 * - Spike: Edge cases — a second, a stranger, and a form no one named each fail
 * - Jenny: Complex scenarios — the same node asked across a transition
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { expectAxiom } from './test-axiom';

let el: HTMLElement;

beforeEach(() => {
    document.body.innerHTML = '';
    el = document.createElement('div');
    el.dataset.elementId = 'radon';
    el.dataset.form = 'window';
    document.body.appendChild(el);
});

describe('Tim: what holds', () => {
    test('one element, the one asked about, in a form the table names', () => {
        expect(() => expectAxiom('radon', el)).not.toThrow();
    });
});

describe('Spike: what breaks it', () => {
    test('a second element with the same id', () => {
        const twin = document.createElement('div');
        twin.dataset.elementId = 'radon';
        document.body.appendChild(twin);
        expect(() => expectAxiom('radon', el)).toThrow();
    });

    test('the one in the page is not the one asked about', () => {
        const stranger = document.createElement('div');
        stranger.dataset.elementId = 'radon';
        el.remove();
        document.body.appendChild(stranger);
        expect(() => expectAxiom('radon', el)).toThrow();
    });

    test('a form no row of the table names', () => {
        el.dataset.form = 'fullscreen';
        expect(() => expectAxiom('radon', el)).toThrow();
    });

    test('none in the page at all', () => {
        el.remove();
        expect(() => expectAxiom('radon', el)).toThrow();
    });
});

describe('Jenny: across a transition', () => {
    test('reparented, it is still the one', () => {
        const holder = document.createElement('section');
        document.body.appendChild(holder);
        holder.appendChild(el);
        el.dataset.form = 'button';
        expect(() => expectAxiom('radon', el)).not.toThrow();
    });
});
