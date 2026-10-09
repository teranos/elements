/**
 * Approve specimen — Rubidium, the next element after the panel's Krypton.
 *
 * "Do you hear how little it matters what the 'thing' is to approve?"
 * An approval is something to look at, options to choose between, maybe a
 * confidence on each, maybe something to open that chooses nothing.
 *
 * "A YES or NO is a final choice. I already sent it. And i can send yes again,
 * and no again." Every tap sends, and sending the other one sends again, until
 * nothing more can be sent. Here time running out locks it; in a host it could
 * be something else. Approvals is a panel, a list to go through.
 */

import { tray } from '../tray/tray';
import type { Element } from '../element';

/** What one press says. The same option pressed again says its next step. */
interface Step {
    says: string;
    /** 'now' takes effect at once; 'when-ready' waits on what the approval waits on. */
    settles?: 'now' | 'when-ready';
}

interface Option {
    label: string;
    /** Left out, a press says the label and pressing it again says nothing more. */
    steps?: Step[];
    /**
     * 0–100, from Jev, the fast classifier. It answers a moment after the card
     * comes in, so the card is there first and the numbers arrive. Left out where
     * a percentage makes no sense, as on a merge.
     */
    confidence?: number;
    /** Cannot be sent while a check has failed: "FAILED isn't ready for approvals." */
    needsChecks?: boolean;
    /** Red is no and green is yes; an option that is neither stays white. */
    means?: 'yes' | 'no';
}

// How long Jev takes to classify, in this example.
const JEV_ANSWERS_MS = 400;

const COLOR = { yes: '#16a34a', no: '#dc2626', neither: '#fff' };

interface Aside {
    label: string;
    open: () => HTMLElement;
}

/** One of the checks a wait is made of, simulated: when it starts and how long it takes, in seconds. */
interface Check {
    starts: number;
    takes: number;
    /** Ends failed rather than done. */
    fails?: boolean;
}

interface Approval {
    title: string;
    /**
     * Where the thing itself lives, opened from the title row. A github.com link
     * opens in the GitHub app where it is installed.
     */
    link?: { label: string; href: string };
    /** Minutes since it came in: the most recent undecided one goes first. */
    arrivedMinutesAgo: number;
    context: () => HTMLElement;
    options: Option[];
    asides?: Aside[];
    /** Time running out locks it, where nothing else does. */
    openForSeconds?: number;
    /** Something to wait on, as a merge waits on CI, simulated here by a countdown. */
    waitsOn?: { label: string; checks: Check[] };
}

function text(lines: string[], mono = false): HTMLElement {
    const el = document.createElement('div');
    el.style.whiteSpace = 'pre-wrap';
    el.style.overflowWrap = 'anywhere';
    el.style.lineHeight = '1.45';
    if (mono) el.style.fontFamily = 'var(--font-mono)';
    el.textContent = lines.join('\n');
    return el;
}

