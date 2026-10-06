/**
 * Mobile Safari in the iOS Simulator, with its own keyboard.
 *
 * The finger is idb's: real taps through UIKit, which is the
 * only way the keyboard comes. The page is the harness's (harness.ts), which
 * reports what it sees. The screen — keyboard and all — is taken by simctl.
 *
 *   UDID=<booted simulator> bun browser/keyboard/ios.ts   (with harness.ts running and Safari open on it)
 */

import { mkdirSync, writeFileSync } from 'fs';
import { judge, type PageState } from './scene';

const UDID = process.env.UDID!;
const OUT = process.env.OUT ?? 'keyboard-shots';
const HARNESS = 'http://localhost:5181';

mkdirSync(OUT, { recursive: true });

interface Report {
    event: string;
    at: number;
    screen: { width: number; height: number };
    state: PageState;
    touch?: { x: number; y: number };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function reports(): Promise<Report[]> {
    return (await fetch(`${HARNESS}/reports`)).json() as Promise<Report[]>;
}

async function latest(): Promise<Report> {
    const all = await reports();
    return all[all.length - 1]!;
}

function shot(name: string): void {
    const r = Bun.spawnSync(['xcrun', 'simctl', 'io', UDID, 'screenshot', `${OUT}/ios-${name}.png`]);
    if (r.exitCode !== 0) console.log(`screenshot ${name} failed: ${r.stderr.toString()}`);
}

function idb(...args: string[]): void {
    const r = Bun.spawnSync(['idb', ...args, '--udid', UDID]);
    if (r.exitCode !== 0) throw new Error(`idb ${args.join(' ')}: ${r.stderr.toString()}`);
}

/** The page's latest state once `done` says so, or after `ms` whatever it is — then a frame's grace. */
async function until(done: (s: PageState) => boolean, ms = 20000): Promise<PageState> {
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
    // The page opens Selenium low on the screen, and says so.
    let ready: Report | undefined;
    for (let i = 0; i < 90 && !ready; i++) {
        ready = (await reports()).find((r) => r.event === 'ready');
        if (!ready) await sleep(1000);
    }
    if (!ready) throw new Error('the page never said it was ready');
    report.ready = ready;
    await sleep(1000);
    shot('0-start');

    // Where the page sits on the screen: tap bare page, and ask where it landed.
    // A tap Safari takes for itself (a tip over the page) is answered by tapping again.
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

    const before = (await latest()).state;
    report.before = before;
    shot('1-before');

    // The finger on the field.
    const at = { x: offset.x + before.field.centerX, y: offset.y + before.field.centerY };
    report.tappedAt = at;
    tap(at.x, at.y);
    const up = await until((s) => s.visualViewport.height < before.visualViewport.height - 100);
    report.up = up;
    shot('2-keyboard-up');

    // No typing here: idb's keys arrive as a hardware keyboard, and iOS puts the
    // software keyboard away for one — the keyboard under test.

    // A tap on bare page takes focus away, and the keyboard with it.
    tap(spot.x, spot.y);
    const gone = await until((s) => s.visualViewport.height >= before.visualViewport.height - 1);
    report.gone = gone;
    shot('3-keyboard-gone');

    failed = judge(before, up, gone);
    report.failed = failed;
} finally {
    report.events = (await reports().catch(() => [])).map((r) => `${r.at} ${r.event} vv=${Math.round(r.state.visualViewport.height)} top=${Math.round(r.state.window.top)}`);
    writeFileSync(`${OUT}/ios-report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
}

if (failed.length) {
    console.log(`\nFAILED on iOS:\n- ${failed.join('\n- ')}`);
    process.exit(1);
}
console.log('\niOS: the keyboard came, the field was seen, and the window went back.');
