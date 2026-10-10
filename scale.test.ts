/**
 * The page's scale, and a field taking the keyboard.
 *
 * "You tap a box to type, and the only thing that should happen is the keyboard
 * coming up. Nothing on the screen should move, zoom or refocus."
 *
 * The package holds it, and the host has no say: whatever the page's viewport
 * line says, it says maximum-scale=1 as well. The real keyboard run
 * (browser/keyboard) is what shows Safari not zooming; these show the line.
 *
 * Personas:
 * - Tim: Happy path — the host's viewport line, held
 * - Spike: Edge cases — no viewport line, a host's own maximum-scale, a line with no content
 * - Jenny: Complex scenarios — a host rewriting or replacing its line after the package holds it
 */

import { describe, test, expect } from 'bun:test';
import { holdScale } from './scale';
// The package as a host takes it, and nothing called.
import './index';

function lines(): string[] {
    return [...document.querySelectorAll<HTMLMetaElement>('meta[name="viewport"]')].map((m) => m.content);
}

// The page's one viewport line, saying what the host wrote. Once the package
// holds the scale it keeps a line on the page, so the host's words go in it.
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

function noLine(): void {
    for (const meta of document.querySelectorAll('meta[name="viewport"]')) meta.remove();
}

// The observer answers after the change, as a microtask.
const settled = () => new Promise((r) => setTimeout(r, 50));

describe('Tim: the host\'s viewport line, held', () => {
    test('the package holds it without the host calling anything', () => {
        expect(lines()).toEqual(['maximum-scale=1']);
    });

    test('a host\'s line keeps what it says and holds the scale', () => {
        hostSays('width=device-width, initial-scale=1, viewport-fit=cover');
        holdScale();
        expect(lines()).toEqual(['width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1']);
    });

    test('holding twice says it once', () => {
        hostSays('width=device-width, initial-scale=1');
        holdScale();
        holdScale();
        expect(lines()).toEqual(['width=device-width, initial-scale=1, maximum-scale=1']);
    });
});

describe('Spike: a page that says little, or the wrong thing', () => {
    test('a page with no viewport line is given one that holds the scale, and nothing else', () => {
        noLine();
        holdScale();
        expect(lines()).toEqual(['maximum-scale=1']);
    });

    test('a host\'s own maximum-scale is not the host\'s to say', () => {
        hostSays('width=device-width, maximum-scale=5, initial-scale=1');
        holdScale();
        expect(lines()).toEqual(['width=device-width, initial-scale=1, maximum-scale=1']);
    });

    test('a line with no content holds the scale', () => {
        noLine();
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
        holdScale();
        expect(lines()).toEqual(['maximum-scale=1']);
    });
});

describe('Jenny: a host that changes its line after the package held it', () => {
    test('a rewritten line is held again', async () => {
        const meta = hostSays('width=device-width');
        holdScale();
        meta.content = 'width=device-width, maximum-scale=3';
        await settled();
        expect(lines()).toEqual(['width=device-width, maximum-scale=1']);
    });

    test('a line put in place of the old one is held too', async () => {
        hostSays('width=device-width');
        holdScale();
        noLine();
        hostSays('width=device-width, initial-scale=1');
        await settled();
        expect(lines()).toEqual(['width=device-width, initial-scale=1, maximum-scale=1']);
    });
});