// Examples only: none of these is a real PR, agent run or applicant.
const APPROVALS: Approval[] = [
    {
        title: 'Raise the schedule interval',
        arrivedMinutesAgo: 12,
        context: () => text(['every 1m → every 5m on schedule 12', 'cuts runs from 1440 to 288 a day']),
        options: [{ label: 'Yes', confidence: 82, means: 'yes' }, { label: 'No', confidence: 18, means: 'no' }],
        openForSeconds: 60,
    },
    {
        title: 'Merge PR #27',
        link: { label: 'GitHub', href: 'https://github.com/teranos/elements/pull/27' },
        arrivedMinutesAgo: 3,
        context: () => text(['Rubidium: an approval you can change your mind on', '2 files · +71 −0'], true),
        // "Click 1 means merge after CI passes, press again to force merge. If we still
        // wait for CI, the NO will cancel the yes. Press NO again and it's definitely NO."
        options: [
            {
                label: 'Merge', means: 'yes', needsChecks: true, steps: [
                    { says: 'merge when CI passes', settles: 'when-ready' },
                    { says: 'force merge', settles: 'now' },
                ],
            },
            {
                label: 'Don’t merge', means: 'no', steps: [
                    { says: 'cancel the merge' },
                    { says: 'definitely no' },
                ],
            },
        ],
        waitsOn: {
            label: 'CI',
            checks: [
                { starts: 0, takes: 12 },
                { starts: 0, takes: 20 },
                { starts: 2, takes: 28 },
                { starts: 6, takes: 32 },
                { starts: 10, takes: 35 },
                { starts: 18, takes: 27 },
            ],
        },
    },
    {
        title: 'Merge PR #31',
        link: { label: 'GitHub', href: 'https://github.com/teranos/elements/pulls' },
        arrivedMinutesAgo: 2,
        context: () => text(['Example: a PR whose CI fails', '4 files · +120 −36'], true),
        options: [
            {
                label: 'Merge', means: 'yes', needsChecks: true, steps: [
                    { says: 'merge when CI passes', settles: 'when-ready' },
                    { says: 'force merge', settles: 'now' },
                ],
            },
            {
                label: 'Don’t merge', means: 'no', steps: [
                    { says: 'cancel the merge' },
                    { says: 'definitely no' },
                ],
            },
        ],
        waitsOn: {
            label: 'CI',
            checks: [
                { starts: 0, takes: 6 },
                { starts: 0, takes: 9, fails: true },
                { starts: 1, takes: 20 },
                { starts: 3, takes: 25 },
            ],
        },
    },
    {
        title: 'Agent is stuck: how to proceed?',
        arrivedMinutesAgo: 1,
        context: () => text([
            '“The migration fails on 3 rows whose email is null. I can skip them and log their ids, '
            + 'backfill them from the signup table, or stop and leave the table as it is.”',
        ]),
        options: [
            { label: 'Skip and log', confidence: 54 },
            { label: 'Backfill', confidence: 38 },
            { label: 'Stop', confidence: 8 },
        ],
        // "I know agents sometimes like to put a table in their response."
        asides: [{
            label: 'The 3 rows',
            open: () => table(
                ['id', 'email', 'signed up', 'in signup table'],
                [
                    ['4812', 'null', '2025-03-02', 'yes'],
                    ['5090', 'null', '2025-06-17', 'yes'],
                    ['7731', 'null', '2026-01-09', 'no'],
                ],
            ),
        }],
        openForSeconds: 120,
    },
    {
        title: 'Create an account for a cleaner',
        arrivedMinutesAgo: 40,
        context: () => text(['Applicant · example', 'applied 9 Oct · 3 years experience · Utrecht']),
        options: [{ label: 'Yes', means: 'yes' }, { label: 'No', means: 'no' }],
        asides: [{
            label: 'Open mail & CV',
            open: () => text([
                'Subject: Application',
                '',
                'Hello, I would like to work with you.',
                'CV attached: 3 years office cleaning, own transport.',
            ]),
        }],
        openForSeconds: 150,
    },
];

const stepsOf = (option: Option): Step[] => option.steps ?? [{ says: option.label }];

function optionButton(option: Option): { btn: HTMLButtonElement; note: HTMLElement } {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.flex = '1 1 0';
    btn.style.minWidth = '0';
    btn.style.minHeight = '64px';
    btn.style.padding = '8px';
    btn.style.border = `2px solid ${COLOR[option.means ?? 'neither']}`;
    btn.style.borderRadius = '0';
    btn.style.font = 'inherit';
    btn.style.touchAction = 'manipulation';
    btn.style.display = 'flex';
    btn.style.flexDirection = 'column';
    btn.style.justifyContent = 'center';
    btn.style.gap = '4px';

    const label = document.createElement('span');
    label.textContent = option.label;
    label.style.fontSize = '16px';
    btn.appendChild(label);

    if (option.confidence !== undefined) {
        const pct = document.createElement('span');
        // Jev has not answered yet: the place is kept, so nothing moves when it does.
        pct.textContent = '··%';
        pct.style.opacity = '0.4';
        pct.title = 'Jev';
        setTimeout(() => {
            pct.textContent = `${option.confidence}%`;
            pct.style.opacity = '1';
        }, JEV_ANSWERS_MS);
        pct.style.fontFamily = 'var(--font-mono)';
        pct.style.fontSize = '22px';
        pct.style.fontVariantNumeric = 'tabular-nums';
        btn.appendChild(pct);
    }

    // What this button has said, and what pressing it again would say.
    const note = document.createElement('span');
    note.style.fontFamily = 'var(--font-mono)';
    note.style.fontSize = '11px';
    note.style.lineHeight = '1.3';
    btn.appendChild(note);
    return { btn, note };
}

/**
 * "A halfsize button, when clicked, becomes larger like elements do, and shows
 * more information. It stays an element in an element."
 *
 * One node all along: half a yes or no button at rest, and the same node grown
 * to the card's width holding what it opened. Its label stays; pressed there
 * it goes back.
 */
