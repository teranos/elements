/**
 * 「[Fable 5.2] What agents said that waits to go, in xenon: one pill for what one said to one other. At rest it says when,」
 * 「[Fable 5.2] which way and who. Pressed, it holds that and nothing else: who, what was said, and the four things that can」
 * 「[Fable 5.2] be done with it.」
 *
 * "IF THERE ARE MESSAGES PENDING TO BE SENT, AS A COLLECTED BATCH, I SEE IT"
 * "I don't like how constantly meaning is conveyed with words while visually you could use standard stuff"
 *
 * 「[Fable 5.2] The four are send, edit, delay, cancel, in that order, each drawn and none written. How each is done is the」
 * 「[Fable 5.2] phone's own. Send and cancel take two presses: armed, one is filled. Edit turns what was said into a field,」
 * 「[Fable 5.2] and pressed again keeps it. Delay is the time itself: pressed, the phone's own date and time setter opens.」
 * 「[Fable 5.2] The four share the whole width evenly, one line and one height: nothing in the pill is empty. A press outside」
 * 「[Fable 5.2] lets the pill go. A clock plays the node. Examples only.」
 */

import { pillFrom, PILL_RESTED } from '../forms/pill';
import { MEANS, CREATES, ARMED_FOR_MS } from '../forms/press';

interface Said {
    id: string;
    way: 'in' | 'out';
    who: string;
    /** Minutes from now that it goes. */
    inMinutes: number;
    lines: string[];
}

const SAID: Said[] = [
    { id: 'rowan', way: 'in', who: 'Rowan', inMinutes: 35, lines: ['The split is done. Two PRs are open, #27 and #31.'] },
    { id: 'keeper', way: 'out', who: 'Keeper', inMinutes: 92, lines: ['k follows the new stack from tonight.', 'Say when the first deploy is through.'] },
];

const two = (n: number) => String(n).padStart(2, '0');

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** A time as ag says it on a pill: HH:MM, with its MM-DD before it when that is not today, as one word. */
export function whenOf(at: Date, now: Date): string {
    const clock = `${two(at.getHours())}:${two(at.getMinutes())}`;
    return sameDay(at, now) ? clock : `${two(at.getMonth() + 1)}-${two(at.getDate())}.${clock}`;
}

/**
 * A time said short, as the phone says its months: the hour and minute today; on another day the month in three letters
 * and the day before them. Never the year.
 */
export function shortOf(at: Date, now: Date): string {
    const clock = `${two(at.getHours())}:${two(at.getMinutes())}`;
    return sameDay(at, now) ? clock : `${at.toLocaleString(undefined, { month: 'short' })} ${at.getDate()} ${clock}`;
}

/** A time as a date and time field holds it: this clock's, to the minute. */
const fieldOf = (at: Date) => `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}T${two(at.getHours())}:${two(at.getMinutes())}`;

/** A mark, drawn: what a press wears in place of words. */
function drawn(path: string): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', path);
    svg.appendChild(line);
    return svg;
}

const MARKS = {
    send: 'M5 13l4 4L19 7',
    edit: 'M4 20h4L19 9l-4-4L4 16v4M13.5 6.5l4 4',
    delay: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3 2',
    cancel: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M5.6 5.6l12.8 12.8',
} as const;

/** One of the four, shaped: as tall as a finger, as wide as its share of the row, its mark in its middle. */
function shaped(node: HTMLElement, act: string): void {
    node.dataset.saidAct = '';
    node.dataset.act = act;
    // Its box is its own: it shares its row with the others (fit.ts).
    node.dataset.ownBox = '';
    for (const [name, value] of Object.entries({
        display: 'grid', 'place-items': 'center', 'box-sizing': 'border-box', width: '100%', height: '44px',
        padding: '0', margin: '0', 'border-radius': '9999px', cursor: 'pointer', 'touch-action': 'manipulation',
    })) node.style.setProperty(name, value, 'important');
}

/**
 * A press that wears a mark. With `armed`, it takes two presses: the first fills it, the second does it, and left alone
 * it is at rest again.
 */
function round(act: 'send' | 'edit' | 'cancel', says: string, does: () => void, armed?: 'yes' | 'no'): HTMLButtonElement {
    const press = document.createElement('button');
    press.type = 'button';
    shaped(press, act);
    press.setAttribute('aria-label', says);
    press.appendChild(drawn(MARKS[act]));
    let waits: ReturnType<typeof setTimeout> | undefined;
    const rest = () => {
        clearTimeout(waits);
        delete press.dataset.armed;
        press.style.removeProperty('background-color');
        press.style.removeProperty('color');
    };
    press.addEventListener('click', () => {
        if (!armed || press.dataset.armed === '') {
            rest();
            does();
            return;
        }
        press.dataset.armed = '';
        press.style.setProperty('background-color', armed === 'yes' ? CREATES.green : MEANS.no, 'important');
        press.style.setProperty('color', armed === 'yes' ? CREATES.ink : MEANS.neither, 'important');
        waits = setTimeout(rest, ARMED_FOR_MS);
    });
    return press;
}

