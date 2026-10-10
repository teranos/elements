/**
 * Approvals — a panel's list of things that wait on a human, to go through.
 *
 * "Do you hear how little it matters what the 'thing' is to approve?"
 * An approval is something to look at, options to choose between, maybe a
 * confidence on each, maybe something to open that chooses nothing.
 *
 * "A YES or NO is a final choice. I already sent it. And i can send yes again,
 * and no again." Every press is handed to the host, and pressing the other
 * option hands it another, until nothing more can be sent: a step that settles
 * now, the host saying what stood took effect, or the time running out.
 *
 * The package shows and sends; what a press does is the host's. Where there is
 * a Jev it answers the confidence, where there are checks the host says their
 * state, and where a merge waits on main's CI the host says when it passed.
 */

import { shatter } from './shatter';
import { growInPlace } from './grow';
import { paintSegment, segmentStrip, type SegmentState } from './segments';

/** What one press says. The same option pressed again says its next step. */
export interface ApprovalStep {
    says: string;
    /** 'now' takes effect at once; 'when-ready' waits on what the approval's merge waits on. */
    settles?: 'now' | 'when-ready';
}

export interface ApprovalOption {
    label: string;
    /** Left out, a press says the label and pressing it again says nothing more. */
    steps?: ApprovalStep[];
    /**
     * 0–100, from Jev, the fast classifier. A promise is Jev still answering:
     * the card is there first and the number arrives. Left out where a
     * percentage makes no sense, as on a merge.
     */
    confidence?: number | Promise<number>;
    /** Red is no and green is yes; an option that is neither stays white. */
    means?: 'yes' | 'no';
}

/** Something to open that chooses nothing: the mail and the CV, the agent's table. */
export interface ApprovalAside {
    label: string;
    open: () => HTMLElement;
}

/**
 * One of the checks on the thing itself. "These are always targeting main, and
 * the checks are what occur on the PR itself, before we even want to present it
 * as something to approve or not." Until every one is done it cannot be
 * decided; one failed, it is not ready for approval at all.
 */
export interface ApprovalCheck {
    name: string;
    state: SegmentState;
}

export interface Approval {
    title: string;
    /**
     * Where the thing itself lives, opened from the title row. A github.com link
     * opens in the GitHub app where it is installed.
     */
    link?: { label: string; href: string };
    /** Minutes since it came in: the most recent undecided one goes first. */
    arrivedMinutesAgo: number;
    context: () => HTMLElement;
    options: ApprovalOption[];
    asides?: ApprovalAside[];
    /** Time running out locks it, where nothing else does. */
    openForSeconds?: number;
    checks?: ApprovalCheck[];
    /**
     * What a step that settles 'when-ready' waits on once it is sent: "merge
     * after CI passes". With seconds it is counted down in the button and takes
     * effect at zero; without, it waits until the host says settled().
     */
    merges?: { label: string; seconds?: number };
}

/** The host: every press is handed to it, and it says what the press did. */
export interface ApprovalHost {
    pressed: (approval: Approval, option: ApprovalOption, step: ApprovalStep) => void;
}

/** One approval in the roll, for the host to keep up to date. */
export interface ApprovalHandle {
    card: HTMLElement;
    /** The checks' states now, one per check, in the order given. */
    checks: (states: SegmentState[]) => void;
    /** What the sent step waited on has passed: it takes effect, and nothing more can be sent. */
    settled: () => void;
}

/** The list: its body, to put in an element, and the approvals added to it. */
export interface ApprovalRoll {
    body: HTMLElement;
    add: (approval: Approval) => ApprovalHandle;
    /** Puts the roll in order now, rather than a moment after the last change. */
    settle: () => void;
}

const COLOR = { yes: '#16a34a', no: '#dc2626', neither: '#fff' };

const stepsOf = (option: ApprovalOption): ApprovalStep[] => option.steps ?? [{ says: option.label }];