function asideElement(aside: Aside): HTMLElement {
    const el = document.createElement('div');
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute('aria-expanded', 'false');
    el.style.alignSelf = 'flex-start';
    el.style.boxSizing = 'border-box';
    el.style.border = '1px solid #fff';
    el.style.background = '#000';
    el.style.color = '#fff';
    el.style.overflow = 'hidden';
    el.style.touchAction = 'manipulation';
    el.style.cursor = 'pointer';

    const label = document.createElement('div');
    label.textContent = aside.label;
    label.style.minHeight = '30px';
    label.style.padding = '4px 8px';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    el.appendChild(label);

    const held = document.createElement('div');
    held.style.padding = '4px 8px 12px';
    held.style.cursor = 'auto';
    held.appendChild(aside.open());

    let open = false;
    const rest = () => {
        el.style.width = 'calc((100% - 8px) / 2)';
        held.remove();
        label.style.borderBottom = 'none';
    };
    const grown = () => {
        el.style.width = '100%';
        el.appendChild(held);
        label.style.borderBottom = '1px solid #fff';
    };
    rest();

    let motion: Animation | null = null;
    const toggle = () => {
        const from = el.getBoundingClientRect();
        motion?.cancel();
        open = !open;
        el.setAttribute('aria-expanded', String(open));
        if (open) grown(); else rest();
        const to = el.getBoundingClientRect();
        motion = el.animate(
            [
                { width: `${from.width}px`, height: `${from.height}px` },
                { width: `${to.width}px`, height: `${to.height}px` },
            ],
            { duration: 220, easing: 'ease-out' },
        );
    };

    // At rest the whole of it opens; grown, its label closes it and what it holds stays to be read.
    el.addEventListener('click', (e) => {
        if (open && !label.contains(e.target as Node)) return;
        toggle();
    });
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
        }
    });
    return el;
}

function table(head: string[], rows: string[][]): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.overflowX = 'auto';
    const t = document.createElement('table');
    t.style.borderCollapse = 'collapse';
    t.style.fontFamily = 'var(--font-mono)';
    t.style.fontSize = '12px';
    t.style.width = '100%';
    const cell = (tag: 'th' | 'td', value: string) => {
        const c = document.createElement(tag);
        c.textContent = value;
        c.style.textAlign = 'left';
        c.style.padding = '4px 8px 4px 0';
        c.style.borderBottom = '1px solid #444';
        c.style.whiteSpace = 'nowrap';
        return c;
    };
    const hr = document.createElement('tr');
    head.forEach((h) => hr.appendChild(cell('th', h)));
    t.appendChild(hr);
    for (const row of rows) {
        const tr = document.createElement('tr');
        row.forEach((v) => tr.appendChild(cell('td', v)));
        t.appendChild(tr);
    }
    wrap.appendChild(t);
    return wrap;
}

interface Rendered {
    card: HTMLElement;
    approval: Approval;
    /** Nothing sent yet, and still open. */
    undecided: () => boolean;
    /** 0 ready, 1 still waiting on checks, 2 a check failed: the others take precedence. */
    readiness: () => number;
}

