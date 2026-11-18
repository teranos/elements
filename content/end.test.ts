// "claude element should not start at top when opening requiring user to scroll down every single time"
// An element that opens at its end says so, so a host's gate can hold every one of them to it.

import { describe, test, expect } from 'bun:test';
import { openAtEnd, stopFollowing } from './end';

describe('an element that opens at its end', () => {
    test('says so while it follows its end', () => {
        const element = document.createElement('div');
        openAtEnd(element);
        expect(element.dataset.opensAt).toBe('end');
    });

    test('says nothing once it stops following', () => {
        const element = document.createElement('div');
        openAtEnd(element);
        stopFollowing(element);
        expect(element.dataset.opensAt).toBeUndefined();
    });
});

// 「[Opus 5.5] Seen in xenon: what waits, a pill in its input field, holds a list scrolled in itself. The chat opened at the end of」
// 「[Opus 5.5] that list, not at the end of what was said: the pill is an element of its own, and its scroller is its own.」
describe('Jenny: an element holding another', () => {
    test('opens at the end of its own scroller, not of one in an element it holds', () => {
        const element = document.createElement('div');
        element.dataset.elementId = 'xenon';
        const body = document.createElement('div');
        body.dataset.scroller = 'body';
        const pill = document.createElement('div');
        pill.dataset.elementId = 'xenon-outbox';
        const list = document.createElement('div');
        list.dataset.scroller = 'declared';
        pill.appendChild(list);
        body.appendChild(pill);
        element.appendChild(body);
        document.body.appendChild(element);
        let asked: string | null = null;
        for (const node of [body, list]) {
            Object.defineProperty(node, 'scrollHeight', { value: 500 });
            Object.defineProperty(node, 'scrollTop', { set: () => { asked = node === body ? 'body' : 'list'; }, get: () => 0 });
        }
        openAtEnd(element);
        expect(asked).toBe('body');
        stopFollowing(element);
        element.remove();
    });
});