function optionButton(option: ApprovalOption): { btn: HTMLButtonElement; note: HTMLElement } {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.flex = '1 1 0';
    btn.style.minWidth = '0';
    btn.style.minHeight = '64px';
    btn.style.padding = '8px';
    btn.style.border = `2px solid ${COLOR[option.means ?? 'neither']}`;
    btn.style.borderRadius = '0';
    btn.style.font = 'inherit';
    btn.style.touchAction = 'manipulation';
    btn.style.display = 'flex';
    btn.style.flexDirection = 'column';
    btn.style.justifyContent = 'center';
    btn.style.gap = '4px';
    btn.style.position = 'relative';

    const label = document.createElement('span');
    label.textContent = option.label;
    label.style.fontSize = '16px';
    btn.appendChild(label);

    if (option.confidence !== undefined) {
        const pct = document.createElement('span');
        pct.title = 'Jev';
        pct.style.fontFamily = 'var(--font-mono)';
        pct.style.fontSize = '22px';
        pct.style.fontVariantNumeric = 'tabular-nums';
        const answered = (n: number) => {
            pct.textContent = `${n}%`;
            pct.style.opacity = '1';
        };
        if (typeof option.confidence === 'number') {
            answered(option.confidence);
        } else {
            // Jev has not answered yet: the place is kept, so nothing moves when it does.
            pct.textContent = '··%';
            pct.style.opacity = '0.4';
            option.confidence.then(answered, () => { pct.textContent = ''; });
        }
        btn.appendChild(pct);
    }

    // What this button has said, and what pressing it again would say.
    const note = document.createElement('span');
    note.dataset.note = '';
    note.style.fontFamily = 'var(--font-mono)';
    note.style.fontSize = '11px';
    note.style.lineHeight = '1.3';
    btn.appendChild(note);
    return { btn, note };
}

interface Rendered {
    card: HTMLElement;
    approval: Approval;
    /** Nothing sent yet, and still open. */
    undecided: () => boolean;
    /** When it stopped being undecided, to keep decided ones in the order they were decided. */
    decidedAt: () => number;
    /** 0 ready, 1 still waiting on checks, 2 a check failed: the others take precedence. */
    readiness: () => number;
}

const STATE_SAYS: Record<SegmentState, string> = { done: 'passed', failed: 'failed', waiting: 'queued', running: 'running' };

