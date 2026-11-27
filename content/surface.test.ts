/**
 * 「[Fable 5.2] A surface an agent says, drawn: A2UI v1.0 messages as one node, with the package's own press, field and choices.」
 *
 * 「[Fable 5.2] Personas:」
 * 「[Fable 5.2] - Tim: Happy path — a question with a choice of one is drawn, chosen, and answered as A2UI's action」
 * 「[Fable 5.2] - Spike: Edge cases — a component it does not draw, a child nobody said, messages that are no surface」
 * 「[Fable 5.2] - Jenny: Complex scenarios — a field typed into, a list drawn from data, the agent saying more after」
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { surfaceFrom, surfacePillFrom, ELEMENTS_CATALOG, type SurfaceAction } from './surface';
import { MEANS, CREATES } from '../forms/press';

afterEach(() => { document.body.innerHTML = ''; });

const CATALOG = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

/** What Cumulus says to Rowan's person: valid against A2UI v1.0 at 36725ee (Ajv, 2026-11-27). */
const WHICH_FIRST = {
    version: '1.0',
    createSurface: {
        surfaceId: 'which-first',
        catalogId: CATALOG,
        components: [
            { id: 'root', component: 'Column', children: ['asks', 'choice', 'send'] },
            { id: 'asks', component: 'Text', text: 'Which do I do first?' },
            {
                id: 'choice',
                component: 'ChoicePicker',
                variant: 'mutuallyExclusive',
                options: [
                    { label: 'the split', value: 'split' },
                    { label: "the outside agent's person", value: 'person' },
                    { label: 'neither, wait for me', value: 'wait' },
                ],
                value: { '@path': '/chosen' },
            },
            {
                id: 'send',
                component: 'Button',
                child: 'send_says',
                action: { event: { name: 'chosen', context: { chosen: { '@path': '/chosen' } } } },
            },
            { id: 'send_says', component: 'Text', text: 'answer' },
        ],
        dataModel: { chosen: [] },
    },
};

function drawn(messages: unknown[], onAction?: (action: SurfaceAction) => void | Promise<void>) {
    const surface = surfaceFrom({ messages, onAction });
    document.body.appendChild(surface.element);
    return surface;
}

const option = (root: HTMLElement, says: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('[data-surface-option]')).find((b) => b.textContent === says)!;

describe('Tim: a question with a choice of one', () => {
    test('is one node, named for its surface, saying what was asked and each option', () => {
        const { element } = drawn([WHICH_FIRST]);
        expect(element.dataset.surface).toBe('which-first');
        expect(element.querySelector('[data-surface-component="asks"]')!.textContent).toBe('Which do I do first?');
        expect(Array.from(element.querySelectorAll('[data-surface-option]')).map((b) => b.textContent))
            .toEqual(['the split', "the outside agent's person", 'neither, wait for me']);
        expect(Array.from(element.querySelectorAll('[data-surface-option]')).map((b) => b.getAttribute('aria-pressed')))
            .toEqual(['false', 'false', 'false']);
    });

    test('its options are a list, one under another, each the whole line', () => {
        const { element } = drawn([WHICH_FIRST]);
        const group = element.querySelector<HTMLElement>('[data-surface-component="choice"] [role="group"]')!;
        expect(group.style.getPropertyValue('flex-direction')).toBe('column');
        for (const one of Array.from(group.querySelectorAll<HTMLElement>('[data-surface-option]'))) {
            expect(one.style.getPropertyValue('width')).toBe('100%');
            expect(one.style.getPropertyValue('text-align')).toBe('left');
            // Its box is its own: the package's fit does not make it as narrow as its words (fit.ts).
            expect(one.dataset.ownBox).toBe('');
        }
    });

    test('its button is the package\'s press, saying what its child says', () => {
        const { element } = drawn([WHICH_FIRST]);
        const press = element.querySelector<HTMLButtonElement>('[data-press="which-first-send"]')!;
        expect(press.querySelector('[data-face="title"]')!.textContent).toBe('answer');
    });

    test('an option taken is the one chosen: another taken, the first is let go', () => {
        const { element } = drawn([WHICH_FIRST]);
        option(element, 'the split').click();
        expect(option(element, 'the split').getAttribute('aria-pressed')).toBe('true');
        option(element, 'neither, wait for me').click();
        expect(option(element, 'the split').getAttribute('aria-pressed')).toBe('false');
        expect(option(element, 'neither, wait for me').getAttribute('aria-pressed')).toBe('true');
    });

    test('answered, the host is handed A2UI\'s action, what was chosen in its context', async () => {
        const told: SurfaceAction[] = [];
        const { element } = drawn([WHICH_FIRST], (action) => { told.push(action); });
        option(element, 'the split').click();
        element.querySelector<HTMLButtonElement>('[data-press="which-first-send"]')!.click();
        await settled();
        expect(told.length).toBe(1);
        expect(told[0].name).toBe('chosen');
        expect(told[0].surfaceId).toBe('which-first');
        expect(told[0].sourceComponentId).toBe('send');
        expect(told[0].context).toEqual({ chosen: ['split'] });
        expect(new Date(told[0].timestamp).toISOString()).toBe(told[0].timestamp);
    });

    test('nothing is sent anywhere by choosing: only the press tells the host', async () => {
        const told: SurfaceAction[] = [];
        const { element } = drawn([WHICH_FIRST], (action) => { told.push(action); });
        option(element, 'the split').click();
        await settled();
        expect(told.length).toBe(0);
    });
});

