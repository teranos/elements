/**
 * 「[Fable 5.2] Chrome on an Android emulator, a finger on the pill of what one agent said in xenon.」
 *
 * 「[Fable 5.2] The finger is adb's, as in android.ts: it opens the pill, presses delay, and presses edit. The page is read」
 * 「[Fable 5.2] through Chrome's DevTools socket, and the screen — setter, keyboard and all — is from screencap.」
 *
 * Expects Chrome open on the specimens page, `adb reverse tcp:5180 tcp:5180`
 * and `adb forward tcp:9222 localabstract:chrome_devtools_remote` (android.sh).
 *
 *   bun browser/keyboard/android-pill.ts
 */

import { mkdirSync, writeFileSync } from 'fs';
import { openXenon, pillState, listenForTouch, seenTouch, judgePill, type PillState } from './scene';

const OUT = process.env.OUT ?? 'keyboard-shots';
mkdirSync(OUT, { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function adb(...args: string[]): Buffer {
    const r = Bun.spawnSync(['adb', ...args]);
    if (r.exitCode !== 0) throw new Error(`adb ${args.join(' ')}: ${r.stderr.toString()}`);
    return r.stdout as Buffer;
}

function shot(name: string): void {
    writeFileSync(`${OUT}/android-pill-${name}.png`, adb('exec-out', 'screencap', '-p'));
}

// ── The page, through Chrome's DevTools socket ──────────────────────────

const targets = await (await fetch('http://localhost:9222/json')).json() as { type: string; url: string; webSocketDebuggerUrl: string }[];
const target = targets.find((t) => t.type === 'page' && t.url.startsWith('http://localhost:5180'));
if (!target) throw new Error(`no specimens page among: ${JSON.stringify(targets.map((t) => t.url))}`);

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 1;
const pending = new Map<number, (v: any) => void>();
ws.onmessage = (m) => {
    const msg = JSON.parse(String(m.data));
    pending.get(msg.id)?.(msg);
    pending.delete(msg.id);
};

function send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = nextId++;
    return new Promise<any>((resolve) => {
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
    });
}

async function run(fn: () => unknown): Promise<any> {
    const reply = await send('Runtime.evaluate', { expression: `(${fn.toString()})()`, awaitPromise: true, returnByValue: true });
    if (reply.error || reply.result?.exceptionDetails) throw new Error(JSON.stringify(reply.error ?? reply.result.exceptionDetails));
    return reply.result.result.value;
}

/** The page's state once `done` says so, or after `ms` whatever it is — then a frame's grace, since the emulator paints late. */
async function until(done: (s: PillState) => boolean, ms = 20000): Promise<PillState> {
    const end = Date.now() + ms;
    let s = await run(pillState) as PillState;
    while (!done(s) && Date.now() < end) {
        await sleep(500);
        s = await run(pillState) as PillState;
    }
    await sleep(1500);
    return await run(pillState) as PillState;
}

// ── The scene ───────────────────────────────────────────────────────────

const report: Record<string, unknown> = {};
let failed: string[] = [];
try {
    // The page as it first was: the scene before this one left a window open on it.
    await send('Page.reload');
    await sleep(4000);
    report.opened = await run(openXenon);
    const start = await until(() => false, 2000);
    report.start = start;
    shot('0-start');

    // Where the page sits on the screen: tap what was said, and ask where it landed.
    const dpr = start.devicePixelRatio;
    await run(listenForTouch);
    const probe = { x: Math.round(6 * dpr), y: Math.round(start.innerHeight * dpr * 0.35) };
    adb('shell', 'input', 'tap', String(probe.x), String(probe.y));
    await sleep(1500);
    const seen = await run(seenTouch) as { x: number; y: number } | null;
    if (!seen) throw new Error('the page saw no touch: cannot tell where it sits on the screen');
    const offset = { x: probe.x - seen.x * dpr, y: probe.y - seen.y * dpr };
    report.pageOffset = offset;
    const on = (at: { x: number; y: number }) => adb('shell', 'input', 'tap', String(Math.round(offset.x + at.x * dpr)), String(Math.round(offset.y + at.y * dpr)));

    /** The pill pressed open, by a finger on it where it rests. */
    const opened = async (): Promise<PillState> => {
        const resting = await run(pillState) as PillState;
        if (resting.pill.form === 'pillOpen' && !resting.pill.moving) return resting;
        if (!resting.pill.at) throw new Error('the page has no pill of what Rowan said');
        on(resting.pill.at);
        return until((s) => s.pill.form === 'pillOpen' && !s.pill.moving);
    };

    // The finger on the pill.
    const open = await opened();
    report.open = open;
    shot('1-open');

    // The finger on delay: the device's own date and time setter.
    if (!open.delay) throw new Error('the open pill has no delay to press');
    on(open.delay);
    const setter = await until((s) => s.setterFocused, 10000);
    report.setter = setter;
    shot('2-setter');

    // Back puts the setter away. It may let the pill go too: a finger opens it again.
    adb('shell', 'input', 'keyevent', '4');
    await sleep(2000);
    const again = await opened();
    report.again = again;

    // The finger on edit: what was said is a field, and the keyboard comes.
    if (!again.edit) throw new Error('the open pill has no edit to press');
    on(again.edit);
    const up = await until((s) => s.field !== null && s.visualViewport.height < again.visualViewport.height - 100);
    report.up = up;
    shot('3-keyboard-up');

    failed = judgePill(open, setter, up);
    report.failed = failed;
} finally {
    writeFileSync(`${OUT}/android-pill-report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    ws.close();
}

if (failed.length) {
    console.log(`\nFAILED on Android, the pill:\n- ${failed.join('\n- ')}`);
    process.exit(1);
}
console.log('\nAndroid, the pill: a finger opened it, delay reached the setter, and edit brought the keyboard with the field seen.');