function renderApproval(approval: Approval, changed: () => void): Rendered {
    const card = document.createElement('section');
    card.style.borderTop = '1px solid #fff';
    card.style.padding = '16px 0';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '12px';

    const title = document.createElement('div');
    title.style.display = 'flex';
    title.style.justifyContent = 'space-between';
    title.style.gap = '8px';
    const name = document.createElement('span');
    name.textContent = approval.title;
    name.style.fontSize = '16px';
    name.style.fontWeight = 'bold';
    const ago = document.createElement('span');
    ago.textContent = `${approval.arrivedMinutesAgo}m ago`;
    ago.style.fontFamily = 'var(--font-mono)';
    ago.style.fontSize = '12px';
    ago.style.whiteSpace = 'nowrap';
    let paintChecks = (_elapsed: number) => {};
    const end = document.createElement('span');
    end.style.display = 'flex';
    end.style.alignItems = 'center';
    end.style.gap = '8px';
    end.appendChild(ago);
    if (approval.link) {
        // "Half of halfsize": half as wide as the half-size button. Half as tall
        // would be 16px, too small for a thumb, so it is 24.
        const a = document.createElement('a');
        a.href = approval.link.href;
        a.target = '_blank';
        a.rel = 'noopener';
        a.style.position = 'relative';
        a.style.overflow = 'hidden';
        a.style.boxSizing = 'border-box';
        a.style.width = 'calc((100vw - 32px - 8px) / 4)';
        a.style.minHeight = '24px';
        a.style.display = 'flex';
        a.style.alignItems = 'center';
        a.style.justifyContent = 'center';
        a.style.border = '1px solid #fff';
        a.style.color = '#fff';
        a.style.textDecoration = 'none';
        a.style.fontFamily = 'var(--font-mono)';
        a.style.fontSize = '12px';
        a.style.fontWeight = 'normal';
        // "If there's 6 checks, the GitHub button is 6 segments, becoming fuller as
        // more checks are completed." Not started black, running grey lines moving
        // left, done white, "failed is RED". The label is the inverse of whatever is behind it.
        const checks = approval.waitsOn?.checks ?? [];
        const bar = document.createElement('span');
        bar.style.position = 'absolute';
        bar.style.inset = '0';
        bar.style.display = 'flex';
        bar.style.gap = '1px';
        const segments = checks.map(() => {
            const seg = document.createElement('span');
            seg.style.flex = '1';
            bar.appendChild(seg);
            return seg;
        });
        const label = document.createElement('span');
        label.textContent = approval.link.label;
        label.style.position = 'relative';
        // Each letter is the exact inverse of what is behind it, segment by segment:
        // white over black is black over white. Blended against the button alone.
        label.style.color = '#fff';
        label.style.mixBlendMode = 'difference';
        a.style.isolation = 'isolate';
        a.append(bar, label);
        paintChecks = (elapsed: number) => checks.forEach((check, i) => {
            const seg = segments[i]!;
            const state = elapsed >= check.starts + check.takes ? (check.fails ? 'failed' : 'done')
                : elapsed >= check.starts ? 'running' : 'waiting';
            if (seg.dataset.state === state) return;
            seg.dataset.state = state;
            seg.className = state === 'running' ? 'check-running' : '';
            seg.style.background = { done: '#fff', failed: COLOR.no, waiting: '#000', running: '' }[state];
        });
        end.appendChild(a);
    }
    title.append(name, end);
    title.style.alignItems = 'flex-start';


    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';

    // Every press sends. The other option sends again; the same one says its
    // next step. What was sent last stands until it takes effect or the time
    // runs out, and then nothing more can be sent.
    let current: { option: number; step: number } | null = null;
    let locked: string | null = null;
    let ready = false;
    const checks = approval.waitsOn?.checks ?? [];
    const allDone = Math.max(0, ...checks.map((c) => c.starts + c.takes));
    let elapsed = 0;
    let wasFailed = false;
    const failed = () => checks.some((c) => c.fails && elapsed >= c.starts + c.takes);
    let remaining = approval.waitsOn ? allDone : approval.openForSeconds ?? 0;

    const stepNow = (): Step | null => current && stepsOf(approval.options[current.option]!)[current.step]!;

    const settle = () => {
        const step = stepNow();
        if (step?.settles === 'now' || (step?.settles === 'when-ready' && ready)) locked = step.says;
    };

    const buttons = approval.options.map((option, i) => {
        const { btn, note } = optionButton(option);
        btn.addEventListener('click', () => {
            if (locked) return;
            if (current?.option === i) {
                if (current.step + 1 >= stepsOf(option).length) return;
                current = { option: i, step: current.step + 1 };
            } else {
                current = { option: i, step: 0 };
            }
            settle();
            show();
            changed();
        });
        row.appendChild(btn);
        return { btn, note };
    });

    const show = () => {
        buttons.forEach(({ btn, note }, i) => {
            const option = approval.options[i]!;
            const steps = stepsOf(option);
            const on = current?.option === i;
            const color = COLOR[option.means ?? 'neither'];
            // What was sent last fills with its colour; the others wear it as an outline.
            btn.style.background = on ? color : '#000';
            btn.style.color = on ? (option.means ? '#fff' : '#000') : color;
            const blocked = !!option.needsChecks && failed();
            btn.disabled = !!locked || blocked;
            btn.style.opacity = (locked && !on) || blocked ? '0.4' : '1';
            const next = on ? steps[current!.step + 1] : steps[0];
            const said = on ? steps[current!.step]!.says : null;
            // "The countdown, why not IN THE button." In the one that stands, how long
            // it still can change; before anything is sent, in each, how long to choose.
            const counts = !locked && !ready && !failed() && (on || current === null);
            const lines = [
                said && said !== option.label ? said : null,
                !locked && !blocked && next && next.says !== option.label ? `${on ? 'again' : 'press'}: ${next.says}` : null,
                counts ? `${approval.waitsOn ? `${approval.waitsOn.label} ` : ''}${remaining}s` : null,
                blocked && !locked ? `${approval.waitsOn!.label} failed` : null,
            ].filter(Boolean);
            note.textContent = lines.join('\n');
            note.style.whiteSpace = 'pre-line';
            note.hidden = lines.length === 0;
        });
    };

    // The checks run on whatever is sent, until all of them are done.
    if (approval.waitsOn) {
        paintChecks(0);
        const run = setInterval(() => {
            elapsed += 1;
            paintChecks(elapsed);
            if (failed() && !wasFailed) {
                wasFailed = true;
                // A merge waiting on checks that failed will not happen: it stands no more.
                if (current && approval.options[current.option]!.needsChecks && !locked) current = null;
                show();
                changed();
            }
            if (elapsed >= allDone) {
                clearInterval(run);
                changed();
            }
        }, 1000);
    }

    const timer = setInterval(() => {
        if (locked) return clearInterval(timer);
        remaining -= 1;
        if (remaining <= 0) {
            clearInterval(timer);
            if (approval.waitsOn) {
                ready = !failed();
                settle();
            } else {
                locked = 'locked';
            }
            changed();
        }
        show();
    }, 1000);

    // What an approval opens is about what it shows, so it sits with it, above
    // the choice. No bar for the time left: it is counted in the buttons.
    card.append(title, approval.context());
    for (const aside of approval.asides ?? []) card.appendChild(asideElement(aside));
    card.appendChild(row);
    show();
    return { card, approval, undecided: () => current === null && !locked, readiness: () => (failed() ? 2 : approval.waitsOn && elapsed < allDone ? 1 : 0) };
}

