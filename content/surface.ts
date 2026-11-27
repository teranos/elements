/**
 * 「[Fable 5.2] A surface an agent says, drawn: A2UI v1.0 messages as one node.」
 *
 * 「[Fable 5.2] An agent says what is on it, as data (https://a2ui.org/specification/v1.0-a2ui/): its components by name, and the」
 * 「[Fable 5.2] data they read. How each looks is the package's: a Button is a press (forms/press.ts), a TextField a field」
 * 「[Fable 5.2] (forms/field.ts), a ChoicePicker a list of its options, one under another. What a person types or」
 * 「[Fable 5.2] chooses is kept on the surface and sent nowhere; a press hands the host A2UI's action, with it in its context.」
 * 「[Fable 5.2] Where that goes is the host's. A component not drawn yet is said in place, and what is around it is drawn.」
 *
 * 「[Fable 5.2] A surface is not a message, and a chat holds many. It has a name and a life of its own: created once, told more as often as its agent」
 * 「[Fable 5.2] likes, deleted when it is done.」
 * 「[Fable 5.2] A surface whose root is the package's Pill is one (surfacePillFrom).」
 */

import { pressFrom, MEANS } from '../forms/press';
import { pillFrom } from '../forms/pill';
import { fieldFrom } from '../forms/field';
import { sizeText } from '../text';
import { approvalFrom, renderApprovals, MARKS, type Approval, type ApprovalHandle, type ApprovalOption, type ApprovalRoll, type ApprovalStep } from '../approvals/approvals';
import { declareScroller } from './scroll';
import type { SegmentState } from '../approvals/segments';
import { table } from '../approvals/grow';

/** A2UI's basic catalog: what a surface is drawn from when it names no other. */
export const SURFACE_CATALOG = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

/**
 * 「[Fable 5.2] The package's own catalog (catalog/v1/catalog.json): the basic one, and what the basic one has no word for. A」
 * 「[Fable 5.2] Press is the package's press, of one stage or two (forms/press.ts). A component of any other catalog is said」
 * 「[Fable 5.2] not drawn.」
 */
export const ELEMENTS_CATALOG = 'https://github.com/teranos/elements/blob/main/catalog/v1/catalog.json';

/** What a renderer tells an agent of a press: A2UI's `action` (renderer_to_agent.json). */
export interface SurfaceAction {
    name: string;
    surfaceId: string;
    sourceComponentId: string;
    /** When it was pressed, ISO 8601. */
    timestamp: string;
    /** What the agent asked to be told, every path read from the surface's data as it is now. */
    context: Record<string, unknown>;
    userMessage?: string;
}

export interface Surface {
    /** A2UI messages, in order; one of them creates the surface. */
    messages: readonly unknown[];
    /** Handed each action. A throw is said beside the press that was pressed. */
    onAction?: (action: SurfaceAction) => void | Promise<void>;
    /** Told whenever what the surface says of itself may have changed: its title, or that it is deleted. */
    onChange?: () => void;
}

export interface SurfaceHandle {
    /** The surface: one node for its whole life. */
    element: HTMLElement;
    /** What the agent says after: more components, more data, or that it is deleted. Refused whole, or taken whole. */
    say(messages: readonly unknown[]): void;
    /** What it says at rest, when its root is the package's Pill: null when it is not, or says nothing. */
    title(): string | null;
    /** Its agent deleted it. */
    deleted(): boolean;
}

/** A surface as a pill: what an agent keeps standing in a chat's input field while the thing it is about lasts. */
export interface SurfacePill {
    /** The pill: one node for its whole life (forms/pill.ts). Gone from sight once its surface is deleted. */
    element: HTMLElement;
    say(messages: readonly unknown[]): void;
}

const STATES: readonly string[] = ['waiting', 'running', 'done', 'failed'];

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

const copy = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/** A JSON Pointer's steps (RFC 6901). */
function steps(pointer: string): string[] {
    if (pointer === '' || pointer === '/') return [];
    return pointer.split('/').slice(1).map((step) => step.split('~1').join('/').split('~0').join('~'));
}

