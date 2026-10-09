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

interface Option {
    label: string;
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
    openForSeconds: number;
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
        context: () => text(['Rubidium: an approval you can change your mind on', '2 files · +71 −0 · checks green'], true),
        options: [{ label: 'Merge', means: 'yes' }, { label: 'Don’t merge', means: 'no' }],
        openForSeconds: 90,
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

function optionButton(option: Option): HTMLButtonElement {
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
    return btn;
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

    const clock = document.createElement('div');
    clock.style.fontFamily = 'var(--font-mono)';
    clock.style.fontSize = '12px';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';

    // Every tap sends. Sending the other one sends again; what was sent last
    // stands, until the time runs out and nothing more can be sent.
    const sent: number[] = [];
    let locked = false;
    let left = approval.openForSeconds;
    const last = () => sent[sent.length - 1] ?? null;

    const buttons = approval.options.map((option, i) => {
        const btn = optionButton(option);
        btn.addEventListener('click', () => {
            if (locked || last() === i) return;
            sent.push(i);
            show();
        });
        row.appendChild(btn);
        return btn;
    });

    const show = () => {
        const current = last();
        buttons.forEach((btn, i) => {
            const on = current === i;
            const means = approval.options[i]!.means;
            const color = COLOR[means ?? 'neither'];
            // What was sent last fills with its colour; the others wear it as an outline.
            btn.style.background = on ? color : '#000';
            btn.style.color = on ? (means ? '#fff' : '#000') : color;
            btn.disabled = locked;
            btn.style.opacity = locked && !on ? '0.4' : '1';
        });
        const history = sent.map((i) => approval.options[i]!.label).join(' → ');
        clock.textContent = locked
            ? (current === null ? 'locked · nothing was sent' : `locked · ${history}`)
            : (current === null ? `nothing sent · locks in ${left}s` : `sent ${history} · locks in ${left}s`);
    };

    const timer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
            locked = true;
            clearInterval(timer);
        }
        show();
    }, 1000);

    card.append(title, approval.context(), row);

    for (const aside of approval.asides ?? []) {
        // Half a yes or no button: as wide as one, half as tall. It opens, it chooses nothing.
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = aside.label;
        btn.style.alignSelf = 'flex-start';
        btn.style.width = 'calc((100% - 8px) / 2)';
        btn.style.minHeight = '32px';
        btn.style.padding = '4px 8px';
        btn.style.background = '#000';
        btn.style.color = '#fff';
        btn.style.border = '1px solid #fff';
        btn.style.borderRadius = '0';
        btn.style.font = 'inherit';
        btn.style.touchAction = 'manipulation';
        let opened: HTMLElement | null = null;
        btn.addEventListener('click', () => {
            if (opened) {
                opened.remove();
                opened = null;
                return;
            }
            opened = aside.open();
            opened.style.borderLeft = '1px solid #fff';
            opened.style.paddingLeft = '12px';
            btn.after(opened);
        });
        card.appendChild(btn);
    }

    card.appendChild(clock);
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