/** "One PR left for you": what an agent says when a merge waits on its person. Valid against A2UI v1.0 with catalog/v1/catalog.json. */
const ONE_PR_LEFT = (press: Record<string, unknown> = {}) => ({
    version: '1.0',
    createSurface: {
        surfaceId: 'one-pr-left',
        catalogId: ELEMENTS_CATALOG,
        components: [
            { id: 'root', component: 'Row', children: ['says', 'merge'] },
            { id: 'says', component: 'Text', text: 'PR #27 moves the lock to main.' },
            {
                id: 'merge', component: 'Press', text: 'merge', again: 'PR #27 is merged',
                action: { event: { name: 'merge', context: { repository: 'example/home', number: 27 } } },
                ...press,
            },
        ],
    },
});

// "To be clear that you're arming the button and can then press to confirm"
describe('Tim: a press of two stages, from the package\'s own catalog', () => {
    const merge = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('[data-press="one-pr-left-merge"]')!;
    /** A colour as this DOM writes it back. */
    const colour = (said: string) => { const probe = document.createElement('i'); probe.style.setProperty('background-color', said); return probe.style.getPropertyValue('background-color'); };

    test('says what it says, in its own text', () => {
        const { element } = drawn([ONE_PR_LEFT()]);
        expect(merge(element).querySelector('[data-face="title"]')!.textContent).toBe('merge');
        expect(merge(element).dataset.stage).toBe('rest');
    });

    test('pressed once, it is armed and says beside it what the second press does; the agent is told nothing', async () => {
        const told: SurfaceAction[] = [];
        const { element } = drawn([ONE_PR_LEFT()], (action) => { told.push(action); });
        merge(element).click();
        await settled();
        expect(merge(element).dataset.stage).toBe('armed');
        expect(element.querySelector('[data-press-again="one-pr-left-merge"]')!.textContent).toBe('again: PR #27 is merged');
        expect(told.length).toBe(0);
    });

    test('pressed again, the agent is told, with what it asked to be told', async () => {
        const told: SurfaceAction[] = [];
        const { element } = drawn([ONE_PR_LEFT()], (action) => { told.push(action); });
        merge(element).click();
        merge(element).click();
        await settled();
        expect(told.map((a) => [a.name, a.sourceComponentId, a.context])).toEqual([['merge', 'merge', { repository: 'example/home', number: 27 }]]);
        expect(merge(element).dataset.stage).toBe('rest');
    });

    test('with no again, one press tells the agent', async () => {
        const told: SurfaceAction[] = [];
        const { element } = drawn([ONE_PR_LEFT({ again: undefined })], (action) => { told.push(action); });
        merge(element).click();
        await settled();
        expect(told.length).toBe(1);
    });

    test('a second press that cannot be undone, or that creates, is the package\'s press of that kind', () => {
        const red = drawn([ONE_PR_LEFT({ irrevocable: true })]).element;
        merge(red).click();
        expect(merge(red).style.getPropertyValue('background-color')).toBe(colour(MEANS.no));
        document.body.innerHTML = '';
        const green = drawn([ONE_PR_LEFT({ creates: true })]).element;
        merge(green).click();
        expect(merge(green).style.getPropertyValue('background-color')).toBe(colour(CREATES.green));
    });

    test('the basic catalog\'s components are drawn under the package\'s catalog too', () => {
        const { element } = drawn([ONE_PR_LEFT()]);
        expect(element.querySelector('[data-surface-component="says"]')!.textContent).toBe('PR #27 moves the lock to main.');
    });
});

