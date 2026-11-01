/**
 * The spawn menu — what a right-click or a finger held still opens on a canvas.
 *
 * "on mobile, can't get into spawn menu"
 *
 * The package draws the menu, carries a choice to where it is put down, takes
 * it back if it is not, and morphs it into place. The host says what can be
 * spawned where (`entries`) and what becomes of a choice (`place`): ids,
 * persistence, pan and zoom, threads. One listener on the document serves every
 * element carrying `data-canvas-id`, the nearest one asked, so a host wires
 * nothing and a canvas inside a canvas has the menu too.
 *
 * The element is one. The button chosen from the menu becomes the cursor that
 * is carried, and the cursor becomes the placed element: `place` renders into
 * the element it is handed and returns that one. Any other is an error.
 */

import { getLogger, getLogSegment, getSpawnHost, clearSpawnHost } from '../config';
import { getRestDuration } from '../element';
import { sizeText } from '../text';
import { attachCursorToMouse, prepareCursorForPlacement, commitCursorPlacement } from './cursor';
import { onTouchHold, type TouchHold } from './touch-hold';

/** One thing a canvas can spawn. Plain text throughout. */
export interface SpawnEntry {
    id: string;
    symbol: string;
    title: string;
    description?: string;
    hint?: string;
}

/** What the host is asked, and told. */
export interface SpawnHost {
    /** What can be spawned where `target` was pressed on `canvas`. Empty: no menu opens. */
    entries(where: { target: HTMLElement; canvas: HTMLElement }): SpawnEntry[];
    /**
     * Put the chosen entry down. The host renders INTO `carried`, puts it on the
     * canvas, persists it and returns it: an element is one DOM element for its
     * whole life, so any other element returned is an error. The package morphs
     * it into place once this resolves. `content` is read from the nearest
     * `data-spawn-content` under the pointer, if any.
     */
    place(placing: {
        entry: SpawnEntry;
        canvas: HTMLElement;
        at: { clientX: number; clientY: number };
        carried: HTMLElement;
        symbol: HTMLElement | null;
        content?: string;
    }): Promise<HTMLElement>;
    /**
     * An entry the host carries itself, when it is chosen. Return true to take
     * it: the menu and its scrim are gone, nothing is carried, and the host
     * puts the element down when it is ready, with `putDownCarried`. Return
     * false, or have no `take`, and the package carries it.
     */
    take?(taking: { entry: SpawnEntry; canvas: HTMLElement; target: HTMLElement }): boolean;
}

/** What `place` is handed, and what `putDownCarried` hands to it. */
export type Placing = Parameters<SpawnHost['place']>[0];

/** The host carried an element of its own; the package hands it to `place` and morphs it into place. */
export async function putDownCarried(placing: Placing): Promise<void> {
    await handOver(placing, placing.carried.getBoundingClientRect());
}

const CANVAS = '[data-canvas-id]';
const ELEMENT_SPACING = 48;
const FLOAT_DEPTH = 15;
const FACE_INTENSITY = 0.08;
const PLACE_MORPH_MS = 350;

interface OpenMenu {
    el: HTMLElement;
    stop: () => void;
}

interface Placement {
    entry: SpawnEntry;
    canvas: HTMLElement;
    carried: HTMLElement;
    stopFollowing: () => void;
}

interface Installed {
    hold: TouchHold;
    remove: () => void;
}

let installed: Installed | null = null;
let menu: OpenMenu | null = null;
let placement: Placement | null = null;

export function isSpawnMenuOpen(): boolean { return menu !== null; }
export function isPlacementActive(): boolean { return placement !== null; }

const say = (level: 'debug' | 'error', message: string): void => {
    getLogger()[level](getLogSegment(), message);
};

const canvasOf = (target: EventTarget | null): HTMLElement | null =>
    target && typeof (target as HTMLElement).closest === 'function'
        ? (target as HTMLElement).closest<HTMLElement>(CANVAS)
        : null;

