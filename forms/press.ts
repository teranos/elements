// Press: Button Form's variation that does what it says, once or in two stages, rather than opens.
// Part of the element it sits in, never a second element in it; why it is built this way is the README's Boundary.

import { preventDrag } from '../canvas/drag';
import { sizeText, TEXT_SIZES, type TextSize } from '../text';

/** What an outline says: yes is green, no is red, neither is white. The approvals' options wear it too. */
export const MEANS: Readonly<{ yes: '#16a34a'; no: '#dc2626'; neither: '#fff' }> = Object.freeze({ yes: '#16a34a', no: '#dc2626', neither: '#fff' } as const);

/** How long an armed press waits for its second press before it is at rest again. */
export const ARMED_FOR_MS = 5000;

interface Said {
    /** Its name: data-press, and what a failure beside it is said for. */
    id: string;
    /** What it says. With a mark, its name, read out and not shown. */
    title: string;
    /** Worn instead of the title's words: a drawn mark, or a glyph. */
    mark?: SVGSVGElement | string;
    /** What a press does. A throw is said beside the press. */
    does: () => void | Promise<void>;
}

/** One press does it. It cannot be irrevocable, or create: that is a second stage's to say. */
export interface OnePress extends Said {
    again?: never;
    irrevocable?: never;
    creates?: never;
    armedForMs?: never;
}

/** The first press arms and says what the second does; the second does it. */
interface Second extends Said {
    /** What the second press does, said under the title once armed, after the word again. */
    again: string;
    /** Default ARMED_FOR_MS. */
    armedForMs?: number;
}

/** The second press can be undone: armed, it stays white. */
export interface UndoablePress extends Second {
    irrevocable?: never;
    creates?: never;
}

/** The second press cannot be undone: armed, it is red. */
export interface IrrevocablePress extends Second {
    irrevocable: true;
    creates?: never;
}

/** The second press creates something: armed, it is green and shimmers. */
export interface CreatingPress extends Second {
    creates: true;
    irrevocable?: never;
}

export type TwoPress = UndoablePress | IrrevocablePress | CreatingPress;

export type Press = OnePress | TwoPress;

export interface PressHandle {
    element: HTMLButtonElement;
    /** Held back, and why; null lets it be pressed again. */
    hold: (why: string | null) => void;
}

type Stage = 'rest' | 'armed' | 'doing';

const KEYS = new Set(['id', 'title', 'mark', 'does', 'again', 'irrevocable', 'creates', 'armedForMs']);

/** Armed to create: the green it shimmers between. */
export const CREATES: Readonly<{ green: '#4ade80'; light: '#86efac'; ink: '#0b1a0f' }> = Object.freeze({ green: '#4ade80', light: '#86efac', ink: '#0b1a0f' } as const);

const SHIMMER = 'elements-press-shimmer';
const RUNS_OUT = 'elements-press-runs-out';

/** The shimmer's and the bar's keyframes, in the page once: an inline style can name an animation but not hold one. */
function holdKeyframes(): void {
    if (document.getElementById(SHIMMER)) return;
    const style = document.createElement('style');
    style.id = SHIMMER;
    style.textContent = `@keyframes ${SHIMMER} { from { background-position: 200% 0; } to { background-position: 0 0; } }`
        + ` @keyframes ${RUNS_OUT} { from { transform: scaleX(1); } to { transform: scaleX(0); } }`;
    document.head.appendChild(style);
}

