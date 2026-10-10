/**
 * "I want the nice real uncompromising version. I want to feel a little bit
 * better on each approval I go through."
 *
 * A press breaks a crystal fragment off the button where the thumb landed: a
 * real piece of its face — its colour, its letters — cut along fracture lines
 * from the point of impact. Light runs over the cut where it struck.
 *
 * "Because of the fast upward movement and the finger touch combined it would
 * look like being shattered out of it and fly away fast." Not something to
 * keep: knocked out. The fragment leaves at speed, up and away from where
 * the finger struck, spinning, and is off the screen in a moment. Its glassy
 * edge catches a glint as it turns. A few chips scatter with it.
 *
 * "Why can I keep pressing the button but nothing is actually taken out of
 * it?" What breaks off is gone from the button: each press leaves a hole the
 * shape of its fragment, and the next fragment breaks from what is left.
 *
 * One canvas over everything, drawn only while something is in the air.
 */

type Vec3 = [number, number, number];

interface Fragment {
    texture: HTMLCanvasElement;
    /** Outline in its own plane, around its centre of mass, in CSS pixels. */
    outline: [number, number][];
    /** Where its centre was on the button, in the texture's coordinates. */
    origin: [number, number];
    radius: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    spin: Vec3;
    turn: Vec3;
    phase: number;
    /** Where it broke off, on the screen. */
    x0: number;
    y0: number;
    /** Toward the viewer is negative. */
    z: number;
    /** Which way it turns, and the way it leaves. */
    sign: number;
    exit: [number, number];
    age: number;
    tint: string;
    chip: boolean;
}

interface Crack {
    x: number;
    y: number;
    lines: [number, number][][];
    age: number;
}

const GRAVITY = 1150;
const FOCAL = 520;
const THICKNESS = 3;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
const fragments: Fragment[] = [];
const cracks: Crack[] = [];
let running = false;
/** The holes each button has had broken out of it, in its own coordinates. */
const holes = new WeakMap<HTMLElement, [number, number][][]>();

/** The button shows only what is left of it: its holes are cut out of it. */
function cutHoles(btn: HTMLElement): void {
    const list = holes.get(btn) ?? [];
    const r = btn.getBoundingClientRect();
    const scale = 2;
    const mask = document.createElement('canvas');
    mask.width = Math.ceil(r.width * scale);
    mask.height = Math.ceil(r.height * scale);
    const m = mask.getContext('2d')!;
    m.scale(scale, scale);
    m.fillStyle = '#000';
    m.fillRect(0, 0, r.width, r.height);
    m.globalCompositeOperation = 'destination-out';
    for (const hole of list) {
        m.beginPath();
        hole.forEach(([x, y], i) => (i ? m.lineTo(x, y) : m.moveTo(x, y)));
        m.closePath();
        m.fill();
    }
    const url = `url(${mask.toDataURL()})`;
    btn.style.webkitMaskImage = url;
    btn.style.maskImage = url;
    btn.style.webkitMaskSize = '100% 100%';
    btn.style.maskSize = '100% 100%';
    btn.style.webkitMaskRepeat = 'no-repeat';
    btn.style.maskRepeat = 'no-repeat';
}
let last = 0;

/** The one canvas over everything, or null where nothing can be drawn. */
function layer(): CanvasRenderingContext2D | null {
    if (ctx && canvas?.isConnected) return ctx;
    const made = document.createElement('canvas');
    ctx = made.getContext('2d');
    if (!ctx) return null;
    canvas = made;
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '2147483647';
    document.body.appendChild(canvas);
    return ctx;
}

function fit(): number {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(innerWidth * dpr);
    const h = Math.round(innerHeight * dpr);
    if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
    }
    return dpr;
}