/** The listeners that make every canvas open its menu. Once; later calls change nothing. */
export function installSpawn(): void {
    if (installed) return;
    putStylesheetInPage();
    const hold = onTouchHold(document, (x, y, target) => onHold(x, y, target));

    // A right-click that closed or cancelled something has had its answer; it opens nothing.
    const answered = new WeakSet<Event>();
    // What is already open or carried answers first, before the page can: capture.
    const onContext = (raw: Event): void => {
        const e = raw as MouseEvent;
        // The platform fires contextmenu for the press a hold already answered.
        if (hold.isHeld()) { e.preventDefault(); e.stopImmediatePropagation(); return; }
        if (placement) { e.preventDefault(); answered.add(e); cancelPlacement(); return; }
        if (menu) { e.preventDefault(); answered.add(e); closeMenu(false); }
    };
    // A menu opens last, once the element pressed has had its say: bubble. An
    // element that takes its own right-click and stops it keeps it.
    const onContextOpen = (raw: Event): void => {
        const e = raw as MouseEvent;
        if (answered.has(e)) return;
        const canvas = canvasOf(e.target);
        if (canvas && openMenu(e.clientX, e.clientY, e.target as HTMLElement, canvas)) e.preventDefault();
    };

    const onMouseDown = (raw: Event): void => {
        const e = raw as MouseEvent;
        if (placement) {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            putDown(e.clientX, e.clientY);
            return;
        }
        if (menu && !menu.el.contains(e.target as Node)) {
            e.preventDefault();
            closeMenu(false);
        }
    };

    const onKey = (raw: Event): void => {
        const e = raw as KeyboardEvent;
        if (e.key !== 'Escape') return;
        if (placement) { e.preventDefault(); cancelPlacement(); }
        else if (menu) { e.preventDefault(); closeMenu(false); }
    };

    document.addEventListener('contextmenu', onContext, true);
    document.addEventListener('contextmenu', onContextOpen);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKey);
    installed = {
        hold,
        remove: () => {
            document.removeEventListener('contextmenu', onContext, true);
            document.removeEventListener('contextmenu', onContextOpen);
            document.removeEventListener('mousedown', onMouseDown, true);
            document.removeEventListener('keydown', onKey);
            hold.dispose();
        },
    };
}

/** Menu closed, placement cancelled, listeners and the host's answers gone. */
export function resetSpawn(): void {
    cancelPlacement();
    if (menu) { menu.el.remove(); closeMenu(false); }
    removeScrim();
    installed?.remove();
    installed = null;
    clearSpawnHost();
}

/** A hold is the phone's right-click; held while carrying, it is the phone's Escape. */
function onHold(x: number, y: number, target: HTMLElement): void {
    if (placement) { cancelPlacement(); return; }
    if (menu) return;
    const canvas = canvasOf(target);
    if (canvas) openMenu(x, y, target, canvas);
}

// ---------------------------------------------------------------- the menu

