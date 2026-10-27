// A press: Button Form's variation that does what it says, once or in two stages.
// Personas: Tim (one press, two stages), Spike (rest is never red, arming runs out, a failure beside it, misuse), Jenny (every face from the start).

import { describe, test, expect, beforeEach } from 'bun:test';
import { pressFrom, pressSizeFor, AtField, AX, PRESS_SIZES, type Press } from './press';

/** JSDOM says a colour back as rgb(); happy-dom as it was set. Either is the colour. */
const isColor = (got: string, hex: string): boolean => {
    const n = parseInt(hex.slice(1), 16);
    const rgb = hex.length === 4
        ? `rgb(${[0, 1, 2].map((i) => parseInt(hex[i + 1]! + hex[i + 1]!, 16)).join(', ')})`
        : `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    return got.includes(hex) || got.includes(rgb);
};

const shown = (press: HTMLElement) => Array.from(press.querySelectorAll<HTMLElement>('[data-face]'))
    .filter((face) => face.style.visibility !== 'hidden')
    .map((face) => face.textContent);

const shownFaces = (press: HTMLElement) => Array.from(press.querySelectorAll<HTMLElement>('[data-face]'))
    .filter((face) => face.style.visibility !== 'hidden')
    .map((face) => face.dataset.face);

const faces = (press: HTMLElement) => Array.from(press.querySelectorAll<HTMLElement>('[data-face]')).map((face) => face.dataset.face);

let done: string[];

const place = (press: Press) => {
    const handle = pressFrom(press);
    document.body.appendChild(handle.element);
    return handle;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
    document.body.innerHTML = '';
    done = [];
});

describe('Tim: one press does it, two stages arm and then do it', () => {
    test('a press is a button that says its title, part of its element and not a second one', () => {
        const { element } = place({ id: 'save', title: 'Save', does: () => { done.push('save'); } });
        expect(element.tagName).toBe('BUTTON');
        expect(element.dataset.press).toBe('save');
        expect(element.hasAttribute('data-element-id')).toBe(false);
        expect(element.hasAttribute('data-form')).toBe(false);
        expect(shown(element)).toEqual(['Save']);
    });

    test('a press can wear a mark instead of its words, and its title is still its name', () => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const drawn = place({ id: 'github', title: 'Sign in with GitHub', mark: svg, does: () => {} }).element;
        expect(drawn.querySelector('[data-face="title"]')!.firstChild).toBe(svg);
        expect(drawn.getAttribute('aria-label')).toBe('Sign in with GitHub');
        const glyph = place({ id: 'birth', title: 'A subcanvas', mark: '⧉', does: () => {} }).element;
        expect(glyph.querySelector('[data-face="title"]')!.textContent).toBe('⧉');
        expect(glyph.getAttribute('aria-label')).toBe('A subcanvas');
    });

    test('one press does it', async () => {
        const { element } = place({ id: 'save', title: 'Save', does: () => { done.push('save'); } });
        element.click();
        await settle();
        expect(done).toEqual(['save']);
    });

    test('two stages: the first press arms and says what the second does; the second does it', async () => {
        const { element } = place({ id: 'revoke', title: 'Revoke', again: 'the token stops working', does: () => { done.push('revoke'); } });
        element.click();
        await settle();
        expect(done).toEqual([]);
        expect(element.dataset.stage).toBe('armed');
        expect(shown(element)).toEqual(['Revoke']);
        const again = element.nextElementSibling as HTMLElement;
        expect(again.dataset.pressAgain).toBe('revoke');
        expect(again.textContent).toBe('again: the token stops working');
        element.click();
        await settle();
        expect(done).toEqual(['revoke']);
        expect(element.dataset.stage).toBe('rest');
        expect(element.nextElementSibling).toBeNull();
    });

    test('while it is being done it says so and takes no press', async () => {
        let finish!: () => void;
        const { element } = place({ id: 'save', title: 'Save', does: () => new Promise<void>((resolve) => { finish = resolve; }) });
        element.click();
        await settle();
        expect(element.dataset.stage).toBe('doing');
        expect((element as HTMLButtonElement).disabled).toBe(false);
        expect(element.getAttribute('aria-busy')).toBe('true');
        expect(shownFaces(element)).toEqual(['doing']);
        expect(element.textContent).toBe('Save');
        element.click();
        await settle();
        expect(element.dataset.stage).toBe('doing');
        finish();
        await settle();
        expect(element.dataset.stage).toBe('rest');
        expect(shown(element)).toEqual(['Save']);
    });
});

describe('Spike: "the immediate red communicates, irrevocable click, which is wrong for this."', () => {
    test('at rest every press wears the ax element\'s look, the irrevocable one too', () => {
        const presses: Press[] = [
            { id: 'a', title: 'Save', does: () => {} },
            { id: 'b', title: 'Unbind', again: 'it is unbound', does: () => {} },
            { id: 'c', title: 'Nuke', again: 'gone, for good', irrevocable: true, does: () => {} },
        ];
        for (const press of presses) {
            const { element } = place(press);
            expect(element.style.borderColor).toBe(AX.frame);
            // "how discordant the black button is compared to everything else": the ax ground, an element's own dark.
            expect(element.style.backgroundColor).toBe(AX.ground);
            expect(isColor(element.style.color, AX.ink)).toBe(true);
        }
    });

    test('armed, the irrevocable one turns red; the one that can be undone takes the ax ink', async () => {
        const nuke = place({ id: 'nuke', title: 'Nuke', again: 'gone, for good', irrevocable: true, does: () => {} }).element;
        const unbind = place({ id: 'unbind', title: 'Unbind', again: 'it is unbound', does: () => {} }).element;
        nuke.click();
        unbind.click();
        await settle();
        expect(isColor(nuke.style.borderColor, '#dc2626')).toBe(true);
        expect(isColor(unbind.style.borderColor, AX.ink)).toBe(true);
    });

    test('a press that creates is at rest as every press and, armed, green and shimmering', async () => {
        const plus = place({ id: 'plus', title: '+', again: 'the canvas is made', creates: true, does: () => {} }).element;
        expect(plus.style.borderColor).toBe(AX.frame);
        expect(plus.dataset.creates).toBeUndefined();
        plus.click();
        await settle();
        expect(isColor(plus.style.borderColor, '#4ade80')).toBe(true);
        expect(plus.style.backgroundImage).toContain('linear-gradient');
        expect(plus.style.animationName).toBe('elements-press-shimmer');
    });

    test('the arming runs out, and the press is at rest again having done nothing', async () => {
        const { element } = place({ id: 'revoke', title: 'Revoke', again: 'the token stops working', armedForMs: 5, does: () => { done.push('revoke'); } });
        element.click();
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(element.dataset.stage).toBe('rest');
        expect(done).toEqual([]);
    });

    test('a failure is said beside the press, not in it, and the next press takes it away', async () => {
        let fail = true;
        const { element } = place({ id: 'save', title: 'Save', does: () => { if (fail) throw new Error('502 from the node'); } });
        element.click();
        await settle();
        const said = element.nextElementSibling as HTMLElement;
        expect(said.dataset.pressSaid).toBe('save');
        expect(said.textContent).toBe('502 from the node');
        expect(element.dataset.stage).toBe('rest');
        expect(shown(element)).toEqual(['Save']);
        fail = false;
        element.click();
        await settle();
        expect(element.nextElementSibling).toBeNull();
    });

    test('a press can be held back: never disabled, and pressed it says why beside it', async () => {
        const handle = place({ id: 'save', title: 'Save', does: () => { done.push('save'); } });
        handle.hold('nothing changed yet');
        expect((handle.element as HTMLButtonElement).disabled).toBe(false);
        expect(handle.element.getAttribute('aria-disabled')).toBe('true');
        expect(handle.element.title).toBe('nothing changed yet');
        handle.element.click();
        await settle();
        expect(done).toEqual([]);
        const said = handle.element.nextElementSibling as HTMLElement;
        expect(said.textContent).toBe('nothing changed yet');
        expect(said.getAttribute('role')).toBe('alert');
        handle.hold(null);
        expect(handle.element.getAttribute('aria-disabled')).toBe('false');
        expect(handle.element.hasAttribute('title')).toBe(false);
        handle.element.click();
        await settle();
        expect(done).toEqual(['save']);
        expect(handle.element.nextElementSibling).toBeNull();
    });

    test('a failure that is a field\'s is said at that field, which points to it, and the next press takes it away', async () => {
        const field = document.createElement('div');
        field.setAttribute('aria-describedby', 'hint');
        document.body.appendChild(field);
        let fail = true;
        const { element } = place({ id: 'save', title: 'Save', does: () => { if (fail) throw new AtField(field, 'a name is needed'); } });
        element.click();
        await settle();
        const said = field.nextElementSibling as HTMLElement;
        expect(said.textContent).toBe('a name is needed');
        expect(said.getAttribute('role')).toBe('alert');
        expect(field.getAttribute('aria-invalid')).toBe('true');
        expect(field.getAttribute('aria-describedby')).toBe(`hint ${said.id}`);
        expect(element.nextElementSibling).toBeNull();
        fail = false;
        element.click();
        await settle();
        expect(field.nextElementSibling).toBe(element);
        expect(field.hasAttribute('aria-invalid')).toBe(false);
        expect(field.getAttribute('aria-describedby')).toBe('hint');
    });

    // What does not compile is press.misuse.ts's, under bun run typecheck.
    test('a caller with no types is stopped where the compiler stops a typed one', () => {
        const untyped = (said: Record<string, unknown>) => () => pressFrom(said as unknown as Press);
        expect(untyped({ id: 'x', title: 'Nuke', irrevocable: true, does: () => {} })).toThrow(TypeError);
        expect(untyped({ id: 'y', title: 'Save', variant: 'danger', does: () => {} })).toThrow(TypeError);
        expect(untyped({ id: 'z', title: 'Revoke', again: '', does: () => {} })).toThrow(TypeError);
        expect(untyped({ id: '', title: 'Save', does: () => {} })).toThrow(TypeError);
        expect(untyped({ id: 'c', title: '+', creates: true, does: () => {} })).toThrow(TypeError);
        expect(untyped({ id: 'd', title: 'Nuke', again: 'x', creates: true, irrevocable: true, does: () => {} })).toThrow(TypeError);
    });
});

describe('Spike: "To be clear that you\'re arming the button and can then press to confirm"', () => {
    test('armed, it is filled with what its outline said: the ax ink, red, or green', async () => {
        const unbind = place({ id: 'unbind', title: 'Unbind', again: 'it is unbound', does: () => {} }).element;
        const nuke = place({ id: 'nuke', title: 'Nuke', again: 'gone, for good', irrevocable: true, does: () => {} }).element;
        unbind.click();
        nuke.click();
        await settle();
        expect(isColor(unbind.style.backgroundColor, AX.ink)).toBe(true);
        expect(isColor(unbind.style.color, '#000')).toBe(true);
        expect(isColor(nuke.style.backgroundColor, '#dc2626')).toBe(true);
        expect(isColor(nuke.style.color, '#fff')).toBe(true);
    });

    test('armed, a bar runs out across its foot for as long as it stays armed, and is gone at rest', async () => {
        const { element } = place({ id: 'revoke', title: 'Revoke', again: 'the token stops working', armedForMs: 3000, does: () => {} });
        const bar = element.querySelector<HTMLElement>('[data-press-runs-out]')!;
        expect(bar.style.visibility).toBe('hidden');
        expect(bar.style.position).toBe('absolute');
        element.click();
        await settle();
        expect(bar.style.visibility).toBe('visible');
        expect(bar.style.animationDuration).toBe('3000ms');
        element.click();
        await settle();
        expect(bar.style.visibility).toBe('hidden');
    });

    test('the arming that runs out takes what it said beside the press with it', async () => {
        const { element } = place({ id: 'revoke', title: 'Revoke', again: 'the token stops working', armedForMs: 5, does: () => {} });
        element.click();
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(element.nextElementSibling).toBeNull();
    });
});

describe('Jenny: "I just want a preselection of sizes"', () => {
    test('there are three boxes, each a width and a height', () => {
        expect(Object.keys(PRESS_SIZES)).toEqual(['sm', 'md', 'lg']);
        for (const box of Object.values(PRESS_SIZES)) {
            expect(box.width).toBeGreaterThan(0);
            expect(box.height).toBeGreaterThanOrEqual(44);
        }
    });

    test('the package picks the box by the form the press stands in', () => {
        expect(pressSizeFor('window')).toBe('sm');
        expect(pressSizeFor('canvasPlaced')).toBe('sm');
        expect(pressSizeFor('panel')).toBe('md');
        expect(pressSizeFor('workspace')).toBe('md');
        expect(pressSizeFor('canvasExpanded')).toBe('md');
        expect(pressSizeFor(null)).toBe('lg');
    });

    test('the box is the page rule\'s, by form; the press carries no size of its own', () => {
        const { element } = place({ id: 'save', title: 'Save', does: () => {} });
        const rule = document.getElementById('elements-press-size')!.textContent!;
        expect(rule).toContain('@layer elements');
        expect(rule).toContain(`[data-form="panel"] [data-press]`);
        expect(rule).toContain(`width: ${PRESS_SIZES.md.width}px !important; height: ${PRESS_SIZES.md.height}px !important;`);
        expect(rule).toContain(`[data-form="window"] [data-press]`);
        for (const name of ['width', 'height', 'min-height', 'min-width', 'padding']) {
            expect(element.style.getPropertyValue(name)).toBe('');
        }
    });

    test('nothing is reserved in it: a press holds its title and its doing, whatever it is', async () => {
        const single = place({ id: 'save', title: 'Save', does: () => {} }).element;
        const twice = place({ id: 'revoke', title: 'Revoke', again: 'the token stops working', does: () => {} }).element;
        expect(faces(single)).toEqual(['title', 'doing']);
        expect(faces(twice)).toEqual(['title', 'doing']);
        twice.click();
        await settle();
        expect(faces(twice)).toEqual(['title', 'doing']);
    });

    test('a face is never taken out of the layout: it is unseen, not gone', async () => {
        const { element } = place({ id: 'revoke', title: 'Revoke', again: 'the token stops working', does: () => {} });
        element.click();
        await settle();
        for (const face of element.querySelectorAll<HTMLElement>('[data-face]')) {
            expect(face.hidden).toBe(false);
            expect(face.style.display).not.toBe('none');
        }
    });
});