/**
 * "Most recent undecided sorted first." The cards are moved, never rebuilt, and
 * glide from where they stood to where they go. A press is left to land before
 * its card moves away from under the thumb.
 */
function sortApprovals(body: HTMLElement, rendered: Rendered[]): void {
    const order = [...rendered].sort((a, b) =>
        Number(b.undecided()) - Number(a.undecided())
        // "If an approval still has outstanding checks, other approvals take precedence."
        // A failed one is not ready for approvals at all, and goes after those still waiting.
        || a.readiness() - b.readiness()
        || a.approval.arrivedMinutesAgo - b.approval.arrivedMinutesAgo);
    if (order.every((r, i) => body.children[i] === r.card)) return;
    const before = new Map(rendered.map((r) => [r.card, r.card.getBoundingClientRect().top]));
    for (const r of order) body.appendChild(r.card);
    for (const r of order) {
        const dy = before.get(r.card)! - r.card.getBoundingClientRect().top;
        if (dy) r.card.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 180, easing: 'ease-out' });
    }
}

// Grey diagonal lines moving left: a check that is running.
function addCheckStyle(): void {
    if (document.getElementById('check-running-style')) return;
    const style = document.createElement('style');
    style.id = 'check-running-style';
    style.textContent = `
        .check-running {
            background-color: #000;
            background-image: linear-gradient(-45deg, #888 25%, transparent 25%, transparent 50%, #888 50%, #888 75%, transparent 75%);
            background-size: 8px 8px;
            animation: check-running 0.5s linear infinite;
        }
        @keyframes check-running { to { background-position: -8px 0; } }
        @media (prefers-reduced-motion: reduce) { .check-running { animation: none; } }
    `;
    document.head.appendChild(style);
}

export function renderApproveSpecimen(): void {
    addCheckStyle();
    const item: Element = {
        id: 'approve-specimen',
        title: 'Rubidium',
        symbol: 'Rb',
        opensAs: 'panel',
        color: '#000',
        renderContent: () => {
            const body = document.createElement('div');
            body.className = 'content';
            let pending: ReturnType<typeof setTimeout> | undefined;
            const changed = () => {
                clearTimeout(pending);
                pending = setTimeout(() => sortApprovals(body, rendered), 150);
            };
            const rendered = APPROVALS.map((approval) => renderApproval(approval, changed));
            for (const r of rendered) body.appendChild(r.card);
            sortApprovals(body, rendered);
            return body;
        },
    };
    tray.add(item);
}
