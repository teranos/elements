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
    /** 0–100. Left out where a percentage makes no sense, as on a merge. */
    confidence?: number;
    /** Red is no and green is yes; an option that is neither stays white. */
    means?: 'yes' | 'no';
}

const COLOR = { yes: '#16a34a', no: '#dc2626', neither: '#fff' };

interface Aside {
    label: string;
    open: () => HTMLElement;
}

interface Approval {
    title: string;
    context: () => HTMLElement;
    options: Option[];
    asides?: Aside[];
    /** Time running out locks it, where nothing else does. */
    openForSeconds?: number;
    /** Something to wait on, as a merge waits on CI, simulated here by a countdown. */
    waitsOn?: { label: string; seconds: number };
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
        context: () => text(['every 1m → every 5m on schedule 12', 'cuts runs from 1440 to 288 a day']),
        options: [{ label: 'Yes', confidence: 82, means: 'yes' }, { label: 'No', confidence: 18, means: 'no' }],
        openForSeconds: 60,
    },
    {
        title: 'Merge PR #27',
        context: () => text(['Rubidium: an approval you can change your mind on', '2 files · +71 −0'], true),
        // "Click 1 means merge after CI passes, press again to force merge. If we still
        // wait for CI, the NO will cancel the yes. Press NO again and it's definitely NO."
        options: [
            {
                label: 'Merge', means: 'yes', steps: [
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
        waitsOn: { label: 'CI', seconds: 45 },
    },
    {
        title: 'Agent is stuck: how to proceed?',
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
        pct.textContent = `${option.confidence}%`;
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

function renderApproval(approval: Approval): HTMLElement {
    const card = document.createElement('section');
    card.style.borderTop = '1px solid #fff';
    card.style.padding = '16px 0';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '12px';

    const title = document.createElement('div');
    title.textContent = approval.title;
    title.style.fontSize = '16px';
    title.style.fontWeight = 'bold';

    // "No need for your statusline." The buttons say what stands; what is left of
    // the time, or of the wait, drains away under them, and is gone when it ends.
    const left = document.createElement('div');
    left.style.height = '3px';
    left.style.background = '#fff';
    left.style.transition = 'width 1s linear';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';

    // Every press sends. The other option sends again; the same one says its
    // next step. What was sent last stands until it takes effect or the time
    // runs out, and then nothing more can be sent.
    let current: { option: number; step: number } | null = null;
    let locked: string | null = null;
    let ready = false;
    const total = approval.waitsOn?.seconds ?? approval.openForSeconds ?? 0;
    let remaining = total;

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
            btn.disabled = !!locked;
            btn.style.opacity = locked && !on ? '0.4' : '1';
            const next = on ? steps[current!.step + 1] : steps[0];
            const said = on ? steps[current!.step]!.says : null;
            const lines = [
                said && said !== option.label ? said : null,
                !locked && next && next.says !== option.label ? `${on ? 'again' : 'press'}: ${next.says}` : null,
            ].filter(Boolean);
            note.textContent = lines.join('\n');
            note.style.whiteSpace = 'pre-line';
            note.hidden = lines.length === 0;
        });
        left.style.width = `${(remaining / total) * 100}%`;
        left.hidden = !!locked || ready;
    };

    const timer = setInterval(() => {
        if (locked) return clearInterval(timer);
        remaining -= 1;
        if (remaining <= 0) {
            clearInterval(timer);
            if (approval.waitsOn) {
                ready = true;
                settle();
            } else {
                locked = 'locked';
            }
        }
        show();
    }, 1000);

    card.append(title, approval.context(), row);

    for (const aside of approval.asides ?? []) card.appendChild(asideElement(aside));

    card.insertBefore(left, row.nextSibling);
    show();
    return card;
}

export function renderApproveSpecimen(): void {
    const item: Element = {
        id: 'approve-specimen',
        title: 'Rubidium',
        symbol: 'Rb',
        opensAs: 'panel',
        color: '#000',
        renderContent: () => {
            const body = document.createElement('div');
            body.className = 'content';
            for (const approval of APPROVALS) body.appendChild(renderApproval(approval));
            return body;
        },
    };
    tray.add(item);
}
