/**
 * The page's scale is the person's.
 *
 * "Be prepared for text-size changes ... Apps that don't respond to this setting can be difficult
 * or impossible to use for people who rely on this feature." (Apple Human Interface Guidelines)
 *
 * The package once held maximum-scale=1 on every viewport line so iOS Safari would not zoom onto a
 * small field, and in a Chromium phone that took pinch zoom away (browser/zoom.browser.ts measures
 * it). A field inside an element is at 16 whatever a host writes (text.ts), so the package leaves
 * the page's viewport line as the host wrote it. The real keyboard run (browser/keyboard) is what
 * shows Safari not zooming a field.
 *
 * Personas:
 * - Tim: Happy path — the host's viewport line, as written
 * - Spike: Edge cases — no viewport line, a host's own maximum-scale
 * - Jenny: Complex scenarios — the package taken after the host's line, and a line the host changes after
 */

import { describe, test, expect, beforeEach } from 'bun:test';
// The package as a host takes it, and nothing called.
import './index';

function lines(): string[] {
    return [...document.querySelectorAll<HTMLMetaElement>('meta[name="viewport"]')].map((m) => m.content);
}

function hostSays(content: string): HTMLMetaElement {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
    }
    meta.content = content;
    return meta;
}

beforeEach(() => {
    for (const meta of document.querySelectorAll('meta[name="viewport"]')) meta.remove();
});

describe('Tim: the host\'s viewport line, as written', () => {
    test('the package leaves it alone', async () => {
        hostSays('width=device-width, initial-scale=1');
        await Promise.resolve();

        expect(lines()).toEqual(['width=device-width, initial-scale=1']);
    });
});

describe('Spike: nothing said, or too much', () => {
    test('a page with no viewport line gets none from the package', async () => {
        await Promise.resolve();

        expect(lines()).toEqual([]);
    });

    test('a host\'s own maximum-scale is the host\'s', async () => {
        hostSays('width=device-width, maximum-scale=3');
        await Promise.resolve();

        expect(lines()).toEqual(['width=device-width, maximum-scale=3']);
    });
});

describe('Jenny: a line the host changes', () => {
    test('rewritten after the package is in, it stays as it was written', async () => {
        const meta = hostSays('width=device-width, initial-scale=1');
        meta.content = 'width=device-width, initial-scale=1, maximum-scale=1';
        // A mutation observer answers in a microtask, if there is one.
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(lines()).toEqual(['width=device-width, initial-scale=1, maximum-scale=1']);
    });
});