function openMenu(x: number, y: number, target: HTMLElement, canvas: HTMLElement): boolean {
    const host = getSpawnHost();
    if (!host) return false;
    let entries: SpawnEntry[];
    try {
        entries = host.entries({ target, canvas });
    } catch (err) {
        say('error', `spawn: entries failed: ${err instanceof Error ? err.message : String(err)}`);
        return false;
    }
    if (entries.length === 0) return false;

    putStylesheetInPage();
    showScrim('menu');

    const el = document.createElement('div');
    el.className = 'elements-spawn-menu';
    el.setAttribute('role', 'menu');
    el.setAttribute('aria-label', 'Spawn new element');
    el.setAttribute('data-text-surface', '');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    const totalHeight = (entries.length - 1) * ELEMENT_SPACING;
    const nodes: { el: HTMLElement; baseY: number; phase: number }[] = [];

    entries.forEach((entry, i) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'elements-spawn-item';
        item.setAttribute('role', 'menuitem');
        item.setAttribute('aria-label', entry.title);
        item.textContent = entry.symbol;
        sizeText(item, 'lg');
        item.appendChild(revealOf(entry));

        let chosen = false;
        const choose = (): void => {
            if (chosen) return;
            chosen = true;
            chooseEntry(entry, item, canvas, target);
        };
        item.addEventListener('mousedown', (e) => { e.stopPropagation(); choose(); });
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
        });
        el.appendChild(item);
        nodes.push({ el: item, baseY: i * ELEMENT_SPACING - totalHeight / 2, phase: Math.random() * Math.PI * 2 });
    });

    document.body.appendChild(el);

    // Symbols drift in place and tilt toward the pointer.
    let pointerX = x;
    let pointerY = y;
    const onMove = (e: MouseEvent): void => { pointerX = e.clientX; pointerY = e.clientY; };
    document.addEventListener('mousemove', onMove);
    const start = performance.now();
    let frame = 0;
    const hovered = (n: HTMLElement): boolean => {
        try { return n.matches(':hover'); } catch { return false; }
    };
    const drift = (now: number): void => {
        const t = (now - start) / 1000;
        for (const n of nodes) {
            if (hovered(n.el)) { n.el.style.transform = `translate3d(0px, ${n.baseY}px, 0px)`; continue; }
            const dx = Math.sin(t * 0.8 + n.phase) * 3;
            const dy = Math.cos(t * 0.6 + n.phase * 1.3) * 2;
            const dz = Math.sin(t * 0.3 + n.phase * 0.7) * FLOAT_DEPTH;
            const rotY = (pointerX - x) * FACE_INTENSITY * 0.1;
            const rotX = -(pointerY - y) * FACE_INTENSITY * 0.1;
            n.el.style.transform = `translate3d(${dx}px, ${n.baseY + dy}px, ${dz}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        }
        frame = requestAnimationFrame(drift);
    };
    if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(drift);

    menu = {
        el,
        stop: () => {
            if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
            document.removeEventListener('mousemove', onMove);
        },
    };
    say('debug', `spawn: menu opened with ${entries.length} entries`);
    return true;
}

/** What is said of an entry when it is hovered. Text, never markup. */
function revealOf(entry: SpawnEntry): HTMLElement {
    const reveal = document.createElement('div');
    reveal.className = 'elements-spawn-reveal';
    sizeText(reveal, 'sm');
    const title = document.createElement('strong');
    sizeText(title, 'md');
    title.textContent = entry.title;
    reveal.appendChild(title);
    for (const [cls, text] of [['desc', entry.description], ['hint', entry.hint]] as const) {
        if (!text) continue;
        const line = document.createElement('div');
        line.className = `elements-spawn-${cls}`;
        line.textContent = text;
        reveal.appendChild(line);
    }
    return reveal;
}

/** The menu is no longer one at once; what is left of it fades. */
function closeMenu(keepScrim: boolean): void {
    const closing = menu;
    if (!closing) return;
    menu = null;
    closing.stop();
    closing.el.removeAttribute('role');
    if (!keepScrim) removeScrim();
    const el = closing.el;
    if (typeof el.animate !== 'function' || getRestDuration() === 0) { el.remove(); return; }
    const fade = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: getRestDuration() * 0.4, easing: 'ease', fill: 'forwards' });
    fade.addEventListener('finish', () => el.remove());
    fade.addEventListener('cancel', () => el.remove());
}

// ------------------------------------------------------------- the carrying

function chooseEntry(entry: SpawnEntry, item: HTMLElement, canvas: HTMLElement, target: HTMLElement): void {
    // The button leaves the menu before the menu goes: it is the element carried.
    item.remove();
    closeMenu(true);

    // An entry the host carries itself is the host's from here: nothing of the package's is left standing.
    const host = getSpawnHost();
    if (host?.take) {
        let taken = false;
        try {
            taken = host.take({ entry, canvas, target }) === true;
        } catch (err) {
            say('error', `spawn: taking ${entry.title} failed: ${err instanceof Error ? err.message : String(err)}`);
            removeScrim();
            return;
        }
        if (taken) { removeScrim(); return; }
    }

    const rect = item.getBoundingClientRect();
    item.className = 'cursor';
    item.removeAttribute('role');
    item.removeAttribute('aria-label');
    item.setAttribute('data-element-type', entry.title);
    item.setAttribute('data-text-surface', '');
    sizeText(item, 'lg');
    item.style.cssText = `position: fixed; pointer-events: none; z-index: 10003; left: ${rect.left + rect.width / 2}px; top: ${rect.top + rect.height / 2}px;`;
    item.textContent = '';
    const symbol = document.createElement('span');
    symbol.className = 'cursor-symbol';
    symbol.textContent = entry.symbol;
    item.appendChild(symbol);
    document.body.appendChild(item);

    showScrim('carrying');
    document.body.setAttribute('data-spawn-carrying', entry.id);
    placement = { entry, canvas, carried: item, stopFollowing: attachCursorToMouse(item) };
    say('debug', `spawn: carrying ${entry.title}`);
}

function endCarrying(): Placement | null {
    const ending = placement;
    if (!ending) return null;
    placement = null;
    ending.stopFollowing();
    document.body.removeAttribute('data-spawn-carrying');
    removeScrim();
    return ending;
}

/** Leave without placing: the carried element never became one, and goes. */
export function cancelPlacement(): void {
    const ending = endCarrying();
    if (!ending) return;
    ending.carried.remove();
    say('debug', `spawn: cancelled ${ending.entry.title}`);
}

function putDown(clientX: number, clientY: number): void {
    const carrying = placement;
    if (!carrying) return;
    const { carried, entry, canvas } = carrying;

    let content: string | undefined;
    if (typeof document.elementFromPoint === 'function') {
        try {
            carried.style.display = 'none';
            content = document.elementFromPoint(clientX, clientY)?.closest('[data-spawn-content]')?.getAttribute('data-spawn-content') ?? undefined;
        } catch { /* nothing under the pointer to read */ } finally {
            carried.style.display = '';
        }
    }
    const from = carried.getBoundingClientRect();
    const symbol = prepareCursorForPlacement(carried);
    endCarrying();
    void handOver({ entry, canvas, at: { clientX, clientY }, carried, symbol, content }, from);
}

async function handOver(
    placing: Parameters<SpawnHost['place']>[0],
    from: DOMRect,
): Promise<void> {
    const { carried, entry } = placing;
    const host = getSpawnHost();
    if (!host) { carried.remove(); return; }
    let returned: HTMLElement;
    try {
        returned = await host.place(placing);
    } catch (err) {
        say('error', `spawn: placing ${entry.title} failed: ${err instanceof Error ? err.message : String(err)}`);
        carried.remove();
        return;
    }
    if (returned !== carried) {
        say('error', `spawn: placing ${entry.title} returned an element that is not the carried one; an element is one DOM element for its whole life`);
        carried.remove();
        return;
    }
    morphIntoPlace(carried, from, placing.symbol);
}

/** The cursor is an element now: its text is its element's, not the surface's. */
function becomeElement(el: HTMLElement): void {
    commitCursorPlacement(el);
    el.removeAttribute('data-text-surface');
    delete el.dataset.textSize;
}

const finite = (n: number, otherwise: number): number => (Number.isFinite(n) ? n : otherwise);

/** The carried element grows from the cursor's box to its place, its content arriving after. */
function morphIntoPlace(el: HTMLElement, from: DOMRect, symbol: HTMLElement | null): void {
    if (typeof el.animate !== 'function' || getRestDuration() === 0) { becomeElement(el); return; }

    const to = el.getBoundingClientRect();
    const children = Array.from(el.children).filter(c => c !== symbol && !(symbol && c.contains(symbol))) as HTMLElement[];
    for (const c of children) c.style.opacity = '0';

    const dx = finite(from.left + from.width / 2 - (to.left + to.width / 2), 0);
    const dy = finite(from.top + from.height / 2 - (to.top + to.height / 2), 0);
    const sx = to.width > 0 ? finite(from.width / to.width, 1) : 1;
    const sy = to.height > 0 ? finite(from.height / to.height, 1) : 1;

    const road = el.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: '6px' },
        { transform: 'translate(0, 0) scale(1, 1)', borderRadius: el.style.borderRadius || '6px' },
    ], { duration: PLACE_MORPH_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'none' });

    let over = false;
    const arrive = (): void => {
        if (over) return;
        over = true;
        for (const c of children) {
            c.style.opacity = '';
            if (typeof c.animate === 'function') c.animate([{ opacity: '0' }, { opacity: '1' }], { duration: 150, easing: 'ease-out', fill: 'none' });
        }
        becomeElement(el);
    };
    road.addEventListener('finish', arrive);
    road.addEventListener('cancel', arrive);
}

// ----------------------------------------------------------- scrim and style

function showScrim(phase: 'menu' | 'carrying'): void {
    let scrim = document.querySelector<HTMLElement>('[data-spawn-scrim]');
    if (!scrim) {
        scrim = document.createElement('div');
        document.body.appendChild(scrim);
    }
    scrim.setAttribute('data-spawn-scrim', phase);
}

function removeScrim(): void {
    document.querySelector('[data-spawn-scrim]')?.remove();
}

function putStylesheetInPage(): void {
    if (document.head.querySelector('style[data-elements-spawn]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-elements-spawn', '');
    style.textContent = `
[data-spawn-scrim]{position:fixed;inset:0;z-index:10001;pointer-events:none;transition:background-color 200ms ease}
[data-spawn-scrim="menu"]{background-color:rgba(0,0,0,.6)}
[data-spawn-scrim="carrying"]{background-color:rgba(0,0,0,.3)}
.elements-spawn-menu{position:fixed;background:none;border:none;z-index:10002;perspective:800px;transform-style:preserve-3d}
.elements-spawn-item{position:absolute;width:auto;height:auto;border:none;background:none;color:rgba(255,255,255,.7);cursor:pointer;display:flex;align-items:center;justify-content:center;transform-style:preserve-3d;transition:color .3s ease,opacity .3s ease;padding:8px}
.elements-spawn-item:hover{color:#fff;z-index:1}
.elements-spawn-menu:has(.elements-spawn-item:hover) .elements-spawn-item:not(:hover){opacity:.35}
.elements-spawn-item:active{transform:scale(.95)!important}
.elements-spawn-item:focus-visible{outline:2px solid #4a9eff;outline-offset:2px}
.elements-spawn-reveal{position:absolute;left:calc(100% + 12px);top:50%;transform:translateY(-50%) translateZ(0);background:rgba(30,30,30,.95);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:12px 16px;color:rgba(255,255,255,.85);max-width:240px;pointer-events:none;opacity:0;transition:opacity .2s ease;text-align:left}
.elements-spawn-item:hover .elements-spawn-reveal{opacity:1;pointer-events:auto}
.elements-spawn-reveal strong{display:block;margin-bottom:4px}
.elements-spawn-desc{color:rgba(255,255,255,.65);line-height:1.4}
.elements-spawn-hint{color:rgba(255,255,255,.4);margin-top:4px;font-style:italic}
.cursor{position:fixed;pointer-events:none;z-index:10003;color:rgba(255,255,255,.95);background:none;border:none;width:44px;height:44px;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%)}
@media (pointer:coarse){.elements-spawn-item{padding:12px}}
`;
    document.head.appendChild(style);
}
