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
 * - Jenny: Complex scenarios — a root added later, or attached to a host already in the element (found when a
 *   finger or a focus comes from inside it); a root inside a root; a root's contents replaced; the element
 *   released (the root is the host's again, unless an element around it still holds it); a style attribute
 *   written in one: a size comes off, a layout property stays, the root having no fit rule to take its place
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { holdElementText, releaseElementText, FIELD_TEXT_SIZE } from './text';

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
        expect(rules(root)[0]).toContain(`font-size: max(${FIELD_TEXT_SIZE / 16}rem, ${FIELD_TEXT_SIZE}px) !important`);
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

    test('a root attached to a host already in the element is found when a finger lands in it', async () => {
        const el = element();
        holdElementText(el);
        const host = document.createElement('div');
        el.appendChild(host);
        await tick();
        const root = host.attachShadow({ mode: 'open' });
        root.innerHTML = '<input type="text">';
        expect(rules(root)).toHaveLength(0);

        root.querySelector('input')!.dispatchEvent(new (window as any).Event('pointerdown', { bubbles: true, composed: true }));

        expect(rules(root)).toHaveLength(1);
    });

    test('a root attached to a host already in the element is found when a field takes focus', async () => {
        const el = element();
        holdElementText(el);
        const host = document.createElement('div');
        el.appendChild(host);
        await tick();
        const root = host.attachShadow({ mode: 'open' });
        root.innerHTML = '<input type="text">';

        root.querySelector('input')!.dispatchEvent(new (window as any).Event('focusin', { bubbles: true, composed: true }));

        expect(rules(root)).toHaveLength(1);
    });

    test('a root whose contents are replaced has the rule again', async () => {
        const el = element();
        const { root } = hostWithRoot(el);
        holdElementText(el);
        expect(rules(root)).toHaveLength(1);

        root.innerHTML = '<input type="text">';
        await tick();

        expect(rules(root)).toHaveLength(1);
    });

    test('a layout property written important in a root stays: the root has no fit rule to take its place', async () => {
        const el = element();
        const { root } = hostWithRoot(el);
        const input = root.querySelector('input')!;
        input.style.setProperty('max-width', '5px', 'important');
        input.style.setProperty('font-size', '11px', 'important');

        holdElementText(el);

        expect(input.style.fontSize).toBe('');
        expect(input.style.getPropertyValue('max-width')).toBe('5px');
    });
});

describe('Jenny: an element released', () => {
    test('the root is the host\'s again: the rule is gone from it', () => {
        const el = element();
        const { root } = hostWithRoot(el);
        holdElementText(el);

        releaseElementText(el);

        expect(rules(root)).toHaveLength(0);
    });

    test('and the element held again has it again', () => {
        const el = element();
        const { root } = hostWithRoot(el);
        holdElementText(el);
        releaseElementText(el);

        holdElementText(el);

        expect(rules(root)).toHaveLength(1);
    });

    test('an element around it still holds it: the rule stays until that one is released', () => {
        const outer = element();
        const inner = document.createElement('div');
        inner.dataset.elementId = 'inner';
        outer.appendChild(inner);
        const { root } = hostWithRoot(inner);
        holdElementText(outer);
        holdElementText(inner);

        releaseElementText(inner);
        expect(rules(root)).toHaveLength(1);

        releaseElementText(outer);
        expect(rules(root)).toHaveLength(0);
    });
});

describe('Jenny: a host that moves', () => {
    test('out of the element: the root is the host\'s again', async () => {
        const el = element();
        const { host, root } = hostWithRoot(el);
        holdElementText(el);
        expect(rules(root)).toHaveLength(1);

        document.body.appendChild(host);
        await tick();

        expect(rules(root)).toHaveLength(0);
    });

    test('into another held element: that one holds it, and the first letting go does not take it', async () => {
        const first = element();
        const second = document.createElement('div');
        second.dataset.elementId = 'second';
        document.body.appendChild(second);
        const { host, root } = hostWithRoot(first);
        holdElementText(first);
        holdElementText(second);

        second.appendChild(host);
        await tick();
        expect(rules(root)).toHaveLength(1);

        releaseElementText(first);
        expect(rules(root)).toHaveLength(1);

        releaseElementText(second);
        expect(rules(root)).toHaveLength(0);
    });

    test('out, and later back in: dressed again', async () => {
        const el = element();
        const { host, root } = hostWithRoot(el);
        holdElementText(el);
        document.body.appendChild(host);
        await tick();

        el.appendChild(host);
        await tick();

        expect(rules(root)).toHaveLength(1);
    });
});
