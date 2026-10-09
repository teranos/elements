/**
 * Approve specimen — Rubidium, the next element after the panel's Krypton.
 *
 * "Do you hear how little it matters what the 'thing' is to approve?"
 * An approval is something to look at, options to choose between, maybe a
 * confidence on each, maybe something to open that chooses nothing. One is
 * chosen at a time and the choice can change, as often as the thumb likes,
 * until it becomes final. Here time running out makes it final; in a host it
 * could be something else. Approvals is a panel, a list to go through.
 */

import { tray } from '../tray/tray';
import type { Element } from '../element';

interface Option {
    label: string;
    /** 0–100. Left out where a percentage makes no sense, as on a merge. */
    confidence?: number;
}

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
        options: [{ label: 'Yes', confidence: 82 }, { label: 'No', confidence: 18 }],
        openForSeconds: 60,
    },
    {
        title: 'Merge PR #27',
        context: () => text(['Rubidium: an approval you can change your mind on', '2 files · +71 −0 · checks green'], true),
        options: [{ label: 'Merge' }, { label: 'Don’t merge' }],
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
        options: [{ label: 'Yes' }, { label: 'No' }],
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
    btn.style.border = '1px solid #fff';
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

    let chosen: number | null = null;
    let final = false;
    let left = approval.openForSeconds;

    const buttons = approval.options.map((option, i) => {
        const btn = optionButton(option);
        btn.addEventListener('click', () => {
            if (final) return;
            chosen = i;
            show();
        });
        row.appendChild(btn);
        return btn;
    });

    const show = () => {
        buttons.forEach((btn, i) => {
            const on = chosen === i;
            btn.style.background = on ? '#fff' : '#000';
            btn.style.color = on ? '#000' : '#fff';
            btn.disabled = final;
            btn.style.opacity = final && !on ? '0.4' : '1';
        });
        clock.textContent = final
            ? `final · ${chosen === null ? 'nothing chosen' : approval.options[chosen]!.label}`
            : `${chosen === null ? 'not chosen' : approval.options[chosen]!.label} · final in ${left}s`;
    };

    const timer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
            final = true;
            clearInterval(timer);
        }
        show();
    }, 1000);

    card.append(title, approval.context(), row);

    for (const aside of approval.asides ?? []) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = aside.label;
        btn.style.alignSelf = 'flex-start';
        btn.style.background = 'none';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.padding = '8px 0';
        btn.style.font = 'inherit';
        btn.style.textDecoration = 'underline';
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
