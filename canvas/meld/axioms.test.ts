/**
 * Meld Axiom tests
 *
 * Axiom: each side of an element accepts at most one connection.
 * An element with an occupied right-outgoing port cannot emit another
 * right edge; an element whose left (right-incoming) is occupied cannot
 * receive another right-incoming edge. Same for bottom/top.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { configureElements } from '../../config';
import { getMeldOptions, isPortFree } from './meldability';

beforeEach(() => {
    configureElements({
        meldability: {
            source: [{ direction: 'right', targets: ['step', 'sink'] }],
            step: [
                { direction: 'right', targets: ['step', 'sink'] },
                { direction: 'bottom', targets: ['output'] },
            ],
            sink: [{ direction: 'bottom', targets: ['output'] }],
            output: [{ direction: 'bottom', targets: ['output'] }],
        },
    });
});

/** Helper: build a composition DOM with children matching the edge IDs */
function compWith(...specs: Array<{ id: string; cls: string }>): HTMLElement {
    const comp = document.createElement('div');
    comp.className = 'melded-composition';
    for (const g of specs) {
        const el = document.createElement('div');
        el.className = g.cls;
        el.setAttribute('data-element-id', g.id);
        comp.appendChild(el);
    }
    return comp;
}

describe('Spike: one element per side axiom', () => {

    test('step with right-outgoing occupied (step→sink) cannot accept another right-append', () => {
        const comp = compWith(
            { id: 'step1', cls: 'step' },
            { id: 'sink1', cls: 'sink' },
        );
        const edges = [{ from: 'step1', to: 'sink1', direction: 'right' }];

        const options = getMeldOptions('sink', comp, edges);

        const stepAppend = options.find(o => o.elementId === 'step1' && o.direction === 'right');
        expect(stepAppend).toBeUndefined();
    });

    test('sink with left side occupied (step→sink) cannot receive second left meld', () => {
        const comp = compWith(
            { id: 'step1', cls: 'step' },
            { id: 'sink1', cls: 'sink' },
        );
        const edges = [{ from: 'step1', to: 'sink1', direction: 'right' }];

        const options = getMeldOptions('source', comp, edges);

        const sinkPrepend = options.find(o => o.elementId === 'sink1');
        expect(sinkPrepend).toBeUndefined();

        const stepPrepend = options.find(o => o.elementId === 'step1' && o.incomingRole === 'from');
        expect(stepPrepend).toBeDefined();
        expect(stepPrepend!.direction).toBe('right');
    });

    test('step with bottom occupied (step→output) rejects second bottom attachment', () => {
        const comp = compWith(
            { id: 'step1', cls: 'step' },
            { id: 'output1', cls: 'output' },
        );
        const edges = [{ from: 'step1', to: 'output1', direction: 'bottom' }];

        const options = getMeldOptions('output', comp, edges);

        const stepBottom = options.find(o => o.elementId === 'step1' && o.direction === 'bottom');
        expect(stepBottom).toBeUndefined();
    });

    test('step with right occupied still allows bottom meld (different side)', () => {
        const comp = compWith(
            { id: 'step1', cls: 'step' },
            { id: 'sink1', cls: 'sink' },
        );
        const edges = [{ from: 'step1', to: 'sink1', direction: 'right' }];

        const options = getMeldOptions('output', comp, edges);

        const stepBottom = options.find(o => o.elementId === 'step1' && o.direction === 'bottom');
        expect(stepBottom).toBeDefined();
        expect(stepBottom!.incomingRole).toBe('to');
    });
});

describe('Jenny: saturated chain', () => {

    test('[source → step → sink] — right axis fully saturated, bottom axis open', () => {
        const comp = compWith(
            { id: 'source1', cls: 'source' },
            { id: 'step1', cls: 'step' },
            { id: 'sink1', cls: 'sink' },
        );
        const edges = [
            { from: 'source1', to: 'step1', direction: 'right' },
            { from: 'step1', to: 'sink1', direction: 'right' },
        ];

        expect(isPortFree('source1', 'right', 'outgoing', edges)).toBe(false);
        expect(isPortFree('step1', 'right', 'incoming', edges)).toBe(false);
        expect(isPortFree('step1', 'right', 'outgoing', edges)).toBe(false);
        expect(isPortFree('sink1', 'right', 'incoming', edges)).toBe(false);

        expect(isPortFree('step1', 'bottom', 'outgoing', edges)).toBe(true);
        expect(isPortFree('sink1', 'bottom', 'outgoing', edges)).toBe(true);

        expect(getMeldOptions('step', comp, edges)).toEqual([]);
        expect(getMeldOptions('source', comp, edges)).toEqual([]);

        const outputOptions = getMeldOptions('output', comp, edges);
        expect(outputOptions.length).toBe(2);
        expect(outputOptions.find(o => o.elementId === 'step1' && o.direction === 'bottom')).toBeDefined();
        expect(outputOptions.find(o => o.elementId === 'sink1' && o.direction === 'bottom')).toBeDefined();
    });
});
