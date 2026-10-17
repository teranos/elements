/**
 * One scrollbar, the package's (#2).
 *
 * "i want one cemtrally managed elements owned scrollbar and they the elements
 * are only allowed to use that one" — "there should not be a system one".
 *
 * Inside an element no system scrollbar is drawn: the package's rule hides every
 * one. The element's scroller (content/scroll.ts) gets the package's bar, one per
 * element, drawn by nothing else.
 *
 * Personas:
 * - Tim: Happy path — a window's body brings one bar, and the rule that hides the system's
 * - Spike: Edge cases — watched again, still one; no scroller, no bar; a declared scroller has it
 * - Jenny: Complex scenarios — the rule outranks a host and leaves a dot alone; a dot drops its bar
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { holdBody } from './body';
import { watchScroll, declareScroller } from './scroll';

const RULE_ID = 'elements-scrollbar';
const rule = () => document.getElementById(RULE_ID);
const bars = (element: HTMLElement) => element.querySelectorAll('[data-scrollbar]');

/** An element in a form, holding a body the package gave it. */
function windowWithBody(id = 'lithium'): { element: HTMLElement; body: HTMLElement } {
    const element = document.createElement('div');
    element.dataset.elementId = id;
    const body = document.createElement('div');
    holdBody(body);
    body.innerHTML = '<p>line</p>';
    element.appendChild(body);
    document.body.appendChild(element);
    return { element, body };
}

beforeEach(() => {
    document.head.querySelectorAll('style').forEach((s) => s.remove());
    document.body.innerHTML = '';
});

describe('Tim: a window\'s body', () => {
    test('brings one bar, the package\'s, unseen by a screen reader', () => {
        const { element } = windowWithBody();
        watchScroll(element, 'Lithium');

        expect(bars(element)).toHaveLength(1);
        expect(bars(element)[0].getAttribute('aria-hidden')).toBe('true');
    });

    test('brings the rule that hides the system\'s', () => {
        const { element } = windowWithBody();
        watchScroll(element, 'Lithium');
        const css = rule()!.textContent!;

        expect(css).toContain('scrollbar-width: none !important');
        expect(css).toContain('::-webkit-scrollbar');
    });
});

describe('Spike: what has a bar', () => {
    test('watched again, an element still has one', () => {
        const { element } = windowWithBody();
        watchScroll(element, 'Lithium');
        watchScroll(element, 'Lithium');

        expect(bars(element)).toHaveLength(1);
        expect(document.querySelectorAll(`#${RULE_ID}`)).toHaveLength(1);
    });

    test('an element with no scroller has no bar', () => {
        const element = document.createElement('div');
        element.dataset.elementId = 'helium';
        document.body.appendChild(element);
        watchScroll(element, 'Helium');

        expect(bars(element)).toHaveLength(0);
    });

    test('a declared scroller has the bar, and the element still one', () => {
        const { element, body } = windowWithBody();
        const log = document.createElement('div');
        log.style.overflowY = 'auto';
        declareScroller(log);
        body.appendChild(log);
        watchScroll(element, 'Lithium');

        expect(bars(element)).toHaveLength(1);
        expect((bars(element)[0] as HTMLElement).dataset.scrollbar).toBe('declared');
    });
});

describe('Jenny: the rule, and a dot', () => {
    test('is layered and important, and leaves a dot to the tray', () => {
        const { element } = windowWithBody();
        watchScroll(element, 'Lithium');
        const css = rule()!.textContent!;

        expect(css).toContain('@layer elements');
        expect(css).toContain('[data-element-id]:not(.dot)');
    });

    test('an element whose body is taken (a dot) drops its bar', async () => {
        const { element, body } = windowWithBody();
        watchScroll(element, 'Lithium');
        body.remove();
        await window.happyDOM?.waitUntilComplete();

        expect(bars(element)).toHaveLength(0);
    });
});