/** The button as it looks now, painted again: its fill, its border, every line of its text. */
function paintButton(btn: HTMLElement, dpr: number): HTMLCanvasElement {
    const r = btn.getBoundingClientRect();
    const tex = document.createElement('canvas');
    tex.width = Math.ceil(r.width * dpr);
    tex.height = Math.ceil(r.height * dpr);
    const t = tex.getContext('2d')!;
    t.scale(dpr, dpr);
    const style = getComputedStyle(btn);
    t.fillStyle = style.backgroundColor;
    t.fillRect(0, 0, r.width, r.height);
    const border = parseFloat(style.borderTopWidth) || 0;
    if (border) {
        t.strokeStyle = style.borderTopColor;
        t.lineWidth = border;
        t.strokeRect(border / 2, border / 2, r.width - border, r.height - border);
    }
    for (const span of btn.querySelectorAll<HTMLElement>('span')) {
        if (!span.textContent || span.hidden || span.closest('[hidden]')) continue;
        const s = getComputedStyle(span);
        t.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
        t.fillStyle = s.color;
        t.textAlign = 'center';
        t.textBaseline = 'middle';
        const lines = span.textContent.split('\n');
        const box = span.getBoundingClientRect();
        const lh = box.height / lines.length;
        lines.forEach((line, i) => t.fillText(line, box.left - r.left + box.width / 2, box.top - r.top + lh * (i + 0.5)));
    }
    // What was broken out before is not there to break again.
    t.globalCompositeOperation = 'destination-out';
    for (const hole of holes.get(btn) ?? []) {
        t.beginPath();
        hole.forEach(([x, y], i) => (i ? t.lineTo(x, y) : t.moveTo(x, y)));
        t.closePath();
        t.fill();
    }
    return tex;
}

/** A crystal shard: a long, sharp-cornered outline, not a blob. */
function shardOutline(size: number): [number, number][] {
    const corners = 5 + Math.floor(Math.random() * 3);
    const stretch = 1.35 + Math.random() * 0.5;
    const tilt = Math.random() * Math.PI;
    const pts: [number, number][] = [];
    for (let k = 0; k < corners; k++) {
        const a = (k / corners) * Math.PI * 2 + (Math.random() - 0.5) * 0.55;
        // Alternate long and short reaches: facets meet at points.
        const reach = size * (k % 2 ? 0.55 + Math.random() * 0.2 : 0.85 + Math.random() * 0.25);
        const x = Math.cos(a) * reach * stretch;
        const y = Math.sin(a) * reach;
        pts.push([x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt)]);
    }
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return pts.map(([x, y]) => [x - cx, y - cy]);
}

/** Fracture lines radiating from the point of impact, each a few jagged segments. */
function crackLines(): [number, number][][] {
    const n = 7 + Math.floor(Math.random() * 4);
    return Array.from({ length: n }, (_, i) => {
        let a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const len = 14 + Math.random() * 26;
        const line: [number, number][] = [[0, 0]];
        let x = 0;
        let y = 0;
        const steps = 3 + Math.floor(Math.random() * 2);
        for (let s = 0; s < steps; s++) {
            a += (Math.random() - 0.5) * 0.7;
            x += Math.cos(a) * (len / steps);
            y += Math.sin(a) * (len / steps);
            line.push([x, y]);
        }
        return line;
    });
}

function rotate([x, y, z]: Vec3, [rx, ry, rz]: Vec3): Vec3 {
    let c = Math.cos(rx);
    let s = Math.sin(rx);
    [y, z] = [y * c - z * s, y * s + z * c];
    c = Math.cos(ry);
    s = Math.sin(ry);
    [x, z] = [x * c + z * s, -x * s + z * c];
    c = Math.cos(rz);
    s = Math.sin(rz);
    [x, y] = [x * c - y * s, x * s + y * c];
    return [x, y, z];
}

function project(cx: number, cy: number, [x, y, z]: Vec3): [number, number] {
    const k = FOCAL / (FOCAL + z);
    return [cx + x * k, cy + y * k];
}

function tintOf(color: string): string {
    return color === '#fff' ? '#b8c2d0' : color;
}

