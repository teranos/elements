// Which kinds meld, and on which side, is the host's to say: configureElements({ meldability }).
// The package holds the mechanics: ports, one connection per side, meld options.
// Tim: a host's table decides. Spike: what no table says. Jenny: a host replaces its table.

import { describe, test, expect, beforeEach } from 'bun:test';
import { configureElements } from '../../config';
import * as pkg from '../../index';
import {
    areClassesCompatible,
    getCompatibleDirections,
    getInitiatorClasses,
    getTargetClasses,
    getCompatibleTargets,
    getElementClass,
    getMeldOptions,
    selectPreferredMeldOption,
    type Meldability,
} from './meldability';
import { getLeafElementIds, getRootElementIds, computeGridPositions } from '../edge-graph';

// A host's table: a chain to the right, outputs stacking below, one kind on both sides.
const HOST: Meldability = {
    source: [{ direction: 'right', targets: ['step', 'sink'] }],
    step: [
        { direction: 'right', targets: ['step', 'sink'] },
        { direction: 'bottom', targets: ['output'] },
    ],
    sink: [{ direction: 'bottom', targets: ['output'] }],
    output: [{ direction: 'bottom', targets: ['output'] }],
    stack: [
        { direction: 'right', targets: ['output', 'sink', 'stack'] },
        { direction: 'bottom', targets: ['sink', 'stack'] },
    ],
};

beforeEach(() => {
    configureElements({ meldability: HOST });
});

describe('Tim: the host\'s table decides what melds', () => {
    test('source → step melds on the right', () => {
        expect(areClassesCompatible('source', 'step')).toBe('right');
    });

    test('step → output melds at the bottom', () => {
        expect(areClassesCompatible('step', 'output')).toBe('bottom');
    });

    test('a kind with two ports toward the same target gets both, in table order', () => {
        expect(getCompatibleDirections('stack', 'sink')).toEqual(['right', 'bottom']);
        expect(areClassesCompatible('stack', 'sink')).toBe('right');
    });

    test('initiators are the table\'s keys, targets every kind a port names', () => {
        expect([...getInitiatorClasses()].sort()).toEqual(['output', 'sink', 'source', 'stack', 'step']);
        expect([...getTargetClasses()].sort()).toEqual(['output', 'sink', 'stack', 'step']);
    });

    test('compatible targets of a kind span all its ports', () => {
        expect(getCompatibleTargets('step').sort()).toEqual(['output', 'sink', 'step']);
    });

    test('an element\'s kind is the class the table names', () => {
        const el = document.createElement('div');
        el.className = 'canvas-element step extra-class';
        expect(getElementClass(el)).toBe('step');
    });
});

describe('Spike: what the table does not say, does not meld', () => {
    test('a pair the table does not connect is incompatible', () => {
        expect(areClassesCompatible('sink', 'sink')).toBe(null);
    });

    test('an unknown kind has no directions and no targets', () => {
        expect(areClassesCompatible('unknown', 'step')).toBe(null);
        expect(getCompatibleTargets('unknown')).toEqual([]);
    });

    // A class name's shape means nothing: only the table makes a class a kind.
    test('a canvas-*-element class the table does not name is no kind', () => {
        const el = document.createElement('div');
        el.className = 'canvas-py-element canvas-element';
        expect(getElementClass(el)).toBe(null);
        expect(areClassesCompatible('canvas-ax-element', 'canvas-py-element')).toBe(null);
    });

    // Nil is nil: no table melds nothing, and falls back to no one's table.
    test('an unconfigured package melds nothing', () => {
        const meldability = `${import.meta.dir}/meldability.ts`;
        const script = `import { getInitiatorClasses, getTargetClasses } from '${meldability}';`
            + 'console.log(JSON.stringify([getInitiatorClasses(), getTargetClasses()]));';
        const run = Bun.spawnSync([process.execPath, '-e', script]);
        expect(run.stderr.toString()).toBe('');
        expect(JSON.parse(run.stdout.toString())).toEqual([[], []]);
    });

    test('the package no longer exports a table of its own', () => {
        expect('MELDABILITY' in pkg).toBe(false);
    });
});

