/**
 * 「[Opus 5.5] What waits to be said in xenon: a pill in its input field (forms/pill.ts, content/say.ts `waiting`).」
 *
 * "IF THERE ARE MESSAGES PENDING TO BE SENT, AS A COLLECTED BATCH, I SEE IT". It was an overlay that, pressed, took the
 * 「[Opus 5.5] whole screen: "About it taking over everything for no good reason?" "THE OLD PATTERN IS BAD". "I want you to use the」
 * 「[Opus 5.5] pills for it instead". At rest it says how many wait and when they go. Pressed, it is across its row, the words, the」
 * 「[Opus 5.5] keyboard and what was said where they were: what waits, each saying what it says, and what is done with them, said」
 * 「[Opus 5.5] once, on one line. A row pressed is chosen; Cancel takes what is chosen, or, nothing chosen, all of it.」
 */

import { pillFrom, PILL_RESTED } from '../forms/pill';
import { pressFrom } from '../forms/press';
import { declareScroller } from '../content/scroll';

/** Who said it, when, and what. */
const WAITING: [string, string, string][] = [
    ['Alder', '21:40', 'pull request one is open'],
    ['Hazel', '22:10', 'the pond is drained'],
    ['Alder', '22:40', 'pull request two is open'],
    ['Alder', '23:10', 'the checks on pull request two passed'],
    ['Hazel', '23:40', 'the heron came back to the pond and stood there until it was dark'],
    ['Alder', '00:10', 'pull request one was merged'],
    ['Hazel', '00:20', 'the pond is filling again'],
    ['Alder', '00:30', 'a review asks for a smaller press'],
];

const pin = (node: HTMLElement, styles: Record<string, string>) => {
    for (const [name, value] of Object.entries(styles)) node.style.setProperty(name, value);
};

export function outboxFrom(): HTMLElement {
    const id = 'xenon-outbox';
    const to = 'Lamplighter';
    let due = '00:40';
    const rows: HTMLButtonElement[] = [];
    const chosen = () => rows.filter((r) => r.getAttribute('aria-pressed') === 'true');
    const says = () => `${rows.length} wait · ${due}`;
    const moment = () => new Promise<void>((resolve) => setTimeout(resolve, 400));
    const away = (gone: HTMLButtonElement[]) => {
        for (const row of gone) {
            rows.splice(rows.indexOf(row), 1);
            row.remove();
        }
    };

    const when = document.createElement('div');
    const sayWhen = () => { when.textContent = `To ${to}, at ${due}.`; };
    sayWhen();

    // 「[Opus 5.5] What is done with what waits, said once, on one line.」
    const actions = document.createElement('div');
    pin(actions, { display: 'flex', 'flex-wrap': 'wrap', gap: '8px' });
    actions.append(
        pressFrom({ id: `${id}-now`, title: 'Send now', does: async () => { await moment(); away(rows.slice()); told(); } }).element,
        pressFrom({ id: `${id}-later`, title: 'Later', does: async () => { await moment(); due = '01:10'; sayWhen(); told(); } }).element,
        // 「[Opus 5.5] What is chosen, or, nothing chosen, all of it. Never sent can't be undone: the first press arms it.」
        pressFrom({
            id: `${id}-cancel`, title: 'Cancel', again: 'never sent', irrevocable: true,
            // 「[Opus 5.5] What is taken is what was chosen when it was pressed: a row let go while it is done stays taken.」
            does: async () => { const taken = chosen().length ? chosen() : rows.slice(); await moment(); away(taken); told(); },
        }).element,
    );

    // 「[Opus 5.5] What waits: each says what it says; a short list, scrolled in itself.」
    const list = document.createElement('div');
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', 'What waits');
    pin(list, { display: 'flex', 'flex-direction': 'column', gap: '4px', 'max-height': '30vh', 'overflow-y': 'auto' });
    declareScroller(list);
    for (const [who, at, what] of WAITING) {
        const row = document.createElement('button');
        row.type = 'button';
        row.dataset.waits = '';
        row.setAttribute('aria-pressed', 'false');
        const from = document.createElement('div');
        from.dataset.waitsFrom = '';
        from.textContent = `${who} · ${at}`;
        const text = document.createElement('div');
        text.textContent = what;
        row.append(from, text);
        row.addEventListener('click', () => row.setAttribute('aria-pressed', String(row.getAttribute('aria-pressed') !== 'true')));
        rows.push(row);
        list.appendChild(row);
    }

    // 「[Opus 5.5] Drawn once, before it is first pressed: it says how many wait from the start.」
    const whole = document.createElement('div');
    pin(whole, { display: 'flex', 'flex-direction': 'column', gap: '8px', width: '100%' });
    whole.append(when, actions, list);

    const pill = pillFrom({ id, title: says(), renderContent: () => whole });
    pill.element.dataset.outbox = id;
    pill.element.title = 'What waits to be said';
    // 「[Opus 5.5] Nothing left, it rests and is gone; otherwise it says what waits.」
    const told = () => {
        pill.retitle(says());
        if (rows.length) return;
        pill.rest();
        // 「[Opus 5.5] Already at rest, it is not told so again: gone now.」
        if (pill.element.dataset.form === 'pill' && pill.element.dataset.pillMoving === undefined) pill.element.hidden = true;
    };
    pill.element.addEventListener(PILL_RESTED, () => { pill.element.hidden = rows.length === 0; });
    return pill.element;
}
