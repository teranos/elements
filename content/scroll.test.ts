/**
 * One scroller per element, and it is the package's.
 *
 * Apple Human Interface Guidelines, Scroll views: "Avoid putting a scroll view
 * inside another scroll view with the same orientation", and "It's alright to
 * place a horizontal scroll view inside a vertical scroll view". So an element
 * scrolls vertically in one place: the body the package gave it, or the scroller
 * its host declared. Any other vertical scroller is named where it is, and the
 * host is told what to do instead.
 *
 * Personas:
 * - Tim: Happy path — a body is the element's scroller; a host declares its own
 * - Spike: Edge cases — what is not a second scroller, what is, and what the
 *   host already said
 * - Jenny: Complex scenarios — content that arrives later, changes its mind,
 *   or comes from the canvas; the test that fails a host
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { configureElements } from '../config';
import { renderContent } from './render';
import { holdBody } from './body';
import { watchScroll, declareScroller, expectScroll } from './scroll';

let warnings: { message: string; metadata?: Record<string, unknown> }[] = [];

configureElements({
    logger: {
        debug() {},
        info() {},
        warn(_segment, message, metadata) { warnings.push({ message, metadata }); },
        error() {},
    },
});

beforeEach(() => {
    document.head.querySelectorAll('style').forEach((s) => s.remove());
    document.body.innerHTML = '';
    warnings = [];
});

/** Let the watch see what changed since. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

function stylesheet(css: string): void {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
}

/** A window opened the way a tray dot opens one. */
function opened(content: HTMLElement, id = 'claude', title = 'Claude'): { element: HTMLElement; body: HTMLElement } {
    const element = document.createElement('div');
    element.dataset.elementId = id;
    document.body.appendChild(element);
    const { contentElement } = renderContent(element, { id, title, renderContent: () => content }, 'Window');
    return { element, body: contentElement! };
}

function div(className = '', text = ''): HTMLElement {
    const el = document.createElement('div');
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
}

const scrollsVertically = (el: HTMLElement) => el.style.overflowY === 'auto';

describe('Tim: a body is the element\'s scroller', () => {
    test('a window\'s body is its scroller, and keeps its scroll to itself', () => {
        const { body } = opened(div('', 'a long log'));

        expect(body.dataset.scroller).toBe('body');
        expect(scrollsVertically(body)).toBe(true);
        // At its end, a scroll stays here: it does not move the page behind it.
        expect(body.style.overscrollBehavior).toBe('contain');
    });

    test('a body with nothing in it to focus can be reached by the keyboard, and is named for its element', () => {
        const { body } = opened(div('', 'a long log'));

        expect(body.tabIndex).toBe(0);
        expect(body.getAttribute('role')).toBe('region');
        expect(body.getAttribute('aria-label')).toBe('Claude');
    });

    test('a body holding a field is reached through the field, not as a stop of its own', () => {
        const form = div();
        form.appendChild(document.createElement('input'));
        const { body } = opened(form, 'selenium', 'Selenium');

        expect(body.hasAttribute('tabindex')).toBe(false);
        expect(body.hasAttribute('role')).toBe(false);
    });

    test('a host that declares its own scroller has it: the body stops scrolling vertically', () => {
        const column = div('tr-col');
        column.style.overflowY = 'auto';
        declareScroller(column);
        const { body } = opened(column);

        expect(column.dataset.scroller).toBe('declared');
        expect(column.style.overscrollBehavior).toBe('contain');
        expect(body.style.overflowY).toBe('hidden');
        expect(warnings).toEqual([]);
    });
});