function pilled(said: Said): HTMLElement {
    const arrow = said.way === 'in' ? '<-' : '->';
    /** When it goes. */
    let at = new Date(Date.now() + said.inMinutes * 60000);
    /** What was said, as it stands. */
    let says = said.lines.join('\n');
    let gone = false;

    const titled = () => `${whenOf(at, new Date())}${arrow}[${said.who}]`;
    const away = () => {
        gone = true;
        pill.rest();
        if (pill.element.dataset.form === 'pill' && pill.element.dataset.pillMoving === undefined) pill.element.hidden = true;
    };

    const holds = (): HTMLElement => {
        const whole = document.createElement('div');
        whole.style.setProperty('display', 'flex');
        whole.style.setProperty('flex-direction', 'column');
        whole.style.setProperty('gap', '8px');
        whole.style.setProperty('width', '100%');

        // 「[Fable 5.2] When, who and what was said, in ag's order and on one line of text: the time first and subtle, then the」
        // 「[Fable 5.2] name, then the words, running on.」
        const who = document.createElement('div');
        who.dataset.saidWho = '';
        who.style.setProperty('white-space', 'pre-wrap');
        const shown = document.createElement('span');
        shown.dataset.saidAt = '';
        shown.style.setProperty('color', '#aaa');
        const say = () => { shown.textContent = shortOf(at, new Date()); };
        say();
        const name = document.createElement('b');
        name.textContent = said.who;
        const what = document.createElement('span');
        what.dataset.saidWhat = '';
        what.textContent = says;
        who.append(shown, ' ', name, ' ', what);

        // 「[Fable 5.2] Edit: what was said is a field, the keyboard up. Pressed again, what it holds is what is said.」
        let field: HTMLTextAreaElement | null = null;
        const edit = round('edit', 'Edit', () => {
            if (field) {
                says = field.value;
                what.textContent = says;
                pill.element.dataset.says = says;
                field.replaceWith(what);
                field = null;
                edit.setAttribute('aria-pressed', 'false');
                return;
            }
            field = document.createElement('textarea');
            field.setAttribute('aria-label', `What is said to ${said.who}`);
            field.rows = Math.min(8, Math.max(2, says.split('\n').length + 1));
            field.value = says;
            // A line of its own under the name, the whole width, in the words' own font.
            for (const [name, value] of Object.entries({ display: 'block', width: '100%', 'box-sizing': 'border-box', 'font-family': 'inherit', margin: '4px 0 0' })) {
                field.style.setProperty(name, value);
            }
            what.replaceWith(field);
            edit.setAttribute('aria-pressed', 'true');
            field.focus();
        });
        edit.setAttribute('aria-pressed', 'false');

        // 「[Fable 5.2] Delay: shaped as the others are, wearing a clock. Pressed, the phone's own date and time setter opens:」
        // 「[Fable 5.2] its field lies over the mark, unseen. When it goes is said before the name, not here.」
        const delay = document.createElement('label');
        shaped(delay, 'delay');
        delay.style.setProperty('position', 'relative');
        delay.appendChild(drawn(MARKS.delay));
        const setter = document.createElement('input');
        setter.type = 'datetime-local';
        setter.setAttribute('aria-label', 'When it goes');
        setter.value = fieldOf(at);
        for (const [name, value] of Object.entries({ position: 'absolute', inset: '0', width: '100%', height: '100%', opacity: '0', margin: '0', padding: '0', border: '0' })) {
            setter.style.setProperty(name, value, 'important');
        }
        setter.addEventListener('change', () => {
            const chosen = new Date(setter.value);
            if (Number.isNaN(chosen.getTime())) return;
            at = chosen;
            pill.element.dataset.held = at.toISOString();
            say();
            pill.retitle(titled());
        });
        delay.appendChild(setter);

        // 「[Fable 5.2] Send, edit, delay, cancel: one line, one height, the whole width shared evenly between the four.」
        const acts = document.createElement('div');
        acts.dataset.saidActs = '';
        acts.style.setProperty('display', 'grid');
        acts.style.setProperty('grid-template-columns', 'repeat(4, 1fr)');
        acts.style.setProperty('gap', '8px');
        acts.append(
            round('send', 'Send now', away, 'yes'),
            edit,
            delay,
            round('cancel', 'Cancel', away, 'no'),
        );

        whole.append(who, acts);
        return whole;
    };

    const pill = pillFrom({ id: `said-${said.id}`, title: titled(), renderContent: holds });
    pill.element.dataset.said = said.id;
    pill.element.title = `What ${said.way === 'in' ? `${said.who} said` : `was said to ${said.who}`}`;
    pill.element.addEventListener(PILL_RESTED, () => { pill.element.hidden = gone; });
    return pill.element;
}

/** What was said and waits to go, a pill each, the soonest first. */
export function saidFrom(): HTMLElement[] {
    return SAID.slice().sort((a, b) => a.inMinutes - b.inMinutes).map(pilled);
}
