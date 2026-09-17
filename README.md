# @qntx/glyphs

[AXIOMAS.md](AXIOMAS.md) — read it before changing anything here. [VISION.md](VISION.md) — why the axioms exist.

An element is exactly one DOM element for its entire lifetime. It morphs between forms — dot, proximity-expanded, window, panel, canvas — through smooth animations, but the element identity never changes.

This package is the element runtime: tray, proximity engine, morph transactions, forms, and the canvas interaction layer (drag, resize, meld). It has zero framework dependencies — pure DOM, Web Animations API, and dependency injection via `configureElements()` and `CanvasHost` for host-specific concerns.

## Core pattern

Every element renderer follows the same shape: take an `Element`, return a DOM element.

```typescript
import type { Element } from '@qntx/glyphs';

function createMyElement(item: Element): HTMLElement {
    // build DOM from item.id, item.title, item.content, item.symbol
    // return a single element — the element's identity for its entire lifetime
}
```

The `Element` interface is the universal input contract. The package owns the type; renderers live in the host.

`title` is plain text — strip any markup before passing. `symbol` is the one symbol field and the package renders it natively: generic title bars, canvas-placed title bars, and the proximity-expanded dot all display it, through `createSymbolSpan`. `symbolElement` is the element-continuity carrier for the same string across a cursor → placed morph.

## Environment

Browser-only. Assumes `document`, `DOMParser`, Web Animations API, and `ResizeObserver` as globals. Not compatible with Node.js or SSR without a DOM polyfill.

## Configuration

Host apps call `configureElements()` at startup to inject logger, persistence, canvas coordinate bridge, `CanvasHost`, and cleanup callbacks. `CanvasHost` bridges canvas interaction (drag, resize, meld) to host-specific state — persistence, selection, composition CRUD, and sync. Without configuration, safe defaults apply: no-op logger, no-op persistence, no-op canvas host, identity coordinate transforms.

`dotGeometry` is the exception to "host-specific concerns": it is geometry, not a dependency. The proximity engine writes the dot's width, height and border-radius inline on every frame, so no stylesheet can reach it — a host that wants a bigger or smaller dot sets it here.

```typescript
configureElements({
    dotGeometry: { minWidth: 15, minHeight: 15 },  // resting dot; omitted fields keep 10/10/220/32/2
});
```

## Examples

`bun examples/serve.ts` — live specimens, no host required.

## Testing

```bash
bun test                     # happy-dom (local)
USE_JSDOM=1 bun test         # JSDOM (CI)
```

Tests live with the package source and pin the package. Host behavior (persistence round-trips, workspace wiring) is the host's to test.

## Publishing

[JSR](https://jsr.io/@qntx/glyphs) holds the versions published before this repository existed. This repository has no publish workflow yet, so nothing committed here reaches JSR until one exists. JSR skips a version that already exists, so a change without a bump to `version` in `jsr.json` never ships.

## Boundary

Where this package ends and a host begins. The test that settles each line is in [CLAUDE.md](CLAUDE.md).

- **Canvas workspace orchestration is the host's.** Pan, zoom, selection, spawn, and thread state are the host's to wire to its own persistence and sync. The package owns the interaction layer the workspace consumes: drag, resize, meld, placement, z-order, touch browse.
- **ElementUI's I/O is the host's.** `pluginFetch`, `pluginWebSocket`, `onMeld`, and config persistence belong to the host factory. The DOM building blocks (`createInput`, `createButton`, `createStatusLine`) are package-owned in `ui-primitives.ts`; the host factory delegates to them.
- **Titles arrive plain.** Callers strip markup before passing items.

## Morph classes

One morph class, `morphing`, belongs to the morph: `prepareMorphTo` adds it beside the element's own classes, and the transaction ends it — commit swaps it for the settled classes (`panel …`, `canvas-fullscreen-adjusted`; a window settles into none, `[data-form="window"]` is its only hook), rollback restores exactly the classes the element had. Which form is in flight is `data-form`'s to say, written at morph start. Position and stacking during a morph are inline, and `raise()` writes a plain z-index.