describe('Jenny: a host replaces its table', () => {
    test('a second table replaces the first, and the class lists follow it', () => {
        configureElements({ meldability: { a: [{ direction: 'right', targets: ['b'] }] } });
        expect(getInitiatorClasses()).toEqual(['a']);
        expect(getTargetClasses()).toEqual(['b']);
        expect(areClassesCompatible('source', 'step')).toBe(null);

        configureElements({ meldability: HOST });
        expect(areClassesCompatible('a', 'b')).toBe(null);
        expect(areClassesCompatible('source', 'step')).toBe('right');
    });

    test('configuring something else leaves the table as it was', () => {
        configureElements({ logSegment: 'TEST' });
        expect(areClassesCompatible('source', 'step')).toBe('right');
    });

    test('an empty table is a table: nothing melds', () => {
        configureElements({ meldability: {} });
        expect(getInitiatorClasses()).toEqual([]);
        expect(getTargetClasses()).toEqual([]);
        expect(areClassesCompatible('source', 'step')).toBe(null);
    });
});

/** A composition holding one element per spec. */
function compWith(...specs: Array<{ id: string; cls: string }>): HTMLElement {
    const comp = document.createElement('div');
    for (const s of specs) {
        const el = document.createElement('div');
        el.className = s.cls;
        el.setAttribute('data-element-id', s.id);
        comp.appendChild(el);
    }
    return comp;
}

