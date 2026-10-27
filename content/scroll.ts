/**
 * Where an element scrolls.
 *
 * Apple Human Interface Guidelines, Scroll views: "Avoid putting a scroll view
 * inside another scroll view with the same orientation", and "It's alright to
 * place a horizontal scroll view inside a vertical scroll view". So an element
 * scrolls vertically in one place, and the package owns it: the body it gave
 * the element (content/body.ts), or a scroller the host declared to it with
 * declareScroller(). Whatever the package learns about scrolling, it does there,
 * so there is no second place for a host to do it.
 *
 * A host says what scrolls; the package says how. Anything else that scrolls
 * vertically inside an element is named where it is — data-scroller="undeclared"
 * on the node, and one warning that says what to do instead — and fails
 * expectScroll() in the host's own tests. Sideways scrollers (a code block) and
 * a field's own scrolling are not second scrollers.
 *
 * Only declared overflow is read, never measured overflow: the same verdict in a
 * test DOM, where every box measures zero, as on a phone.
 *
 * The element's scroller scrolls down, never sideways. Content wider than the
 * element drops it dead (measured, so only on a page): see dropDeadIfTooWide.
 */

import { getLogger, getLogSegment } from '../config';
import { holdScrollbar, dropScrollbar } from './scrollbar';
import { bringInside, evenButtons, loosenGrids, wrapRows } from '../fit';

/** Elements whose scrolling is the platform's own. */
const SCROLLS_ITSELF = new Set(['TEXTAREA', 'SELECT', 'INPUT', 'IFRAME']);

/** What the keyboard can stop on inside a scroller, so the scroller need not be a stop itself. */
const TAB_STOPS = 'a[href], button, input, select, textarea, iframe, [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"])';

/** A disconnected element has no computed style; how many frames to wait for it to be placed. */
const FRAMES_TO_WAIT_FOR_PAGE = 120;

interface Watch {
    title: string;
    observer: MutationObserver | null;
    /** The scrollers a host has already been told about: once each. */
    told: WeakSet<HTMLElement>;
    waiting: boolean;
    /** The body last seen holding the element's content. */
    body: HTMLElement | null;
    /** The scroller that dropped dead, too wide, and has not fit since. */
    dead: HTMLElement | null;
    /** Looks again when the scroller changes width with nothing inside it changing: a morph to a panel, a phone turned. */
    resize: ResizeObserver | null;
    resized: HTMLElement | null;
}

const watches = new WeakMap<HTMLElement, Watch>();

/** How wide a dead scroller's content was, in how wide, as it was said. */
const deadAt = new WeakMap<HTMLElement, { wide: number; room: number }>();

const TOO_WIDE_STYLE_ID = 'elements-too-wide-style';

// The host's content stays where it is, laid out, so it is measured again; it is not seen or pressed.
const TOO_WIDE_STYLE = `
[data-too-wide] > :not([data-too-wide-notice]) {
    visibility: hidden !important;
}

[data-too-wide-notice] {
    position: sticky;
    top: 0;
    z-index: 1;
    box-sizing: border-box;
    width: 100%;
    padding: 8px 10px;
    font-family: var(--font-mono, monospace);
    white-space: normal;
    overflow-wrap: anywhere;
    color: #ffe4ec;
    background: var(--color-error, #b3261e);
}
`;

/** What a body wrote to make room for a declared scroller, to take back exactly that. */
interface Room {
    holder: HTMLElement;
    holderWas: { flex: string; minHeight: string };
    bodyWas: { display: string; flexDirection: string };
}

const rooms = new WeakMap<HTMLElement, Room>();

/** The attributes the package wrote to make a scroller reachable, to take back exactly those. */
const madeReachable = new WeakMap<HTMLElement, string[]>();

/**
 * A host's word that this node is its element's vertical scroller. The body the
 * package gave the element then stops scrolling vertically, and the node scrolls
 * the way the package's scroller does. Callable before the node is in an element.
 */
export function declareScroller(node: HTMLElement): void {
    node.dataset.scroller = 'declared';
    node.style.overscrollBehavior = 'contain';
    // Down, not sideways, as the body the package gives (content/body.ts).
    node.style.overflowX = 'hidden';
}

/**
 * Watch where an element scrolls, now and whenever its content changes. One
 * watch per element (AXIOMAS.md, Element Axioma): watching again looks again,
 * under the title given.
 */
