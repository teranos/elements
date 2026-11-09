/**
 * A field in a shadow root, inside an element, is at 16 too.
 *
 * A document stylesheet does not reach into a shadow root, so a host's web component drawing an
 * input in one was outside the package's 16 (text.ts), the size iOS Safari does not zoom the page
 * for. The package puts its own rule into every open shadow root inside an element, as it is
 * attached or added, and keeps watching it. A closed root is not reachable by anyone; the host owns it.
 *
 * Personas:
 * - Tim: Happy path — an open shadow root inside an element has the rule, once
 * - Spike: Edge cases — a closed root, a root outside any element, an element with none
 * - Jenny: Complex scenarios — a root added later; a root inside a root; a style attribute written in one
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { holdElementText, FIELD_TEXT_SIZE } from './text';

const tick = () => new Promise<void>((done) => setTimeout(done, 0));

function element(): HTMLElement {
    const el = document.createElement('div');
    el.dataset.elementId = 'selenium';
    document.body.appendChild(el);
    return el;
}

function hostWithRoot(parent: Element, mode: 'open' | 'closed' = 'open'): { host: HTMLElement; root: ShadowRoot } {
    const host = document.createElement('div');
    parent.appendChild(host);
    const root = host.attachShadow({ mode });
    root.innerHTML = '<input type="text">';
    return { host, root };
}

const rules = (root: ShadowRoot) => [...root.querySelectorAll('style[data-elements-text]')].map((s) => s.textContent ?? '');

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('Tim: an open shadow root inside an element', () => {
    test('has the field rule, at 16', () => {
        const el = element();
        const { root } = hostWithRoot(el);

        holdElementText(el);

        expect(rules(root)).toHaveLength(1);
        expect(rules(root)[0]).toContain(`font-size: ${FIELD_TEXT_SIZE}px !important`);
        expect(rules(root)[0]).toContain('input');
        expect(rules(root)[0]).toContain('[contenteditable]:not([contenteditable="false"])');
    });

    test('has it once, however many times the element is held', () => {
        const el = element();
        const { root } = hostWithRoot(el);

        holdElementText(el);
        holdElementText(el);

        expect(rules(root)).toHaveLength(1);
    });
});

describe('Spike: what has no rule', () => {
    test('a closed root is the host\'s: nothing is put in it, and nothing throws', () => {
        const el = element();
        const { host } = hostWithRoot(el, 'closed');

        expect(() => holdElementText(el)).not.toThrow();
        expect(host.shadowRoot).toBeNull();
    });

    test('a root outside any element is not touched', () => {
        const el = element();
        const outside = document.createElement('div');
        document.body.appendChild(outside);
        const { root } = hostWithRoot(outside);

        holdElementText(el);

        expect(rules(root)).toHaveLength(0);
    });

    test('an element with no root has nothing to reach', () => {
        const el = element();
        el.innerHTML = '<input>';

        expect(() => holdElementText(el)).not.toThrow();
    });
});

describe('Jenny: roots that come later, or inside roots', () => {
    test('a root added after the element is held gets the rule', async () => {
        const el = element();
        holdElementText(el);

        const { root } = hostWithRoot(el);
        await tick();

        expect(rules(root)).toHaveLength(1);
    });

    test('a root inside a root has it too', async () => {
        const el = element();
        const outer = hostWithRoot(el);
        const inner = hostWithRoot(outer.root as unknown as Element);
        holdElementText(el);
        await tick();

        expect(rules(outer.root)).toHaveLength(1);
        expect(rules(inner.root)).toHaveLength(1);
    });

    test('a root added inside a root, after, gets it', async () => {
        const el = element();
        const outer = hostWithRoot(el);
        holdElementText(el);

        const inner = hostWithRoot(outer.root as unknown as Element);
        await tick();

        expect(rules(inner.root)).toHaveLength(1);
    });

    test('a size written important on a field in a root is taken off', async () => {
        const el = element();
        const { root } = hostWithRoot(el);
        holdElementText(el);

        const input = root.querySelector('input')!;
        input.style.setProperty('font-size', '11px', 'important');
        await tick();

        expect(input.style.fontSize).toBe('');
    });
});
