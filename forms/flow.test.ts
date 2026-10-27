// A flow, as Anthropic's Connect workload wizard is one: numbered steps, one at a time, seen through to the end over a scrim.
// Tim: the steps, Continue, Back and Done. Spike: Continue pressed on a step not done. Jenny: the scrim, under the window, gone at Done.

import { describe, test, expect, beforeEach } from 'bun:test';
import { flowFrom, type FlowStep } from './flow';

beforeEach(() => { document.body.innerHTML = ''; });

/** A step whose panel holds one line, resolved as the test says. */
function step(title: string, says: string, resolved: { why: string | null } = { why: null }): FlowStep & { done: (why: string | null) => void } {
    let tell: (why: string | null) => void = () => {};
    return {
        title,
        says,
        draw: (panel, resolve) => {
            panel.textContent = `${title} here`;
            tell = resolve;
            resolve(resolved.why);
        },
        done: (why) => tell(why),
    };
}

function press(flow: HTMLElement, id: string): void {
    (flow.querySelector(`[data-press="${id}"]`) as HTMLButtonElement).click();
}

const shown = (flow: HTMLElement) => flow.querySelector('[data-flow-panel]')!.textContent;

describe('Tim: a flow is its steps, one at a time', () => {
    test('each step is named, numbered, with what it is, the first one current', () => {
        const flow = flowFrom({ id: 'connect', steps: [step('Issuer', 'Select or register the provider'), step('Test', 'Verify end-to-end')], onDone: () => {} });
        const rail = Array.from(flow.element.querySelectorAll('[data-flow-step]'));
        expect(rail.map((s) => s.textContent)).toEqual(['1IssuerSelect or register the provider', '2TestVerify end-to-end']);
        expect((rail[0] as HTMLElement).dataset.current).toBe('');
        expect(shown(flow.element)).toBe('Issuer here');
    });

    test('Continue goes to the next step, the one before it checked; Back goes back', () => {
        const flow = flowFrom({ id: 'connect', steps: [step('Issuer', ''), step('Test', '')], onDone: () => {} });
        press(flow.element, 'connect-continue');
        expect(shown(flow.element)).toBe('Test here');
        const first = flow.element.querySelector('[data-flow-step="0"]') as HTMLElement;
        expect(first.dataset.done).toBe('');
        expect(first.textContent).toContain('✓');
        press(flow.element, 'connect-back');
        expect(shown(flow.element)).toBe('Issuer here');
    });

    test('the last step says Done, and Done ends the flow', () => {
        let ended = 0;
        const flow = flowFrom({ id: 'connect', steps: [step('Test', '')], onDone: () => { ended++; } });
        expect(flow.element.querySelector('[data-press="connect-continue"]')).toBeNull();
        expect(flow.element.querySelector('[data-press="connect-done"]')!.textContent).toContain('Done');
        press(flow.element, 'connect-done');
        expect(ended).toBe(1);
    });

    test('every step is drawn at one height, a step taller than it scrolling in its panel', () => {
        const flow = flowFrom({ id: 'connect', steps: [step('Issuer', ''), step('Test', '')], onDone: () => {} });
        const height = flow.element.style.getPropertyValue('height');
        expect(height).not.toBe('');
        press(flow.element, 'connect-continue');
        expect(flow.element.style.getPropertyValue('height')).toBe(height);
        expect((flow.element.querySelector('[data-flow-panel]') as HTMLElement).style.getPropertyValue('overflow-y')).toBe('auto');
    });
});

describe('Spike: a step not done', () => {
    test('Continue is never greyed out: pressed, it says what the step still needs, and stays', () => {
        const test = step('Test', '', { why: "Paste the wizard's snippet first." });
        const flow = flowFrom({ id: 'connect', steps: [test, step('After', '')], onDone: () => {} });
        const press_ = flow.element.querySelector('[data-press="connect-continue"]') as HTMLButtonElement;
        expect(press_.disabled).toBe(false);
        press(flow.element, 'connect-continue');
        expect(shown(flow.element)).toBe('Test here');
        expect(flow.element.textContent).toContain("Paste the wizard's snippet first.");
        // Resolved, it goes on.
        test.done(null);
        press(flow.element, 'connect-continue');
        expect(shown(flow.element)).toBe('After here');
    });
});

describe('Jenny: the scrim says it is a flow', () => {
    test('in a window, a scrim covers the page under that window, and is gone at Done', () => {
        const window_ = document.createElement('div');
        window_.dataset.form = 'window';
        window_.style.zIndex = '40';
        document.body.appendChild(window_);
        const flow = flowFrom({ id: 'connect', steps: [step('Test', '')], onDone: () => {} });
        window_.appendChild(flow.element);
        flow.captive();
        const scrim = document.querySelector('[data-scrim="connect"]') as HTMLElement;
        expect(scrim).not.toBeNull();
        expect(scrim.style.position).toBe('fixed');
        expect(Number(scrim.style.zIndex)).toBe(39);
        press(flow.element, 'connect-done');
        expect(document.querySelector('[data-scrim="connect"]')).toBeNull();
    });

    test('a window raised above another stays above its scrim', async () => {
        const window_ = document.createElement('div');
        window_.dataset.form = 'window';
        window_.style.zIndex = '40';
        document.body.appendChild(window_);
        const flow = flowFrom({ id: 'connect', steps: [step('Test', '')], onDone: () => {} });
        window_.appendChild(flow.element);
        flow.captive();
        window_.style.zIndex = '55';
        await new Promise((r) => setTimeout(r, 1));
        expect(Number((document.querySelector('[data-scrim="connect"]') as HTMLElement).style.zIndex)).toBe(54);
    });
});