describe('Tim: the body makes room for the scroller it gave way to', () => {
    test('a declared scroller fills the body, bounded by it, so what it holds can be reached', () => {
        const column = div('tr-col', 'turns');
        column.style.overflowY = 'auto';
        declareScroller(column);
        const { body } = opened(column);

        expect(body.style.display).toBe('flex');
        expect(body.style.flexDirection).toBe('column');
        expect(column.style.flex).toBe('1 1 auto');
        expect(column.style.minHeight).toBe('0px');
    });

    test('a scroller deeper in is bounded through the body\'s child that holds it', () => {
        const transcript = div('tr');
        const column = div('tr-col', 'turns');
        column.style.overflowY = 'auto';
        declareScroller(column);
        transcript.appendChild(column);
        opened(transcript);

        expect(transcript.style.flex).toBe('1 1 auto');
        expect(transcript.style.minHeight).toBe('0px');
    });
});

describe('Spike: what is a second scroller, and what is not', () => {
    test('a body whose content failed to render is still the element\'s body', () => {
        const element = document.createElement('div');
        element.dataset.elementId = 'broken';
        document.body.appendChild(element);
        const { contentElement } = renderContent(element, {
            id: 'broken',
            title: 'Broken',
            renderContent: () => { throw new Error('no data'); },
        }, 'Window');

        expect(contentElement!.dataset.scroller).toBe('body');
    });

    test('a code block that scrolls sideways in a body that scrolls down is not a second scroller', () => {
        const pre = document.createElement('pre');
        pre.style.overflowX = 'auto';
        opened(pre);

        expect(pre.dataset.scroller).toBeUndefined();
        expect(warnings).toEqual([]);
    });

    test('a field\'s own scrolling is the platform\'s, not a second scroller', () => {
        const box = div();
        const area = document.createElement('textarea');
        area.style.overflowY = 'auto';
        box.appendChild(area);
        opened(box);

        expect(area.dataset.scroller).toBeUndefined();
        expect(warnings).toEqual([]);
    });

    test('a vertical scroller nobody declared is named where it is, and the host is told what to do', () => {
        stylesheet('.tr-col { overflow-y: auto; }');
        const column = div('tr-col', 'turns');
        opened(column);

        expect(column.dataset.scroller).toBe('undeclared');
        expect(warnings.length).toBe(1);
        expect(warnings[0].message).toContain('claude');
        expect(warnings[0].message).toContain('div.tr-col');
        expect(warnings[0].message).toContain('declareScroller');
    });

    test('a scroller declared by its overflow shorthand is a scroller too', () => {
        const column = div('ground', 'soil');
        column.style.overflow = 'auto';
        opened(column);

        expect(column.dataset.scroller).toBe('undeclared');
    });

    test('a vertical scroller inside a declared one is a second scroller', () => {
        const outer = div('cm-scroller');
        outer.style.overflowY = 'auto';
        declareScroller(outer);
        const inner = div('cm-gutter');
        inner.style.overflowY = 'scroll';
        outer.appendChild(inner);
        opened(outer);

        expect(inner.dataset.scroller).toBe('undeclared');
    });

    test('a host\'s own tabindex on a scroller is left as the host set it', () => {
        const column = div('', 'turns');
        column.style.overflowY = 'auto';
        column.tabIndex = -1;
        declareScroller(column);
        opened(column);

        expect(column.tabIndex).toBe(-1);
    });

    test('an element without a body: whatever scrolls in it is declared, or named', () => {
        const element = div('canvas-element');
        element.dataset.elementId = 'triplet';
        const list = div('triplet-list', 'rows');
        list.style.overflow = 'auto';
        element.appendChild(list);
        document.body.appendChild(element);

        watchScroll(element, 'Triplet');

        expect(list.dataset.scroller).toBe('undeclared');
        expect(warnings[0].message).toContain('triplet');
    });
});

