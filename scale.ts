/**
 * The page's scale, while a field takes the keyboard.
 *
 * "You tap a box to type, and the only thing that should happen is the keyboard
 * coming up. Nothing on the screen should move, zoom or refocus."
 *
 * iOS Safari zooms the page onto a field whose text is under 16px, and a host
 * that has to remember 16px forgets it. So the package holds the scale and the
 * host has no say: whatever the page's viewport line says, it also says
 * maximum-scale=1, said again whenever the line changes. Safari still lets a
 * person pinch the page; only the zoom nobody asked for is gone.
 */

const HELD = 'maximum-scale=1';

// Kept, so nothing collects it while the page lives.
let watcher: MutationObserver | null = null;

/** What a viewport line says, with the scale held. */
function holding(content: string): string {
    const said = content
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '' && !part.startsWith('maximum-scale'));
    return [...said, HELD].join(', ');
}

function hold(): void {
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="viewport"]');
    if (metas.length === 0) {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = HELD;
        document.head.appendChild(meta);
        watchLine(meta);
        return;
    }
    for (const meta of metas) {
        const held = holding(meta.content);
        if (meta.content !== held) meta.content = held;
        watchLine(meta);
    }
}

// Each viewport line is watched for what it says; the head, for lines coming and going.
const watchedLines = new WeakSet<HTMLMetaElement>();

function watchLine(meta: HTMLMetaElement): void {
    if (!watcher || watchedLines.has(meta)) return;
    watchedLines.add(meta);
    watcher.observe(meta, { attributes: true, attributeFilter: ['name', 'content'] });
}

/** Hold the page's scale, from now on. */
export function holdScale(): void {
    if (!watcher) {
        watcher = new MutationObserver(hold);
        watcher.observe(document.head, { childList: true });
    }
    hold();
}
