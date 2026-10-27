// Press: Button Form's variation that does what it says, once or in two stages, rather than opens.
// Part of the element it sits in, never a second element in it; why it is built this way is the README's Boundary.

import { preventDrag } from '../canvas/drag';
import { sizeText, TEXT_SIZES, type TextSize } from '../text';
import type { Form } from '../form';

/** What an outline says: yes is green, no is red, neither is white. The approvals' options wear it too. */
export const MEANS: Readonly<{ yes: '#16a34a'; no: '#dc2626'; neither: '#fff' }> = Object.freeze({ yes: '#16a34a', no: '#dc2626', neither: '#fff' } as const);

import { AX } from './ax';
export { AX };

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
    /** What the second press does, said beside the press once armed, after the word again. */
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
    /** Held back, and why: pressed, it says why beside it. null lets it be pressed again. */
    hold: (why: string | null) => void;
}

// "foutmeding at the inputfield makes sense for example"

/** What a press could not do because of a field: thrown from does, it is said at that field. */
export class AtField extends Error {
    constructor(readonly field: HTMLElement, message: string) {
        super(message);
        this.name = 'AtField';
    }
}

/** Each saying's own id, for the field it is said at to point to. */
let sayings = 0;

// "I just want a preselection of sizes"
//
// A press is one of these boxes, and nothing in it decides how big it is: not its title, not what
// it is doing, not what it will say. Which box is the package's to pick, by the form the press
// stands in. Its title is held to two lines of it.

/** px: every box a press can be. Two small ones side by side fit a window on a 390px phone (80% of it, less its padding). */
export const PRESS_SIZES: Readonly<{
    sm: { readonly width: 136; readonly height: 52 };
    md: { readonly width: 176; readonly height: 52 };
    lg: { readonly width: 208; readonly height: 60 };
}> = Object.freeze({
    sm: Object.freeze({ width: 136, height: 52 } as const),
    md: Object.freeze({ width: 176, height: 52 } as const),
    lg: Object.freeze({ width: 208, height: 60 } as const),
});

/** A box from the set. */
export type PressSize = keyof typeof PRESS_SIZES;

/** Which box a press is, by the form of the element it stands in; null is no element, the bare page. */
const SIZE_IN: Readonly<Record<Form, PressSize>> = Object.freeze({
    dot: 'sm',
    proximity: 'sm',
    window: 'sm',
    panel: 'md',
    workspace: 'md',
    canvasPlaced: 'sm',
    canvasExpanded: 'md',
    cursor: 'sm',
    tooltip: 'sm',
    button: 'sm',
});

/** The box a press is in a form, or on the bare page. */
export function pressSizeFor(form: Form | null): PressSize {
    return form === null ? 'lg' : SIZE_IN[form];
}

const SIZE_RULE_ID = 'elements-press-size';

const boxed = (size: PressSize) =>
    `width: ${PRESS_SIZES[size].width}px !important; height: ${PRESS_SIZES[size].height}px !important;`;

// Layered and important, as text sizes are: no host stylesheet or style attribute sizes a press.
// The bare page first, then the wide forms, then the narrow: a press in a window on a workspace is
// the window's, the later rule of two that both match.
const SIZE_RULE = `@layer elements {
[data-press] { box-sizing: border-box !important; ${boxed('lg')} min-height: 0 !important; max-height: none !important; padding: 0 8px !important; margin: 0 !important; flex: none !important; overflow: hidden !important; }
${(['md', 'sm'] as const).map((size) => {
    const forms = (Object.keys(SIZE_IN) as Form[]).filter((form) => SIZE_IN[form] === size);
    return `${forms.map((form) => `[data-form="${form}"] [data-press]`).join(', ')} { ${boxed(size)} }`;
}).join('\n')}
}`;