function read(data: unknown, pointer: string): unknown {
    let at = data;
    for (const step of steps(pointer)) {
        if (Array.isArray(at)) at = at[Number(step)];
        else if (isObject(at)) at = at[step];
        else return undefined;
    }
    return at;
}

/** Writes a value where a pointer says, making what holds it on the way; undefined takes it away. Returns the data. */
function written(data: unknown, pointer: string, value: unknown): unknown {
    const path = steps(pointer);
    if (!path.length) return value === undefined ? {} : value;
    const root: unknown = isObject(data) || Array.isArray(data) ? data : {};
    let at = root as Json | unknown[];
    path.forEach((step, i) => {
        const key = (Array.isArray(at) ? Number(step) : step) as never;
        if (i === path.length - 1) {
            if (value === undefined && !Array.isArray(at)) delete at[key];
            else at[key] = value as never;
            return;
        }
        const next = at[key] as unknown;
        if (!isObject(next) && !Array.isArray(next)) (at[key] as unknown) = {};
        at = at[key] as Json | unknown[];
    });
    return root;
}

/** A path as said in a component, from where that component stands: one not starting at the root is its own item's. */
const from = (scope: string, path: string): string => (path.startsWith('/') ? path : `${scope}/${path}`);

const KINDS = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface'] as const;
type Kind = typeof KINDS[number];
const UNTOLD = ['callRendererFunction', 'agentFunctionResponse'];

const JUSTIFY: Record<string, string> = {
    start: 'flex-start', end: 'flex-end', center: 'center', stretch: 'stretch',
    spaceBetween: 'space-between', spaceAround: 'space-around', spaceEvenly: 'space-evenly',
};
const ALIGN: Record<string, string> = { start: 'flex-start', end: 'flex-end', center: 'center', stretch: 'stretch' };

/** A choice's options: a list, one under another. */
const LIST: Record<string, string> = { display: 'flex', 'flex-direction': 'column', gap: '4px' };
/** An option in that list: the whole line, its words at its start. */
const IN_LIST: Record<string, string> = { display: 'block', width: '100%', 'text-align': 'left' };

/** A function call where a value goes: not answered yet. */
const CALLED = Symbol('called');

