// Sparkline: numbers to an 80×16 line, and the line answers pointing.
// The drawing is the package's; what the numbers mean is the host's.
// Colours are the package's own custom properties: a host sets them in its stylesheet.

import type { Element } from './element';
import { tooltipFrom, type TooltipTiming } from './forms/tooltip';

// No space after the comma: happy-dom drops a var() whose fallback has one.
const STROKE = 'var(--elements-sparkline-stroke,#64748b)';
const WHOLE_STROKE = 'var(--elements-sparkline-whole-stroke,#94a3b8)';
const MUTE = 'var(--elements-sparkline-mute,#64748b)';

/** A value for a double-quoted HTML attribute, whatever it holds: only an ampersand and a double quote change one. */
function attr(value: string): string {
    return value.split('&').join('&amp;').split('"').join('&quot;');
}

/** One series as an 80×16 line, scaled to its own maximum; given when each step is, it answers pointing (wireLineTooltips).
 *  Named, the window it may become carries the name. */
export function renderSparkline(data: (number | null)[], at?: string[], name?: string): string {
    const values = data.filter((v): v is number => v != null);
    if (values.length < 2) return '';

    const w = 80;
    const h = 16;
    const max = Math.max(...values);
    if (max === 0) return '';

    const points = data.map((v, i) => {
        if (v == null) return null;
        const x = (i / (data.length - 1)) * w;
        const y = h - (v / max) * (h - 2) - 1;
        return `${x},${y}`;
    }).filter(Boolean);

    const steps = at && at.length === data.length
        ? ` data-tooltip-series="${attr(JSON.stringify(data.map((v, i) => [at[i], v ?? 0])))}"`
            + (name ? ` data-tooltip-name="${attr(name)}"` : '')
        : '';
    return `<svg class="sparkline-line"${steps} viewBox="0 0 ${w} ${h}" style="width: ${w}px; height: ${h}px;">
        <polyline points="${points.join(' ')}" fill="none" stroke="${STROKE}" stroke-width="1" />
    </svg>`;
}

/** A line's steps: when, and the value then. */
type Step = [string, number];

function stepsOf(line: globalThis.Element): Step[] {
    return JSON.parse(line.getAttribute('data-tooltip-series') ?? '[]') as Step[];
}

/** The step under the pointer: "For one changing value, direct view of time and value". */
export function stepAt(line: globalThis.Element, x: number): string {
    let steps: Step[];
    try {
        steps = stepsOf(line);
    } catch (err: unknown) {
        return `this line's moments could not be read: ${err instanceof Error ? err.message : String(err)}`;
    }
    if (steps.length === 0) return '';
    const rect = line.getBoundingClientRect();
    const along = rect.width > 0 ? (x - rect.left) / rect.width : 0;
    const i = Math.min(steps.length - 1, Math.max(0, Math.round(along * (steps.length - 1))));
    return `${steps[i]![0]} · ${steps[i]![1]}`;
}

/** The bigger picture for a longer hover: the whole line drawn large between its first and last moment,
 *  and every moment that saw something, with its value. */
function wholeLine(steps: Step[]): HTMLElement {
    const picture = document.createElement('div');
    picture.className = 'sparkline-whole';
    if (steps.length < 2) return picture;

    const w = 320;
    const h = 64;
    const max = Math.max(...steps.map(([, v]) => v));
    const points = steps.map(([, v], i) => {
        const x = (i / (steps.length - 1)) * w;
        const y = max === 0 ? h - 1 : h - (v / max) * (h - 2) - 1;
        return `${x},${y}`;
    });
    picture.innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="width: ${w}px; height: ${h}px; display: block;">
        <polyline points="${points.join(' ')}" fill="none" stroke="${WHOLE_STROKE}" stroke-width="1.5" />
    </svg>`;

    const axis = document.createElement('div');
    axis.className = 'sparkline-whole-axis';
    axis.style.display = 'flex';
    axis.style.justifyContent = 'space-between';
    axis.style.color = MUTE;
    const first = document.createElement('span');
    first.textContent = steps[0]![0];
    const last = document.createElement('span');
    last.textContent = steps[steps.length - 1]![0];
    axis.append(first, last);
    picture.appendChild(axis);

    const moments = document.createElement('div');
    moments.className = 'sparkline-whole-moments';
    moments.style.marginTop = '6px';
    for (const [at, value] of steps) {
        if (value === 0) continue;
        const moment = document.createElement('div');
        moment.textContent = `${at} · ${value}`;
        moments.appendChild(moment);
    }
    picture.appendChild(moments);
    return picture;
}

let said = 0;

/** The element a line says, a new one every time: its name, and the whole line as its content. */
function lineSaid(line: globalThis.Element): Element {
    said++;
    let steps: Step[] = [];
    let unread = '';
    try {
        steps = stepsOf(line);
    } catch (err: unknown) {
        unread = `this line's moments could not be read: ${err instanceof Error ? err.message : String(err)}`;
    }
    const span = steps.length > 0 ? `${steps[0]![0]} to ${steps[steps.length - 1]![0]}` : '';
    return {
        id: `sparkline-${said}`,
        title: line.getAttribute('data-tooltip-name') ?? span,
        renderContent: () => {
            if (unread === '') return wholeLine(steps);
            const body = document.createElement('div');
            body.textContent = unread;
            return body;
        },
    };
}

const wired = new WeakSet<globalThis.Element>();

/** Every line that carries its moments answers pointing, wherever it is drawn: wired the first time a pointer
 *  comes over it, before it is entered, so lines drawn as markup need no wiring of their own. */
export function wireLineTooltips(root: Document = document, timing: TooltipTiming = {}): void {
    root.addEventListener('pointerover', (e: Event) => {
        const line = (e.target as globalThis.Element | null)?.closest?.('[data-tooltip-series]') as SVGElement | null;
        if (!line || wired.has(line)) return;
        wired.add(line);
        tooltipFrom(line, () => lineSaid(line), timing, (at) => stepAt(line, at.x));
    }, true);
}
