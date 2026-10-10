/**
 * Approve specimen — Rubidium, the next element after the panel's Krypton.
 *
 * The element is the package's (approvals/approvals.ts); this is a host
 * playing it: five made-up approvals, checks that run on a clock, a Jev that
 * answers after a moment, and a main CI that passes after twenty seconds.
 */

import { tray } from '../tray/tray';
import type { Element } from '../element';
import { renderApprovals, type Approval, type ApprovalHandle } from '../approvals/approvals';
import { table } from '../approvals/grow';
import type { SegmentState } from '../approvals/segments';

// How long Jev takes to classify, in this example.
const JEV_ANSWERS_MS = 400;

/** Jev, answering after a moment: the card is there first and the number arrives. */
const jev = (n: number): Promise<number> => new Promise((answer) => setTimeout(() => answer(n), JEV_ANSWERS_MS));

/** One of the checks a wait is made of, simulated: when it starts and how long it takes, in seconds. */
interface Run {
    name: string;
    starts: number;
    takes: number;
    /** Ends failed rather than done. */
    fails?: boolean;
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

// "Click 1 means merge after CI passes, press again to force merge. If we still
// wait for CI, the NO will cancel the yes. Press NO again and it's definitely NO."
const MERGE_OPTIONS: Approval['options'] = [
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
];

// Examples only: none of these is a real PR, agent run or applicant.
const APPROVALS: { approval: Approval; runs?: Run[] }[] = [
    {
        approval: {
            title: 'Raise the schedule interval',
            arrivedMinutesAgo: 12,
            context: () => text(['every 1m → every 5m on schedule 12', 'cuts runs from 1440 to 288 a day']),
            options: [{ label: 'Yes', confidence: jev(82), means: 'yes' }, { label: 'No', confidence: jev(18), means: 'no' }],
            openForSeconds: 60,
        },
    },
    {
        approval: {
            title: 'Merge PR #27',
            link: { label: 'GitHub', href: 'https://github.com/teranos/elements/pull/27' },
            arrivedMinutesAgo: 3,
            context: () => text(['Rubidium: an approval you can change your mind on', '2 files · +71 −0'], true),
            options: MERGE_OPTIONS,
            merges: { label: 'main CI', seconds: 20 },
            checks: [],
        },
        runs: [
            { name: 'TypeScript', starts: 0, takes: 6 },
            { name: 'Unit · happy-dom', starts: 0, takes: 9 },
            { name: 'Unit · JSDOM', starts: 1, takes: 12 },
            { name: 'Browser', starts: 2, takes: 14 },
            { name: 'Android Emulator, Chrome', starts: 4, takes: 13 },
            { name: 'iPhone Simulator, Safari', starts: 6, takes: 12 },
        ],
    },
    {
        approval: {
            title: 'Merge PR #31',
            link: { label: 'GitHub', href: 'https://github.com/teranos/elements/pulls' },
            arrivedMinutesAgo: 2,
            context: () => text(['Example: a PR whose checks fail', '4 files · +120 −36'], true),
            options: MERGE_OPTIONS,
            merges: { label: 'main CI', seconds: 20 },
            checks: [],
        },
        runs: [
            { name: 'TypeScript', starts: 0, takes: 6 },
            { name: 'Browser', starts: 0, takes: 9, fails: true },
            { name: 'Android Emulator, Chrome', starts: 1, takes: 20 },
            { name: 'iPhone Simulator, Safari', starts: 3, takes: 25 },
        ],
    },
    {
        approval: {
            title: 'Agent is stuck: how to proceed?',
            arrivedMinutesAgo: 1,
            context: () => text([
                '“The migration fails on 3 rows whose email is null. I can skip them and log their ids, '
                + 'backfill them from the signup table, or stop and leave the table as it is.”',
            ]),
            options: [
                { label: 'Skip and log', confidence: jev(54) },
                { label: 'Backfill', confidence: jev(38) },
                { label: 'Stop', confidence: jev(8) },
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
    },
    {
        approval: {
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
    },
];

/** The PR's own checks run on a clock, and the host tells the card their state each second. */
function runChecks(handle: ApprovalHandle, runs: Run[]): void {
    const allDone = Math.max(0, ...runs.map((r) => r.starts + r.takes));
    let elapsed = 0;
    const states = (): SegmentState[] => runs.map((r) => elapsed >= r.starts + r.takes ? (r.fails ? 'failed' : 'done')
        : elapsed >= r.starts ? 'running' : 'waiting');
    handle.checks(states());
    const clock = setInterval(() => {
        elapsed += 1;
        handle.checks(states());
        if (elapsed >= allDone) clearInterval(clock);
    }, 1000);
}

export function renderApproveSpecimen(): void {
    const item: Element = {
        id: 'approve-specimen',
        title: 'Rubidium',
        symbol: 'Rb',
        opensAs: 'panel',
        color: '#000',
        renderContent: () => {
            // A host sends each press somewhere; this one only shows it.
            const roll = renderApprovals({ pressed: () => {} });
            for (const { approval, runs } of APPROVALS) {
                const handle = roll.add({ ...approval, checks: runs?.map((r) => ({ name: r.name, state: 'waiting' as const })) });
                if (runs) runChecks(handle, runs);
            }
            return roll.body;
        },
    };
    tray.add(item);
}
