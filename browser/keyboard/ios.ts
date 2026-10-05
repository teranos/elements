/**
 * Mobile Safari in the iOS Simulator, with its own keyboard.
 *
 * No emulated browser raises a keyboard; a simulated iPhone does. Safari is
 * driven through safaridriver (W3C WebDriver), and the screen — keyboard and
 * all — is taken by simctl, since a page's own screenshot ends where the page does.
 *
 *   UDID=<booted simulator> bun browser/keyboard/ios.ts
 */

import { mkdirSync, writeFileSync } from 'fs';
import { openSelenium, placeLow, state, judge, type PageState } from './scene';

const UDID = process.env.UDID!;
const OUT = process.env.OUT ?? 'keyboard-shots';
const WD = 'http://localhost:4444';
const PAGE = 'http://localhost:5180/';
const ELEMENT = 'element-6066-11e4-a52e-4f735466cecf';

mkdirSync(OUT, { recursive: true });

async function wd(method: string, path: string, body?: unknown): Promise<any> {
    const res = await fetch(WD + path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json() as { value: any };
    if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(json)}`);
    return json.value;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function shot(name: string): void {
    const r = Bun.spawnSync(['xcrun', 'simctl', 'io', UDID, 'screenshot', `${OUT}/ios-${name}.png`]);
    if (r.exitCode !== 0) console.log(`screenshot ${name} failed: ${r.stderr.toString()}`);
}

const session = await wd('POST', '/session', {
    capabilities: {
        alwaysMatch: {
            browserName: 'safari',
            platformName: 'iOS',
            'safari:useSimulator': true,
            'safari:deviceUDID': UDID,
        },
    },
});
const sid: string = session.sessionId;
console.log('session', JSON.stringify(session.capabilities));

const run = (fn: () => unknown): Promise<any> =>
    wd('POST', `/session/${sid}/execute/sync`, { script: `return (${fn.toString()})()`, args: [] });

const report: Record<string, unknown> = {};
try {
    await wd('POST', `/session/${sid}/url`, { url: PAGE });
    await sleep(1000);
    report.opened = await run(openSelenium);
    report.placedAt = await run(placeLow);
    await sleep(500);
    const before = await run(state) as PageState;
    report.before = before;
    shot('1-before');

    const found = await wd('POST', `/session/${sid}/element`, {
        using: 'css selector',
        value: '[data-element-id="field-specimen"] input',
    });
    const field = found[ELEMENT];
    await wd('POST', `/session/${sid}/element/${field}/click`, {});
    await sleep(2000);
    const up = await run(state) as PageState;
    report.up = up;
    shot('2-keyboard-up');

    await wd('POST', `/session/${sid}/element/${field}/value`, { text: 'se@example.com' });
    await sleep(800);
    report.typed = await run(state);
    shot('3-typed');

    await run(() => (document.activeElement as HTMLElement | null)?.blur());
    await sleep(2000);
    const gone = await run(state) as PageState;
    report.gone = gone;
    shot('4-keyboard-gone');

    report.failed = judge(before, up, gone);
} finally {
    writeFileSync(`${OUT}/ios-report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await wd('DELETE', `/session/${sid}`).catch(() => {});
}

const failed = report.failed as string[];
if (failed.length) {
    console.log(`\nFAILED on iOS:\n- ${failed.join('\n- ')}`);
    process.exit(1);
}
console.log('\niOS: the keyboard came, the field was seen, and the window went back.');
