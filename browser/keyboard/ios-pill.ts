/**
 * 「[Fable 5.2] Mobile Safari in the iOS Simulator, a finger on the pill of what one agent said in xenon.」
 *
 * 「[Fable 5.2] The finger is idb's, as in ios.ts: it opens the pill, presses delay, and presses edit. The page is the harness's」
 * 「[Fable 5.2] at /pill (pill-page.ts), which reports what it sees. The screen — setter, keyboard and all — is taken by simctl.」
 *
 *   「[Fable 5.2] UDID=<booted simulator> bun browser/keyboard/ios-pill.ts   (with harness.ts running and Safari open on /pill)」
 */

import { mkdirSync, writeFileSync } from 'fs';
import { judgePill, type PillState } from './scene';

const UDID = process.env.UDID!;
const OUT = process.env.OUT ?? 'keyboard-shots';
const HARNESS = 'http://localhost:5181';

mkdirSync(OUT, { recursive: true });

interface Report {
    scene?: string;
    event: string;
    at: number;
    screen: { width: number; height: number };
    state: PillState;
    touch?: { x: number; y: number };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** What the pill's page reported, and nothing of the page before it. */
async function reports(): Promise<Report[]> {
    const all = await (await fetch(`${HARNESS}/reports`)).json() as Report[];
    return all.filter((r) => r.scene === 'pill');
}

async function latest(): Promise<Report> {
    const all = await reports();
    return all[all.length - 1]!;
}

function shot(name: string): void {
    const r = Bun.spawnSync(['xcrun', 'simctl', 'io', UDID, 'screenshot', `${OUT}/ios-pill-${name}.png`]);
    if (r.exitCode !== 0) console.log(`screenshot ${name} failed: ${r.stderr.toString()}`);
}

function idb(...args: string[]): void {
    const r = Bun.spawnSync(['idb', ...args, '--udid', UDID]);
    if (r.exitCode !== 0) throw new Error(`idb ${args.join(' ')}: ${r.stderr.toString()}`);
}

/** The page's latest state once `done` says so, or after `ms` whatever it is — then a frame's grace. */
async function until(done: (s: PillState) => boolean, ms = 20000): Promise<PillState> {
    const end = Date.now() + ms;
    let s = (await latest()).state;
    while (!done(s) && Date.now() < end) {
        await sleep(500);
        s = (await latest()).state;
    }
    await sleep(1500);
    return (await latest()).state;
}

const tap = (x: number, y: number) => idb('ui', 'tap', String(Math.round(x)), String(Math.round(y)));

const report: Record<string, unknown> = {};
let failed: string[] = [];
try {
    // 「[Fable 5.2] The page opens xenon, and says so.」
    let ready: Report | undefined;
    for (let i = 0; i < 90 && !ready; i++) {
        ready = (await reports()).find((r) => r.event === 'ready');
        if (!ready) await sleep(1000);
    }
    if (!ready) throw new Error('the pill\'s page never said it was ready');
    report.ready = ready;
    await sleep(1000);
    shot('0-start');

    // 「[Fable 5.2] Where the page sits on the screen: tap what was said, and ask where it landed.」
    const spot = { x: 6, y: Math.round(ready.screen.height * 0.35) };
    let offset: { x: number; y: number } | undefined;
    for (let i = 0; i < 4 && !offset; i++) {
        const seen = (await reports()).length;
        tap(spot.x, spot.y);
        await sleep(1200);
        const touch = (await reports()).slice(seen).find((r) => r.event === 'touch');
        if (touch?.touch) offset = { x: spot.x - touch.touch.x, y: spot.y - touch.touch.y };
        else shot(`0-tap-${i + 1}-not-seen`);
    }
    if (!offset) throw new Error('the page saw none of four taps: cannot tell where it sits on the screen');
    report.pageOffset = offset;
    const on = (at: { x: number; y: number }) => tap(offset!.x + at.x, offset!.y + at.y);

    /** The pill pressed open, by a finger on it where it rests. */
    const opened = async (): Promise<PillState> => {
        const resting = (await latest()).state;
        if (resting.pill.form === 'pillOpen' && !resting.pill.moving) return resting;
        if (!resting.pill.at) throw new Error('the page has no pill of what Rowan said');
        on(resting.pill.at);
        return until((s) => s.pill.form === 'pillOpen' && !s.pill.moving);
    };

    // 「[Fable 5.2] The finger on the pill.」
    const open = await opened();
    report.open = open;
    shot('1-open');

    // 「[Fable 5.2] The finger on delay: the device's own date and time setter.」
    if (!open.delay) throw new Error('the open pill has no delay to press');
    on(open.delay);
    const setter = await until((s) => s.setterFocused, 10000);
    report.setter = setter;
    shot('2-setter');

    // 「[Fable 5.2] A tap on what was said puts the setter away. It may let the pill go too: a finger opens it again.」
    tap(spot.x, spot.y);
    await sleep(2000);
    const again = await opened();
    report.again = again;

    // 「[Fable 5.2] The finger on edit: what was said is a field, and the keyboard comes.」
    if (!again.edit) throw new Error('the open pill has no edit to press');
    on(again.edit);
    const up = await until((s) => s.field !== null && s.visualViewport.height < again.visualViewport.height - 100);
    report.up = up;
    shot('3-keyboard-up');

    failed = judgePill(open, setter, up);
    report.failed = failed;
} finally {
    report.events = (await reports().catch(() => [])).filter((r) => r.event !== 'tick')
        .map((r) => `${r.at} ${r.event} vv=${Math.round(r.state.visualViewport.height)} pill=${r.state.pill.form} field=${r.state.fieldFocused} setter=${r.state.setterFocused}`);
    writeFileSync(`${OUT}/ios-pill-report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
}

if (failed.length) {
    console.log(`\nFAILED on iOS, the pill:\n- ${failed.join('\n- ')}`);
    process.exit(1);
}
console.log('\niOS, the pill: a finger opened it, delay reached the setter, and edit brought the keyboard with the field seen.');
