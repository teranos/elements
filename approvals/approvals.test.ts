// Approvals: what waits on a human, shown as a list to go through. Every press
// sends, and the other option sends again. What the host decides with them is
// the host's.
// Personas: Tim (options shown, a press sends, the roll's order),
// Spike (checks running or failed, a step that settles now, a press that sends
// nothing), Jenny (the PR story: merge, force, cancel, main's CI done).

import { describe, test, expect, beforeEach, beforeAll } from 'bun:test';
import { renderApprovals } from './approvals';
import { HELD } from '../forms/press';
import type { Approval, ApprovalHost, ApprovalRoll } from './approvals';

const realm = () => globalThis.window as unknown as { HTMLCanvasElement: typeof HTMLCanvasElement };

beforeAll(() => {
    // Neither test DOM draws: a press breaks nothing off and says so quietly.
    realm().HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
});

const text = (s: string) => {
    const el = document.createElement('div');
    el.textContent = s;
    return el;
};

let pressed: string[];
let roll: ApprovalRoll;

const host: ApprovalHost = {
    pressed: (approval, option, step) => { pressed.push(`${approval.title}: ${option.label} → ${step.says}`); },
};

const yesNo = (title: string, arrivedMinutesAgo = 1, more: Partial<Approval> = {}): Approval => ({
    title,
    arrivedMinutesAgo,
    context: () => text(title),
    options: [{ label: 'Yes', means: 'yes' }, { label: 'No', means: 'no' }],
    ...more,
});

const merge = (title: string, more: Partial<Approval> = {}): Approval => ({
    title,
    link: { label: 'GitHub', href: 'https://github.com/teranos/elements/pull/29' },
    arrivedMinutesAgo: 3,
    context: () => text(title),
    options: [
        { label: 'Merge', means: 'yes', steps: [{ says: 'merge when main CI passes', settles: 'when-ready' }, { says: 'force merge', settles: 'now' }] },
        { label: 'Don’t merge', means: 'no', steps: [{ says: 'cancel the merge' }, { says: 'definitely no' }] },
    ],
    merges: { label: 'main CI' },
    checks: [{ name: 'TypeScript', state: 'done' }, { name: 'Browser', state: 'done' }],
    ...more,
});

