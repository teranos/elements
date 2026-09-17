/**
 * Tests for the content watch.
 *
 * The behaviour under test is the one that reached a phone screen: a window
 * opened, its chrome committed, and its body never arrived — 44px of title
 * bar over 16px of padding, with nothing thrown and nothing logged. These are
 * the assertions that would have failed instead.
 *
 * Personas:
 * - Tim: Happy path — a body that draws is present, at mount or later
 * - Spike: Edge cases — a body that never draws is refused, and says so
 * - Jenny: Complex scenarios — the element's own word, re-arming, and the stash
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import type { Element } from '../element';
import {
    watchContent,
    disarmContentWatch,
    declareContent,
    showsSomething,
    isWatched,
} from './watch';
import { getContentState } from '../dataset';
import { stashContent } from './stash';

const DEADLINE = 20;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function fixture(id: string = 'tokens-element'): Element {
    return {
        id,
        title: 'Access Tokens',
        renderContent: () => document.createElement('div'),
    };
}

/** A window as render-content.ts leaves it: element, title bar, content area. */
function opened(body?: HTMLElement): { element: HTMLElement; contentArea: HTMLElement } {
    const element = document.createElement('div');
    element.dataset.elementId = 'tokens-element';

    const titleBar = document.createElement('div');
    titleBar.className = 'title-bar';
    titleBar.textContent = 'Access Tokens';
    element.appendChild(titleBar);

    const contentArea = document.createElement('div');
    contentArea.classList.add('content-area');
    if (body) contentArea.appendChild(body);
    element.appendChild(contentArea);

    document.body.appendChild(element);
    return { element, contentArea };
}

function text(content: string): HTMLElement {
    const div = document.createElement('div');
    div.textContent = content;
    return div;
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('Tim: a body that draws', () => {
    test('settles present at mount when the element rendered synchronously', () => {
        const { element, contentArea } = opened(text('Loading tokens…'));
        watchContent(element, contentArea, fixture(), 'Window', DEADLINE);

        expect(getContentState(element)).toBe('present');
        expect(isWatched(element)).toBe(false);
    });

    test('a placeholder counts — the question is whether the user sees anything', () => {
        expect(showsSomething(opened(text('Loading tokens…')).contentArea)).toBe(true);
        expect(showsSomething(opened(text('No access tokens.')).contentArea)).toBe(true);
    });

    test('settles present when the body draws later', async () => {
        const body = document.createElement('div');
        const { element, contentArea } = opened(body);
        watchContent(element, contentArea, fixture(), 'Window', DEADLINE);
        expect(getContentState(element)).toBe('pending');

        body.appendChild(text('ci-runner'));
        await sleep(5);

        expect(getContentState(element)).toBe('present');
        expect(isWatched(element)).toBe(false);
    });

    test('a body that drew before the deadline is never refused', async () => {
        const body = document.createElement('div');
        const { element, contentArea } = opened(body);
        watchContent(element, contentArea, fixture(), 'Window', DEADLINE);

        body.appendChild(text('ci-runner'));
        await sleep(DEADLINE * 3);

        expect(getContentState(element)).toBe('present');
        expect(contentArea.textContent).not.toContain('nothing was drawn');
    });
});

describe('Spike: a body that never draws', () => {
    test('is refused when the deadline passes', async () => {
        const { element, contentArea } = opened(document.createElement('div'));
        watchContent(element, contentArea, fixture(), 'Window', DEADLINE);
        expect(getContentState(element)).toBe('pending');

        await sleep(DEADLINE * 3);

        expect(getContentState(element)).toBe('refused');
        expect(isWatched(element)).toBe(false);
    });

    test('says so in the body, naming the element and how long it waited', async () => {
        const { element, contentArea } = opened();
        watchContent(element, contentArea, fixture(), 'Panel', DEADLINE);
        await sleep(DEADLINE * 3);

        const said = contentArea.textContent ?? '';
        expect(said).toContain('nothing was drawn, and nothing said why');
        expect(said).toContain('tokens-element');
        expect(said).toContain('Panel');
        expect(said).toContain(`${DEADLINE}ms`);
    });

    test('an empty content area shows nothing, whitespace included', () => {
        expect(showsSomething(opened().contentArea)).toBe(false);
        expect(showsSomething(opened(text('   \n  ')).contentArea)).toBe(false);
    });

    test('something that draws without words still counts', () => {
        const { contentArea } = opened();
        contentArea.appendChild(document.createElement('img'));
        expect(showsSomething(contentArea)).toBe(true);
    });

    test('disarming stops the deadline', async () => {
        const { element, contentArea } = opened();
        watchContent(element, contentArea, fixture(), 'Window', DEADLINE);
        disarmContentWatch(element);

        await sleep(DEADLINE * 3);

        expect(getContentState(element)).toBe('pending');
        expect(contentArea.textContent).not.toContain('nothing was drawn');
    });
});

describe('Jenny: the element\'s own word', () => {
    test('an element may declare empty from anywhere inside its body', async () => {
        const body = document.createElement('div');
        const { element, contentArea } = opened(body);
        watchContent(element, contentArea, fixture(), 'Window', DEADLINE);

        declareContent(body, 'empty');
        await sleep(DEADLINE * 3);

        expect(getContentState(element)).toBe('empty');
        expect(contentArea.textContent).not.toContain('nothing was drawn');
    });

    test('a declared state is not overridden by the deadline', async () => {
        const { element, contentArea } = opened();
        watchContent(element, contentArea, fixture(), 'Window', DEADLINE);

        declareContent(contentArea, 'refused');
        await sleep(DEADLINE * 3);

        expect(getContentState(element)).toBe('refused');
        // The element said why itself; the watch does not say it a second time.
        expect(contentArea.textContent).not.toContain('nothing was drawn');
    });

    test('a node outside any element declares nothing and throws nothing', () => {
        const orphan = document.createElement('div');
        expect(() => declareContent(orphan, 'present')).not.toThrow();
        expect(getContentState(orphan)).toBeNull();
    });

    test('one element, one watch — re-arming replaces the last', async () => {
        const { element, contentArea } = opened();
        watchContent(element, contentArea, fixture(), 'Window', DEADLINE);
        watchContent(element, contentArea, fixture(), 'Window', DEADLINE * 6);

        await sleep(DEADLINE * 3);
        // The first deadline is gone with the first watch; the second still runs.
        expect(getContentState(element)).toBe('pending');
        expect(isWatched(element)).toBe(true);

        disarmContentWatch(element);
    });

    test('stashing to the tray ends the watch — a stashed body did not fail', async () => {
        const { element, contentArea } = opened();
        watchContent(element, contentArea, fixture(), 'Window', DEADLINE);

        stashContent(element);
        await sleep(DEADLINE * 3);

        expect(isWatched(element)).toBe(false);
        expect(getContentState(element)).toBe('pending');
        expect(contentArea.textContent).not.toContain('nothing was drawn');
    });
});