describe('Port-aware meld mechanics', () => {
    describe('getLeafElementIds', () => {
        test('finds leaf in simple chain', () => {
            const edges = [
                { from: 'ax1', to: 'py1', direction: 'right' },
                { from: 'py1', to: 'prompt1', direction: 'right' }
            ];
            expect(getLeafElementIds(edges)).toEqual(['prompt1']);
        });

        test('finds multiple leaves in fan-out', () => {
            const edges = [
                { from: 'ax1', to: 'py1', direction: 'right' },
                { from: 'ax1', to: 'py2', direction: 'right' }
            ];
            const leaves = getLeafElementIds(edges);
            expect(leaves).toContain('py1');
            expect(leaves).toContain('py2');
            expect(leaves.length).toBe(2);
        });

        test('single edge: leaf is the to node', () => {
            const edges = [{ from: 'ax1', to: 'prompt1', direction: 'right' }];
            expect(getLeafElementIds(edges)).toEqual(['prompt1']);
        });
    });

    describe('getRootElementIds', () => {
        test('finds root in simple chain', () => {
            const edges = [
                { from: 'ax1', to: 'py1', direction: 'right' },
                { from: 'py1', to: 'prompt1', direction: 'right' }
            ];
            expect(getRootElementIds(edges)).toEqual(['ax1']);
        });

        test('finds multiple roots in fan-in', () => {
            const edges = [
                { from: 'py1', to: 'prompt1', direction: 'right' },
                { from: 'py2', to: 'prompt1', direction: 'right' }
            ];
            const roots = getRootElementIds(edges);
            expect(roots).toContain('py1');
            expect(roots).toContain('py2');
            expect(roots.length).toBe(2);
        });
    });

    describe('getMeldOptions', () => {
        test('sink can append to a source-step composition (step leaf, right port)', () => {
            const comp = compWith({ id: 'source1', cls: 'source' }, { id: 'step1', cls: 'step' });
            const edges = [{ from: 'source1', to: 'step1', direction: 'right' }];

            const appendOption = getMeldOptions('sink', comp, edges).find(o => o.incomingRole === 'to');
            expect(appendOption).toBeDefined();
            expect(appendOption!.elementId).toBe('step1');
            expect(appendOption!.direction).toBe('right');
        });

        test('source can prepend to a step-sink composition (step root, right port)', () => {
            const comp = compWith({ id: 'step1', cls: 'step' }, { id: 'sink1', cls: 'sink' });
            const edges = [{ from: 'step1', to: 'sink1', direction: 'right' }];

            const prependOption = getMeldOptions('source', comp, edges).find(o => o.incomingRole === 'from');
            expect(prependOption).toBeDefined();
            expect(prependOption!.elementId).toBe('step1');
            expect(prependOption!.direction).toBe('right');
        });

        test('output can attach below the step leaf (bottom port)', () => {
            const comp = compWith({ id: 'source1', cls: 'source' }, { id: 'step1', cls: 'step' });
            const edges = [{ from: 'source1', to: 'step1', direction: 'right' }];

            const bottomOption = getMeldOptions('output', comp, edges).find(o => o.direction === 'bottom');
            expect(bottomOption).toBeDefined();
            expect(bottomOption!.elementId).toBe('step1');
            expect(bottomOption!.incomingRole).toBe('to');
        });

        test('stack right-meld onto an output chain returns options for all outputs (#521)', () => {
            const comp = compWith(
                { id: 'output1', cls: 'output' },
                { id: 'output2', cls: 'output' },
                { id: 'output3', cls: 'output' },
            );
            const edges = [
                { from: 'output1', to: 'output2', direction: 'bottom' },
                { from: 'output2', to: 'output3', direction: 'bottom' },
            ];

            const options = getMeldOptions('stack', comp, edges);
            expect(options.filter(o => o.direction === 'right').length).toBe(3);
            expect(selectPreferredMeldOption(options, 'output3')!.elementId).toBe('output3');
            expect(selectPreferredMeldOption(options, 'nonexistent')).toBeDefined();
        });

        test('an incompatible kind returns no options', () => {
            const comp = compWith({ id: 'source1', cls: 'source' });
            const edges = [{ from: 'source1', to: 'step1', direction: 'right' }];
            expect(getMeldOptions('unknown', comp, edges)).toEqual([]);
        });
    });

    describe('computeGridPositions', () => {
        test('single right edge → row 1, cols 1-2', () => {
            const edges = [{ from: 'ax1', to: 'py1', direction: 'right' }];
            const positions = computeGridPositions(edges);
            expect(positions.get('ax1')).toEqual({ row: 1, col: 1 });
            expect(positions.get('py1')).toEqual({ row: 1, col: 2 });
        });

        test('single bottom edge → col 1, rows 1-2', () => {
            const edges = [{ from: 'py1', to: 'result1', direction: 'bottom' }];
            const positions = computeGridPositions(edges);
            expect(positions.get('py1')).toEqual({ row: 1, col: 1 });
            expect(positions.get('result1')).toEqual({ row: 2, col: 1 });
        });

        test('mixed right+bottom → ax{1,1} py{1,2} result{2,2}', () => {
            const edges = [
                { from: 'ax1', to: 'py1', direction: 'right' },
                { from: 'py1', to: 'result1', direction: 'bottom' }
            ];
            const positions = computeGridPositions(edges);
            expect(positions.get('ax1')).toEqual({ row: 1, col: 1 });
            expect(positions.get('py1')).toEqual({ row: 1, col: 2 });
            expect(positions.get('result1')).toEqual({ row: 2, col: 2 });
        });

        test('chain ax→py→prompt with py→result → 4 positions on 2D grid', () => {
            const edges = [
                { from: 'ax1', to: 'py1', direction: 'right' },
                { from: 'py1', to: 'prompt1', direction: 'right' },
                { from: 'py1', to: 'result1', direction: 'bottom' }
            ];
            const positions = computeGridPositions(edges);
            expect(positions.get('ax1')).toEqual({ row: 1, col: 1 });
            expect(positions.get('py1')).toEqual({ row: 1, col: 2 });
            expect(positions.get('prompt1')).toEqual({ row: 1, col: 3 });
            expect(positions.get('result1')).toEqual({ row: 2, col: 2 });
        });

        test('empty edges → empty map', () => {
            expect(computeGridPositions([]).size).toBe(0);
        });

        test('multiple bottom children from same parent → stacked rows', () => {
            const edges = [
                { from: 'py1', to: 'r1', direction: 'bottom' },
                { from: 'py1', to: 'r2', direction: 'bottom' }
            ];
            const positions = computeGridPositions(edges);
            expect(positions.get('py1')).toEqual({ row: 1, col: 1 });
            expect(positions.get('r1')).toEqual({ row: 2, col: 1 });
            expect(positions.get('r2')).toEqual({ row: 3, col: 1 });
        });

        test('multiple right children from same parent → adjacent columns', () => {
            const edges = [
                { from: 'ax1', to: 'py1', direction: 'right' },
                { from: 'ax1', to: 'py2', direction: 'right' }
            ];
            const positions = computeGridPositions(edges);
            expect(positions.get('ax1')).toEqual({ row: 1, col: 1 });
            expect(positions.get('py1')).toEqual({ row: 1, col: 2 });
            expect(positions.get('py2')).toEqual({ row: 1, col: 3 });
        });

        test('multiple roots → each gets its own column', () => {
            const edges = [
                { from: 'py1', to: 'prompt1', direction: 'right' },
                { from: 'py2', to: 'prompt1', direction: 'right' }
            ];
            const positions = computeGridPositions(edges);
            expect(positions.get('py1')).toEqual({ row: 1, col: 1 });
            expect(positions.get('py2')).toEqual({ row: 1, col: 2 });
            expect(positions.get('prompt1')).toEqual({ row: 1, col: 2 });
        });

        test('3+ docs stacking on prompt → stacked rows above', () => {
            const edges = [
                { from: 'doc1', to: 'prompt1', direction: 'bottom' },
                { from: 'doc2', to: 'doc1', direction: 'bottom' },
                { from: 'doc3', to: 'doc2', direction: 'bottom' }
            ];
            const positions = computeGridPositions(edges);
            expect(positions.size).toBe(4);
        });

        test('note + doc both melded on prompt → separate bottom edges', () => {
            const edges = [
                { from: 'doc1', to: 'prompt1', direction: 'bottom' },
                { from: 'note1', to: 'prompt1', direction: 'bottom' }
            ];
            const positions = computeGridPositions(edges);
            expect(positions.get('prompt1')).toBeDefined();
            expect(positions.get('doc1')).toBeDefined();
            expect(positions.get('note1')).toBeDefined();
        });

        test('lateral root right-melded onto mid-chain preserves vertical layout (#521)', () => {
            const edges = [
                { from: 'r1', to: 'r2', direction: 'bottom' },
                { from: 'r2', to: 'r3', direction: 'bottom' },
                { from: 'r3', to: 'r4', direction: 'bottom' },
                { from: 'doc1', to: 'r3', direction: 'right' }
            ];
            const positions = computeGridPositions(edges);

            const r1 = positions.get('r1')!;
            const r2 = positions.get('r2')!;
            const r3 = positions.get('r3')!;
            const r4 = positions.get('r4')!;
            const doc = positions.get('doc1')!;

            expect(r1.col).toBe(r2.col);
            expect(r2.col).toBe(r3.col);
            expect(r3.col).toBe(r4.col);
            expect(r1.row).toBeLessThan(r2.row);
            expect(r2.row).toBeLessThan(r3.row);
            expect(r3.row).toBeLessThan(r4.row);

            expect(doc.row).toBe(r3.row);
            expect(doc.col).toBeLessThan(r3.col);
        });

        test('top direction edge → target above parent, normalized', () => {
            const edges = [
                { from: 'note1', to: 'prompt1', direction: 'top' }
            ];
            const positions = computeGridPositions(edges);
            expect(positions.get('prompt1')).toEqual({ row: 1, col: 1 });
            expect(positions.get('note1')).toEqual({ row: 2, col: 1 });
        });
    });
});