describe('Spike: a press the catalog does not allow', () => {
    test('one that cannot be undone, or creates, with no second stage to say so, is said in place', () => {
        const { element } = drawn([ONE_PR_LEFT({ again: undefined, irrevocable: true })]);
        expect(element.querySelector('[data-press]')).toBeNull();
        expect(element.querySelector('[data-surface-undrawn="Press"]')!.textContent).toBe('Press that cannot be undone, or creates, with no again is not drawn');
    });

    test('a Press on a surface of the basic catalog is said in place: that catalog has none', () => {
        const message = ONE_PR_LEFT();
        const { element } = drawn([{ ...message, createSurface: { ...message.createSurface, catalogId: CATALOG } }]);
        expect(element.querySelector('[data-surface-undrawn="Press"]')!.textContent).toBe('Press is not drawn yet');
    });

    test('a component that names the package\'s catalog itself is drawn on a surface of the basic one', () => {
        const message = ONE_PR_LEFT();
        const components = message.createSurface.components.map((c) => (c.component === 'Press' ? { ...c, '@catalogId': ELEMENTS_CATALOG } : c));
        const { element } = drawn([{ ...message, createSurface: { ...message.createSurface, catalogId: CATALOG, components } }]);
        expect(element.querySelector('[data-press="one-pr-left-merge"]')).not.toBeNull();
    });

    test('a component of a catalog nobody draws is said in place', () => {
        const { element } = drawn([{
            version: '1.0',
            createSurface: { surfaceId: 's', catalogId: 'example.com:theirs', components: [{ id: 'root', component: 'Text', text: 'hello' }] },
        }]);
        expect(element.textContent).toBe('Text is not drawn yet');
    });
});