export function watchScroll(element: HTMLElement, title: string): void {
    let watch = watches.get(element);
    if (!watch) {
        const fresh: Watch = { title, observer: null, told: new WeakSet(), waiting: false, body: null, dead: null, resize: null, resized: null };
        if (typeof MutationObserver === 'function') {
            fresh.observer = new MutationObserver((records) => {
                // A drag or a morph writing the element's own style every frame changes nothing inside it,
                // nor does the package's bar (content/scrollbar.ts) moving as the scroller does.
                if (records.every((record) => (record.type === 'attributes' && record.target === element) || isBar(record))) return;
                review(element, fresh, changedBy(records));
            });
            fresh.observer.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
        }
        watches.set(element, fresh);
        watch = fresh;
    }
    watch.title = title;
    review(element, watch, descendants(element));
}

/**
 * For a host's tests: an element scrolls vertically in one place. Throws naming
 * every vertical scroller nobody declared.
 */
export function expectScroll(element: HTMLElement): void {
    const second = descendants(element).filter((node) => isSecondScroller(element, node));
    if (second.length === 0) return;
    throw new Error(
        `SCROLL: ${idOf(element)}: ${second.map(describe).join(', ')} scroll vertically without being declared. ` +
        `declareScroller() the one that is this element's scroller; take overflow away from the rest.`,
    );
}

/**
 * For a host's tests in a real browser: nothing in the element is wider than it.
 * Measured now, so it fails whether or not the watch has looked yet.
 */
export function expectFits(element: HTMLElement): void {
    const scrollers = element.querySelectorAll<HTMLElement>('[data-scroller="body"], [data-scroller="declared"]');
    for (const scroller of Array.from(scrollers)) {
        const wide = scroller.scrollWidth;
        const room = scroller.clientWidth;
        if (wide <= room + 1) continue;
        throw new Error(
            `WIDTH: ${idOf(element)}: its content is ${wide}px wide in ${room}px. ` +
            `${offenders(scroller).join(', ') || describe(scroller)}. Let it wrap, or fit it to the element's width.`,
        );
    }
    // Content inside its element is not enough: the element itself stands whole on its screen.
    const r = element.getBoundingClientRect();
    if (r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1)) {
        throw new Error(
            `WIDTH: ${idOf(element)} runs off its screen: from ${Math.round(r.left)}px to ${Math.round(r.right)}px on a screen ${window.innerWidth}px wide.`,
        );
    }
}

function review(element: HTMLElement, watch: Watch, candidates: HTMLElement[]): void {
    if (!element.isConnected) {
        waitForPage(element, watch);
        return;
    }

    // What was named before may have stopped scrolling since.
    const named = Array.from(element.querySelectorAll<HTMLElement>('[data-scroller="undeclared"]'));
    for (const node of new Set([...candidates, ...named])) {
        if (!element.contains(node) || node === element) continue;
        const kind = node.dataset.scroller;
        if (kind === 'body' || kind === 'declared') continue;
        if (isSecondScroller(element, node)) {
            if (kind !== 'undeclared') node.dataset.scroller = 'undeclared';
            if (!watch.told.has(node)) {
                watch.told.add(node);
                tell(element, node);
            }
        } else if (kind === 'undeclared') {
            delete node.dataset.scroller;
        }
    }

    const body = element.querySelector<HTMLElement>(':scope > [data-scroller="body"]');
    // A body dropped (a window back on the canvas) leaves what it held as the host had it.
    if (watch.body && watch.body !== body) giveWay(watch.body, null);
    watch.body = body;
    if (body) {
        const declared = body.querySelector<HTMLElement>('[data-scroller="declared"]');
        giveWay(body, declared ? childHolding(body, declared) : null);
        reach(body, watch.title);
    }

    const scroller = body?.querySelector<HTMLElement>('[data-scroller="declared"]')
        ?? element.querySelector<HTMLElement>('[data-scroller="declared"]')
        ?? body;
    if (watch.dead && watch.dead !== scroller) revive(watch.dead, watch);
    if (scroller) {
        observeWidth(element, scroller, watch);
        dropDeadIfTooWide(element, scroller, watch);
        holdScrollbar(element, scroller);
    } else {
        dropScrollbar(element);
    }
    for (const declared of Array.from(element.querySelectorAll<HTMLElement>('[data-scroller="declared"]'))) {
        reach(declared, watch.title);
    }
}

/**
 * A declared scroller is the element's: the body stops scrolling vertically and
 * makes room for it, a column whose child holding the scroller fills it and is
 * bounded by it — the scroller cannot scroll what nothing bounds, and the body
 * no longer would. From that child down, the host's layout carries the bound.
 * When the scroller goes, the body scrolls again and what was written is taken back.
 */
