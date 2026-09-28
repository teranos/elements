/**
 * The body is what scrolls.
 *
 * A window is a column in a box that clips (window/settle.ts).
 */

// Personas:
// - Tim: a rendered body scrolls
// - Spike: any body a window holds scrolls the same way

import { describe, test, expect, beforeEach } from 'bun:test';
import { holdBody } from './body';
import { renderContent } from './render';

beforeEach(() => {
    document.body.innerHTML = '';
});

function scrolls(body: HTMLElement): void {
    expect(body.style.flex).toBe('1 1 auto');
    // A flex item does not shrink below its content without this.
    expect(body.style.minHeight).toBe('0px');
    expect(body.style.overflow).toBe('auto');
}

describe('Tim: a rendered body scrolls', () => {
    test('renderContent hands back a body that scrolls', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const { contentElement } = renderContent(el, {
            id: 'i-element',
            title: 'i',
            renderContent: () => document.createElement('div'),
        }, 'Window');

        scrolls(contentElement!);
    });
});

describe('Spike: any body a window holds', () => {
    test('holdBody makes a body scroll', () => {
        const body = document.createElement('div');
        holdBody(body);

        scrolls(body);
    });
});