function renderApproval(approval: Approval, host: ApprovalHost, changed: (pressed?: boolean) => void): Rendered & ApprovalHandle {
    const card = document.createElement('section');
    card.style.borderTop = '1px solid #fff';
    card.style.padding = '16px 0';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '12px';

    const title = document.createElement('div');
    title.style.display = 'flex';
    title.style.justifyContent = 'space-between';
    title.style.gap = '8px';
    const name = document.createElement('span');
    name.dataset.title = '';
    name.textContent = approval.title;
    name.style.fontSize = '16px';
    name.style.fontWeight = 'bold';
    const ago = document.createElement('span');
    ago.textContent = `${approval.arrivedMinutesAgo}m ago`;
    ago.style.fontFamily = 'var(--font-mono)';
    ago.style.fontSize = '12px';
    ago.style.whiteSpace = 'nowrap';
    const end = document.createElement('span');
    end.style.display = 'flex';
    end.style.alignItems = 'center';
    end.style.gap = '8px';
    end.appendChild(ago);

    const checks: SegmentState[] = (approval.checks ?? []).map((c) => c.state);
    let paintChecks = () => {};
    if (approval.link) {
        const link = approval.link;
        // "Half of halfsize": half as wide as the half-size button. Half as tall
        // would be 16px, too small for a thumb, so it is 24.
        //
        // "Pressing GitHub should just display its checks initially and pressing
        // again does deeplink, so it's button in button." One node: pressed, it
        // leaves the title row for its own row under the title, grown to the card's
        // width, and lists the checks; inside it a square button opens the PR.
        const gh = document.createElement('div');
        gh.setAttribute('role', 'button');
        gh.tabIndex = 0;
        gh.setAttribute('aria-expanded', 'false');
        gh.style.boxSizing = 'border-box';
        gh.style.border = '1px solid #fff';
        gh.style.background = '#000';
        gh.style.overflow = 'hidden';
        gh.style.cursor = 'pointer';
        gh.style.touchAction = 'manipulation';
        gh.style.fontFamily = 'var(--font-mono)';
        gh.style.fontSize = '12px';
        gh.style.fontWeight = 'normal';
        gh.style.flexShrink = '0';

        const head = document.createElement('div');
        head.style.display = 'flex';
        head.style.alignItems = 'stretch';

        // "If there's 6 checks, the GitHub button is 6 segments, becoming fuller as
        // more checks are completed." Not started black, running grey lines moving
        // left, done white, "failed is RED". The label is the inverse of whatever is behind it.
        const named = approval.checks ?? [];
        const { strip, segments } = segmentStrip(link.label, named.length);

        // The button in the button: perfectly square, the white GitHub mark.
        const open = document.createElement('a');
        open.href = link.href;
        open.target = '_blank';
        open.rel = 'noopener';
        open.setAttribute('aria-label', `Open in ${link.label}`);
        open.style.width = '44px';
        open.style.height = '44px';
        open.style.flexShrink = '0';
        open.style.boxSizing = 'border-box';
        open.style.borderLeft = '1px solid #fff';
        open.style.display = 'flex';
        open.style.alignItems = 'center';
        open.style.justifyContent = 'center';
        open.style.background = '#000';
        open.innerHTML = '<svg viewBox="0 0 16 16" width="24" height="24" aria-hidden="true"><path fill="#fff" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
        head.append(strip, open);

        // What each check is doing, one row each, its mark drawn as its segment is.
        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '6px';
        list.style.padding = '10px 8px';
        list.style.borderTop = '1px solid #fff';
        list.style.color = '#fff';
        const rows = named.map((check) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '8px';
            const mark = document.createElement('span');
            mark.style.width = '12px';
            mark.style.height = '12px';
            mark.style.flexShrink = '0';
            mark.style.border = '1px solid #fff';
            mark.style.boxSizing = 'border-box';
            const what = document.createElement('span');
            what.textContent = check.name;
            what.style.flex = '1';
            what.style.minWidth = '0';
            what.style.overflowWrap = 'anywhere';
            const state = document.createElement('span');
            row.append(mark, what, state);
            list.appendChild(row);
            return { mark, state };
        });

        gh.appendChild(head);

        let grown = false;
        const rest = () => {
            gh.style.width = 'calc((100vw - 32px - 8px) / 4)';
            open.style.display = 'none';
            list.remove();
            end.appendChild(gh);
        };
        const grow = () => {
            gh.style.width = '100%';
            open.style.display = 'flex';
            gh.appendChild(list);
            title.after(gh);
        };
        rest();

        let motion: Animation | null = null;
        const toggle = () => {
            const from = gh.getBoundingClientRect();
            motion?.cancel();
            grown = !grown;
            gh.setAttribute('aria-expanded', String(grown));
            if (grown) grow(); else rest();
            const to = gh.getBoundingClientRect();
            if (typeof gh.animate !== 'function') return;
            motion = gh.animate(
                [
                    { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)`, width: `${from.width}px`, height: `${from.height}px` },
                    { transform: 'none', width: `${to.width}px`, height: `${to.height}px` },
                ],
                { duration: 200, easing: 'ease-out' },
            );
        };
        gh.addEventListener('click', (e) => {
            if (open.contains(e.target as Node)) return;
            if (grown && list.contains(e.target as Node)) return;
            toggle();
        });
        gh.addEventListener('keydown', (e) => {
            if (e.target !== gh) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });

        paintChecks = () => checks.forEach((state, i) => {
            const seg = segments[i]!;
            if (seg.dataset.state === state) return;
            const { mark, state: said } = rows[i]!;
            paintSegment(seg, state);
            paintSegment(mark, state);
            said.textContent = STATE_SAYS[state];
            said.style.color = state === 'failed' ? COLOR.no : '#fff';
        });
    }
    title.append(name, end);
    title.style.alignItems = 'flex-start';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';

    // Every press sends. The other option sends again; the same one says its
    // next step. What was sent last stands until it takes effect or the time
    // runs out, and then nothing more can be sent.
    let current: { option: number; step: number } | null = null;
    let locked: string | null = null;
    const failed = () => checks.some((c) => c === 'failed');
    const presented = () => checks.every((c) => c === 'done');
    let remaining = approval.openForSeconds ?? 0;
    /** Seconds until what stood takes effect; Infinity until the host says; null when nothing waits. */
    let merging: number | null = null;

    const stepNow = (): ApprovalStep | null => current && stepsOf(approval.options[current.option]!)[current.step]!;

    const settle = () => {
        const step = stepNow();
        merging = null;
        if (step?.settles === 'now') locked = step.says;
        else if (step?.settles === 'when-ready') merging = approval.merges?.seconds ?? Infinity;
    };

    const buttons = approval.options.map((option, i) => {
        const { btn, note } = optionButton(option);
        btn.addEventListener('click', (e) => {
            if (locked || !presented()) return;
            if (current?.option === i) {
                if (current.step + 1 >= stepsOf(option).length) return;
                current = { option: i, step: current.step + 1 };
            } else {
                current = { option: i, step: 0 };
            }
            settle();
            show();
            // After show(): the piece that breaks off wears the decision just made.
            shatter(btn, e, COLOR[option.means ?? 'neither']);
            host.pressed(approval, option, stepNow()!);
            changed(true);
        });
        row.appendChild(btn);
        return { btn, note };
    });

    const show = () => {
        const notYet = !presented();
        buttons.forEach(({ btn, note }, i) => {
            const option = approval.options[i]!;
            const steps = stepsOf(option);
            const on = current?.option === i;
            const color = COLOR[option.means ?? 'neither'];
            // What was sent last fills with its colour; the others wear it as an outline.
            btn.style.background = on ? color : '#000';
            btn.style.color = on ? (option.means ? '#fff' : '#000') : color;
            btn.disabled = !!locked || notYet;
            btn.style.opacity = (locked && !on) || notYet ? '0.4' : '1';
            const next = on ? steps[current!.step + 1] : steps[0];
            const said = on ? steps[current!.step]!.says : null;
            // "The countdown, why not IN THE button." In the one that stands, how long
            // until it takes effect or can no longer change; before anything is sent,
            // in each, how long to choose.
            const count = locked || notYet ? null
                : on && merging !== null ? (merging === Infinity ? approval.merges!.label : `${approval.merges!.label} ${merging}s`)
                : approval.openForSeconds && (on || current === null) ? `${remaining}s` : null;
            const lines = notYet
                ? [failed() ? 'checks failed' : 'checks running']
                : [
                    said && said !== option.label ? said : null,
                    !locked && next && next.says !== option.label ? `${on ? 'again' : 'press'}: ${next.says}` : null,
                    count,
                ].filter(Boolean);
            note.textContent = lines.join('\n');
            note.style.whiteSpace = 'pre-line';
            note.hidden = lines.length === 0;
        });
    };

    // Only time the package itself counts needs a clock: a countdown to choose,
    // or a wait given in seconds. A host that says settled() needs none.
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
        if (locked) return clearInterval(timer);
        if (merging !== null && merging !== Infinity) {
            merging -= 1;
            if (merging <= 0) {
                locked = stepNow()!.says;
                merging = null;
                changed();
            }
        }
        if (approval.openForSeconds && presented()) {
            remaining -= 1;
            if (remaining <= 0) {
                locked = 'locked';
                changed();
            }
        }
        show();
    };
    if (approval.openForSeconds || approval.merges?.seconds) timer = setInterval(tick, 1000);

    // What an approval opens is about what it shows, so it sits with it, above
    // the choice. No bar for the time left: it is counted in the buttons.
    card.append(title, approval.context());
    for (const aside of approval.asides ?? []) card.appendChild(growInPlace(aside.label, aside.open));
    card.appendChild(row);
    paintChecks();
    show();
    const undecided = () => current === null && !locked;
    let decidedAt = Infinity;
    const stamp = () => {
        if (undecided()) decidedAt = Infinity;
        else if (decidedAt === Infinity) decidedAt = performance.now();
        return decidedAt;
    };
    return {
        card,
        approval,
        undecided,
        decidedAt: stamp,
        readiness: () => (failed() ? 2 : presented() ? 0 : 1),
        checks: (states) => {
            states.forEach((state, i) => { if (i < checks.length) checks[i] = state; });
            paintChecks();
            show();
            changed();
        },
        settled: () => {
            if (merging === null || locked) return;
            locked = stepNow()!.says;
            merging = null;
            show();
            changed();
        },
    };
}

/**
 * "Most recent undecided sorted first." "After I press, the approval doesn't
 * shift down; everything moves up, like a filmroll." Decided ones stay where
 * they were, above, in the order they were decided; swiping down brings them
 * back. Undecided ones follow, the most recent first. The cards are moved,
 * never rebuilt, and glide from where they stood to where they go.
 */
function sortApprovals(body: HTMLElement, rendered: Rendered[], end: HTMLElement): void {
    // Every one says when it was decided now, not only those a sort happens to compare.
    const when = new Map(rendered.map((r) => [r, r.decidedAt()]));
    const decided = rendered.filter((r) => !r.undecided()).sort((a, b) => when.get(a)! - when.get(b)!);
    const open = rendered.filter((r) => r.undecided()).sort((a, b) =>
        // "If an approval still has outstanding checks, other approvals take precedence."
        // A failed one is not ready for approvals at all, and goes after those still waiting.
        a.readiness() - b.readiness()
        || a.approval.arrivedMinutesAgo - b.approval.arrivedMinutesAgo);
    const order = [...decided, ...open];
    if (order.every((r, i) => body.children[i] === r.card) && body.lastElementChild === end) return;
    const before = new Map(rendered.map((r) => [r.card, r.card.getBoundingClientRect().top]));
    for (const r of order) body.appendChild(r.card);
    body.appendChild(end);
    for (const r of order) {
        const dy = before.get(r.card)! - r.card.getBoundingClientRect().top;
        if (dy && typeof r.card.animate === 'function') {
            r.card.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 140, easing: 'ease-out' });
        }
    }
}

/** The element's scroller: the nearest one up from the list that scrolls. */
function scrollerOf(el: HTMLElement): HTMLElement | null {
    for (let n = el.parentElement; n; n = n.parentElement) {
        const y = getComputedStyle(n).overflowY;
        if ((y === 'auto' || y === 'scroll') && n.scrollHeight > n.clientHeight) return n;
    }
    return null;
}

/** The roll moves up until the first undecided one, or the end of the roll, is at the top. */
function advance(body: HTMLElement, rendered: Rendered[], end: HTMLElement, smooth: boolean): void {
    const scroller = scrollerOf(body);
    if (!scroller) return;
    const next = [...body.children].find((c) => rendered.some((r) => r.card === c && r.undecided())) as HTMLElement | undefined;
    const target = next ?? end;
    const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    if (!smooth) {
        scroller.scrollTop = top;
        return;
    }
    // "Everything needs to feel faster": its own quick glide, not the browser's slow smooth scroll.
    const from = scroller.scrollTop;
    const start = performance.now();
    const glide = (now: number) => {
        const t = Math.min(1, (now - start) / 220);
        scroller.scrollTop = from + (top - from) * (1 - Math.pow(1 - t, 3));
        if (t < 1) requestAnimationFrame(glide);
    };
    requestAnimationFrame(glide);
}

/**
 * The list, to be the body of a panel. Approvals are added as they come in;
 * the roll keeps its order and, after a press, glides up to the next undecided one.
 */
export function renderApprovals(host: ApprovalHost): ApprovalRoll {
    const body = document.createElement('div');
    body.className = 'content';
    // The end of the roll, a screen tall, so the last one can come to the top.
    const end = document.createElement('div');
    end.textContent = 'Nothing left to decide.';
    end.style.minHeight = '100vh';
    end.style.borderTop = '1px solid #fff';
    end.style.padding = '16px 0';
    end.style.fontFamily = 'var(--font-mono)';
    end.style.fontSize = '12px';
    body.appendChild(end);
    const rendered: Rendered[] = [];
    let pending: ReturnType<typeof setTimeout> | undefined;
    let advancing = false;
    const settle = (smooth: boolean) => {
        clearTimeout(pending);
        pending = undefined;
        sortApprovals(body, rendered, end);
        if (advancing) advance(body, rendered, end, smooth);
        advancing = false;
    };
    const changed = (pressed = false) => {
        advancing ||= pressed;
        clearTimeout(pending);
        pending = setTimeout(() => settle(true), 90);
    };
    return {
        body,
        add: (approval) => {
            const r = renderApproval(approval, host, changed);
            rendered.push(r);
            body.appendChild(r.card);
            changed();
            return r;
        },
        settle: () => settle(false),
    };
}
