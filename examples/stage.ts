// The stage a specimen stands in. Each example once built its own: a box that positions what is placed
// in it, a literal height, and the canvas id the package asks about. One makes them, so the specimens
// page has one kind of box, and a change to what a stage is is one change.

/** A canvas for a specimen, `height` px tall, named by `canvasId`, appended to `root`. */
export function stage(root: HTMLElement, canvasId: string, height: number): HTMLElement {
    const area = document.createElement('div');
    area.dataset.stage = '';
    area.dataset.canvasId = canvasId;
    area.style.position = 'relative';
    area.style.height = `${height}px`;
    root.appendChild(area);
    return area;
}
