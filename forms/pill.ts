/**
 * Pill Form — an element resting as a pill in an input field.
 *
 * "Why doesn't it behave like an element form? Not as an overlay, but as a generalised 'pills above inputfields'
 * form?" "In elemental form, everything has an answer." "The input field pill should be inside of inputfield form, and
 * it taking focus should let kb stay in place." At rest it is a pill in its field's row, saying its title. Pressed, it
 * is the same element across that row (pillOpen), what it holds in it, while what else is in the row stands aside;
 * the field stays where it is: "I want inputfield to still be there". Let go (rest, Escape, a press outside), it goes
 * back to where it rested. A press on it never takes the focus from the field, so the keyboard stays.
 *
 * Where it rests while it is away is a gap, as Button Form's is: no id, no form (Element Axioma). Its road there and
 * back is Button Form's road, box to box (morph-transaction.ts). Its shape at rest and open is the package's
 * (fit.ts); what it looks like is the host's.
 */

import { type Element, getRestDuration } from '../element';
import { setForm, getForm, setElementId } from '../dataset';
import { stashContent, restoreContent } from '../content/stash';
import { beginMorphToButton, type TooltipBox } from '../morph-transaction';
import { getLogger, getLogSegment } from '../config';
import { raise } from '../window/z-order';

/** What a pill tells itself when it rests again: whoever shows it looks again (content/say.ts). */
export const PILL_RESTED = 'elements:pill-rested';

export interface PillHandle {
    element: HTMLElement;
    /** What it says at rest, from now on. */
    retitle(title: string): void;
    /** Lets it go: back to where it rested. */
    rest(): void;
}

/** The field each pill is in, said by whoever puts it there (content/say.ts). */
const fields = new WeakMap<HTMLElement, HTMLElement>();

/** Says which field this pill is in: the one that keeps the words, and the keyboard, while it is pressed. */
export function pillIn(pill: HTMLElement, field: HTMLElement): void {
    fields.set(pill, field);
}

/** Whether a pill is pressed open, or on its way. */
export function pillAway(pill: HTMLElement): boolean {
    return getForm(pill) === 'pillOpen' || pill.dataset.pillMoving === '';
}

/** What else is in the row, and how it was shown, while the pill is across it. */
type Aside = { node: HTMLElement; display: string; priority: string }[];

function boxOf(el: HTMLElement): TooltipBox {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
}

/**
 * Where it is now, held by the body of the element it rests in, so the road starts there and it stays that element's
 * all the way: what the package says of what is in an element still says it of this (fit.ts, text.ts).
 */
function lift(element: HTMLElement, at: TooltipBox, field: HTMLElement): void {
    const holder = field.closest<HTMLElement>('[data-scroller="body"], [data-scroller="declared"]') ?? element.ownerDocument.body;
    holder.appendChild(element);
    element.style.cssText = '';
    element.style.position = 'fixed';
    element.style.boxSizing = 'border-box';
    element.style.overflow = 'hidden';
    element.style.left = `${at.x}px`;
    element.style.top = `${at.y}px`;
    element.style.width = `${at.width}px`;
    element.style.height = `${at.height}px`;
    // In front while it moves, as Button Form's element is: the element it rests in is in front of the page.
    raise(element);
}