function giveWay(body: HTMLElement, holder: HTMLElement | null): void {
    const room = rooms.get(body);
    if (room && room.holder === holder) return;
    if (room) {
        room.holder.style.flex = room.holderWas.flex;
        room.holder.style.minHeight = room.holderWas.minHeight;
        body.style.display = room.bodyWas.display;
        body.style.flexDirection = room.bodyWas.flexDirection;
        rooms.delete(body);
    }
    if (!holder) {
        if (body.style.overflowY !== 'auto') body.style.overflowY = 'auto';
        return;
    }
    rooms.set(body, {
        holder,
        holderWas: { flex: holder.style.flex, minHeight: holder.style.minHeight },
        bodyWas: { display: body.style.display, flexDirection: body.style.flexDirection },
    });
    body.style.overflowY = 'hidden';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    holder.style.flex = '1 1 auto';
    holder.style.minHeight = '0px';
}

/** The body's own child that is, or holds, the node. */
function childHolding(body: HTMLElement, node: HTMLElement): HTMLElement {
    let child = node;
    while (child.parentElement && child.parentElement !== body) child = child.parentElement;
    return child;
}

/**
 * A scroller the keyboard cannot reach through anything inside it is a stop of
 * its own, named for its element. Chrome does this for itself since 132;
 * Safari does not. A tabindex the host set is the host's.
 */
function reach(scroller: HTMLElement, title: string): void {
    const given = madeReachable.get(scroller);
    if (!given && scroller.hasAttribute('tabindex')) return;

    const scrolls = scroller.dataset.scroller === 'declared' || scroller.style.overflowY !== 'hidden';
    const needs = scrolls && scroller.querySelector(TAB_STOPS) === null;

    if (needs && !given) {
        const wrote = ['tabindex'];
        scroller.tabIndex = 0;
        if (!scroller.hasAttribute('role')) {
            scroller.setAttribute('role', 'region');
            wrote.push('role');
        }
        if (!scroller.hasAttribute('aria-label') && !scroller.hasAttribute('aria-labelledby')) {
            scroller.setAttribute('aria-label', title);
            wrote.push('aria-label');
        }
        madeReachable.set(scroller, wrote);
    } else if (!needs && given) {
        for (const name of given) scroller.removeAttribute(name);
        madeReachable.delete(scroller);
    }
}

// "what i wanted is for the thing to just drop dead when this happens"
/** Content wider than its scroller: hidden, said, an error, until it fits. Measured, so a test DOM says nothing. */
function dropDeadIfTooWide(element: HTMLElement, scroller: HTMLElement, watch: Watch): void {
    // A grid's tracks and a placed box are what the package's rule cannot outrank (fit.ts): they give way first,
    // and a row that ran out of room wraps, wherever it is, clipped or not.
    wrapRows(scroller);
    evenButtons(scroller);
    bringInside(scroller);
    // Not only when the scroller is too wide: tracks that fill it exactly leave an auto track at nothing.
    loosenGrids(scroller);
    const wide = scroller.scrollWidth;
    const room = scroller.clientWidth;
    if (wide <= room + 1) {
        if (watch.dead === scroller) revive(scroller, watch);
        return;
    }
    const was = deadAt.get(scroller);
    if (watch.dead === scroller && was?.wide === wide && was.room === room) return;

    const past = offenders(scroller);
    const said = `TOO WIDE: ${idOf(element)}: its content is ${wide}px wide in ${room}px, and an element does not scroll sideways. ` +
        `${past.length ? `Past its edge: ${past.join(', ')}. ` : ''}` +
        `It is dead until its content fits: let it wrap, or fit it to the element's width.`;

    ensureTooWideStyle();
    scroller.dataset.tooWide = `${wide}px in ${room}px`;
    deadAt.set(scroller, { wide, room });
    let notice = scroller.querySelector<HTMLElement>(':scope > [data-too-wide-notice]');
    if (!notice) {
        notice = document.createElement('div');
        notice.dataset.tooWideNotice = '';
        notice.setAttribute('role', 'alert');
        scroller.prepend(notice);
    }
    notice.textContent = said;

    // Said once each time it dies, not again for every look while it stays dead.
    if (watch.dead === scroller) return;
    watch.dead = scroller;
    getLogger().error(getLogSegment(), `[Width] ${said}`, {
        element: idOf(element), contentWidth: wide, width: room, past,
    });
}

/** The content fits again, or its scroller is not the element's any more: alive, as the host had it. */
function revive(scroller: HTMLElement, watch: Watch): void {
    scroller.querySelector(':scope > [data-too-wide-notice]')?.remove();
    delete scroller.dataset.tooWide;
    deadAt.delete(scroller);
    if (watch.dead === scroller) watch.dead = null;
}

/** How far right a node's box, or the text it lays out past that box, reaches. */
function reachOf(node: HTMLElement): number {
    const box = node.getBoundingClientRect();
    return Math.max(box.right, box.left + node.scrollWidth);
}

