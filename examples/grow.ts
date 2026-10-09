/**
 * An element in an element: a button that grows in place to show what it
 * holds, and goes back. First made for an approval's mail and CV and an
 * agent's table; any example that has more to show than it wants on screen
 * can use it.
 *
 * "A halfsize button, when clicked, becomes larger like elements do, and shows
 * more information. It stays an element in an element."
 *
 * One node all along: half the width of its row at rest, and the same node
 * grown to the row's full width holding what it opened. Its label stays;
 * pressed there it goes back.
 */
export function growInPlace(text: string, open: () => HTMLElement): HTMLElement {
    const el = document.createElement('div');
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute('aria-expanded', 'false');
    el.style.alignSelf = 'flex-start';
    el.style.boxSizing = 'border-box';
    el.style.border = '1px solid #fff';
    el.style.background = '#000';
    el.style.color = '#fff';
    el.style.overflow = 'hidden';
    el.style.touchAction = 'manipulation';
    el.style.cursor = 'pointer';

    const label = document.createElement('div');
    label.textContent = text;
    label.style.minHeight = '30px';
    label.style.padding = '4px 8px';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    el.appendChild(label);

    const held = document.createElement('div');
    held.style.padding = '4px 8px 12px';
    held.style.cursor = 'auto';
    held.appendChild(open());

    let grown = false;
    const rest = () => {
        el.style.width = 'calc((100% - 8px) / 2)';
        held.remove();
        label.style.borderBottom = 'none';
    };
    const grow = () => {
        el.style.width = '100%';
        el.appendChild(held);
        label.style.borderBottom = '1px solid #fff';
    };
    rest();

    let motion: Animation | null = null;
    const toggle = () => {
        const from = el.getBoundingClientRect();
        motion?.cancel();
        grown = !grown;
        el.setAttribute('aria-expanded', String(grown));
        if (grown) grow(); else rest();
        const to = el.getBoundingClientRect();
        motion = el.animate(
            [
                { width: `${from.width}px`, height: `${from.height}px` },
                { width: `${to.width}px`, height: `${to.height}px` },
            ],
            { duration: 220, easing: 'ease-out' },
        );
    };

    // At rest the whole of it opens; grown, its label closes it and what it holds stays to be read.
    el.addEventListener('click', (e) => {
        if (grown && !label.contains(e.target as Node)) return;
        toggle();
    });
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
        }
    });
    return el;
}

/** A small table of monospaced rows, scrolling sideways in its own box when wider than its place. */
export function table(head: string[], rows: string[][]): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.overflowX = 'auto';
    const t = document.createElement('table');
    t.style.borderCollapse = 'collapse';
    t.style.fontFamily = 'var(--font-mono)';
    t.style.fontSize = '12px';
    t.style.width = '100%';
    const cell = (tag: 'th' | 'td', value: string) => {
        const c = document.createElement(tag);
        c.textContent = value;
        c.style.textAlign = 'left';
        c.style.padding = '4px 8px 4px 0';
        c.style.borderBottom = '1px solid #444';
        c.style.whiteSpace = 'nowrap';
        return c;
    };
    const hr = document.createElement('tr');
    head.forEach((h) => hr.appendChild(cell('th', h)));
    t.appendChild(hr);
    for (const row of rows) {
        const tr = document.createElement('tr');
        row.forEach((v) => tr.appendChild(cell('td', v)));
        t.appendChild(tr);
    }
    wrap.appendChild(t);
    return wrap;
}
