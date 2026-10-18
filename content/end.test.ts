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
