/**
 * A strip of segments, one per run of something, fuller as more of them end:
 * not started black, running grey lines moving left, done white, "failed is
 * RED". Its label is the exact inverse of whatever is behind it, segment by
 * segment. First made for a PR's checks; anything that runs in parts — a
 * schedule's last runs — can wear it.
 */

export type SegmentState = 'waiting' | 'running' | 'done' | 'failed';

const FAILED = '#dc2626';

/** Paints one segment, or anything drawn the way a segment is, in a state. */
export function paintSegment(el: HTMLElement, state: SegmentState): void {
    ensureStyle();
    el.dataset.state = state;
    el.className = state === 'running' ? 'segment-running' : '';
    el.style.background = { done: '#fff', failed: FAILED, waiting: '#000', running: '' }[state];
}

export function segmentStrip(text: string, count: number): { strip: HTMLElement; segments: HTMLElement[] } {
    ensureStyle();
    const strip = document.createElement('div');
    strip.style.position = 'relative';
    strip.style.flex = '1';
    strip.style.minHeight = '22px';
    strip.style.display = 'flex';
    strip.style.alignItems = 'center';
    strip.style.justifyContent = 'center';
    strip.style.isolation = 'isolate';
    const bar = document.createElement('span');
    bar.style.position = 'absolute';
    bar.style.inset = '0';
    bar.style.display = 'flex';
    bar.style.gap = '1px';
    const segments = Array.from({ length: count }, () => {
        const seg = document.createElement('span');
        seg.style.flex = '1';
        bar.appendChild(seg);
        paintSegment(seg, 'waiting');
        return seg;
    });
    const label = document.createElement('span');
    label.textContent = text;
    label.style.position = 'relative';
    // Each letter is the exact inverse of what is behind it: white over black is
    // black over white. Blended against the strip alone.
    label.style.color = '#fff';
    label.style.mixBlendMode = 'difference';
    strip.append(bar, label);
    return { strip, segments };
}

// Grey diagonal lines moving left: a run that is running.
function ensureStyle(): void {
    if (document.getElementById('segment-running-style')) return;
    const style = document.createElement('style');
    style.id = 'segment-running-style';
    style.textContent = `
        .segment-running {
            background-color: #000;
            /* Dark grey, so the label inverted over it is light grey and still reads. */
            background-image: linear-gradient(-45deg, #3a3a3a 25%, transparent 25%, transparent 50%, #3a3a3a 50%, #3a3a3a 75%, transparent 75%);
            background-size: 8px 8px;
            animation: segment-running 1.6s linear infinite;
        }
        @keyframes segment-running { to { background-position: -8px 0; } }
        @media (prefers-reduced-motion: reduce) { .segment-running { animation: none; } }
    `;
    document.head.appendChild(style);
}
