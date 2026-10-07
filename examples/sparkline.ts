// Sparkline specimen — Arsenic, the next element after the button's Germanium.
// Each row is numbers, when each one is, and a name: point at a line, then hover longer.
// The last row sets the package's custom properties, the way a host on another background does.

import { canvasPlaced } from '../canvas/placed';
import { declareScroller } from '../content/scroll';
import { renderSparkline, wireLineTooltips } from '../sparkline';
import type { Element } from '../element';

const HOURS = Array.from({ length: 12 }, (_, i) => `2026-09-29 ${String(8 + i).padStart(2, '0')}`);

const ROWS: [name: string, data: (number | null)[], style: string][] = [
    ['steady', [3, 4, 3, 5, 4, 4, 5, 3, 4, 5, 4, 4], ''],
    ['one spike', [0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0], ''],
    ['with gaps', [2, 3, null, null, 5, 6, null, 4, 3, null, 2, 1], ''],
    ['host colours', [1, 2, 4, 8, 6, 3, 5, 7, 9, 6, 4, 2], '--elements-sparkline-stroke:#fff;--elements-sparkline-whole-stroke:#ffd43b;--elements-sparkline-mute:#aaa'],
];

export function renderSparklineSpecimen(): void {
    const root = document.getElementById('root');
    if (!root) return;

    const area = document.createElement('div');
    area.style.position = 'relative';
    area.style.height = '200px';
    area.dataset.canvasId = 'sparkline-canvas';
    root.appendChild(area);

    const item: Element = {
        id: 'sparkline-specimen',
        title: 'Arsenic',
        symbol: 'As',
        renderContent: () => document.createElement('div'),
    };

    const { element } = canvasPlaced({
        item,
        className: 'canvas-sparkline-specimen',
        defaults: { x: 16, y: 16, width: 260, height: 150 },
        titleBar: { label: 'Arsenic' },
        logLabel: 'SparklineSpecimen',
    });

    const body = document.createElement('div');
    body.className = 'content-area';
    // A canvas-placed element has no body of the package's: this one is its scroller, said so.
    declareScroller(body);
    for (const [name, data, style] of ROWS) {
        const row = document.createElement('div');
        row.style.cssText = `display: flex; justify-content: space-between; align-items: center; gap: 10px; ${style}`;
        const label = document.createElement('span');
        label.textContent = name;
        const spark = document.createElement('span');
        spark.style.display = 'inline-flex';
        spark.innerHTML = renderSparkline(data, HOURS, name);
        row.append(label, spark);
        body.appendChild(row);
    }
    element.appendChild(body);
    area.appendChild(element);

    wireLineTooltips();
}
