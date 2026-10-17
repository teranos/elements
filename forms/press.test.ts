// A press: Button Form's variation that does what it says, once or in two stages.
// Personas: Tim (one press, two stages), Spike (rest is never red, arming runs out, a failure beside it, misuse), Jenny (every face from the start).

import { describe, test, expect, beforeEach } from 'bun:test';
import { pressFrom, type Press } from './press';

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
        expect(shown(element)).toEqual(['Revoke', 'again: the token stops working']);
        element.click();
        await settle();
        expect(done).toEqual(['revoke']);
        expect(element.dataset.stage).toBe('rest');
    });

    test('while it is being done it says so and takes no press', async () => {
        let finish!: () => void;
        const { element } = place({ id: 'save', title: 'Save', does: () => new Promise<void>((resolve) => { finish = resolve; }) });
        element.click();
        await settle();
        expect(element.dataset.stage).toBe('doing');
        expect((element as HTMLButtonElement).disabled).toBe(true);
        expect(element.getAttribute('aria-busy')).toBe('true');
        expect(shown(element)).toEqual(['···']);
        finish();
        await settle();
        expect(element.dataset.stage).toBe('rest');
        expect(shown(element)).toEqual(['Save']);
    });
});

describe('Spike: "the immediate red communicates, irrevocable click, which is wrong for this."', () => {
    test('at rest every press is outlined white, the irrevocable one too', () => {
        const presses: Press[] = [
            { id: 'a', title: 'Save', does: () => {} },
            { id: 'b', title: 'Unbind', again: 'it is unbound', does: () => {} },
            { id: 'c', title: 'Nuke', again: 'gone, for good', irrevocable: true, does: () => {} },
        ];
        for (const press of presses) {
            const { element } = place(press);
            expect(isColor(element.style.borderColor, '#fff')).toBe(true);
            expect(isColor(element.style.backgroundColor, '#000')).toBe(true);
        }
    });

    test('armed, the irrevocable one turns red; the one that can be undone stays white', async () => {
        const nuke = place({ id: 'nuke', title: 'Nuke', again: 'gone, for good', irrevocable: true, does: () => {} }).element;
        const unbind = place({ id: 'unbind', title: 'Unbind', again: 'it is unbound', does: () => {} }).element;
        nuke.click();
        unbind.click();
        await settle();
        expect(isColor(nuke.style.borderColor, '#dc2626')).toBe(true);
        expect(isColor(unbind.style.borderColor, '#fff')).toBe(true);
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

    test('a press can be held back, and says why', async () => {
        const handle = place({ id: 'save', title: 'Save', does: () => { done.push('save'); } });
        handle.hold('nothing changed yet');
        expect((handle.element as HTMLButtonElement).disabled).toBe(true);
        expect(handle.element.title).toBe('nothing changed yet');
        handle.element.click();
        await settle();
        expect(done).toEqual([]);
        handle.hold(null);
        handle.element.click();
        await settle();
        expect(done).toEqual(['save']);
    });

    // What does not compile is press.misuse.ts's, under bun run typecheck.
    test('a caller with no types is stopped where the compiler stops a typed one', () => {
        const untyped = (said: Record<string, unknown>) => () => pressFrom(said as unknown as Press);
        expect(untyped({ id: 'x', title: 'Nuke', irrevocable: true, does: () => {} })).toThrow(TypeError);
        expect(untyped({ id: 'y', title: 'Save', variant: 'danger', does: () => {} })).toThrow(TypeError);
        expect(untyped({ id: 'z', title: 'Revoke', again: '', does: () => {} })).toThrow(TypeError);
        expect(untyped({ id: '', title: 'Save', does: () => {} })).toThrow(TypeError);
    });
});

describe('Jenny: "a button should just be the same size"', () => {
    test('a single press holds its title and its doing, at every stage', async () => {
        let finish!: () => void;
        const { element } = place({ id: 'save', title: 'Save', does: () => new Promise<void>((resolve) => { finish = resolve; }) });
        expect(faces(element)).toEqual(['title', 'doing']);
        element.click();
        await settle();
        expect(faces(element)).toEqual(['title', 'doing']);
        finish();
        await settle();
        expect(faces(element)).toEqual(['title', 'doing']);
    });

    test('two stages hold the title, the doing and the armed note, at rest, armed and doing', async () => {
        let finish!: () => void;
        const { element } = place({
            id: 'revoke', title: 'Revoke', again: 'the token stops working',
            does: () => new Promise<void>((resolve) => { finish = resolve; }),
        });
        const all = ['title', 'doing', 'armed-note'];
        expect(faces(element)).toEqual(all);
        element.click();
        await settle();
        expect(faces(element)).toEqual(all);
        element.click();
        await settle();
        expect(faces(element)).toEqual(all);
        finish();
        await settle();
        expect(faces(element)).toEqual(all);
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