describe('Spike: what is no surface, or not drawn', () => {
    test('a component it does not draw is said in place, and the rest is drawn', () => {
        const { element } = drawn([{
            version: '1.0',
            createSurface: {
                surfaceId: 's', catalogId: CATALOG,
                components: [
                    { id: 'root', component: 'Column', children: ['a', 'b'] },
                    { id: 'a', component: 'Slider', value: 3, max: 10 },
                    { id: 'b', component: 'Text', text: 'still here' },
                ],
            },
        }]);
        const undrawn = element.querySelector<HTMLElement>('[data-surface-undrawn]')!;
        expect(undrawn.dataset.surfaceUndrawn).toBe('Slider');
        expect(undrawn.textContent).toBe('Slider is not drawn yet');
        expect(element.querySelector('[data-surface-component="b"]')!.textContent).toBe('still here');
    });

    test('a child nobody said is said in place', () => {
        const { element } = drawn([{
            version: '1.0',
            createSurface: { surfaceId: 's', catalogId: CATALOG, components: [{ id: 'root', component: 'Row', children: ['ghost'] }] },
        }]);
        expect(element.querySelector('[data-surface-undrawn]')!.textContent).toBe('ghost was not said');
    });

    test('a component that holds itself is said in place, not drawn forever', () => {
        const { element } = drawn([{
            version: '1.0',
            createSurface: { surfaceId: 's', catalogId: CATALOG, components: [{ id: 'root', component: 'Column', children: ['root'] }] },
        }]);
        expect(element.querySelector('[data-surface-undrawn]')!.textContent).toBe('root holds itself');
    });

    test('an obscured field is never drawn as plain text', () => {
        const { element } = drawn([{
            version: '1.0',
            createSurface: {
                surfaceId: 's', catalogId: CATALOG,
                components: [{ id: 'root', component: 'TextField', label: 'Password', value: { '@path': '/p' }, variant: 'obscured' }],
                dataModel: { p: 'hunter2' },
            },
        }]);
        expect(element.querySelector('input, textarea')).toBeNull();
        expect(element.textContent).toBe('TextField obscured is not drawn yet');
    });

    test('a button that calls a function is said in place: a press that does nothing is not drawn', () => {
        const { element } = drawn([{
            version: '1.0',
            createSurface: {
                surfaceId: 's', catalogId: CATALOG,
                components: [
                    { id: 'root', component: 'Button', child: 't', action: { functionCall: { '@call': 'openUrl', args: { url: 'https://example.com' } } } },
                    { id: 't', component: 'Text', text: 'open' },
                ],
            },
        }]);
        expect(element.querySelector('[data-press]')).toBeNull();
        expect(element.textContent).toBe('Button with a function call is not drawn yet');
    });

    test('messages that create no surface are refused', () => {
        expect(() => surfaceFrom({ messages: [] })).toThrow('a surface is created: no message says createSurface');
        expect(() => surfaceFrom({ messages: [{ version: '1.0', updateDataModel: { surfaceId: 's', value: {} } }] }))
            .toThrow('surface s is told something before it is created');
    });

    test('a message of another version, or for another surface, is refused, and nothing of the list is drawn', () => {
        expect(() => surfaceFrom({ messages: [{ ...WHICH_FIRST, version: '0.9' }] })).toThrow('a surface speaks A2UI 1.0, and message 0 says 0.9');
        const { element, say } = drawn([WHICH_FIRST]);
        expect(() => say([
            { version: '1.0', updateDataModel: { surfaceId: 'which-first', path: '/chosen', value: ['wait'] } },
            { version: '1.0', updateDataModel: { surfaceId: 'another', value: {} } },
        ])).toThrow('this surface is which-first, and message 1 is for another');
        expect(option(element, 'neither, wait for me').getAttribute('aria-pressed')).toBe('false');
    });

    test('what the host could not do with an action is said beside the press', async () => {
        const { element } = drawn([WHICH_FIRST], () => { throw new Error('Rowan is not reached'); });
        element.querySelector<HTMLButtonElement>('[data-press="which-first-send"]')!.click();
        await settled();
        expect(element.querySelector('[data-press-said="which-first-send"]')!.textContent).toBe('Rowan is not reached');
    });
});

