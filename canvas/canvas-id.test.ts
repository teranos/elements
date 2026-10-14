// An element is on a canvas when an ancestor carries data-canvas-id; that attribute is the canvas.
// No host class name finds it, and no host's canvas id stands in when there is none.
// Tim: each interaction reads the canvas it stands on. Spike: an element on no canvas.

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { configureElements, type CanvasHost, type Logger } from '../config';
import { getCanvasOrigin, setForm } from '../dataset';
import { performMeld } from './meld/composition';
import { wireExpandToWindow } from './expand-to-window';
import { placeWindowOnCanvas } from './window';
import { makeDraggable } from './drag';
import { playAnimations } from '../test-animations';

let asked: string[];
let warned: string[];

function recordingHost(): CanvasHost {
    return {
        saveCanvasElement() {},
        getCanvasElements: () => [],
        getTransform: (canvasId) => { asked.push(canvasId); return { panX: 0, panY: 0, scale: 1 }; },
        getSelectedElementIds: (canvasId) => { asked.push(canvasId); return []; },
        isElementSelected: () => false,
        saveComposition() {},
        removeComposition() {},
        findCompositionByElement: () => null,
        flushSync() {},
    };
}

const capturing: Logger = {
    debug() {},
    info() {},
    warn(_segment, message) { warned.push(message); },
    error(_segment, message) { warned.push(message); },
};

const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };

/** A canvas as a host builds one: data-canvas-id and a content layer, no class. */
function canvasWithLayer(id: string): { canvas: HTMLElement; layer: HTMLElement } {
    const canvas = document.createElement('div');
    canvas.dataset.canvasId = id;
    const layer = document.createElement('div');
    layer.className = 'canvas-content-layer';
    canvas.appendChild(layer);
    document.body.appendChild(canvas);
    return { canvas, layer };
}

function placed(id: string): HTMLElement {
    const el = document.createElement('div');
    el.setAttribute('data-element-id', id);
    el.style.left = '0px';
    el.style.top = '0px';
    return el;
}

beforeEach(() => {
    document.body.innerHTML = '';
    asked = [];
    warned = [];
    configureElements({ canvasHost: recordingHost(), logger: capturing });
});

afterEach(() => {
    asked = [];
    configureElements({ logger: silent });
});

describe('Tim: each interaction reads the canvas it stands on', () => {
    test('a meld measures with the transform of the canvas the composition stands on', () => {
        const { layer } = canvasWithLayer('c1');
        const a = placed('a');
        const b = placed('b');
        layer.append(a, b);

        performMeld(a, b, { id: 'a', title: 'a' }, { id: 'b', title: 'b' }, 'right');

        expect(asked).toEqual(['c1']);
    });

    test('a window lifted off a canvas remembers that canvas', () => {
        const { layer } = canvasWithLayer('c1');
        const el = placed('a');
        const btn = document.createElement('button');
        el.appendChild(btn);
        layer.appendChild(el);

        wireExpandToWindow({
            element: el, expandBtn: btn, elementId: 'a', title: 'a', symbol: 'a',
            renderContent: () => document.createElement('div'),
        });
        const played = playAnimations();
        try {
            btn.click();
        } finally {
            played.restore();
        }

        expect(getCanvasOrigin(el)?.canvasId).toBe('c1');
    });

    test('a window put back lands on the canvas found by data-canvas-id', async () => {
        const played = playAnimations();
        try {
            const { layer } = canvasWithLayer('c1');
            const el = placed('a');
            setForm(el, 'window');
            document.body.appendChild(el);

            await new Promise<void>(resolve => placeWindowOnCanvas(el, { onRestoreComplete: () => resolve() }));

            expect(warned).toEqual([]);
            expect(el.parentElement).toBe(layer);
        } finally {
            played.restore();
        }
    });

    test('a drag asks for the selection of the canvas it stands on', () => {
        const { layer } = canvasWithLayer('c1');
        const el = placed('a');
        layer.appendChild(el);
        makeDraggable(el, el, { id: 'a', title: 'a' });

        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));

        expect(asked).toEqual(['c1']);
    });
});

describe('Spike: an element on no canvas', () => {
    test('a meld off any canvas asks no canvas for its transform', () => {
        const parent = document.createElement('div');
        document.body.appendChild(parent);
        const a = placed('a');
        const b = placed('b');
        parent.append(a, b);

        performMeld(a, b, { id: 'a', title: 'a' }, { id: 'b', title: 'b' }, 'right');

        expect(asked).toEqual([]);
    });

    test('a drag off any canvas asks no canvas for a selection', () => {
        const el = placed('a');
        document.body.appendChild(el);
        makeDraggable(el, el, { id: 'a', title: 'a' });

        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }));

        expect(asked).toEqual([]);
    });

    test('an element on no canvas is not lifted to a window, and says so', () => {
        const el = placed('a');
        const btn = document.createElement('button');
        el.appendChild(btn);
        document.body.appendChild(el);

        wireExpandToWindow({
            element: el, expandBtn: btn, elementId: 'a', title: 'a', symbol: 'a',
            renderContent: () => document.createElement('div'),
        });
        btn.click();

        expect(getCanvasOrigin(el)).toBe(null);
        expect(warned.length).toBe(1);
    });

    test('a window with no canvas to go back to stays a window, and says so', () => {
        const el = placed('a');
        setForm(el, 'window');
        document.body.appendChild(el);

        placeWindowOnCanvas(el, { onRestoreComplete() {} });

        expect(warned.length).toBe(1);
        expect(el.parentElement).toBe(document.body);
    });
});
