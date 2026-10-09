/**
 * Panel specimen — Krypton, an element that takes the whole screen, as a
 * dataset like Pulse's schedules does in QNTX.
 *
 * "It just takes over the entire screen and isn't pressable." Full screen, its
 * background fills the screen and its controls stay inside the safe area.
 */

import { tray } from '../tray/tray';
import type { Element } from '../element';
import { createInput } from '../canvas/ui-primitives';
import { paintSegment, segmentStrip, type SegmentState } from './segments';
import { growInPlace } from './grow';

/** What each colour of a run means, each drawn the way a segment is. */
function runsKey(): HTMLElement {
    const key = document.createElement('div');
    key.style.display = 'flex';
    key.style.flexDirection = 'column';
    key.style.gap = '6px';
    const said: [SegmentState, string][] = [
        ['done', 'passed'],
        ['running', 'running now'],
        ['failed', 'failed'],
        ['waiting', 'not started'],
    ];
    for (const [state, text] of said) {
        const line = document.createElement('div');
        line.style.display = 'flex';
        line.style.alignItems = 'center';
        line.style.gap = '8px';
        const mark = document.createElement('span');
        mark.style.width = '12px';
        mark.style.height = '12px';
        mark.style.border = '1px solid #fff';
        mark.style.boxSizing = 'border-box';
        paintSegment(mark, state);
        const words = document.createElement('span');
        words.textContent = text;
        line.append(mark, words);
        key.appendChild(line);
    }
    return key;
}

// Each schedule's last six runs, oldest first: most pass, now and then one
// fails, and every fifth schedule is running its latest now.
function lastRuns(i: number): SegmentState[] {
    return Array.from({ length: 6 }, (_, j) =>
        j === 5 && i % 5 === 0 ? 'running' : (i * 7 + j) % 11 === 0 ? 'failed' : 'done');
}

export function renderPanelSpecimen(): void {
    const item: Element = {
        id: 'panel-specimen',
        title: 'Krypton',
        symbol: 'Kr',
        opensAs: 'panel',
        color: '#000',
        renderContent: () => {
            const body = document.createElement('div');
            body.className = 'content';
            // The button that grows in place in Rubidium, holding here what a run's colour means.
            body.appendChild(growInPlace('What the runs mean', runsKey));
            // A row wider than a phone's screen: the panel does not let it be panned to.
            const wide = document.createElement('div');
            wide.style.whiteSpace = 'nowrap';
            wide.textContent = 'schedule 0 · ACTIVE · every 1m · next 11:18 · last 11:17 · ok · runs 1204 · owner root · wider than a phone';
            body.appendChild(wide);
            for (let i = 1; i <= 40; i++) {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.gap = '8px';
                const text = document.createElement('span');
                text.textContent = `schedule ${i} · ACTIVE · every ${i}m`;
                text.style.flex = '1';
                text.style.minWidth = '0';
                // The strip a PR's checks wear in Rubidium, worn here by the schedule's last runs.
                const { strip, segments } = segmentStrip('runs', 6);
                strip.style.flex = '0 0 72px';
                strip.style.minHeight = '16px';
                strip.style.fontSize = '10px';
                lastRuns(i).forEach((state, j) => paintSegment(segments[j]!, state));
                row.append(text, strip);
                body.appendChild(row);
            }
            // A field at the end of the list: on a phone the keyboard comes up over
            // the bottom of the screen, which is where this panel's last field is.
            body.appendChild(createInput({ label: 'New schedule', placeholder: 'every 5m', type: 'text' }));
            return body;
        },
    };
    tray.add(item);
}