/** A surface, to put where what an element holds goes. */
export function surfaceFrom(surface: Surface): SurfaceHandle {
    const element = document.createElement('div');
    let id: string | null = null;
    let catalog: string | undefined;
    let deleted = false;
    let data: unknown = {};
    const components = new Map<string, Json>();
    /** What reads the data again when it changes: true when what it drew can no longer say it, and all is drawn anew. */
    let readers: (() => boolean | void)[] = [];
    /** The roll being drawn, while one is: its approvals put themselves in it. */
    let rolling: { roll: ApprovalRoll; pressed: Map<Approval, (option: ApprovalOption, step: ApprovalStep) => void> } | null = null;

    /** Each message's kind and what it says, or a throw: nothing of a list is taken unless all of it can be. */
    const understood = (messages: readonly unknown[]): { kind: Kind; says: Json }[] => {
        let created = id !== null;
        let gone = deleted;
        let named = id;
        const all = messages.map((message, i) => {
            if (!isObject(message)) throw new TypeError(`message ${i} of a surface is no object`);
            if (message.version !== '1.0') throw new TypeError(`a surface speaks A2UI 1.0, and message ${i} says ${String(message.version)}`);
            const untold = UNTOLD.find((kind) => kind in message);
            if (untold) throw new TypeError(`a surface is not told ${untold} yet`);
            const kind = KINDS.find((k) => k in message);
            const says = kind ? message[kind] : undefined;
            if (!kind || !isObject(says) || typeof says.surfaceId !== 'string' || !says.surfaceId) {
                throw new TypeError(`message ${i} of a surface says none of ${KINDS.join(', ')} for a surface it names`);
            }
            if (named !== null && says.surfaceId !== named) throw new TypeError(`this surface is ${named}, and message ${i} is for another`);
            if (gone) throw new TypeError(`surface ${says.surfaceId} was deleted`);
            if (kind === 'createSurface') {
                if (created) throw new TypeError(`surface ${says.surfaceId} is created once`);
                created = true;
                named = says.surfaceId;
            } else if (!created) {
                throw new TypeError(`surface ${says.surfaceId} is told something before it is created`);
            }
            if (kind === 'deleteSurface') gone = true;
            if (says.components !== undefined) {
                if (!Array.isArray(says.components) || says.components.some((c) => !isObject(c) || typeof c.id !== 'string' || typeof c.component !== 'string')) {
                    throw new TypeError(`message ${i} of surface ${says.surfaceId}: each component has an id and says which component it is`);
                }
            }
            return { kind, says };
        });
        if (!created) throw new TypeError('a surface is created: no message says createSurface');
        return all;
    };

    const value = (said: unknown, scope: string): unknown => {
        if (isObject(said) && typeof said['@path'] === 'string') return read(data, from(scope, said['@path']));
        if (isObject(said) && '@call' in said) return CALLED;
        return said;
    };
    const words = (said: unknown, scope: string): string => {
        const v = value(said, scope);
        return v === undefined || v === null || v === CALLED ? '' : String(v);
    };
    const bound = (said: unknown, scope: string): string | null =>
        (isObject(said) && typeof said['@path'] === 'string' ? from(scope, said['@path']) : null);

    /** Said where something would stand, of what is not drawn. */
    const undrawn = (what: string, says: string): HTMLElement => {
        const node = document.createElement('div');
        node.dataset.surfaceUndrawn = what;
        node.textContent = says;
        sizeText(node, 'sm');
        return node;
    };

    const changed = () => {
        if (readers.map((reader) => reader()).some((anew) => anew === true)) draw();
        surface.onChange?.();
    };
    const write = (path: string, v: unknown) => {
        data = written(data, path, v);
        changed();
    };

    const holds = (c: Json, node: HTMLElement, scope: string, held: ReadonlySet<string>, nth: string) => {
        const children = c.children;
        if (Array.isArray(children)) {
            for (const child of children) node.appendChild(drawn(String(child), scope, held, nth));
            return;
        }
        if (isObject(children) && typeof children.componentId === 'string' && typeof children.path === 'string') {
            const path = from(scope, children.path);
            const many = () => { const list = read(data, path); return Array.isArray(list) ? list.length : -1; };
            const was = many();
            for (let i = 0; i < was; i++) node.appendChild(drawn(children.componentId, `${path}/${i}`, held, `${nth}-${i}`));
            // 「[Fable 5.2] As many as it drew: each still reads its own item. More or fewer, the surface is drawn anew.」
            readers.push(() => many() !== was);
        }
    };

    const laid = (c: Json, direction: 'row' | 'column', node: HTMLElement) => {
        node.style.setProperty('display', 'flex');
        node.style.setProperty('flex-direction', direction);
        node.style.setProperty('gap', '8px');
        if (direction === 'row') node.style.setProperty('flex-wrap', 'wrap');
        if (typeof c.justify === 'string' && JUSTIFY[c.justify]) node.style.setProperty('justify-content', JUSTIFY[c.justify]);
        if (typeof c.align === 'string' && ALIGN[c.align]) node.style.setProperty('align-items', ALIGN[c.align]);
    };

    /** What a press tells the host: A2UI's action, every path of its context read from the data as it is now. */
    const tells = (event: Json, componentId: string, scope: string) => async (): Promise<void> => {
        const context: Record<string, unknown> = {};
        for (const [key, said] of Object.entries(isObject(event.context) ? event.context : {})) {
            const v = value(said, scope);
            if (v === CALLED) throw new Error(`${key} of this action is a function call, which is not answered yet`);
            context[key] = copy(v);
        }
        const action: SurfaceAction = {
            name: String(event.name),
            surfaceId: id!,
            sourceComponentId: componentId,
            timestamp: new Date().toISOString(),
            context,
        };
        if (event.userMessage !== undefined) action.userMessage = words(event.userMessage, scope);
        await surface.onAction?.(action);
    };

    function drawn(componentId: string, scope: string, holding: ReadonlySet<string>, nth: string): HTMLElement {
        const c = components.get(componentId);
        if (!c) return undrawn(componentId, `${componentId} was not said`);
        if (holding.has(componentId)) return undrawn(componentId, `${componentId} holds itself`);
        const held = new Set(holding).add(componentId);
        const kind = String(c.component);
        const of = typeof c['@catalogId'] === 'string' ? c['@catalogId'] : catalog;
        if (of !== undefined && of !== SURFACE_CATALOG && of !== ELEMENTS_CATALOG) return undrawn(kind, `${kind} is not drawn yet`);
        const name = `${id}-${componentId}${nth}`;
        const node = document.createElement('div');
        node.dataset.surfaceComponent = componentId;

        if (kind === 'Text') {
            // 「[Fable 5.2] Body text is the size of what is around it, as the element says it; a caption is the smallest.」
            if (c.variant === 'caption') sizeText(node, 'xs');
            const say = () => { node.textContent = words(c.text, scope); };
            say();
            readers.push(say);
            return node;
        }

        if (kind === 'Row' || kind === 'Column' || kind === 'List') {
            laid(c, kind === 'Row' || (kind === 'List' && c.direction === 'horizontal') ? 'row' : 'column', node);
            holds(c, node, scope, held, nth);
            return node;
        }

        if (kind === 'Button') {
            const child = components.get(String(c.child));
            if (!child) return undrawn(String(c.child), `${String(c.child)} was not said`);
            if (child.component !== 'Text') return undrawn(kind, 'Button with a child that is not Text is not drawn yet');
            const event = isObject(c.action) && isObject(c.action.event) ? c.action.event : null;
            if (!event) return undrawn(kind, 'Button with a function call is not drawn yet');
            const title = () => words(child.text, scope);
            if (!title()) return undrawn(kind, 'Button that says nothing is not drawn yet');
            const press = pressFrom({ id: name, title: title(), does: tells(event, componentId, scope) });
            node.appendChild(press.element);
            readers.push(() => {
                const face = press.element.querySelector('[data-face="title"]');
                if (face && title() && face.textContent !== title()) face.textContent = title();
            });
            return node;
        }

        // 「[Fable 5.2] The root of a surface that stands as a pill: at rest its title, open what it holds.」
        if (kind === 'Pill' && of === ELEMENTS_CATALOG) {
            if (componentId !== 'root') return undrawn(kind, 'Pill is the root of its surface: it is not drawn inside another');
            node.appendChild(drawn(String(c.child), scope, held, nth));
            return node;
        }

        // 「[Fable 5.2] Something that waits on a person, as the package's approvals are (approvals/approvals.ts): something to」
        // 「[Fable 5.2] look at, options, maybe something to open that chooses nothing.」
        if (kind === 'Approval' && of === ELEMENTS_CATALOG) {
            const said = Array.isArray(c.options) ? c.options.filter(isObject) : [];
            const options: ApprovalOption[] = said.map((o) => ({
                label: String(o.label),
                ...(o.means === 'yes' || o.means === 'no' ? { means: o.means } : {}),
                ...(typeof o.mark === 'string' && o.mark in MARKS ? { mark: o.mark as keyof typeof MARKS } : {}),
                ...(Array.isArray(o.steps) && o.steps.length ? {
                    steps: o.steps.filter(isObject).map((s): ApprovalStep => ({
                        says: String(s.says),
                        ...(s.settles === 'now' || s.settles === 'when-ready' ? { settles: s.settles } : {}),
                    })),
                } : {}),
            }));
            if (options.length < 2) return undrawn(kind, 'Approval with fewer than two options is not drawn');
            const event = isObject(c.action) && isObject(c.action.event) ? c.action.event : null;
            if (!event) return undrawn(kind, 'Approval with a function call is not drawn yet');
            const named = Array.isArray(c.checks) ? c.checks.filter(isObject) : [];
            const states = (): SegmentState[] => named.map((check) => {
                const state = words(check.state, scope);
                return (STATES.includes(state) ? state : 'waiting') as SegmentState;
            });
            const approval: Approval = {
                title: words(c.title, scope),
                arrivedMinutesAgo: typeof c.arrivedMinutesAgo === 'number' ? c.arrivedMinutesAgo : 0,
                context: () => {
                    const about = document.createElement('div');
                    about.textContent = words(c.says, scope);
                    return about;
                },
                options,
                ...(isObject(c.link) && typeof c.link.label === 'string' && typeof c.link.href === 'string'
                    ? { link: { label: c.link.label, href: c.link.href } } : {}),
                ...(named.length ? { checks: named.map((check, i) => ({ name: String(check.name), state: states()[i]! })) } : {}),
                ...(isObject(c.merges) && typeof c.merges.label === 'string'
                    ? { merges: { label: c.merges.label, ...(typeof c.merges.seconds === 'number' ? { seconds: c.merges.seconds } : {}) } } : {}),
                ...(typeof c.openForSeconds === 'number' ? { openForSeconds: c.openForSeconds } : {}),
                ...(Array.isArray(c.asides) && c.asides.length ? {
                    asides: c.asides.filter(isObject).map((aside) => ({
                        label: String(aside.label),
                        open: () => drawn(String(aside.child), scope, held, nth),
                    })),
                } : {}),
            };
            const path = bound(c.value, scope);
            let failed: HTMLElement | null = null;
            // 「[Fable 5.2] Every press is sent, as every approval's is: what stands is written where the agent bound it, then told.」
            const pressed = (option: ApprovalOption, step: ApprovalStep) => {
                failed?.remove();
                failed = null;
                if (path !== null) write(path, { option: option.label, says: step.says, ...(step.settles ? { settles: step.settles } : {}) });
                tells(event, componentId, scope)().catch((err: unknown) => {
                    failed = document.createElement('div');
                    failed.setAttribute('role', 'alert');
                    failed.dataset.surfaceSaid = componentId;
                    failed.textContent = err instanceof Error ? err.message : String(err);
                    failed.style.setProperty('color', MEANS.no);
                    sizeText(failed, 'sm');
                    handle.card.appendChild(failed);
                });
            };
            // 「[Fable 5.2] In a roll it is one of the roll's, in the roll's order; on its own, it stands where it was said.」
            let handle: ApprovalHandle;
            if (rolling) {
                rolling.pressed.set(approval, pressed);
                handle = rolling.roll.add(approval);
                node.dataset.surfaceRolled = '';
            } else {
                handle = approvalFrom(approval, { pressed: (_, option, step) => pressed(option, step) });
                node.appendChild(handle.card);
            }
            handle.card.dataset.surfaceComponent = componentId;
            let was = JSON.stringify(states());
            readers.push(() => {
                const now = JSON.stringify(states());
                if (now !== was) {
                    was = now;
                    handle.checks(states());
                }
                // 「[Fable 5.2] The agent says what stood took effect: nothing more can be sent.」
                if (value(c.settled, scope) === true) handle.settled();
            });
            return node;
        }

        // "Most recent undecided sorted first." "After I press, the approval doesn't shift down; everything moves up, like a filmroll."
        // 「[Fable 5.2] Everything that waits on a person, as one: the package's roll (approvals/approvals.ts), scrolled in itself.」
        if (kind === 'Roll' && of === ELEMENTS_CATALOG) {
            const pressed = new Map<Approval, (option: ApprovalOption, step: ApprovalStep) => void>();
            const roll = renderApprovals({ pressed: (approval, option, step) => pressed.get(approval)?.(option, step) });
            const outer = rolling;
            rolling = { roll, pressed };
            for (const child of Array.isArray(c.children) ? c.children : []) {
                const one = drawn(String(child), scope, held, nth);
                // 「[Fable 5.2] An approval put itself in the roll. Anything else in a roll is said above it, not drawn.」
                if (one.dataset.surfaceRolled === undefined) {
                    node.appendChild(one.dataset.surfaceUndrawn !== undefined ? one : undrawn(String(child), `${String(child)} is not an approval: a roll holds approvals`));
                }
            }
            rolling = outer;
            roll.settle();
            node.style.setProperty('max-height', '50vh');
            node.style.setProperty('overflow-y', 'auto');
            declareScroller(node);
            node.appendChild(roll.body);
            return node;
        }

        if (kind === 'Table' && of === ELEMENTS_CATALOG) {
            const heads = Array.isArray(c.heads) ? c.heads.map(String) : [];
            const rows = Array.isArray(c.rows) ? c.rows.filter(Array.isArray).map((row) => (row as unknown[]).map(String)) : [];
            if (!heads.length) return undrawn(kind, 'Table with no heads is not drawn');
            node.appendChild(table(heads, rows));
            return node;
        }

        // "To be clear that you're arming the button and can then press to confirm": the package's own, of two stages.
        if (kind === 'Press' && of === ELEMENTS_CATALOG) {
            const event = isObject(c.action) && isObject(c.action.event) ? c.action.event : null;
            if (!event) return undrawn(kind, 'Press with a function call is not drawn yet');
            const title = () => words(c.text, scope);
            if (!title()) return undrawn(kind, 'Press that says nothing is not drawn yet');
            const again = typeof c.again === 'string' && c.again ? c.again : null;
            if (again === null && (c.irrevocable === true || c.creates === true)) {
                return undrawn(kind, 'Press that cannot be undone, or creates, with no again is not drawn');
            }
            if (c.irrevocable === true && c.creates === true) return undrawn(kind, 'Press that both creates and cannot be undone is not drawn');
            const said = { id: name, title: title(), does: tells(event, componentId, scope) };
            const press = again === null ? pressFrom(said)
                : c.irrevocable === true ? pressFrom({ ...said, again, irrevocable: true })
                : c.creates === true ? pressFrom({ ...said, again, creates: true })
                : pressFrom({ ...said, again });
            node.appendChild(press.element);
            readers.push(() => {
                const face = press.element.querySelector('[data-face="title"]');
                if (face && title() && face.textContent !== title()) face.textContent = title();
            });
            return node;
        }

        if (kind === 'TextField') {
            const variant = typeof c.variant === 'string' ? c.variant : 'shortText';
            // 「[Fable 5.2] The package's field is text (forms/field.ts): what is obscured is never drawn as text.」
            if (variant !== 'shortText' && variant !== 'longText') return undrawn(kind, `TextField ${variant} is not drawn yet`);
            const label = words(c.label, scope);
            if (!label) return undrawn(kind, 'TextField with no label is not drawn yet');
            const placeholder = words(c.placeholder, scope);
            const field = fieldFrom({
                id: name,
                label,
                value: words(c.value, scope),
                ...(placeholder ? { placeholder } : {}),
                ...(variant === 'longText' ? { lines: 3 } : {}),
            });
            field.element.dataset.surfaceComponent = componentId;
            const path = bound(c.value, scope);
            if (path !== null) {
                field.input.addEventListener('input', () => write(path, field.input.value));
                readers.push(() => {
                    const says = words(c.value, scope);
                    if (field.input.value !== says) field.input.value = says;
                });
            }
            return field.element;
        }

        if (kind === 'ChoicePicker') {
            const many = c.variant === 'multipleSelection';
            const path = bound(c.value, scope);
            let own: string[] = Array.isArray(c.value) ? c.value.map(String) : [];
            const chosen = (): string[] => {
                if (path === null) return own;
                const v = read(data, path);
                return Array.isArray(v) ? v.map(String) : [];
            };
            const label = words(c.label, scope);
            if (label) {
                const over = document.createElement('div');
                over.textContent = label;
                sizeText(over, 'sm');
                node.appendChild(over);
            }
            const group = document.createElement('div');
            group.setAttribute('role', 'group');
            if (label) group.setAttribute('aria-label', label);
            // 「[Fable 5.2] A list: one under another, each saying what it is.」
            for (const [prop, v] of Object.entries(LIST)) group.style.setProperty(prop, v, 'important');
            const presses: HTMLButtonElement[] = [];
            const mark = () => {
                const are = chosen();
                for (const press of presses) press.setAttribute('aria-pressed', String(are.includes(press.dataset.surfaceOption!)));
            };
            for (const option of Array.isArray(c.options) ? c.options : []) {
                if (!isObject(option) || typeof option.value !== 'string') continue;
                const of_ = option.value;
                const press = document.createElement('button');
                press.type = 'button';
                press.dataset.surfaceOption = of_;
                press.textContent = words(option.label, scope);
                press.dataset.ownBox = '';
                for (const [prop, v] of Object.entries(IN_LIST)) press.style.setProperty(prop, v, 'important');
                press.addEventListener('click', () => {
                    const are = chosen();
                    const next = !many ? [of_] : are.includes(of_) ? are.filter((v) => v !== of_) : [...are, of_];
                    if (path === null) { own = next; mark(); } else write(path, next);
                });
                presses.push(press);
                group.appendChild(press);
            }
            node.appendChild(group);
            mark();
            readers.push(mark);
            return node;
        }

        return undrawn(kind, `${kind} is not drawn yet`);
    }

    function draw(): void {
        readers = [];
        element.replaceChildren();
        if (components.has('root')) element.appendChild(drawn('root', '', new Set(), ''));
    }

    const say = (messages: readonly unknown[]): void => {
        let anew = false;
        for (const { kind, says } of understood(messages)) {
            if (kind === 'createSurface') {
                id = says.surfaceId as string;
                catalog = typeof says.catalogId === 'string' ? says.catalogId : undefined;
                element.dataset.surface = id;
                if (isObject(says.dataModel)) data = copy(says.dataModel);
            }
            if (kind === 'createSurface' || kind === 'updateComponents') {
                for (const c of (says.components as Json[] | undefined) ?? []) components.set(c.id as string, copy(c));
                anew = true;
            }
            if (kind === 'updateDataModel') {
                // 「[Fable 5.2] A value said null is taken away (agent_to_renderer.json, updateDataModel).」
                data = written(data, typeof says.path === 'string' ? says.path : '/', says.value === null ? undefined : copy(says.value));
            }
            if (kind === 'deleteSurface') {
                deleted = true;
                components.clear();
                data = {};
                element.dataset.surfaceDeleted = '';
                anew = true;
            }
        }
        if (anew) {
            draw();
            surface.onChange?.();
        } else changed();
    };

    const title = (): string | null => {
        const root = components.get('root');
        if (!root || root.component !== 'Pill') return null;
        return words(root.title, '') || null;
    };

    say(surface.messages);
    return { element, say, title, deleted: () => deleted };
}