/** The innermost nodes reaching past the scroller's right edge, by their box or by their own text, and by how much. */
function offenders(scroller: HTMLElement): string[] {
    const edge = scroller.getBoundingClientRect().right;
    const past = Array.from(scroller.querySelectorAll<HTMLElement>('*'))
        .filter((node) => !node.closest('[data-too-wide-notice]'))
        .filter((node) => reachOf(node) > edge + 1);
    const innermost = past.filter((node) => !past.some((other) => other !== node && node.contains(other)));
    return innermost.slice(0, 3).map((node) => {
        const by = Math.round(reachOf(node) - edge);
        const text = (node.textContent ?? '').trim().slice(0, 24);
        return `${describe(node)}${text ? ` "${text}"` : ''} by ${by}px`;
    });
}

/** The width an element's scroller has changes with nothing inside it changing; look again when it does. */
function observeWidth(element: HTMLElement, scroller: HTMLElement, watch: Watch): void {
    if (typeof ResizeObserver !== 'function' || watch.resized === scroller) return;
    watch.resize ??= new ResizeObserver(() => { review(element, watch, []); });
    if (watch.resized) watch.resize.unobserve(watch.resized);
    watch.resize.observe(scroller);
    watch.resized = scroller;
}

function ensureTooWideStyle(): void {
    if (document.getElementById(TOO_WIDE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = TOO_WIDE_STYLE_ID;
    style.textContent = TOO_WIDE_STYLE;
    document.head.appendChild(style);
}

function tell(element: HTMLElement, node: HTMLElement): void {
    const holder = node.parentElement?.closest<HTMLElement>('[data-scroller]');
    const where = holder && element.contains(holder)
        ? holder.dataset.scroller === 'body' ? 'inside its body, which already scrolls' : `inside ${describe(holder)}, which already scrolls`
        : 'and nothing declared it';
    getLogger().warn(
        getLogSegment(),
        `[Scroll] ${idOf(element)}: ${describe(node)} scrolls vertically ${where}. ` +
        `If it is this element's scroller, declareScroller() it and the body stops scrolling; if not, take its overflow away and let the body scroll.`,
        { element: idOf(element), node: describe(node) },
    );
}

function isSecondScroller(element: HTMLElement, node: HTMLElement): boolean {
    if (node === element || SCROLLS_ITSELF.has(node.tagName)) return false;
    const kind = node.dataset.scroller;
    if (kind === 'body' || kind === 'declared') return false;
    return scrollsVertically(node);
}

function scrollsVertically(node: HTMLElement): boolean {
    const computed = window.getComputedStyle(node);
    // A browser always resolves the longhand; a test DOM may leave only what was written.
    const y = computed.overflowY || node.style.overflowY || secondOf(computed.overflow || node.style.overflow);
    return y === 'auto' || y === 'scroll';
}

/** overflow: x y — or one value for both. */
function secondOf(shorthand: string): string {
    const parts = shorthand.split(' ').filter((part) => part !== '');
    return parts[1] ?? parts[0] ?? '';
}

/** A change to the package's bar, or the bar coming and going. */
function isBar(record: MutationRecord): boolean {
    if (record.type === 'attributes') return (record.target as HTMLElement).dataset?.scrollbar !== undefined;
    const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)];
    return nodes.length > 0 && nodes.every((node) => (node as HTMLElement).dataset?.scrollbar !== undefined);
}

function changedBy(records: MutationRecord[]): HTMLElement[] {
    const changed: HTMLElement[] = [];
    for (const record of records) {
        if (record.type === 'attributes') {
            changed.push(record.target as HTMLElement);
            continue;
        }
        for (const added of Array.from(record.addedNodes)) {
            if (added.nodeType !== 1) continue;
            changed.push(added as HTMLElement, ...descendants(added as HTMLElement));
        }
    }
    return changed;
}

function descendants(element: HTMLElement): HTMLElement[] {
    return Array.from(element.querySelectorAll<HTMLElement>('*'));
}

/** Built off the page, an element has no style to read yet: look again once it is placed. */
function waitForPage(element: HTMLElement, watch: Watch): void {
    if (watch.waiting || typeof window.requestAnimationFrame !== 'function') return;
    watch.waiting = true;
    let frames = 0;
    const look = () => {
        if (element.isConnected) {
            watch.waiting = false;
            review(element, watch, descendants(element));
        } else if (++frames < FRAMES_TO_WAIT_FOR_PAGE) {
            window.requestAnimationFrame(look);
        } else {
            watch.waiting = false;
        }
    };
    window.requestAnimationFrame(look);
}

function idOf(element: HTMLElement): string {
    return element.dataset.elementId ?? element.tagName.toLowerCase();
}

function describe(node: HTMLElement): string {
    const classes = Array.from(node.classList).map((name) => `.${name}`).join('');
    return `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${classes}`;
}
