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
import { shatter } from './shatter';

/** What one press says. The same option pressed again says its next step. */
interface Step {
    says: string;
    /** 'now' takes effect at once; 'when-ready' waits on what the approval's merge waits on. */
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
    name: string;
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
    /**
     * "These are always targeting main, and the checks are what occur on the PR
     * itself, before we even want to present it as something to approve or not."
     * Until they are all done it cannot be decided; one failed, it is not ready
     * for approval at all.
     */
    checks?: Check[];
    /** What a merge into main waits on once it is sent, simulated by a countdown. */
    merges?: { label: string; seconds: number };
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
                label: 'Merge', means: 'yes', steps: [
                    { says: 'merge when main CI passes', settles: 'when-ready' },
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
        merges: { label: 'main CI', seconds: 20 },
        checks: [
            { name: 'TypeScript', starts: 0, takes: 6 },
            { name: 'Unit · happy-dom', starts: 0, takes: 9 },
            { name: 'Unit · JSDOM', starts: 1, takes: 12 },
            { name: 'Browser', starts: 2, takes: 14 },
            { name: 'Android Emulator, Chrome', starts: 4, takes: 13 },
            { name: 'iPhone Simulator, Safari', starts: 6, takes: 12 },
        ],
    },
    {
        title: 'Merge PR #31',
        link: { label: 'GitHub', href: 'https://github.com/teranos/elements/pulls' },
        arrivedMinutesAgo: 2,
        context: () => text(['Example: a PR whose checks fail', '4 files · +120 −36'], true),
        options: [
            {
                label: 'Merge', means: 'yes', steps: [
                    { says: 'merge when main CI passes', settles: 'when-ready' },
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
        merges: { label: 'main CI', seconds: 20 },
        checks: [
            { name: 'TypeScript', starts: 0, takes: 6 },
            { name: 'Browser', starts: 0, takes: 9, fails: true },
            { name: 'Android Emulator, Chrome', starts: 1, takes: 20 },
            { name: 'iPhone Simulator, Safari', starts: 3, takes: 25 },
        ],
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
    btn.style.position = 'relative';

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
    /** When it stopped being undecided, to keep decided ones in the order they were decided. */
    decidedAt: () => number;
    /** 0 ready, 1 still waiting on checks, 2 a check failed: the others take precedence. */
    readiness: () => number;
}

function renderApproval(approval: Approval, changed: (pressed?: boolean) => void): Rendered {
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
        const link = approval.link;
        // "Half of halfsize": half as wide as the half-size button. Half as tall
        // would be 16px, too small for a thumb, so it is 24.
        //
        // "Pressing GitHub should just display its checks initially and pressing
        // again does deeplink, so it's button in button." One node: pressed, it
        // leaves the title row for its own row under the title, grown to the card's
        // width, and lists the checks; inside it a square button opens the PR.
        const gh = document.createElement('div');
        gh.setAttribute('role', 'button');
        gh.tabIndex = 0;
        gh.setAttribute('aria-expanded', 'false');
        gh.style.boxSizing = 'border-box';
        gh.style.border = '1px solid #fff';
        gh.style.background = '#000';
        gh.style.overflow = 'hidden';
        gh.style.cursor = 'pointer';
        gh.style.touchAction = 'manipulation';
        gh.style.fontFamily = 'var(--font-mono)';
        gh.style.fontSize = '12px';
        gh.style.fontWeight = 'normal';
        gh.style.flexShrink = '0';

        const head = document.createElement('div');
        head.style.display = 'flex';
        head.style.alignItems = 'stretch';

        // "If there's 6 checks, the GitHub button is 6 segments, becoming fuller as
        // more checks are completed." Not started black, running grey lines moving
        // left, done white, "failed is RED". The label is the inverse of whatever is behind it.
        const strip = document.createElement('div');
        strip.style.position = 'relative';
        strip.style.flex = '1';
        strip.style.minHeight = '22px';
        strip.style.display = 'flex';
        strip.style.alignItems = 'center';
        strip.style.justifyContent = 'center';
        strip.style.isolation = 'isolate';
        const checks = approval.checks ?? [];
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
        label.textContent = link.label;
        label.style.position = 'relative';
        // Each letter is the exact inverse of what is behind it, segment by segment:
        // white over black is black over white. Blended against the strip alone.
        label.style.color = '#fff';
        label.style.mixBlendMode = 'difference';
        strip.append(bar, label);

        // The button in the button: perfectly square, the white GitHub mark.
        const open = document.createElement('a');
        open.href = link.href;
        open.target = '_blank';
        open.rel = 'noopener';
        open.setAttribute('aria-label', `Open in ${link.label}`);
        open.style.width = '44px';
        open.style.height = '44px';
        open.style.flexShrink = '0';
        open.style.boxSizing = 'border-box';
        open.style.borderLeft = '1px solid #fff';
        open.style.display = 'flex';
        open.style.alignItems = 'center';
        open.style.justifyContent = 'center';
        open.style.background = '#000';
        open.innerHTML = '<svg viewBox="0 0 16 16" width="24" height="24" aria-hidden="true"><path fill="#fff" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
        head.append(strip, open);

        // What each check is doing, one row each, its mark drawn as its segment is.
        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '6px';
        list.style.padding = '10px 8px';
        list.style.borderTop = '1px solid #fff';
        list.style.color = '#fff';
        const rows = checks.map((check) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '8px';
            const mark = document.createElement('span');
            mark.style.width = '12px';
            mark.style.height = '12px';
            mark.style.flexShrink = '0';
            mark.style.border = '1px solid #fff';
            mark.style.boxSizing = 'border-box';
            const what = document.createElement('span');
            what.textContent = check.name;
            what.style.flex = '1';
            what.style.minWidth = '0';
            what.style.overflowWrap = 'anywhere';
            const state = document.createElement('span');
            row.append(mark, what, state);
            list.appendChild(row);
            return { mark, state };
        });

        gh.appendChild(head);

        let grown = false;
        const rest = () => {
            gh.style.width = 'calc((100vw - 32px - 8px) / 4)';
            open.style.display = 'none';
            list.remove();
            end.appendChild(gh);
        };
        const grow = () => {
            gh.style.width = '100%';
            open.style.display = 'flex';
            gh.appendChild(list);
            title.after(gh);
        };
        rest();

        let motion: Animation | null = null;
        const toggle = () => {
            const from = gh.getBoundingClientRect();
            motion?.cancel();
            grown = !grown;
            gh.setAttribute('aria-expanded', String(grown));
            if (grown) grow(); else rest();
            const to = gh.getBoundingClientRect();
            motion = gh.animate(
                [
                    { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)`, width: `${from.width}px`, height: `${from.height}px` },
                    { transform: 'none', width: `${to.width}px`, height: `${to.height}px` },
                ],
                { duration: 200, easing: 'ease-out' },
            );
        };
        gh.addEventListener('click', (e) => {
            if (open.contains(e.target as Node)) return;
            if (grown && list.contains(e.target as Node)) return;
            toggle();
        });
        gh.addEventListener('keydown', (e) => {
            if (e.target !== gh) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });

        paintChecks = (elapsed: number) => checks.forEach((check, i) => {
            const seg = segments[i]!;
            const state = elapsed >= check.starts + check.takes ? (check.fails ? 'failed' : 'done')
                : elapsed >= check.starts ? 'running' : 'waiting';
            if (seg.dataset.state === state) return;
            seg.dataset.state = state;
            const { mark, state: said } = rows[i]!;
            for (const el of [seg, mark]) {
                el.className = state === 'running' ? 'check-running' : '';
                el.style.background = { done: '#fff', failed: COLOR.no, waiting: '#000', running: '' }[state];
            }
            said.textContent = { done: 'passed', failed: 'failed', waiting: 'queued', running: 'running' }[state];
            said.style.color = state === 'failed' ? COLOR.no : '#fff';
        });
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
    const checks = approval.checks ?? [];
    const allDone = Math.max(0, ...checks.map((c) => c.starts + c.takes));
    let elapsed = 0;
    const failed = () => checks.some((c) => c.fails && elapsed >= c.starts + c.takes);
    const presented = () => elapsed >= allDone && !failed();
    let remaining = approval.openForSeconds ?? 0;
    let merging: number | null = null;

    const stepNow = (): Step | null => current && stepsOf(approval.options[current.option]!)[current.step]!;

    const settle = () => {
        const step = stepNow();
        merging = null;
        if (step?.settles === 'now') locked = step.says;
        else if (step?.settles === 'when-ready') merging = approval.merges?.seconds ?? 0;
    };

    const buttons = approval.options.map((option, i) => {
        const { btn, note } = optionButton(option);
        btn.addEventListener('click', (e) => {
            if (locked || !presented()) return;
            if (current?.option === i) {
                if (current.step + 1 >= stepsOf(option).length) return;
                current = { option: i, step: current.step + 1 };
            } else {
                current = { option: i, step: 0 };
            }
            settle();
            show();
            // After show(): the piece that breaks off wears the decision just made.
            shatter(btn, e, COLOR[option.means ?? 'neither']);
            changed(true);
        });
        row.appendChild(btn);
        return { btn, note };
    });

    const show = () => {
        const notYet = !presented();
        buttons.forEach(({ btn, note }, i) => {
            const option = approval.options[i]!;
            const steps = stepsOf(option);
            const on = current?.option === i;
            const color = COLOR[option.means ?? 'neither'];
            // What was sent last fills with its colour; the others wear it as an outline.
            btn.style.background = on ? color : '#000';
            btn.style.color = on ? (option.means ? '#fff' : '#000') : color;
            btn.disabled = !!locked || notYet;
            btn.style.opacity = (locked && !on) || notYet ? '0.4' : '1';
            const next = on ? steps[current!.step + 1] : steps[0];
            const said = on ? steps[current!.step]!.says : null;
            // "The countdown, why not IN THE button." In the one that stands, how long
            // until it takes effect or can no longer change; before anything is sent,
            // in each, how long to choose.
            const count = locked || notYet ? null
                : on && merging !== null ? `${approval.merges!.label} ${merging}s`
                : approval.openForSeconds && (on || current === null) ? `${remaining}s` : null;
            const lines = notYet
                ? [failed() ? 'checks failed' : 'checks running']
                : [
                    said && said !== option.label ? said : null,
                    !locked && next && next.says !== option.label ? `${on ? 'again' : 'press'}: ${next.says}` : null,
                    count,
                ].filter(Boolean);
            note.textContent = lines.join('\n');
            note.style.whiteSpace = 'pre-line';
            note.hidden = lines.length === 0;
        });
    };

    // The PR's own checks run before it is put up to be decided.
    if (checks.length) {
        paintChecks(0);
        let wasFailed = false;
        const run = setInterval(() => {
            elapsed += 1;
            paintChecks(elapsed);
            if (failed() && !wasFailed) wasFailed = true;
            if (elapsed >= allDone || wasFailed) {
                if (elapsed >= allDone) clearInterval(run);
                show();
                changed();
            }
        }, 1000);
    }

    const timer = setInterval(() => {
        if (locked) return clearInterval(timer);
        if (merging !== null) {
            merging -= 1;
            if (merging <= 0) {
                locked = stepNow()!.says;
                merging = null;
                changed();
            }
        }
        if (approval.openForSeconds && presented()) {
            remaining -= 1;
            if (remaining <= 0) {
                locked = 'locked';
                changed();
            }
        }
        show();
    }, 1000);

    // What an approval opens is about what it shows, so it sits with it, above
    // the choice. No bar for the time left: it is counted in the buttons.
    card.append(title, approval.context());
    for (const aside of approval.asides ?? []) card.appendChild(asideElement(aside));
    card.appendChild(row);
    show();
    const undecided = () => current === null && !locked;
    let decidedAt = Infinity;
    const stamp = () => {
        if (undecided()) decidedAt = Infinity;
        else if (decidedAt === Infinity) decidedAt = performance.now();
        return decidedAt;
    };
    return { card, approval, undecided, decidedAt: stamp, readiness: () => (failed() ? 2 : presented() ? 0 : 1) };
}

/**
 * "Most recent undecided sorted first." "After I press, the approval doesn't
 * shift down; everything moves up, like a filmroll." Decided ones stay where
 * they were, above, in the order they were decided; swiping down brings them
 * back. Undecided ones follow, the most recent first. The cards are moved,
 * never rebuilt, and glide from where they stood to where they go.
 */
function sortApprovals(body: HTMLElement, rendered: Rendered[], end: HTMLElement): void {
    // Every one says when it was decided now, not only those a sort happens to compare.
    const when = new Map(rendered.map((r) => [r, r.decidedAt()]));
    const decided = rendered.filter((r) => !r.undecided()).sort((a, b) => when.get(a)! - when.get(b)!);
    const open = rendered.filter((r) => r.undecided()).sort((a, b) =>
        // "If an approval still has outstanding checks, other approvals take precedence."
        // A failed one is not ready for approvals at all, and goes after those still waiting.
        a.readiness() - b.readiness()
        || a.approval.arrivedMinutesAgo - b.approval.arrivedMinutesAgo);
    const order = [...decided, ...open];
    if (order.every((r, i) => body.children[i] === r.card)) return;
    const before = new Map(rendered.map((r) => [r.card, r.card.getBoundingClientRect().top]));
    for (const r of order) body.appendChild(r.card);
    body.appendChild(end);
    for (const r of order) {
        const dy = before.get(r.card)! - r.card.getBoundingClientRect().top;
        if (dy) r.card.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 140, easing: 'ease-out' });
    }
}

/** The element's scroller: the nearest one up from the list that scrolls. */
function scrollerOf(el: HTMLElement): HTMLElement | null {
    for (let n = el.parentElement; n; n = n.parentElement) {
        const y = getComputedStyle(n).overflowY;
        if ((y === 'auto' || y === 'scroll') && n.scrollHeight > n.clientHeight) return n;
    }
    return null;
}

/** The roll moves up until the first undecided one, or the end of the roll, is at the top. */
function advance(body: HTMLElement, rendered: Rendered[], end: HTMLElement, smooth: boolean): void {
    const scroller = scrollerOf(body);
    if (!scroller) return;
    const next = [...body.children].find((c) => rendered.some((r) => r.card === c && r.undecided())) as HTMLElement | undefined;
    const target = next ?? end;
    const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    if (!smooth) {
        scroller.scrollTop = top;
        return;
    }
    // "Everything needs to feel faster": its own quick glide, not the browser's slow smooth scroll.
    const from = scroller.scrollTop;
    const start = performance.now();
    const glide = (now: number) => {
        const t = Math.min(1, (now - start) / 220);
        scroller.scrollTop = from + (top - from) * (1 - Math.pow(1 - t, 3));
        if (t < 1) requestAnimationFrame(glide);
    };
    requestAnimationFrame(glide);
}

// Grey diagonal lines moving left: a check that is running.
function addCheckStyle(): void {
    if (document.getElementById('check-running-style')) return;
    const style = document.createElement('style');
    style.id = 'check-running-style';
    style.textContent = `
        .check-running {
            background-color: #000;
            /* Dark grey, so the label inverted over it is light grey and still reads. */
            background-image: linear-gradient(-45deg, #3a3a3a 25%, transparent 25%, transparent 50%, #3a3a3a 50%, #3a3a3a 75%, transparent 75%);
            background-size: 8px 8px;
            animation: check-running 1.6s linear infinite;
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
            // The end of the roll, a screen tall, so the last one can come to the top.
            const end = document.createElement('div');
            end.textContent = 'Nothing left to decide.';
            end.style.minHeight = '100vh';
            end.style.borderTop = '1px solid #fff';
            end.style.padding = '16px 0';
            end.style.fontFamily = 'var(--font-mono)';
            end.style.fontSize = '12px';
            let pending: ReturnType<typeof setTimeout> | undefined;
            let advancing = false;
            const changed = (pressed = false) => {
                advancing ||= pressed;
                clearTimeout(pending);
                pending = setTimeout(() => {
                    sortApprovals(body, rendered, end);
                    if (advancing) advance(body, rendered, end, true);
                    advancing = false;
                }, 90);
            };
            const rendered = APPROVALS.map((approval) => renderApproval(approval, changed));
            for (const r of rendered) body.appendChild(r.card);
            sortApprovals(body, rendered, end);
            return body;
        },
    };
    tray.add(item);
}