/**
 * 「[Fable 5.2] A surface as a pill (forms/pill.ts): at rest it says what its root, the package's Pill, says, and says it anew as」
 * 「[Fable 5.2] its agent changes it; pressed, it is across its row and holds the surface. Deleted by its agent, it is gone.」
 * 「[Fable 5.2] Put in a chat's field as any pill is: `declareSay(field, { waiting: [pill.element] })` (content/say.ts).」
 */
export function surfacePillFrom(surface: Surface): SurfacePill {
    let pill: ReturnType<typeof pillFrom> | null = null;
    let held: SurfaceHandle | null = null;
    const look = () => {
        if (!pill || !held) return;
        const title = held.title();
        if (title !== null) pill.retitle(title);
        if (held.deleted()) {
            pill.rest();
            pill.element.hidden = true;
        }
    };
    const drawn = surfaceFrom({ ...surface, onChange: () => { look(); surface.onChange?.(); } });
    held = drawn;
    const title = drawn.title();
    const name = drawn.element.dataset.surface!;
    if (title === null) throw new TypeError(`surface ${name} is no pill: its root is not the package's Pill, or says nothing`);
    pill = pillFrom({ id: name, title, renderContent: () => drawn.element });
    pill.element.dataset.surfacePill = name;
    look();
    return { element: pill.element, say: drawn.say };
}
