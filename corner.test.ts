// A resize corner's place and size are the package's; how it looks is the host's.
// "right, so it moves out of QNTX and becomes usable by other projects using elements"

// Personas:
// - Tim: a corner can be seen and grabbed with no stylesheet at all
// - Spike: a smaller corner, and the class a host dresses it by

// - Jenny: a canvas element's corner is the same corner

import { describe, test, expect, beforeEach } from 'bun:test';
import { createCorner, CORNER_SIZE } from './corner';
import { canvasPlaced } from './canvas/placed';

beforeEach(() => {
    document.body.innerHTML = '';
});

function placedAt(el: HTMLElement): void {
    expect(el.style.position).toBe('absolute');
    expect(el.style.right).toBe('0px');
    expect(el.style.bottom).toBe('0px');
    expect(el.style.cursor).toBe('nwse-resize');
}

describe('Tim: a corner with no stylesheet', () => {
    test('sits in the bottom-right corner, sized, with the resize cursor', () => {
        const corner = createCorner();

        placedAt(corner);
        expect(corner.style.width).toBe(`${CORNER_SIZE}px`);
        expect(corner.style.height).toBe(`${CORNER_SIZE}px`);
    });
});

describe('Spike: size and dress', () => {
    test('a smaller corner is asked for by size', () => {
        const corner = createCorner(10);

        expect(corner.style.width).toBe('10px');
        expect(corner.style.height).toBe('10px');
    });

    test('carries the class a host dresses it by', () => {
        expect(createCorner().classList.contains('resize-handle')).toBe(true);
    });
});

describe('Jenny: a canvas element\'s corner', () => {
    function placed(extra: { resizeHandleSize?: number; resizeHandleClass?: string }) {
        const { element } = canvasPlaced({
            item: { id: 'note-1', title: 'note', renderContent: () => document.createElement('div') },
            className: 'canvas-note-element',
            defaults: { x: 0, y: 0, width: 200, height: 120 },
            resizable: true,
            logLabel: 'Note',
            ...extra,
        });
        return element.querySelector(':scope > .resize-handle') as HTMLElement;
    }

    test('is placed and sized by the package', () => {
        const corner = placed({});

        placedAt(corner);
        expect(corner.style.width).toBe(`${CORNER_SIZE}px`);
    });

    test('a note asks for a smaller one, and keeps its own class for the look', () => {
        const corner = placed({ resizeHandleSize: 10, resizeHandleClass: 'resize-handle--small' });

        expect(corner.style.width).toBe('10px');
        expect(corner.classList.contains('resize-handle--small')).toBe(true);
    });
});