const stillness = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** What a caller with no types is stopped on, where the compiler stops a typed one. */
function refuse(press: Press): void {
    const said = press as unknown as Record<string, unknown>;
    const unknown = Object.keys(said).filter((key) => !KEYS.has(key));
    if (unknown.length) throw new TypeError(`a press has no ${unknown.join(', ')}; it says ${[...KEYS].join(', ')}`);
    if (typeof said.id !== 'string' || !said.id) throw new TypeError('a press has a name: its id');
    if (typeof said.title !== 'string' || !said.title) throw new TypeError(`press ${said.id} says nothing: it has no title`);
    if (typeof said.does !== 'function') throw new TypeError(`press ${said.id} does nothing`);
    if ('again' in said && (typeof said.again !== 'string' || !said.again)) {
        throw new TypeError(`press ${said.id}: a second stage says what it does`);
    }
    if (said.irrevocable !== undefined && !('again' in said)) {
        throw new TypeError(`press ${said.id}: a single press cannot be irrevocable; that is a second stage's to say`);
    }
    if (said.creates !== undefined && !('again' in said)) {
        throw new TypeError(`press ${said.id}: a single press cannot create; that is a second stage's to say`);
    }
    if (said.creates !== undefined && said.irrevocable !== undefined) {
        throw new TypeError(`press ${said.id}: a second press creates, or cannot be undone, not both`);
    }
}

// Written important on the node itself: no stylesheet, layered or not, says otherwise.
function pin(node: HTMLElement, styles: Record<string, string>): void {
    for (const [name, value] of Object.entries(styles)) node.style.setProperty(name, value, 'important');
}

// Outside any element no rule of the package's sizes text, so a face says its size itself too.
function sized(node: HTMLElement, size: TextSize): void {
    sizeText(node, size);
    pin(node, { 'font-size': `${TEXT_SIZES[size]}px` });
}

// Every face shares the press's grid from birth; one not shown is unseen, never taken out.
function face(name: string, text: string, row: number): HTMLSpanElement {
    const span = document.createElement('span');
    span.dataset.face = name;
    span.textContent = text;
    pin(span, { display: 'block', 'grid-row': String(row), 'grid-column': '1', margin: '0', padding: '0', 'line-height': 'inherit' });
    return span;
}