export function pillFrom(item: Element): PillHandle {
    const log = getLogger();
    const seg = getLogSegment();
    const element = document.createElement('div');
    setElementId(element, item.id);

    // What it says, one node for its whole life (Element Axioma).
    const label = document.createElement('span');
    label.dataset.pillLabel = '';
    let title = item.title;

    let gap: HTMLElement | null = null;
    let restsAs = { width: 0, height: 0 };
    let aside: Aside | null = null;

    const say = () => {
        label.textContent = title;
        element.setAttribute('aria-label', title);
        element.setAttribute('aria-expanded', String(getForm(element) === 'pillOpen'));
    };

    /** At rest: its words, pressable, nothing else. */
    const resting = () => {
        element.style.cssText = '';
        delete element.dataset.pillMoving;
        label.remove();
        if (element.firstChild) stashContent(element);
        element.appendChild(label);
        element.setAttribute('role', 'button');
        element.tabIndex = 0;
        setForm(element, 'pill');
        say();
    };

    const outside = (e: Event) => { if (!element.contains(e.target as Node)) rest(); };

    const open = () => {
        if (getForm(element) !== 'pill' || element.dataset.pillMoving === '') return;
        const field = fields.get(element);
        const place = element.parentElement;
        if (!field?.isConnected || !place) return;
        const at = boxOf(element);
        const to = boxOf(place);
        restsAs = { width: at.width, height: at.height };

        // Where it rests, kept while it is away, and folded: it is across the row.
        gap = document.createElement('div');
        gap.dataset.pillGap = '';
        gap.style.display = 'none';
        element.before(gap);
        lift(element, at, field);
        element.removeAttribute('role');
        element.removeAttribute('tabindex');

        // What it holds travels with it from the first frame: drawn once, kept after.
        label.remove();
        if (!restoreContent(element)) element.appendChild(item.renderContent());
        setForm(element, 'pillOpen');
        element.dataset.pillMoving = '';
        say();

        // What else is in the row stands aside while it is across it; the field is not in the row, and stays.
        aside = Array.from(place.children).filter((n): n is HTMLElement => n instanceof HTMLElement && n !== gap)
            .map((node) => ({ node, display: node.style.getPropertyValue('display'), priority: node.style.getPropertyPriority('display') }));
        // Unseen, keeping their room while it moves: the input field keeps its size, and the words theirs.
        for (const { node } of aside) node.style.setProperty('visibility', 'hidden');
        beginMorphToButton(element, at, to, getRestDuration())
            .then(() => {
                delete element.dataset.pillMoving;
                // Across the row, in the flow; what else was in it stands aside.
                element.style.cssText = '';
                for (const { node } of aside ?? []) {
                    node.style.removeProperty('visibility');
                    node.style.setProperty('display', 'none', 'important');
                }
                gap?.after(element);
                element.ownerDocument.addEventListener('pointerdown', outside, true);
            })
            .catch((err: unknown) => {
                delete element.dataset.pillMoving;
                for (const { node } of aside ?? []) node.style.removeProperty('visibility');
                log.warn(seg, `[Pill ${item.id}] The road across its row was abandoned: ${err instanceof Error ? err.message : String(err)}`);
            });
    };

    function rest(): void {
        if (getForm(element) !== 'pillOpen' || element.dataset.pillMoving === '' || !gap || !aside) return;
        element.ownerDocument.removeEventListener('pointerdown', outside, true);
        const field = fields.get(element)!;
        const from = boxOf(element);
        lift(element, from, field);
        for (const { node, display, priority } of aside) {
            if (display) node.style.setProperty('display', display, priority);
            else node.style.removeProperty('display');
        }
        aside = null;

        // Where it rests, as big as it was there.
        gap.style.display = 'inline-block';
        gap.style.width = `${restsAs.width}px`;
        gap.style.height = `${restsAs.height}px`;
        const to = boxOf(gap);
        setForm(element, 'pill');
        element.dataset.pillMoving = '';

        beginMorphToButton(element, from, to, getRestDuration())
            .then(() => {
                resting();
                gap?.replaceWith(element);
                gap = null;
                // Choosing was part of saying something: the field has the words, if anything took them.
                const field = fields.get(element);
                if (field && field.ownerDocument.activeElement !== field) field.focus();
                element.dispatchEvent(new (element.ownerDocument.defaultView ?? window).Event(PILL_RESTED));
            })
            .catch((err: unknown) => {
                delete element.dataset.pillMoving;
                log.warn(seg, `[Pill ${item.id}] The road back to where it rests was abandoned: ${err instanceof Error ? err.message : String(err)}`);
            });
    }

    // "it taking focus should let kb stay in place": a press on it, or on what it holds, takes no focus from the field.
    const keepFocus = (e: Event) => { if (fields.has(element)) e.preventDefault(); };
    element.addEventListener('pointerdown', keepFocus);
    element.addEventListener('mousedown', keepFocus);
    element.addEventListener('click', (e) => {
        if (getForm(element) === 'pill') { e.preventDefault(); open(); }
    });
    element.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape') { rest(); return; }
        if (getForm(element) !== 'pill' || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        open();
    });

    resting();
    return {
        element,
        retitle(next: string) { title = next; say(); },
        rest,
    };
}
