// A strip of segments: one per run of something, fuller as more of them end.
// "I don't want to see any piece of text ui that has lines behind it":
// the strip writes nothing over its segments; what it is called is its name.
// Personas: Tim (a strip, named, nothing written on it), Spike (a running
// segment, the lines alone), Jenny (a strip as the runs of a schedule).

import { describe, test, expect } from 'bun:test';
import { paintSegment, segmentStrip } from './segments';

describe('Tim: a strip is its segments, and its name is not written on it', () => {
    test('nothing is written over the segments', () => {
        const { strip } = segmentStrip('codevault', 3);
        expect(strip.textContent).toBe('');
    });

    test('what it is called is its accessible name', () => {
        const { strip } = segmentStrip('codevault', 3);
        expect(strip.getAttribute('aria-label')).toBe('codevault');
    });

    test('one segment per run', () => {
        const { segments } = segmentStrip('codevault', 4);
        expect(segments).toHaveLength(4);
    });
});

describe('Spike: a running segment is lines, and only lines', () => {
    test('every segment of a running strip holds no text', () => {
        const { strip, segments } = segmentStrip('codevault', 2);
        segments.forEach((s) => paintSegment(s, 'running'));
        expect(segments.every((s) => s.textContent === '')).toBe(true);
        expect(strip.textContent).toBe('');
    });

    test('an empty name leaves the strip unnamed rather than named nothing', () => {
        const { strip } = segmentStrip('', 2);
        expect(strip.hasAttribute('aria-label')).toBe(false);
    });
});

describe('Jenny: a schedule wears the strip for its last runs', () => {
    test('six runs, some done, one running: six segments, nothing written', () => {
        const { strip, segments } = segmentStrip('runs', 6);
        (['done', 'done', 'failed', 'done', 'running', 'waiting'] as const).forEach((state, i) => paintSegment(segments[i]!, state));
        expect(segments.map((s) => s.dataset.state)).toEqual(['done', 'done', 'failed', 'done', 'running', 'waiting']);
        expect(strip.textContent).toBe('');
        expect(strip.getAttribute('aria-label')).toBe('runs');
    });
});