describe('Jenny: fields, lists, and an agent that says more', () => {
    const NOTE = {
        version: '1.0',
        createSurface: {
            surfaceId: 'note', catalogId: CATALOG,
            components: [
                { id: 'root', component: 'Column', children: ['why', 'who', 'send'] },
                { id: 'why', component: 'TextField', label: 'Why', value: { '@path': '/why' }, variant: 'longText' },
                { id: 'who', component: 'ChoicePicker', label: 'Who is told', variant: 'multipleSelection', options: [{ label: 'Rowan', value: 'rowan' }, { label: 'Keeper', value: 'keeper' }], value: { '@path': '/who' } },
                { id: 'send', component: 'Button', child: 'send_says', action: { event: { name: 'noted', userMessage: { '@path': '/why' }, context: { why: { '@path': '/why' }, who: { '@path': '/who' }, kind: 'note' } } } },
                { id: 'send_says', component: 'Text', text: 'send' },
            ],
            dataModel: { why: 'because', who: ['rowan'] },
        },
    };

    test('a long text field is the package\'s field of several lines, holding what the data says', () => {
        const { element } = drawn([NOTE]);
        const field = element.querySelector<HTMLTextAreaElement>('[data-field="note-why"] textarea')!;
        expect(field.value).toBe('because');
        expect(element.querySelector('[data-field="note-why"] label')!.textContent).toBe('Why');
    });

    test('what is typed and what is chosen of many reach the host in the action, with what the agent said literally', async () => {
        const told: SurfaceAction[] = [];
        const { element } = drawn([NOTE], (action) => { told.push(action); });
        const field = element.querySelector<HTMLTextAreaElement>('[data-field="note-why"] textarea')!;
        field.value = 'because of the heron';
        field.dispatchEvent(new Event('input', { bubbles: true }));
        option(element, 'Keeper').click();
        expect(option(element, 'Rowan').getAttribute('aria-pressed')).toBe('true');
        element.querySelector<HTMLButtonElement>('[data-press="note-send"]')!.click();
        await settled();
        expect(told[0].context).toEqual({ why: 'because of the heron', who: ['rowan', 'keeper'], kind: 'note' });
        expect(told[0].userMessage).toBe('because of the heron');
    });

    test('a choice of many names what it chooses, for a screen reader and above its options', () => {
        const { element } = drawn([NOTE]);
        const group = element.querySelector<HTMLElement>('[data-surface-component="who"] [role="group"]')!;
        expect(group.getAttribute('aria-label')).toBe('Who is told');
    });

    const WAITS = {
        version: '1.0',
        createSurface: {
            surfaceId: 'waits', catalogId: CATALOG,
            components: [
                { id: 'root', component: 'List', children: { componentId: 'one', path: '/waiting' } },
                { id: 'one', component: 'Row', children: ['who', 'says'] },
                { id: 'who', component: 'Text', text: { '@path': 'who' }, variant: 'caption' },
                { id: 'says', component: 'Text', text: { '@path': 'says' } },
            ],
            dataModel: { waiting: [{ who: 'Rowan', says: 'the split is done' }, { who: 'Keeper', says: 'k is up' }] },
        },
    };

    test('a list is drawn from the data, each of its paths read from its own item', () => {
        const { element } = drawn([WAITS]);
        const rows = Array.from(element.querySelectorAll('[data-surface-component="one"]'));
        expect(rows.map((r) => r.textContent)).toEqual(['Rowanthe split is done', 'Keeperk is up']);
    });

    test('the agent saying more data, the same node says it: a text is changed where it stands, a list drawn anew', () => {
        const { element, say } = drawn([WAITS]);
        const first = element.querySelector('[data-surface-component="says"]')!;
        say([{ version: '1.0', updateDataModel: { surfaceId: 'waits', path: '/waiting/0/says', value: 'the split is merged' } }]);
        expect(first.textContent).toBe('the split is merged');
        expect(first.isConnected).toBe(true);
        say([{ version: '1.0', updateDataModel: { surfaceId: 'waits', path: '/waiting', value: [{ who: 'Window', says: 'one waits' }] } }]);
        expect(Array.from(element.querySelectorAll('[data-surface-component="one"]')).map((r) => r.textContent)).toEqual(['Windowone waits']);
        expect(element.isConnected).toBe(true);
    });

    test('a value said null is gone, and components said after replace the ones they name', () => {
        const { element, say } = drawn([WHICH_FIRST]);
        say([{ version: '1.0', updateComponents: { surfaceId: 'which-first', components: [{ id: 'asks', component: 'Text', text: 'Which one, then?' }] } }]);
        expect(element.querySelector('[data-surface-component="asks"]')!.textContent).toBe('Which one, then?');
        expect(element.querySelectorAll('[data-surface-option]').length).toBe(3);
        say([{ version: '1.0', updateDataModel: { surfaceId: 'which-first', path: '/chosen', value: null } }]);
        expect(Array.from(element.querySelectorAll('[data-surface-option]')).map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false']);
    });

    test('a surface created with nothing in it is drawn when its components arrive', () => {
        const { element, say } = drawn([{ version: '1.0', createSurface: { surfaceId: 'late', catalogId: CATALOG } }]);
        expect(element.childElementCount).toBe(0);
        say([{ version: '1.0', updateComponents: { surfaceId: 'late', components: [{ id: 'root', component: 'Text', text: 'here now' }] } }]);
        expect(element.textContent).toBe('here now');
    });

    test('deleted, it holds nothing and says so; told anything after, it refuses', () => {
        const { element, say } = drawn([WHICH_FIRST]);
        say([{ version: '1.0', deleteSurface: { surfaceId: 'which-first' } }]);
        expect(element.childElementCount).toBe(0);
        expect(element.dataset.surfaceDeleted).toBe('');
        expect(() => say([{ version: '1.0', updateDataModel: { surfaceId: 'which-first', value: {} } }])).toThrow('surface which-first was deleted');
    });
});

describe('Jenny: a pull request being worked on, a surface of its own', () => {
    const tells = (path: string, value: unknown) => ({ version: '1.0', updateDataModel: { surfaceId: 'pr-27', path, value } });
    const OPENED = (approval: Record<string, unknown> = {}) => ({
        version: '1.0',
        createSurface: {
            surfaceId: 'pr-27',
            catalogId: ELEMENTS_CATALOG,
            components: [
                { id: 'root', component: 'Pill', title: { '@path': '/title' }, child: 'merge' },
                {
                    id: 'merge', component: 'Approval', title: 'Merge PR #27', says: 'Moves the lock to main.',
                    link: { label: 'GitHub', href: 'https://github.com/teranos/elements/pulls' },
                    checks: [{ name: 'TypeScript', state: { '@path': '/checks/0' } }, { name: 'Unit', state: { '@path': '/checks/1' } }],
                    options: [
                        { label: 'Merge', means: 'yes', mark: 'merge', steps: [{ says: 'merge when main CI passes', settles: 'when-ready' }, { says: 'force merge', settles: 'now' }] },
                        { label: 'Don’t merge', means: 'no', mark: 'no', steps: [{ says: 'cancel the merge' }, { says: 'definitely no' }] },
                    ],
                    merges: { label: 'main CI' },
                    value: { '@path': '/stands' },
                    settled: { '@path': '/settled' },
                    action: { event: { name: 'decided', context: { number: 27, stands: { '@path': '/stands' } } } },
                    ...approval,
                },
            ],
            dataModel: { title: 'PR #27 · 0 of 2 checks', checks: ['running', 'waiting'], settled: false },
        },
    });
    const option = (root: HTMLElement, label: string) => root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    const pilled = (messages: unknown[], onAction?: (action: SurfaceAction) => void) => {
        const pill = surfacePillFrom({ messages, onAction });
        document.body.appendChild(pill.element);
        return pill;
    };

    test('is a pill, named for its surface, saying at rest what its root says', () => {
        const { element } = pilled([OPENED()]);
        expect(element.dataset.form).toBe('pill');
        expect(element.dataset.elementId).toBe('pr-27');
        expect(element.dataset.surfacePill).toBe('pr-27');
        expect(element.textContent).toBe('PR #27 · 0 of 2 checks');
    });

    test('says where it stands anew as its agent says more, the same node all the way', () => {
        const pill = pilled([OPENED()]);
        pill.say([tells('/checks/0', 'done'), tells('/checks/1', 'running'), tells('/title', 'PR #27 · 1 of 2 checks')]);
        expect(pill.element.textContent).toBe('PR #27 · 1 of 2 checks');
        expect(pill.element.isConnected).toBe(true);
    });

    test('deleted by its agent, it is gone from sight', () => {
        const pill = pilled([OPENED()]);
        pill.say([{ version: '1.0', deleteSurface: { surfaceId: 'pr-27' } }]);
        expect(pill.element.hidden).toBe(true);
    });

    test('a surface whose root is no Pill is no pill', () => {
        expect(() => surfacePillFrom({ messages: [WHICH_FIRST] })).toThrow("surface which-first is no pill: its root is not the package's Pill, or says nothing");
    });

    test('what it holds is the approval: its yes and its no, drawn as every approval is', () => {
        const { element } = drawn([OPENED()]);
        expect(element.querySelector('[data-title]')!.textContent).toBe('Merge PR #27');
        expect(option(element, 'Merge')).not.toBeNull();
        expect(option(element, 'Don’t merge')).not.toBeNull();
        expect(element.querySelector('svg[data-mark="merge"]')).not.toBeNull();
    });

    test('while its checks run nothing can be decided; all done, it can', () => {
        const { element, say } = drawn([OPENED()]);
        expect(option(element, 'Merge').disabled).toBe(true);
        say([tells('/checks/0', 'done'), tells('/checks/1', 'done')]);
        expect(option(element, 'Merge').disabled).toBe(false);
    });

    test('every press is told to the agent, with what now stands; the other option sends again', async () => {
        const told: SurfaceAction[] = [];
        const { element, say } = drawn([OPENED()], (action) => { told.push(action); });
        say([tells('/checks', ['done', 'done'])]);
        option(element, 'Merge').click();
        await settled();
        option(element, 'Don’t merge').click();
        await settled();
        expect(told.map((a) => a.context)).toEqual([
            { number: 27, stands: { option: 'Merge', says: 'merge when main CI passes', settles: 'when-ready' } },
            { number: 27, stands: { option: 'Don’t merge', says: 'cancel the merge' } },
        ]);
        expect(told[0].sourceComponentId).toBe('merge');
    });

    test('the same option pressed again says its next step', async () => {
        const told: SurfaceAction[] = [];
        const { element, say } = drawn([OPENED()], (action) => { told.push(action); });
        say([tells('/checks', ['done', 'done'])]);
        option(element, 'Merge').click();
        option(element, 'Merge').click();
        await settled();
        expect(told.map((a) => (a.context.stands as { says: string }).says)).toEqual(['merge when main CI passes', 'force merge']);
        // 「[Fable 5.2] Forced, it took effect at once: nothing more can be sent.」
        expect(option(element, 'Don’t merge').disabled).toBe(true);
    });

    test('the agent saying what stood took effect, nothing more can be sent', async () => {
        const { element, say } = drawn([OPENED()]);
        say([tells('/checks', ['done', 'done'])]);
        option(element, 'Merge').click();
        await settled();
        expect(option(element, 'Don’t merge').disabled).toBe(false);
        say([tells('/settled', true)]);
        expect(option(element, 'Don’t merge').disabled).toBe(true);
    });

    // "I know agents sometimes like to put a table in their response."
    test('options that are neither yes nor no, and something to open that chooses nothing, are an approval too', () => {
        const { element } = drawn([{
            version: '1.0',
            createSurface: {
                surfaceId: 'stuck', catalogId: ELEMENTS_CATALOG,
                components: [
                    {
                        id: 'root', component: 'Approval', title: 'Agent is stuck: how to proceed?', says: 'The migration fails on 3 rows.',
                        options: [{ label: 'Skip and log' }, { label: 'Backfill' }, { label: 'Stop' }],
                        asides: [{ label: 'The 3 rows', child: 'rows' }],
                        action: { event: { name: 'decided' } },
                    },
                    { id: 'rows', component: 'Table', heads: ['id', 'email'], rows: [['4812', 'null'], ['5090', 'null']] },
                ],
            },
        }]);
        expect(['Skip and log', 'Backfill', 'Stop'].map((label) => option(element, label) !== null)).toEqual([true, true, true]);
        const aside = Array.from(element.querySelectorAll<HTMLElement>('[role="button"]')).find((b) => b.textContent === 'The 3 rows')!;
        expect(aside.getAttribute('aria-expanded')).toBe('false');
        aside.click();
        expect(aside.getAttribute('aria-expanded')).toBe('true');
        expect(Array.from(aside.querySelectorAll('td')).map((td) => td.textContent)).toEqual(['4812', 'null', '5090', 'null']);
    });

    test('an approval with one option is said in place: there is nothing to choose between', () => {
        const { element } = drawn([OPENED({ options: [{ label: 'Merge', means: 'yes' }] })]);
        expect(element.querySelector('button')).toBeNull();
        expect(element.querySelector('[data-surface-undrawn="Approval"]')!.textContent).toBe('Approval with fewer than two options is not drawn');
    });

    test('what the host could not do with a press is said under the approval', async () => {
        const { element, say } = drawn([OPENED()], () => { throw new Error('the agent is not reached'); });
        say([tells('/checks', ['done', 'done'])]);
        option(element, 'Merge').click();
        await settled();
        expect(element.querySelector('[data-surface-said="merge"]')!.textContent).toBe('the agent is not reached');
    });

    test('a Pill that is not the root is said in place', () => {
        const { element } = drawn([{
            version: '1.0',
            createSurface: {
                surfaceId: 's', catalogId: ELEMENTS_CATALOG,
                components: [{ id: 'root', component: 'Column', children: ['p'] }, { id: 'p', component: 'Pill', title: 'x', child: 'root' }],
            },
        }]);
        expect(element.querySelector('[data-surface-undrawn="Pill"]')!.textContent).toBe('Pill is the root of its surface: it is not drawn inside another');
    });
});
