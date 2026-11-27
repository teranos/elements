/**
 * 「[Fable 5.2] What waits on a person to decide, in xenon: each thing a surface of its own (content/surface.ts), a pill in the」
 * 「[Fable 5.2] input field for as long as it lasts. One thing, one pill: a pull request is one pill, two are two. Pressed, a」
 * 「[Fable 5.2] pill holds that one thing and nothing else.」
 *
 * "Do you hear how little it matters what the 'thing' is to approve?"
 * "Click 1 means merge after CI passes, press again to force merge. If we still wait for CI, the NO will cancel the yes.
 * Press NO again and it's definitely NO."
 *
 * 「[Fable 5.2] These are the two pull requests of the five things Rubidium holds as its roll (examples/approve.ts). A pill is one」
 * 「[Fable 5.2] of them; Rubidium is all of them, and no pill leads there. What an agent said is another thing, with its own pill (examples/said.ts).」
 * 「[Fable 5.2] Nothing here builds an interface: each message is the whole of its pill, from the package's own catalog」
 * 「[Fable 5.2] (catalog/v1/catalog.json), and a clock plays the agent. Examples only: none of these is a real PR, agent run」
 * 「[Fable 5.2] or applicant.」
 */

import { surfacePillFrom, ELEMENTS_CATALOG, type SurfaceAction, type SurfacePill } from '../content/surface';

/** One of the checks a wait is made of, simulated: when it starts and how long it takes, in seconds. */
interface Run {
    name: string;
    starts: number;
    takes: number;
    /** Ends failed rather than done. */
    fails?: boolean;
}

interface Waits {
    id: string;
    /** What its pill says at rest, until its agent says otherwise. */
    title: string;
    approval: Record<string, unknown>;
    /** What its asides open. */
    holds?: Record<string, unknown>[];
    runs?: Run[];
}

const MERGE_OPTIONS = [
    {
        label: 'Merge', means: 'yes', mark: 'merge', steps: [
            { says: 'merge when main CI passes', settles: 'when-ready' },
            { says: 'force merge', settles: 'now' },
        ],
    },
    { label: 'Don’t merge', means: 'no', mark: 'no', steps: [{ says: 'cancel the merge' }, { says: 'definitely no' }] },
];

/** The most recent first. */
const WAITING: Waits[] = [
    {
        id: 'pr-31',
        title: 'PR #31',
        approval: {
            title: 'Merge PR #31',
            link: { label: 'GitHub', href: 'https://github.com/teranos/elements/pulls' },
            arrivedMinutesAgo: 2,
            says: 'Example: a PR whose checks fail. 4 files · +120 −36',
            options: MERGE_OPTIONS,
            merges: { label: 'main CI', seconds: 20 },
        },
        runs: [
            { name: 'TypeScript', starts: 0, takes: 6 },
            { name: 'Browser', starts: 0, takes: 9, fails: true },
            { name: 'Android Emulator, Chrome', starts: 1, takes: 20 },
            { name: 'iPhone Simulator, Safari', starts: 3, takes: 25 },
        ],
    },
    {
        id: 'pr-27',
        title: 'PR #27',
        approval: {
            title: 'Merge PR #27',
            link: { label: 'GitHub', href: 'https://github.com/teranos/elements/pull/27' },
            arrivedMinutesAgo: 3,
            says: 'Moves the lock for ground to main. 1 file · +3 −3',
            options: MERGE_OPTIONS,
            merges: { label: 'main CI', seconds: 20 },
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
];

/** What the agent says when something starts to wait: one A2UI message. */
function opened(waits: Waits): Record<string, unknown> {
    const runs = waits.runs ?? [];
    return {
        version: '1.0',
        createSurface: {
            surfaceId: waits.id,
            catalogId: ELEMENTS_CATALOG,
            components: [
                { id: 'root', component: 'Pill', title: { '@path': '/title' }, child: 'approval' },
                {
                    id: 'approval',
                    component: 'Approval',
                    ...waits.approval,
                    ...(runs.length ? { checks: runs.map((run, i) => ({ name: run.name, state: { '@path': `/checks/${i}` } })) } : {}),
                    value: { '@path': '/stands' },
                    action: { event: { name: 'decided', context: { of: waits.id, stands: { '@path': '/stands' } } } },
                },
                ...(waits.holds ?? []),
            ],
            dataModel: { title: waits.title, checks: runs.map(() => 'waiting') },
        },
    };
}

const tells = (id: string, path: string, value: unknown) => ({ version: '1.0', updateDataModel: { surfaceId: id, path, value } });

/** The agent's part, played by a clock: its checks run, and what was chosen takes effect. */
function played(waits: Waits): SurfacePill {
    let gone: ReturnType<typeof setTimeout> | undefined;
    const done = (after: number) => {
        clearTimeout(gone);
        gone = setTimeout(() => pill.say([{ version: '1.0', deleteSurface: { surfaceId: waits.id } }]), after);
    };
    const pill = surfacePillFrom({
        messages: [opened(waits)],
        // 「[Fable 5.2] A host sends the action to the agent; the agent does it, and deletes the surface once it took effect.」
        onAction: (action: SurfaceAction) => {
            pill.element.dataset.decided = JSON.stringify(action.context.stands);
            const stands = action.context.stands as { settles?: string } | undefined;
            // 「[Fable 5.2] Waiting on main's CI, it can still be changed: the surface lasts until that wait is over.」
            done(stands?.settles === 'when-ready' ? 23000 : 4000);
        },
    });
    const runs = waits.runs;
    if (runs) {
        const allDone = Math.max(0, ...runs.map((r) => r.starts + r.takes));
        let elapsed = 0;
        const say = () => {
            const states = runs.map((r) => (elapsed >= r.starts + r.takes ? (r.fails ? 'failed' : 'done') : elapsed >= r.starts ? 'running' : 'waiting'));
            const passed = states.filter((s) => s === 'done').length;
            const where = states.includes('failed') ? 'a check failed' : passed === runs.length ? 'ready' : `${passed} of ${runs.length} checks`;
            pill.say([tells(waits.id, '/checks', states), tells(waits.id, '/title', `${waits.title} · ${where}`)]);
        };
        say();
        const clock = setInterval(() => {
            elapsed += 1;
            if (!pill.element.hidden) say();
            if (elapsed >= allDone || pill.element.hidden) clearInterval(clock);
        }, 1000);
    }
    return pill;
}

/** What waits, a pill each, the most recent first. */
export function waitingFrom(): HTMLElement[] {
    return WAITING.map((waits) => played(waits).element);
}
