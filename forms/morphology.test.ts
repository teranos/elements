/**
 * Morph class lifecycle (MRPCL).
 *
 * The morph class belongs to the morph, not the glyph: it arrives with
 * prepareMorphTo, leaves at commit, and never wipes what the glyph wears.
 *
 * It says a morph is in flight and nothing more. Which morph is
 * data-form's to say, so there is one class rather than one per
 * destination.
 *
 * Personas:
 * - Tim: happy path — open, commit, the morph class is gone
 * - Spike: rollback — the glyph keeps the classes it had (Morph Axioma)
 * - Jenny: a window settles into no class of its own
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { prepareMorphTo } from './morphology';
import { setElementId, getForm } from '../dataset';
import type { Element } from '../element';

const noVerify = () => {};

function trayDot(ownClasses: string[] = []): { element: HTMLElement; item: Element } {
    const element = document.createElement('div');
    element.className = ['dot', ...ownClasses].join(' ');
    setElementId(element, 'morph-test-1');
    document.body.appendChild(element);
    const item: Element = {
        id: 'morph-test-1',
        title: 'Morph Test',
        renderContent: () => document.createElement('div'),
    };
    return { element, item };
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('Tim: open and commit', () => {
    test('the morph class is added, the dot class leaves with the dot state', () => {
        const { element, item } = trayDot();
        prepareMorphTo(element, item, noVerify, 'window', '1000');

        expect(element.classList.contains('morphing')).toBe(true);
        expect(element.classList.contains('dot')).toBe(false);
    });

    test('one morph class, whatever the destination — the attribute says which', () => {
        const { element, item } = trayDot();
        prepareMorphTo(element, item, noVerify, 'panel', '10003');

        expect(element.classList.contains('morphing')).toBe(true);
        expect(getForm(element)).toBe('panel');
    });

    test('commit swaps the morph class for the settled class', () => {
        const { element, item } = trayDot();
        const morph = prepareMorphTo(element, item, noVerify, 'panel', '10003');

        morph.commitClass('panel');

        expect(element.classList.contains('morphing')).toBe(false);
        expect(element.classList.contains('panel')).toBe(true);
    });

    test('commit can settle several classes at once (panel)', () => {
        const { element, item } = trayDot();
        const morph = prepareMorphTo(element, item, noVerify, 'panel', '10003');

        morph.commitClass('panel panel--fullscreen panel--from-top');

        expect(element.classList.contains('morphing')).toBe(false);
        expect(element.classList.contains('panel')).toBe(true);
        expect(element.classList.contains('panel--fullscreen')).toBe(true);
        expect(element.classList.contains('panel--from-top')).toBe(true);
    });

    test('the glyph keeps its own classes through open and commit', () => {
        const { element, item } = trayDot(['error']);
        const morph = prepareMorphTo(element, item, noVerify, 'window', '1000');
        expect(element.classList.contains('error')).toBe(true);

        morph.commitClass();
        expect(element.classList.contains('error')).toBe(true);
    });
});

describe('Spike: rollback', () => {
    // Morph Axioma: the attempt is abandoned and the glyph keeps the state
    // it had.
    test('an abandoned morph restores exactly the classes the glyph had', () => {
        const { element, item } = trayDot(['error']);
        const before = element.className;
        const morph = prepareMorphTo(element, item, noVerify, 'window', '1000');

        morph.rollbackClass();

        expect(element.className).toBe(before);
    });
});

describe('Jenny: a window settles into no class of its own', () => {
    // .glyph-window carried one declaration, pointer-events: auto, which
    // .glyph-morphing-to-window carried too — the same rule before and after the
    // morph. [data-form="window"] spans both, so the class is the
    // attribute wearing a second name and the morph commits without one.
    test('commit with nothing to settle leaves the morph class gone and adds none', () => {
        const { element, item } = trayDot();
        const morph = prepareMorphTo(element, item, noVerify, 'window', '1000');

        morph.commitClass();

        expect(element.classList.contains('morphing')).toBe(false);
        expect(element.classList.contains('window')).toBe(false);
        expect(getForm(element)).toBe('window');
    });

    test('an empty string settles nothing rather than throwing on a blank class', () => {
        const { element, item } = trayDot();
        const morph = prepareMorphTo(element, item, noVerify, 'window', '1000');

        expect(() => { morph.commitClass(''); }).not.toThrow();
        expect(element.classList.contains('morphing')).toBe(false);
    });
});
