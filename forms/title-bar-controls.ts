/**
 * Title Bar Controls — shared helpers for adding/removing window controls
 * (minimize, close) to any element title bar.
 *
 * Forms call addWindowControls() when morphing to window/panel,
 * and removeWindowControls() when returning to canvas-placed.
 */

export { TITLE_PRESS, TITLE_INSET } from './title-sizes';

const WINDOW_CONTROLS_CLASS = 'window-controls';

/**
 * 「[Opus 5.5] What each says, drawn: a glyph sits where its font puts it, above the middle of its square; a stroke is where it is」
 * 「[Opus 5.5] drawn. "Those buttons are supposed to be square and equally sized and margin and alignment within the header".」
 */
const MARKS = {
    down: 'M6 2v8M3 7l3 3 3-3',
    minimize: 'M2 6h8',
    close: 'M3 3l6 6M9 3l-6 6',
} as const;

/** A press in the title bar saying `mark`, named `label` for a screen reader and a pointer's title. */
function pressOf(mark: keyof typeof MARKS, label: string, does: () => void): HTMLButtonElement {
    const press = document.createElement('button');
    press.type = 'button';
    press.dataset.mark = mark;
    press.title = label;
    press.setAttribute('aria-label', label);
    press.innerHTML = `<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block"><path d="${MARKS[mark]}"/></svg>`;
    press.onclick = does;
    return press;
}

export interface WindowControlsConfig {
    onMinimize: () => void;
    onClose?: () => void;
    /** An element with a place of its own (forms/button.ts): the down arrow takes it back there. */
    onReturn?: () => void;
}

/** Append minimize/close buttons to an existing element title bar. */
export function addWindowControls(titleBar: HTMLElement, config: WindowControlsConfig): void {
    // Guard against double-add
    if (titleBar.querySelector(`.${WINDOW_CONTROLS_CLASS}`)) return;

    const container = document.createElement('span');
    container.className = WINDOW_CONTROLS_CLASS;
    container.style.display = 'inline-flex';
    // 「[Opus 5.5] TITLE_INSET apart, as the package's rule says (fit.ts).」
    container.style.gap = '4px';
    container.style.flexShrink = '0';
    container.style.marginLeft = 'auto';

    if (config.onReturn) container.appendChild(pressOf('down', 'Back to its place', config.onReturn));
    container.appendChild(pressOf('minimize', 'Minimize', config.onMinimize));
    if (config.onClose) container.appendChild(pressOf('close', 'Close', config.onClose));

    titleBar.appendChild(container);
}

/** Remove window controls from a title bar (when returning to canvas-placed). */
export function removeWindowControls(titleBar: HTMLElement): void {
    const controls = titleBar.querySelector(`.${WINDOW_CONTROLS_CLASS}`);
    if (controls) controls.remove();
}
