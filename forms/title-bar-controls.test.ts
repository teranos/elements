/**
 * The presses in an element's title bar.
 *
 * "Those buttons are supposed to be square and equally sized and margin and alignment within the header". "You can
 * see how it's broken in what should have been the exemplar". Each was as wide as its glyph: the package's fit wrote
 * every button in an element `fit-content`, the title bar's too.
 *
 * Personas:
 * - Tim: Happy path — the package's rule makes every press in a title bar the same square
 * - Spike: Edge cases — a host's own presses (canvasPlaced actions) stand together, as the window's controls do
 * - Jenny: Complex scenarios — the host's presses and the window's controls: one row, evenly apart, at the bar's end
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { fitRule } from '../fit';
import { addWindowControls, TITLE_PRESS, TITLE_INSET } from './title-bar-controls';
import { canvasPlaced } from '../canvas/placed';

afterEach(() => { document.body.innerHTML = ''; });

const lineOf = (rule: string, has: string) => rule.split('\n').find((l) => l.includes(has)) ?? '';

describe('Tim: a press in a title bar', () => {
    test('is the same square, whatever it holds', () => {
        const line = lineOf(fitRule('[data-element-id]'), '.title-bar button');
        expect(line).toContain(`width: ${TITLE_PRESS}px !important`);
        expect(line).toContain(`height: ${TITLE_PRESS}px !important`);
        expect(line).toContain('padding: 0 !important');
    });

    test('is not written as wide as what it holds', () => {
        const fit = lineOf(fitRule('[data-element-id]'), 'width: fit-content');
        expect(fit).toContain(':not(.title-bar *)');
    });
});

describe('Spike: a host\'s own presses', () => {
    test('stand together in the bar, as the window\'s controls do', () => {
        const up = document.createElement('button');
        up.textContent = '⬆';
        const { element } = canvasPlaced({
            item: { id: 'u', title: 'Uranium', renderContent: () => document.createElement('div') },
            defaults: { x: 0, y: 0, width: 200, height: 100 },
            titleBar: { label: 'Uranium', actions: [up] },
            logLabel: 'Test',
        });
        expect(up.parentElement!.classList.contains('title-bar-presses')).toBe(true);
        expect(up.parentElement!.parentElement!.classList.contains('title-bar')).toBe(true);
        element.remove();
    });
});

describe('Jenny: the host\'s presses and the window\'s controls', () => {
    test('one row at the bar\'s end, TITLE_INSET apart and TITLE_INSET in from its end', () => {
        const rule = fitRule('[data-element-id]');
        expect(lineOf(rule, '.title-bar:has(button)')).toContain(`padding-right: ${TITLE_INSET}px !important`);
        const groups = lineOf(rule, '.title-bar .title-bar-presses');
        expect(groups).toContain('.window-controls');
        expect(groups).toContain(`gap: ${TITLE_INSET}px !important`);
        expect(groups).toContain('margin-left: auto !important');
        expect(lineOf(rule, '.title-bar-presses + .window-controls')).toContain(`margin-left: ${TITLE_INSET}px !important`);
        const bar = document.createElement('div');
        bar.className = 'title-bar';
        addWindowControls(bar, { onMinimize: () => {}, onClose: () => {} });
        expect(bar.querySelectorAll('.window-controls button').length).toBe(2);
    });
});