export function shatter(btn: HTMLElement, e: MouseEvent, color: string): void {
    const r = btn.getBoundingClientRect();
    // A press from the keyboard has no point: it breaks from the middle.
    const px = (e.clientX || e.clientY ? e.clientX : r.left + r.width / 2) - r.left;
    const py = (e.clientX || e.clientY ? e.clientY : r.top + r.height / 2) - r.top;
    try { navigator.vibrate?.(8); } catch { /* not every phone lets a page */ }

    // Where nothing can be drawn, nothing breaks off.
    if (!layer()) return;
    const dpr = fit();
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    cracks.push({ x: r.left + px, y: r.top + py, lines: crackLines(), age: 0 });

    if (!reduced) {
        const texture = paintButton(btn, dpr);
        const size = 15 + Math.random() * 6;
        // The piece comes from where the thumb landed, kept whole inside the button.
        const ox = Math.min(Math.max(px, size * 1.6), r.width - size * 1.6);
        const oy = Math.min(Math.max(py, size * 1.1), r.height - size * 1.1);
        const side = Math.random() < 0.5 ? -1 : 1;
        const outline = shardOutline(size);
        // The piece leaves its shape behind as a hole.
        holes.set(btn, [...(holes.get(btn) ?? []), outline.map(([x, y]) => [x + ox, y + oy] as [number, number])]);
        cutHoles(btn);
        const x0 = r.left + ox;
        const y0 = r.top + oy;
        // Knocked away from where the finger struck: off-centre taps send it sideways too.
        const off = (px - r.width / 2) / (r.width / 2);
        fragments.push({
            texture,
            outline,
            origin: [ox, oy],
            radius: size,
            x: x0,
            y: y0,
            vx: off * 260 + side * (40 + Math.random() * 60),
            vy: -(1350 + Math.random() * 300),
            spin: [(10 + Math.random() * 10) * side, (8 + Math.random() * 10) * -side, (4 + Math.random() * 6) * side],
            turn: [0, 0, 0],
            phase: 0,
            x0,
            y0,
            z: 0,
            sign: side,
            exit: [0, 0],
            age: 0,
            tint: tintOf(color),
            chip: false,
        });
        const chips = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < chips; i++) {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
            const speed = 380 + Math.random() * 320;
            fragments.push({
                texture,
                outline: shardOutline(3 + Math.random() * 3),
                origin: [ox, oy],
                radius: 5,
                x: r.left + ox,
                y: r.top + oy,
                vx: Math.cos(a) * speed,
                vy: Math.sin(a) * speed,
                spin: [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 20],
                turn: [0, 0, 0],
                phase: 0,
                x0: r.left + ox,
                y0: r.top + oy,
                z: 0,
                sign: 1,
                exit: [0, 0],
                age: 0,
                tint: tintOf(color),
                chip: true,
            });
        }
    }
    if (!running) {
        running = true;
        last = performance.now();
        requestAnimationFrame(frame);
    }
}

function step(f: Fragment, dt: number): void {
    f.age += dt;
    // Thrown, then gravity: the fragment so hard it is gone before it can fall back.
    f.vy += (f.chip ? GRAVITY : GRAVITY * 1.6) * dt;
    f.vx *= Math.exp(-(f.chip ? 1.2 : 0.4) * dt);
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.turn = [f.turn[0] + f.spin[0] * dt, f.turn[1] + f.spin[1] * dt, f.turn[2] + f.spin[2] * dt];
}

/** The fragment's orientation now. */
function pose(f: Fragment): Vec3 {
    return f.turn;
}

/** A point of the fragment in its own plane, turned and placed at its depth. */
function placed(f: Fragment, rot: Vec3, p: Vec3): Vec3 {
    const [x, y, z] = rotate(p, rot);
    return [x, y, z + f.z];
}

const lifeOf = (f: Fragment) => (f.chip ? 0.55 : 0.6);

