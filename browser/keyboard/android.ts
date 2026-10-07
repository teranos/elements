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
import { openSubject, placeLow, state, listenForTouch, seenTouch, judge, type PageState } from './scene';

const OUT = process.env.OUT ?? 'keyboard-shots';
mkdirSync(OUT, { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The page's state once `done` says so, or after `ms` whatever it is — then a frame's grace, since the emulator paints late. */
async function until(done: (s: PageState) => boolean, ms = 20000): Promise<PageState> {
    const end = Date.now() + ms;
    let s = await run(state) as PageState;
    while (!done(s) && Date.now() < end) {
        await sleep(500);
        s = await run(state) as PageState;
    }
    await sleep(1500);
    return await run(state) as PageState;
}

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

// ── The scene, once for each subject ────────────────────────────────────

/** Selenium, a window low on the screen; then Polonium, QNTX's Pi element full screen. */
async function pass(name: string, report: Record<string, unknown>): Promise<string[]> {
    report.opened = await run(openSubject);
    report.placedAt = await run(placeLow);
    const before = await until(() => false, 2000);
    report.before = before;
    shot(`${name}-1-before`);

    // Where the page sits on the screen: tap the page's left edge, and ask where it landed.
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
    const up = await until((s) => s.visualViewport.height < before.visualViewport.height - 100);
    report.up = up;
    shot(`${name}-2-keyboard-up`);

    adb('shell', 'input', 'text', 'se@example.com');
    report.typed = await until((s) => s.value === 'se@example.com');
    shot(`${name}-3-typed`);

    // Back puts the keyboard away.
    adb('shell', 'input', 'keyevent', '4');
    const gone = await until((s) => s.visualViewport.height >= before.visualViewport.height - 1);
    report.gone = gone;
    shot(`${name}-4-keyboard-gone`);

    return judge(before, up, gone);
}

const report: Record<string, Record<string, unknown>> = { field: {}, agent: {} };
let failed: string[] = [];
try {
    report.field!.screen = adb('shell', 'wm', 'size').toString().trim();
    failed.push(...await pass('field', report.field!));

    // The same tab, on Polonium: the page loads again under the same DevTools target.
    // The page goes away under the call that sends it there: no answer comes back.
    await run(() => { location.search = '?subject=agent'; }).catch(() => {});
    await sleep(5000);
    for (let i = 0; i < 30 && !(await run(() => document.readyState === 'complete' && !!document.querySelector('[data-element-id="agent-specimen"]')).catch(() => false)); i++) await sleep(1000);
    await sleep(1000);
    failed.push(...await pass('agent', report.agent!));
} finally {
    report.failed = { list: failed };
    writeFileSync(`${OUT}/android-report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    ws.close();
}

if (failed.length) {
    console.log(`\nFAILED on Android:\n- ${failed.join('\n- ')}`);
    process.exit(1);
}
console.log('\nAndroid: for a window and a full-screen panel, the keyboard came, the field was seen, and each went back.');
