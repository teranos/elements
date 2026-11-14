/**
 * The choices a chat says with, as one pill.
 *
 * "Why not do it like anthropic does, where its a combined model+effort pill". The pill reads what is chosen, joined
 * (`Opus 5.5 · high`); pressed, it opens a sheet above itself with each choice named and its options under it; an
 * option taken is what the pill reads, the host is told, and the sheet closes. Its shape is the package's; its look,
 * the host's. Beside a say field it shows only while something is being said (content/say.ts): "We don't need to show
 * the picker always".
 */

export interface Choice {
    /** What is chosen, said above its options: "Model", "Effort". */
    name: string;
    options: readonly string[];
    value: string;
}

export interface Choices {
    id: string;
    /** What the pill is, for a screen reader: "Model and effort". */
    label: string;
    choices: Choice[];
    /** Told the choice and what it now is, each time one is taken. */
    onChoose?: (name: string, value: string) => void;
}

/** The pill: rounded whole, as the say pill is. */
const PILL: Record<string, string> = { 'border-radius': '9999px' };

/** The sheet: above the pill, in the element's own colour, rounded as a window is. */
const SHEET: Record<string, string> = {
    position: 'absolute', bottom: 'calc(100% + 8px)', left: '0', 'z-index': '2', width: 'max-content',
    'flex-direction': 'column', gap: '4px', padding: '8px', 'border-radius': '16px',
};

const OPTIONS: Record<string, string> = { display: 'flex', 'flex-wrap': 'wrap', gap: '4px' };

const ROUND: Record<string, string> = { 'border-radius': '9999px' };

function pin(node: HTMLElement, styles: Record<string, string>): void {
    for (const [name, value] of Object.entries(styles)) node.style.setProperty(name, value, 'important');
}

/** Whether a choices pill's sheet is open, for the say field beside it (content/say.ts). */
export function sheetOpen(choices: HTMLElement): boolean {
    return choices.querySelector<HTMLElement>(':scope > [data-choices-sheet]')?.hidden === false;
}

/** One pill for the choices a chat says with. */
export function choicesFrom(c: Choices): HTMLElement {
    if (!c.choices.length) throw new TypeError(`choices ${c.id} chooses nothing: it has no choices`);
    for (const choice of c.choices) {
        if (!choice.options.includes(choice.value)) {
            throw new TypeError(`choice ${choice.name} of ${c.id} is "${choice.value}", which is not among its options: ${choice.options.join(', ')}`);
        }
    }
    const chosen = new Map(c.choices.map((choice) => [choice.name, choice.value]));

    const choices = document.createElement('div');
    choices.dataset.choices = c.id;
    choices.style.setProperty('position', 'relative', 'important');
    // The row's whole width: the sheet over it is as wide as what it lists, up to the row (fit.ts holds it to 100%).
    choices.style.setProperty('flex', '1 1 100%', 'important');

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.dataset.choicesPill = '';
    pill.setAttribute('aria-haspopup', 'true');
    pin(pill, PILL);

    const sheet = document.createElement('div');
    sheet.dataset.choicesSheet = '';
    sheet.hidden = true;
    pin(sheet, SHEET);
    sheet.style.setProperty('display', 'none', 'important');

    const say = () => {
        const words = c.choices.map((choice) => chosen.get(choice.name)!).join(' · ');
        pill.textContent = words;
        pill.setAttribute('aria-label', `${c.label}: ${words}`);
        pill.setAttribute('aria-expanded', String(!sheet.hidden));
        for (const press of Array.from(sheet.querySelectorAll<HTMLButtonElement>('[data-choice]'))) {
            press.setAttribute('aria-pressed', String(chosen.get(press.dataset.choice!) === press.textContent));
        }
    };

    for (const choice of c.choices) {
        const name = document.createElement('div');
        name.dataset.choicesName = '';
        name.textContent = choice.name;
        const options = document.createElement('div');
        pin(options, OPTIONS);
        for (const value of choice.options) {
            const press = document.createElement('button');
            press.type = 'button';
            press.dataset.choice = choice.name;
            press.textContent = value;
            pin(press, ROUND);
            press.addEventListener('click', () => {
                chosen.set(choice.name, value);
                close();
                c.onChoose?.(choice.name, value);
                choices.dispatchEvent(new (choices.ownerDocument.defaultView ?? window).Event(CHOICE_TAKEN));
            });
            options.appendChild(press);
        }
        sheet.append(name, options);
    }

    // A press anywhere else closes it, as a sheet is left.
    const outside = (e: Event) => { if (!choices.contains(e.target as Node)) close(); };
    const open = () => {
        // In the element's own colour: what is said under it is not read through it.
        const element = choices.closest<HTMLElement>('[data-element-id]');
        const ground = element ? (element.style.backgroundColor || getComputedStyle(element).backgroundColor) : '';
        if (ground) sheet.style.setProperty('background-color', ground, 'important');
        sheet.hidden = false;
        // Shown by its display, written important as its place is: hidden alone loses to a host's display.
        sheet.style.setProperty('display', 'flex', 'important');
        say();
        choices.ownerDocument.addEventListener('pointerdown', outside, true);
    };
    const close = () => {
        sheet.hidden = true;
        sheet.style.setProperty('display', 'none', 'important');
        say();
        choices.ownerDocument.removeEventListener('pointerdown', outside, true);
        choices.dispatchEvent(new (choices.ownerDocument.defaultView ?? window).Event(CHOICES_CLOSED));
    };
    pill.addEventListener('click', () => (sheet.hidden ? open() : close()));
    // Escape, from the pill or the sheet, leaves it as it was.
    choices.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) close(); });

    choices.append(sheet, pill);
    say();
    return choices;
}

/** What a choices pill tells itself when its sheet closes: the say field beside it looks again (content/say.ts). */
export const CHOICES_CLOSED = 'elements:choices-closed';

/** What a choices pill tells itself when an option is taken: the say field beside it is said into again (content/say.ts). */
export const CHOICE_TAKEN = 'elements:choice-taken';