/** The boxes, in the page once. */
function holdPressSizes(): void {
    if (document.getElementById(SIZE_RULE_ID)) return;
    const style = document.createElement('style');
    style.id = SIZE_RULE_ID;
    style.textContent = SIZE_RULE;
    document.head.appendChild(style);
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

// The title and its doing share the box's one cell; the one not shown is unseen.
function face(name: string, text: string): HTMLSpanElement {
    const span = document.createElement('span');
    span.dataset.face = name;
    span.textContent = text;
    pin(span, { display: 'block', 'grid-area': '1 / 1', margin: '0', padding: '0', 'line-height': '1.3' });
    return span;
}

/** A press, to put where a button goes. */
export function pressFrom(press: Press): PressHandle {
    refuse(press);
    holdPressSizes();
    const two = press.again !== undefined;

    const element = document.createElement('button');
    element.type = 'button';
    // No form of its own: setForm would hold its text as an element's, and a press is part of one.
    element.dataset.press = press.id;
    // Square, a 2px outline, on whatever surface it stands on. Its box is PRESS_SIZES', from the page's rule.
    // Positioned, so the bar that runs out sits on its foot.
    pin(element, {
        display: 'inline-grid',
        'justify-items': 'center',
        'align-items': 'center',
        'text-align': 'center',
        'vertical-align': 'top',
        position: 'relative',
        'border-width': '2px',
        'border-style': 'solid',
        'border-radius': '2px',
        'font-family': 'var(--font-mono, monospace)',
        'font-weight': 'normal',
        'touch-action': 'manipulation',
    });
    preventDrag(element);

    const title = face('title', press.title);
    sized(title, 'lg');
    // Two lines of the title at most: a box from the set is never made bigger by what it says.
    pin(title, { 'max-height': '2.6em', overflow: 'hidden', 'overflow-wrap': 'anywhere' });
    if (press.mark !== undefined) {
        title.replaceChildren(press.mark);
        element.setAttribute('aria-label', press.title);
    }
    // Drawn, not written: what the press says stays its title.
    const doing = face('doing', '');
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

    // "To be clear that you're arming the button and can then press to confirm": armed, it is
    // filled, a bar runs out across its foot while it waits, and beside it is said what the second does.
    let runsOut: HTMLSpanElement | null = null;
    if (two) {
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
        element.appendChild(runsOut);
    }

    let stage: Stage = 'rest';
    let held: string | null = null;
    let disarm: ReturnType<typeof setTimeout> | undefined;
    let said: HTMLElement | null = null;
    let again: HTMLElement | null = null;

    const seen = (node: HTMLElement, shown: boolean) => pin(node, { visibility: shown ? 'visible' : 'hidden' });

    // Beside the press, never in it.
    const beside = (text: string, color: string): HTMLElement => {
        const line = document.createElement('div');
        line.textContent = text;
        sizeText(line, 'sm');
        pin(line, { 'font-family': 'var(--font-mono)', color, 'user-select': 'text' });
        element.after(line);
        return line;
    };

    const show = () => {
        element.dataset.stage = stage;
        seen(title, stage !== 'doing');
        seen(doing, stage === 'doing');
        if (stage === 'armed' && again === null) {
            again = beside(`again: ${(press as TwoPress).again}`, MEANS.neither);
            again.dataset.pressAgain = press.id;
        } else if (stage !== 'armed' && again !== null) {
            again.remove();
            again = null;
        }
        // The ax element's at rest whatever it does. Armed it is filled with what its outline says: its ink,
        // red only when the second press cannot be undone, green and shimmering only when it creates.
        const lit = stage === 'armed';
        const red = lit && press.irrevocable === true;
        const green = lit && press.creates === true;
        const shimmers = green && !stillness();
        if (lit && !stillness()) holdKeyframes();
        if (runsOut) {
            seen(runsOut, lit);
            pin(runsOut, { 'animation-name': lit && !stillness() ? RUNS_OUT : 'none' });
        }
        pin(element, {
            'border-color': red ? MEANS.no : green ? CREATES.green : lit ? AX.ink : AX.frame,
            color: red ? MEANS.neither : green ? CREATES.ink : lit ? '#000' : AX.ink,
            'background-color': red ? MEANS.no : green ? CREATES.green : lit ? AX.ink : AX.ground,
            'background-image': shimmers ? `linear-gradient(110deg, ${CREATES.green} 0%, ${CREATES.light} 40%, ${CREATES.green} 60%, ${CREATES.light} 100%)` : 'none',
            'background-size': '200% 100%',
            'animation-name': shimmers ? SHIMMER : 'none',
            'animation-duration': '1.2s',
            'animation-timing-function': 'linear',
            'animation-iteration-count': 'infinite',
            opacity: held === null ? '1' : '0.4',
        });
        // Never disabled: a disabled button takes no focus, and says nothing of why.
        element.setAttribute('aria-disabled', String(held !== null));
        element.setAttribute('aria-busy', String(stage === 'doing'));
    };

    // The field a failure was said at, and what it pointed to before.
    let misfilled: { field: HTMLElement; describedBy: string | null } | null = null;

    // Beside the press, not in it: what failed never changes the press's size. At the field, when it is a field's.
    const say = (err: unknown) => {
        said = beside(err instanceof Error ? err.message : String(err), MEANS.no);
        said.dataset.pressSaid = press.id;
        said.id = `elements-press-said-${++sayings}`;
        said.setAttribute('role', 'alert');
        if (err instanceof AtField) {
            misfilled = { field: err.field, describedBy: err.field.getAttribute('aria-describedby') };
            err.field.setAttribute('aria-invalid', 'true');
            err.field.setAttribute('aria-describedby', misfilled.describedBy === null ? said.id : `${misfilled.describedBy} ${said.id}`);
            err.field.after(said);
        }
    };

    const unsay = () => {
        said?.remove();
        said = null;
        if (misfilled === null) return;
        misfilled.field.removeAttribute('aria-invalid');
        if (misfilled.describedBy === null) misfilled.field.removeAttribute('aria-describedby');
        else misfilled.field.setAttribute('aria-describedby', misfilled.describedBy);
        misfilled = null;
    };

    const pressed = async () => {
        if (stage === 'doing') return;
        unsay();
        if (held !== null) {
            say(held);
            return;
        }
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
            stage = 'rest';
            show();
            say(err);
            return;
        }
        stage = 'rest';
        show();
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