function drawFragment(c: CanvasRenderingContext2D, f: Fragment, dpr: number): void {
    const life = lifeOf(f);
    const alpha = Math.max(0, Math.min(1, (life - f.age) / (f.chip ? 0.35 : 0.12)));
    if (alpha <= 0) return;
    const rot = pose(f);
    const unit = 10;
    const o = project(f.x, f.y, placed(f, rot, [0, 0, 0]));
    const u = project(f.x, f.y, placed(f, rot, [unit, 0, 0]));
    const v = project(f.x, f.y, placed(f, rot, [0, unit, 0]));
    const back = project(f.x, f.y, placed(f, rot, [0, 0, THICKNESS]));
    const a = [(u[0] - o[0]) / unit, (u[1] - o[1]) / unit];
    const b = [(v[0] - o[0]) / unit, (v[1] - o[1]) / unit];
    const det = a[0] * b[1] - a[1] * b[0];
    const front = det > 0;
    const lit = Math.min(1, Math.abs(det));
    const path = () => {
        c.beginPath();
        f.outline.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.closePath();
    };

    c.save();
    c.globalAlpha = alpha;

    // Its depth: the same outline behind it, darker, where its thickness shows.
    c.setTransform(dpr * a[0], dpr * a[1], dpr * b[0], dpr * b[1], dpr * back[0], dpr * back[1]);
    path();
    c.fillStyle = f.tint;
    c.globalAlpha = alpha * 0.55;
    c.fill();
    c.globalAlpha = alpha;

    c.setTransform(dpr * a[0], dpr * a[1], dpr * b[0], dpr * b[1], dpr * o[0], dpr * o[1]);
    path();
    c.save();
    c.clip();
    if (front && !f.chip) {
        // Its face: the very piece of the button it broke from.
        c.drawImage(f.texture, -f.origin[0], -f.origin[1], f.texture.width / dpr, f.texture.height / dpr);
    } else {
        // Its back, or a chip: clear crystal tinted by the button.
        const g = c.createLinearGradient(-f.radius, -f.radius, f.radius, f.radius);
        g.addColorStop(0, 'rgba(255,255,255,0.9)');
        g.addColorStop(1, f.tint);
        c.fillStyle = g;
        c.fillRect(-f.radius * 2, -f.radius * 2, f.radius * 4, f.radius * 4);
    }
    // Turned away from the light it darkens a little.
    c.fillStyle = `rgba(0,0,0,${(1 - lit) * 0.45})`;
    c.fillRect(-f.radius * 2, -f.radius * 2, f.radius * 4, f.radius * 4);
    // The glint: a band of light that runs across it as it turns.
    const sweep = Math.sin(rot[0] * 1.3 + rot[1] * 0.9);
    const glint = Math.pow(Math.max(0, Math.cos(rot[0] * 2 + rot[1])), 6);
    const g = c.createLinearGradient(-f.radius * 1.6, -f.radius, f.radius * 1.6, f.radius);
    const at = 0.5 + sweep * 0.4;
    g.addColorStop(Math.max(0, at - 0.18), 'rgba(255,255,255,0)');
    g.addColorStop(at, `rgba(255,255,255,${0.25 + glint * 0.65})`);
    g.addColorStop(Math.min(1, at + 0.18), 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(-f.radius * 2, -f.radius * 2, f.radius * 4, f.radius * 4);
    c.restore();

    // The cut edge, bright, a crystal's facet line.
    path();
    c.lineJoin = 'miter';
    c.lineWidth = 1.1 / Math.sqrt(Math.max(0.05, Math.abs(det)));
    c.strokeStyle = `rgba(255,255,255,${0.55 + glint * 0.45})`;
    c.stroke();
    c.restore();
}

function drawCrack(c: CanvasRenderingContext2D, k: Crack, dpr: number): void {
    const life = 0.3;
    const t = k.age / life;
    if (t >= 1) return;
    c.save();
    c.setTransform(dpr, 0, 0, dpr, dpr * k.x, dpr * k.y);
    // The lines run out from the point of impact, then fade.
    const reach = Math.min(1, t * 4);
    c.strokeStyle = `rgba(255,255,255,${(1 - t) * 0.9})`;
    c.lineWidth = 1;
    c.lineJoin = 'miter';
    for (const line of k.lines) {
        c.beginPath();
        const upto = Math.max(1, Math.round(reach * (line.length - 1)));
        for (let i = 0; i <= upto; i++) (i ? c.lineTo : c.moveTo).call(c, line[i]![0], line[i]![1]);
        c.stroke();
    }
    // A flash where it struck.
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, 16);
    glow.addColorStop(0, `rgba(255,255,255,${(1 - t) * 0.8})`);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = glow;
    c.beginPath();
    c.arc(0, 0, 16, 0, Math.PI * 2);
    c.fill();
    c.restore();
}

function frame(now: number): void {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    const c = ctx!;
    const dpr = fit();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas!.width, canvas!.height);

    for (const k of cracks) k.age += dt;
    for (const f of fragments) step(f, dt);
    for (let i = cracks.length - 1; i >= 0; i--) if (cracks[i]!.age > 0.3) cracks.splice(i, 1);
    for (let i = fragments.length - 1; i >= 0; i--) {
        const f = fragments[i]!;
        if (f.age > lifeOf(f) || f.y < -120 || f.y > innerHeight + 120) fragments.splice(i, 1);
    }

    for (const k of cracks) drawCrack(c, k, dpr);
    // Chips first: the fragment is nearer.
    for (const f of fragments) if (f.chip) drawFragment(c, f, dpr);
    for (const f of fragments) if (!f.chip) drawFragment(c, f, dpr);

    if (fragments.length || cracks.length) {
        requestAnimationFrame(frame);
    } else {
        running = false;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, canvas!.width, canvas!.height);
    }
}
