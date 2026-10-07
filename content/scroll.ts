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
 */

import { getLogger, getLogSegment } from '../config';

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
}

const watches = new WeakMap<HTMLElement, Watch>();

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
}

/**
 * Watch where an element scrolls, now and whenever its content changes. One
 * watch per element (AXIOMAS.md, Element Axioma): watching again looks again,
 * under the title given.
 */
export function watchScroll(element: HTMLElement, title: string): void {
    let watch = watches.get(element);
    if (!watch) {
        const fresh: Watch = { title, observer: null, told: new WeakSet(), waiting: false, body: null };
        if (typeof MutationObserver === 'function') {
            fresh.observer = new MutationObserver((records) => {
                // A drag or a morph writing the element's own style every frame changes nothing inside it.
                if (records.every((record) => record.type === 'attributes' && record.target === element)) return;
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