describe('Jenny: content that arrives later, changes its mind, or comes from the canvas', () => {
    test('a scroller that arrives after the window opened is named when it arrives', async () => {
        const { body } = opened(div('', 'Loading…'));
        const late = div('', 'tokens');
        late.style.overflowY = 'auto';
        body.appendChild(late);
        await settled();

        expect(late.dataset.scroller).toBe('undeclared');
        expect(warnings.length).toBe(1);
    });

    test('a host is told once about one scroller, however often its content changes', async () => {
        stylesheet('.tr-col { overflow-y: auto; }');
        const column = div('tr-col', 'turn 1');
        opened(column);
        for (let turn = 2; turn <= 5; turn++) {
            column.appendChild(div('', `turn ${turn}`));
            await settled();
        }

        expect(warnings.length).toBe(1);
    });

    test('a scroller that stops scrolling is no longer named', async () => {
        const column = div('', 'turns');
        column.style.overflowY = 'auto';
        opened(column);
        column.style.overflowY = 'visible';
        await settled();

        expect(column.dataset.scroller).toBeUndefined();
    });

    test('a declared scroller taken away gives the body its scrolling back', async () => {
        const column = div('', 'turns');
        column.style.overflowY = 'auto';
        declareScroller(column);
        const { body } = opened(column);
        column.remove();
        body.appendChild(div('', 'plain text'));
        await settled();

        expect(scrollsVertically(body)).toBe(true);
    });

    test('a declared scroller taken away: what was written to make room for it is taken back', async () => {
        const transcript = div('tr');
        transcript.style.flex = '0 0 auto';
        const column = div('tr-col', 'turns');
        column.style.overflowY = 'auto';
        declareScroller(column);
        transcript.appendChild(column);
        const { body } = opened(transcript);
        column.remove();
        await settled();

        expect(body.style.display).toBe('');
        expect(transcript.style.flex).toBe('0 0 auto');
        expect(transcript.style.minHeight).toBe('');
    });

    test('back on the canvas, out of its body, a declared scroller is the host\'s as it was', async () => {
        // canvas/window.ts unwraps the body's children into the element and drops the body.
        const column = div('note-editor', 'text');
        column.style.overflow = 'auto';
        declareScroller(column);
        const { element, body } = opened(column, 'note', 'Note');
        element.appendChild(column);
        body.remove();
        await settled();

        expect(column.style.flex).toBe('');
        expect(column.style.minHeight).toBe('');
    });

    test('a body that gains a button stops being a tab stop of its own', async () => {
        const { body } = opened(div('', 'Loading…'));
        body.appendChild(document.createElement('button'));
        await settled();

        expect(body.hasAttribute('tabindex')).toBe(false);
        expect(body.hasAttribute('role')).toBe(false);
        expect(body.hasAttribute('aria-label')).toBe(false);
    });

    test('a scroller declared on the canvas is still the scroller once the element is a window', () => {
        // canvas/window.ts wraps what the element already has in a body.
        const element = div('canvas-element');
        element.dataset.elementId = 'note';
        const editor = div('note-editor', 'text');
        editor.style.overflow = 'auto';
        declareScroller(editor);
        element.appendChild(editor);
        document.body.appendChild(element);
        watchScroll(element, 'Note');

        const body = div('canvas-window-content content-area');
        body.appendChild(editor);
        element.appendChild(body);
        holdBody(body);
        watchScroll(element, 'Note');

        expect(body.style.overflowY).toBe('hidden');
        expect(warnings).toEqual([]);
    });

    test('an element built off the page is looked at once it is placed', async () => {
        // canvasPlaced() runs before the host puts the element on its canvas.
        stylesheet('.sigma-list { overflow-y: auto; }');
        const element = div('canvas-element');
        element.dataset.elementId = 'sigma';
        const list = div('sigma-list', 'rows');
        element.appendChild(list);
        watchScroll(element, 'Sigma');
        document.body.appendChild(element);
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        await settled();

        expect(list.dataset.scroller).toBe('undeclared');
    });

    test('expectScroll fails a host\'s test on a scroller it did not declare, naming it', () => {
        stylesheet('.ground { overflow-y: auto; }');
        const { element } = opened(div('ground', 'soil'), 'ground', 'Ground');

        expect(() => expectScroll(element)).toThrow('div.ground');
    });

    test('expectScroll passes an element that scrolls in one place', () => {
        const column = div('', 'turns');
        column.style.overflowY = 'auto';
        declareScroller(column);
        const { element } = opened(column);

        expect(() => expectScroll(element)).not.toThrow();
    });
});
