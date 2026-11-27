#!/usr/bin/env bun
/**
 * The specimens page, plus a reporter: what the page sees of touches, focus and
 * the visual viewport is posted back here, for a driver that can only tap.
 *
 * On iOS a WebDriver-driven page never raises the keyboard — its clicks and keys
 * do not pass through UIKit. A real tap does (idb), and a real tap cannot ask the
 * page anything. So the page tells.
 *
 *   bun browser/keyboard/harness.ts   →  http://localhost:5181, reports at /reports
 */

import { join } from 'path';

const root = join(import.meta.dir, '../..');
const PORT = 5181;
const reports: unknown[] = [];

async function bundle(entry: string): Promise<Response> {
    const built = await Bun.build({ entrypoints: [join(root, entry)] });
    if (!built.success) return new Response(built.logs.join('\n'), { status: 500 });
    return new Response(await built.outputs[0]!.text(), { headers: { 'Content-Type': 'text/javascript' } });
}

Bun.serve({
    port: PORT,
    async fetch(req) {
        const path = new URL(req.url).pathname;
        if (path === '/main.js') return bundle('examples/main.ts');
        if (path === '/page.js') return bundle('browser/keyboard/page.ts');
        if (path === '/pill-page.js') return bundle('browser/keyboard/pill-page.ts');
        if (path === '/report' && req.method === 'POST') {
            reports.push(await req.json());
            return new Response('ok');
        }
        if (path === '/reports') return Response.json(reports);
        const html = await Bun.file(join(root, 'examples/index.html')).text();
        // 「[Fable 5.2] The pill of what one agent said has a page of its own: /pill.」
        const page = path === '/pill' ? '/pill-page.js' : '/page.js';
        return new Response(html.replace('</body>', `  <script type="module" src="${page}"></script>\n</body>`), {
            headers: { 'Content-Type': 'text/html' },
        });
    },
});

console.log(`keyboard harness → http://localhost:${PORT}`);
