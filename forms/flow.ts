// Flow: numbered steps a person goes through one at a time, seen through to the end over a scrim.
// "there is actually a kind of distinction Anthropic does well here"
// "which is to accept that this is a 1,2,3,4 flow, and needs to bee seen through until the end."

import { PANEL_OVERLAY_BG } from '../element';
import { sizeText } from '../text';
import { MEANS, pressFrom } from './press';

/** One step: its name, what it is, and its panel, drawn when it is reached. */
export interface FlowStep {
    title: string;
    /** The line under its name. */
    says: string;
    /** Draws the step into panel. resolved(null) lets the flow go on; resolved(why) holds Continue, saying why when pressed. */
    draw: (panel: HTMLElement, resolved: (why: string | null) => void) => void;
}

export interface Flow {
    /** Its name: data-flow, and the presses' and scrim's. */
    id: string;
    steps: FlowStep[];
    /** Done, on the last step resolved. */
    onDone: () => void;
}

export interface FlowHandle {
    element: HTMLElement;
    /** Covers everything under the window the flow stands in with a scrim, until Done. */
    captive: () => void;
}

// Written important on the node itself: no stylesheet, layered or not, says otherwise.
function pin(node: HTMLElement, styles: Record<string, string>): void {
    for (const [name, value] of Object.entries(styles)) node.style.setProperty(name, value, 'important');
}

/** A flow, to put where an element's content goes. */
export function flowFrom(flow: Flow): FlowHandle {
    if (!flow.id) throw new TypeError('a flow has a name: its id');
    if (flow.steps.length === 0) throw new TypeError(`flow ${flow.id} has no steps`);

    const element = document.createElement('div');
    element.dataset.flow = flow.id;
    // A row, not a grid: the fit loosens a grid's tracks, and the steps were squeezed to a letter a line.
    // One height for every step: the window does not change size under the person going through it.
    pin(element, { display: 'flex', 'align-items': 'stretch', gap: '16px', 'min-width': '0', height: '36em', 'max-height': '60vh' });

    const rail = document.createElement('ol');
    pin(rail, { 'list-style': 'none', margin: '0', padding: '0', display: 'flex', 'flex-direction': 'column', gap: '12px', flex: '0 0 11em', width: '11em', 'align-self': 'flex-start' });
    const main = document.createElement('div');
    pin(main, { display: 'flex', 'flex-direction': 'column', gap: '12px', 'min-width': '0', 'min-height': '0', 'max-height': '100%', flex: '1 1 0' });
    const panel = document.createElement('div');
    panel.dataset.flowPanel = '';
    // A step taller than the flow scrolls in its panel; Back and Continue stay in sight.
    pin(panel, { display: 'flex', 'flex-direction': 'column', gap: '8px', 'min-width': '0', 'min-height': '0', flex: '1 1 auto', 'overflow-y': 'auto' });
    const foot = document.createElement('div');
    pin(foot, { flex: '0 0 auto', display: 'flex', 'justify-content': 'space-between', 'align-items': 'flex-start', gap: '8px' });
    main.append(panel, foot);
    element.append(rail, main);

    let at = 0;
    // What each step still needs, null once it is resolved. A step not yet drawn needs to be reached.
    const needs: (string | null)[] = flow.steps.map(() => 'This step is not done yet.');
    let scrim: HTMLElement | null = null;
    let watch: MutationObserver | null = null;

    const back = pressFrom({ id: `${flow.id}-back`, title: 'Back', does: () => { go(at - 1); } });
    const onward = pressFrom({ id: `${flow.id}-continue`, title: 'Continue', does: () => { go(at + 1); } });
    // The last step's, where Continue was: the flow ends there and nowhere else.
    const finish = pressFrom({ id: `${flow.id}-done`, title: 'Done', does: () => { release(); flow.onDone(); } });

    const drawRail = () => {
        rail.replaceChildren();
        flow.steps.forEach((step, n) => {
            const item = document.createElement('li');
            item.dataset.flowStep = String(n);
            pin(item, { display: 'grid', 'grid-template-columns': '1.6em minmax(0, 1fr)', 'column-gap': '8px', opacity: n > at ? '0.5' : '1' });
            const mark = document.createElement('span');
            const done = n < at;
            if (done) item.dataset.done = '';
            if (n === at) item.dataset.current = '';
            mark.textContent = done ? '✓' : String(n + 1);
            pin(mark, {
                'grid-row': 'span 2', width: '1.6em', height: '1.6em', 'border-radius': '50%', display: 'grid', 'place-items': 'center',
                'background-color': done ? MEANS.yes : n === at ? 'currentColor' : 'transparent', border: '1px solid currentColor',
            });
            if (n === at) {
                // The current step's number, read on its own colour.
                const number = document.createElement('span');
                number.textContent = String(n + 1);
                pin(number, { color: 'var(--bg-almost-black, #000)' });
                mark.replaceChildren(number);
            }
            const title = document.createElement('span');
            title.textContent = step.title;
            if (n === at) pin(title, { 'font-weight': 'bold' });
            const says = document.createElement('span');
            says.textContent = step.says;
            sizeText(says, 'xs');
            pin(says, { opacity: '0.7' });
            item.append(mark, title, says);
            rail.appendChild(item);
        });
    };

    const go = (to: number) => {
        at = Math.max(0, Math.min(to, flow.steps.length - 1));
        drawRail();
        panel.replaceChildren();
        const next = at === flow.steps.length - 1 ? finish : onward;
        foot.replaceChildren(...(at > 0 ? [back.element] : [document.createElement('span')]), next.element);
        const reached = at;
        flow.steps[at]!.draw(panel, (why) => {
            needs[reached] = why;
            if (reached === at) next.hold(why);
        });
        next.hold(needs[at] ?? null);
    };

    /** The scrim follows the window it stands under: always just beneath it. */
    const follow = (window_: HTMLElement) => {
        if (scrim) pin(scrim, { 'z-index': String((Number(window_.style.zIndex) || 1) - 1) });
    };

    const release = () => {
        watch?.disconnect();
        watch = null;
        scrim?.remove();
        scrim = null;
    };

    const captive = () => {
        const window_ = element.closest<HTMLElement>('[data-form]');
        if (!window_ || scrim) return;
        scrim = document.createElement('div');
        scrim.dataset.scrim = flow.id;
        scrim.setAttribute('aria-hidden', 'true');
        pin(scrim, { position: 'fixed', inset: '0', 'background-color': PANEL_OVERLAY_BG });
        document.body.appendChild(scrim);
        follow(window_);
        watch = new MutationObserver(() => follow(window_));
        watch.observe(window_, { attributes: true, attributeFilter: ['style'] });
    };

    go(0);
    return { element, captive };
}
