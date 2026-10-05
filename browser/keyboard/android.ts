/**
 * Chrome on an Android emulator, with its own keyboard.
 *
 * The finger is adb's: a real tap through the input system, real typing
 * through the IME, Back to put the keyboard away, and the screen — keyboard
 * and all — from screencap. The page is read through Chrome's DevTools socket.
 *
 * Expects Chrome open on the specimens page, `adb reverse tcp:5180 tcp:5180`
 * and `adb forward tcp:9222 localabstract:chrome_devtools_remote` (android.sh).
 *
 *   bun browser/keyboard/android.ts
 */

import { mkdirSync, writeFileSync } from 'fs';
import { openSelenium, placeLow, state, listenForTouch, seenTouch, judge, type PageState } from './scene';

const OUT = process.env.OUT ?? 'keyboard-shots';
mkdirSync(OUT, { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function adb(...args: string[]): Buffer {
    const r = Bun.spawnSync(['adb', ...args]);
    if (r.exitCode !== 0) throw new Error(`adb ${args.join(' ')}: ${r.stderr.toString()}`);
    return r.stdout as Buffer;
}

function shot(name: string): void {
    writeFileSync(`${OUT}/android-${name}.png`, adb('exec-out', 'screencap', '-p'));
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

async function run(fn: () => unknown): Promise<any> {
    const id = nextId++;
    const reply = await new Promise<any>((resolve) => {
        pending.set(id, resolve);
        ws.send(JSON.stringify({
            id,
            method: 'Runtime.evaluate',
            params: { expression: `(${fn.toString()})()`, awaitPromise: true, returnByValue: true },
        }));
    });
    if (reply.error || reply.result?.exceptionDetails) throw new Error(JSON.stringify(reply.error ?? reply.result.exceptionDetails));
    return reply.result.result.value;
}

// ── The scene ───────────────────────────────────────────────────────────

const report: Record<string, unknown> = {};
let failed: string[] = [];
try {
    report.screen = adb('shell', 'wm', 'size').toString().trim();
    report.opened = await run(openSelenium);
    report.placedAt = await run(placeLow);
    await sleep(500);
    const before = await run(state) as PageState;
    report.before = before;
    shot('1-before');

    // Where the page sits on the screen: tap bare page, and ask where it landed.
    const dpr = before.devicePixelRatio;
    await run(listenForTouch);
    const probe = { x: Math.round(6 * dpr), y: Math.round(before.innerHeight * dpr * 0.5) };
    adb('shell', 'input', 'tap', String(probe.x), String(probe.y));
    await sleep(1500);
    const seen = await run(seenTouch) as { x: number; y: number } | null;
    if (!seen) throw new Error('the page saw no touch: cannot tell where it sits on the screen');
    const offset = { x: probe.x - seen.x * dpr, y: probe.y - seen.y * dpr };
    report.pageOffset = offset;

    // The finger on the field.
    const at = {
        x: Math.round(offset.x + before.field.centerX * dpr),
        y: Math.round(offset.y + before.field.centerY * dpr),
    };
    report.tappedAt = at;
    adb('shell', 'input', 'tap', String(at.x), String(at.y));
    await sleep(2500);
    const up = await run(state) as PageState;
    report.up = up;
    shot('2-keyboard-up');

    adb('shell', 'input', 'text', 'se@example.com');
    await sleep(1000);
    report.typed = await run(state);
    shot('3-typed');

    // Back puts the keyboard away.
    adb('shell', 'input', 'keyevent', '4');
    await sleep(2500);
    const gone = await run(state) as PageState;
    report.gone = gone;
    shot('4-keyboard-gone');

    failed = judge(before, up, gone);
    report.failed = failed;
} finally {
    writeFileSync(`${OUT}/android-report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    ws.close();
}

if (failed.length) {
    console.log(`\nFAILED on Android:\n- ${failed.join('\n- ')}`);
    process.exit(1);
}
console.log('\nAndroid: the keyboard came, the field was seen, and the window went back.');