/** A press, to put where a button goes. */
export function pressFrom(press: Press): PressHandle {
    refuse(press);
    const two = press.again !== undefined;

    const element = document.createElement('button');
    element.type = 'button';
    // No form of its own: setForm would hold its text as an element's, and a press is part of one.
    element.dataset.press = press.id;
    // Square, a 2px outline, on whatever surface it stands on: "how discordant the black button is
    // compared to everything else". Positioned, so the bar that runs out sits on its foot.
    pin(element, {
        'box-sizing': 'border-box',
        display: 'inline-grid',
        'justify-items': 'center',
        'align-content': 'center',
        'min-height': '44px',
        padding: '8px 12px',
        'border-width': '2px',
        'border-style': 'solid',
        'border-radius': '0',
        'font-family': 'inherit',
        'font-weight': 'normal',
        'line-height': '1.3',
        'touch-action': 'manipulation',
        position: 'relative',
        'background-color': 'transparent',
    });
    preventDrag(element);

    const title = face('title', press.title, 1);
    sized(title, 'lg');
    if (press.mark !== undefined) {
        title.replaceChildren(press.mark);
        element.setAttribute('aria-label', press.title);
    }
    // Drawn, not written: what the press says stays its title and its note.
    const doing = face('doing', '', 1);
    sized(doing, 'lg');
    doing.setAttribute('aria-hidden', 'true');
    pin(doing, {
        width: '3ch',
        height: '1.3em',
        'font-family': 'var(--font-mono)',
        'background-image': 'radial-gradient(circle, currentColor 0.12em, transparent 0.14em)',
        'background-size': '1ch 100%',
        'background-repeat': 'repeat-x',
    });
    element.append(title, doing);

    // "To be clear that you're arming the button and can then press to confirm": at rest a two-stage
    // press says it takes two, armed it says what the second does, and a bar runs out while it waits.
    let twice: HTMLSpanElement | null = null;
    let armed: HTMLSpanElement | null = null;
    let runsOut: HTMLSpanElement | null = null;
    if (two) {
        twice = face('twice-note', 'press twice', 2);
        armed = face('armed-note', `again: ${press.again}`, 2);
        for (const note of [twice, armed]) {
            sized(note, 'sm');
            pin(note, { 'font-family': 'var(--font-mono)' });
        }
        // Out of the grid, so it never sizes the press.
        runsOut = document.createElement('span');
        runsOut.dataset.pressRunsOut = '';
        runsOut.setAttribute('aria-hidden', 'true');
        pin(runsOut, {
            position: 'absolute',
            left: '0',
            right: '0',
            bottom: '0',
            height: '3px',
            'transform-origin': 'left',
            'background-color': 'currentColor',
            'animation-duration': `${(press as TwoPress).armedForMs ?? ARMED_FOR_MS}ms`,
            'animation-timing-function': 'linear',
            'animation-fill-mode': 'forwards',
        });
        element.append(twice, armed, runsOut);
    }

    let stage: Stage = 'rest';
    let held: string | null = null;
    let disarm: ReturnType<typeof setTimeout> | undefined;
    let said: HTMLElement | null = null;

    const seen = (node: HTMLElement, shown: boolean) => pin(node, { visibility: shown ? 'visible' : 'hidden' });

    const show = () => {
        element.dataset.stage = stage;
        seen(title, stage !== 'doing');
        seen(doing, stage === 'doing');
        if (twice) seen(twice, stage !== 'armed');
        if (armed) seen(armed, stage === 'armed');
        // White at rest whatever it does. Armed it is filled with what its outline says: white,
        // red only when the second press cannot be undone, green and shimmering only when it creates.
        const lit = stage === 'armed';
        const red = lit && press.irrevocable === true;
        const green = lit && press.creates === true;
        const shimmers = green && !stillness();
        if (shimmers || (lit && !stillness())) holdKeyframes();
        if (runsOut) {
            seen(runsOut, lit);
            pin(runsOut, { 'animation-name': lit && !stillness() ? RUNS_OUT : 'none' });
        }
        pin(element, {
            'border-color': red ? MEANS.no : green ? CREATES.green : MEANS.neither,
            color: red ? MEANS.neither : green ? CREATES.ink : lit ? '#000' : MEANS.neither,
            'background-color': red ? MEANS.no : green ? CREATES.green : lit ? MEANS.neither : 'transparent',
            'background-image': shimmers ? `linear-gradient(110deg, ${CREATES.green} 0%, ${CREATES.light} 40%, ${CREATES.green} 60%, ${CREATES.light} 100%)` : 'none',
            'background-size': '200% 100%',
            'animation-name': shimmers ? SHIMMER : 'none',
            'animation-duration': '1.2s',
            'animation-timing-function': 'linear',
            'animation-iteration-count': 'infinite',
            opacity: held === null ? '1' : '0.4',
        });
        element.disabled = stage === 'doing' || held !== null;
        element.setAttribute('aria-busy', String(stage === 'doing'));
    };

    // Beside the press, not in it: what failed never changes the press's size.
    const say = (err: unknown) => {
        said = document.createElement('div');
        said.dataset.pressSaid = press.id;
        said.textContent = err instanceof Error ? err.message : String(err);
        sizeText(said, 'sm');
        pin(said, { 'font-family': 'var(--font-mono)', color: MEANS.no, 'user-select': 'text' });
        element.after(said);
    };

    const pressed = async () => {
        if (stage === 'doing' || held !== null) return;
        said?.remove();
        said = null;
        if (two && stage === 'rest') {
            stage = 'armed';
            show();
            const ms = (press as TwoPress).armedForMs ?? ARMED_FOR_MS;
            disarm = setTimeout(() => {
                if (stage !== 'armed') return;
                stage = 'rest';
                show();
            }, ms);
            return;
        }
        clearTimeout(disarm);
        stage = 'doing';
        show();
        try {
            await press.does();
        } catch (err) {
            say(err);
        } finally {
            stage = 'rest';
            show();
        }
    };

    element.addEventListener('click', () => { void pressed(); });

    show();
    return {
        element,
        hold: (why) => {
            held = why;
            if (why === null) element.removeAttribute('title');
            else element.title = why;
            show();
        },
    };
}