/** JSDOM says a colour back as rgb(); happy-dom as it was set. Either is the colour. */
const isColor = (got: string, hex: string): boolean => {
    const n = parseInt(hex.slice(1), 16);
    const rgb = hex.length === 4
        ? `rgb(${[0, 1, 2].map((i) => parseInt(hex[i + 1]! + hex[i + 1]!, 16)).join(', ')})`
        : `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    return got.includes(hex) || got.includes(rgb);
};

const buttons = (card: HTMLElement) => Array.from(card.querySelectorAll<HTMLButtonElement>('button'));
// An option is named by its label, whether it shows it as words or draws its mark.
const button = (card: HTMLElement, label: string) => buttons(card).find((b) => b.getAttribute('aria-label') === label)!;
/** Whether it shows it is waiting: its spinner, there always, shown or not. */
const spinning = (btn: HTMLButtonElement) => btn.querySelector<HTMLElement>('[data-waiting]')!.style.display !== 'none';
const note = (btn: HTMLButtonElement) => btn.querySelector<HTMLElement>('[data-note]')!.textContent;
const titles = () => Array.from(roll.body.querySelectorAll('section')).map((s) => s.querySelector('[data-title]')!.textContent);

beforeEach(() => {
    document.body.innerHTML = '';
    pressed = [];
    roll = renderApprovals(host);
    document.body.appendChild(roll.body);
});

describe('Tim: every option visible, a press sends, the roll in order', () => {
    test('every option is a button; yes is green, no is red, neither is white', () => {
        const { card } = roll.add(yesNo('Raise the interval', 1, { options: [{ label: 'Yes', means: 'yes' }, { label: 'No', means: 'no' }, { label: 'Later' }] }));
        expect(buttons(card).map((b) => b.getAttribute('aria-label'))).toEqual(['Yes', 'No', 'Later']);
        expect(isColor(button(card, 'Yes').style.border, '#16873c')).toBe(true);
        expect(isColor(button(card, 'No').style.border, '#d93636')).toBe(true);
        expect(isColor(button(card, 'Later').style.border, '#fff')).toBe(true);
    });

    test('a press sends, and fills the button with its colour', () => {
        const { card } = roll.add(yesNo('Raise the interval'));
        button(card, 'Yes').click();
        expect(pressed).toEqual(['Raise the interval: Yes → Yes']);
        expect(isColor(button(card, 'Yes').style.background, '#16873c')).toBe(true);
        expect(isColor(button(card, 'No').style.background, '#000')).toBe(true);
    });

    test('the other option sends again; the same one says its next step', () => {
        const { card } = roll.add(merge('Merge PR #29'));
        button(card, 'Merge').click();
        button(card, 'Don’t merge').click();
        button(card, 'Don’t merge').click();
        expect(pressed).toEqual([
            'Merge PR #29: Merge → merge when main CI passes',
            'Merge PR #29: Don’t merge → cancel the merge',
            'Merge PR #29: Don’t merge → definitely no',
        ]);
    });

    test('the most recent undecided one goes first, and the end of the roll is last', () => {
        roll.add(yesNo('Older', 40));
        roll.add(yesNo('Newest', 1));
        roll.add(yesNo('Middle', 12));
        roll.settle();
        expect(titles()).toEqual(['Newest', 'Middle', 'Older']);
        expect(roll.body.lastElementChild!.textContent).toBe('Nothing left to decide.');
    });
});

describe('Tim: the checks button is named, and nothing is written over its checks', () => {
    // "I don't want to see any piece of text ui that has lines behind it."
    test('the button that holds the checks is named by its link, and shows no text over the segments', () => {
        roll.add(merge('Codevault', { link: { label: 'codevault', href: 'https://github.com/teranos/elements/pull/29' }, checks: [{ name: 'TypeScript', state: 'running' }] }));
        const checks = roll.body.querySelector<HTMLElement>('[role="button"][aria-expanded]')!;
        expect(checks.getAttribute('aria-label')).toBe('codevault');
        const strip = checks.firstElementChild!.firstElementChild as HTMLElement;
        expect(strip.textContent).toBe('');
    });
});

// "I don't like how constantly meaning is conveyed with words while visually you could use standard stuff".
describe('Tim: what an option says, drawn', () => {
    test('a marked option draws its mark, and says its label only to a screen reader', () => {
        const { card } = roll.add(yesNo('Raise the interval', 1, {
            options: [{ label: 'Yes', means: 'yes', mark: 'yes' }, { label: 'No', means: 'no', mark: 'no' }, { label: 'Later' }],
        }));
        for (const label of ['Yes', 'No']) {
            const b = button(card, label);
            expect(b.querySelector('svg[data-mark]')).not.toBeNull();
            expect(b.textContent).toBe('');
        }
        expect(button(card, 'Later').textContent).toBe('Later');
    });

    test('the time left to choose is a bar that drains, not a count of seconds', () => {
        const { card } = roll.add(yesNo('Raise the interval', 1, { openForSeconds: 60 }));
        const bar = button(card, 'Yes').querySelector<HTMLElement>('[data-time-left]')!;
        expect(bar).not.toBeNull();
        expect(bar.style.getPropertyValue('--left')).toBe('1');
        expect(note(button(card, 'Yes'))).not.toMatch(/\d+s/);
    });

    // CodeRabbit on #115: "Reference the action note from each option button with `aria-describedby`." Named by its label,
    // what it says under it is read out only when the button points at it.
    test('what an option says under its label is read out with it', () => {
        const { card } = roll.add(merge('Merge PR #29'));
        button(card, 'Merge').click();
        const merged = button(card, 'Merge');
        const said = document.getElementById(merged.getAttribute('aria-describedby') ?? '');
        expect(said?.textContent).toContain('again: force merge');
        const other = button(card, 'Don’t merge').getAttribute('aria-describedby');
        expect(other).not.toBe(merged.getAttribute('aria-describedby'));
    });

    test('its box is its own: the package\'s fit does not size it by its words', () => {
        const { card } = roll.add(yesNo('Raise the interval'));
        expect(button(card, 'Yes').dataset.ownBox).toBe('');
    });
});

describe('Spike: not yet, not at all, and nothing more', () => {
    test('checks still running: nothing can be pressed, and the buttons say so', () => {
        const { card } = roll.add(merge('Merge PR #29', { checks: [{ name: 'TypeScript', state: 'done' }, { name: 'Browser', state: 'running' }] }));
        expect(button(card, 'Merge').disabled).toBe(true);
        // Waiting is a spinner, as everywhere: said to a screen reader, not in words on the button.
        expect(spinning(button(card, 'Merge'))).toBe(true);
        expect(button(card, 'Merge').title).toBe('checks running');
        expect(note(button(card, 'Merge'))).toBe('');
        button(card, 'Merge').click();
        expect(pressed).toEqual([]);
    });

    // CodeRabbit on #115: faded to 0.4, what an option says read under 4.5 to 1. Not yet, it is drawn in HELD.
    test('not yet, it is drawn in HELD, not faded', () => {
        const { card } = roll.add(yesNo('Raise the interval', 1, { checks: [{ name: 'Browser', state: 'running' }], options: [{ label: 'Skip' }, { label: 'Stop' }] }));
        expect(button(card, 'Skip').style.opacity).toBe('1');
        expect(isColor(button(card, 'Skip').style.color, HELD)).toBe(true);
    });

    test('a check failed: not ready for approval at all', () => {
        const { card } = roll.add(merge('Merge PR #31', { checks: [{ name: 'TypeScript', state: 'done' }, { name: 'Browser', state: 'failed' }] }));
        expect(button(card, 'Merge').disabled).toBe(true);
        expect(spinning(button(card, 'Merge'))).toBe(false);
        expect(button(card, 'Merge').title).toBe('checks failed');
        expect(note(button(card, 'Merge'))).toBe('');
    });

    test('the host says the checks are done, and it can be decided', () => {
        const handle = roll.add(merge('Merge PR #29', { checks: [{ name: 'TypeScript', state: 'running' }, { name: 'Browser', state: 'waiting' }] }));
        expect(button(handle.card, 'Merge').disabled).toBe(true);
        handle.checks(['done', 'done']);
        expect(button(handle.card, 'Merge').disabled).toBe(false);
        expect(handle.card.querySelectorAll('[data-state="done"]').length).toBeGreaterThanOrEqual(2);
    });

    test('a step that settles now is final: pressing again sends nothing', () => {
        const { card } = roll.add(merge('Merge PR #29'));
        button(card, 'Merge').click();
        button(card, 'Merge').click();
        expect(pressed.at(-1)).toBe('Merge PR #29: Merge → force merge');
        button(card, 'Merge').click();
        button(card, 'Don’t merge').click();
        expect(pressed.length).toBe(2);
        expect(button(card, 'Don’t merge').disabled).toBe(true);
    });

    test('an option with no steps says its label, and pressing it again sends nothing more', () => {
        const { card } = roll.add(yesNo('Raise the interval'));
        button(card, 'Yes').click();
        button(card, 'Yes').click();
        expect(pressed).toEqual(['Raise the interval: Yes → Yes']);
    });

    test('one still waiting on checks goes after the ready ones; one that failed goes last', () => {
        roll.add(merge('Failed', { arrivedMinutesAgo: 1, checks: [{ name: 'Browser', state: 'failed' }] }));
        roll.add(merge('Waiting', { arrivedMinutesAgo: 2, checks: [{ name: 'Browser', state: 'running' }] }));
        roll.add(yesNo('Ready', 30));
        roll.settle();
        expect(titles()).toEqual(['Ready', 'Waiting', 'Failed']);
    });
});

describe('Jenny: the PR story', () => {
    test('Merge waits on main’s CI, in the button; Merge again forces it', () => {
        const { card } = roll.add(merge('Merge PR #29'));
        button(card, 'Merge').click();
        expect(note(button(card, 'Merge'))).toContain('merge when main CI passes');
        expect(note(button(card, 'Merge'))).toContain('again: force merge');
        // What it waits on is a spinner in the button, named for a screen reader.
        expect(spinning(button(card, 'Merge'))).toBe(true);
        expect(button(card, 'Merge').title).toBe('waiting on main CI');
        button(card, 'Merge').click();
        expect(note(button(card, 'Merge'))).toBe('force merge');
        expect(button(card, 'Merge').disabled).toBe(true);
    });

    test('Don’t merge while main’s CI is waited on cancels the merge; again is definitely no', () => {
        const { card } = roll.add(merge('Merge PR #29'));
        button(card, 'Merge').click();
        button(card, 'Don’t merge').click();
        // Nothing stands on Merge any more: it only says what pressing it would do.
        expect(note(button(card, 'Merge'))).toBe('press: merge when main CI passes');
        expect(isColor(button(card, 'Merge').style.background, '#000')).toBe(true);
        expect(isColor(button(card, 'Don’t merge').style.background, '#d93636')).toBe(true);
        expect(note(button(card, 'Don’t merge'))).toContain('cancel the merge');
        button(card, 'Don’t merge').click();
        expect(pressed.at(-1)).toBe('Merge PR #29: Don’t merge → definitely no');
    });

    test('main’s CI passes: what stood takes effect, and nothing more can be sent', () => {
        const handle = roll.add(merge('Merge PR #29'));
        button(handle.card, 'Merge').click();
        handle.settled();
        expect(note(button(handle.card, 'Merge'))).toBe('merge when main CI passes');
        expect(button(handle.card, 'Merge').disabled).toBe(true);
        button(handle.card, 'Don’t merge').click();
        expect(pressed.length).toBe(1);
    });

    test('the film roll: a decided one stays above, and the undecided follow', () => {
        const a = roll.add(yesNo('A', 1));
        roll.add(yesNo('B', 2));
        roll.add(yesNo('C', 3));
        roll.settle();
        button(roll.body.querySelector('section')!, 'Yes').click();
        roll.settle();
        expect(titles()).toEqual(['A', 'B', 'C']);
        button(roll.body.querySelectorAll('section')[2]!, 'No').click();
        roll.settle();
        expect(titles()).toEqual(['A', 'C', 'B']);
        expect(a.card.isConnected).toBe(true);
    });
});
