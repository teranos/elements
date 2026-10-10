# elements
[AXIOMAS.md](AXIOMAS.md) — read it before changing anything here. [VISION.md](VISION.md) — why the axioms exist.

An element is exactly one DOM element for its entire lifetime. It morphs between forms — dot, proximity-expanded, window, panel, canvas — through smooth animations, but the element identity never changes.

This package is the element runtime: tray, proximity engine, morph transactions, forms, and the canvas interaction layer (drag, resize, meld). It has zero framework dependencies — pure DOM, Web Animations API, and dependency injection via `configureElements()` and `CanvasHost` for host-specific concerns.

## Core pattern

Every element renderer follows the same shape: take an `Element`, return a DOM element.

```typescript
import type { Element } from '@teranos/elements';

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

`dotGeometry` is the exception to "host-specific concerns": it is geometry, not a dependency. The proximity engine writes the dot's width, height and border-radius inline on every frame, so no stylesheet can reach it — a host that wants a bigger or smaller dot sets it here. Left unset, a dot rests at 13px on a phone (up to 768px wide), 15px up to 900px, 10px above. The tray's place at the right edge, its column, the gap between dots (2px, 6px on a phone) and a dot's glide between sizes are the package's too, written inline; a host's stylesheet gives only the dot's font, text colour and border colour.

```typescript
configureElements({
    dotGeometry: { minWidth: 15, minHeight: 15 },  // resting dot; omitted fields keep the screen's resting size, 220/32/2
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

[JSR](https://jsr.io/@teranos/elements) holds every published version. Every push to main publishes, tests gating it, from `.github/workflows/publish.yml`. JSR skips a version it already has without a word, so the workflow fails instead when `version` in `jsr.json` has not moved: a commit on main either ships or is red.

## Boundary

Where this package ends and a host begins. The test that settles each line is in [CLAUDE.md](CLAUDE.md).

- **Canvas workspace orchestration is the host's.** Pan, zoom, selection, spawn, and thread state are the host's to wire to its own persistence and sync. The package owns the interaction layer the workspace consumes: drag, resize, meld, placement, z-order, touch browse.
- **ElementUI's I/O is the host's.** `pluginFetch`, `pluginWebSocket`, `onMeld`, and config persistence belong to the host factory. The DOM building blocks (`createInput`, `createButton`, `createStatusLine`) are package-owned in `canvas/ui-primitives.ts`; the host factory delegates to them.
- **Titles arrive plain.** Callers strip markup before passing items.
- **Where a window stands while the keyboard is up is the package's; how its fields look is the host's.** A window with a focused field rises clear of the on-screen keyboard and goes back after (`window/keyboard.ts`), because placement is the package's.
- **The size a panel is read at on a phone is the package's, and the host has no say.** "QNTX's text and message box sized like Claude's on the phone, owned by Elements so no host has to remember it." On a touch screen a panel shows what it holds scaled until the host's text reads at 17 (Apple Human Interface Guidelines, Typography: body text at the default size), and every field in it scales with it (`forms/panel.ts`, `readAtPhoneSize`). The host draws at whatever size it draws; text already at 17 or more is not made smaller.
- **That a tap on a field brings the keyboard and nothing else is the package's, and the host has no say.** "You tap a box to type, and the only thing that should happen is the keyboard coming up. Nothing on the screen should move, zoom or refocus." The package holds the page's scale (`scale.ts`): whatever the page's viewport line says, it also says `maximum-scale=1`, said again whenever the line changes. No host has to remember anything for it, and none can turn it off. The real keyboard run dresses its field small and fails if the page zooms.
- **Where an element scrolls is the package's; what scrolls is the host's to say.** An element scrolls vertically in one place (Apple HIG, Scroll views: no scroll view inside another of the same orientation): the body the package gives it, or a node the host names with `declareScroller()`, and the body then stops scrolling and makes room for it: the body's child holding it is bounded by the body, and from there down the host's layout carries the bound. Whatever the package does for scrolling it does there. Any other vertical scroller in an element is named — `data-scroller="undeclared"` and one warning saying what to do instead — and fails `expectScroll()` in the host's tests (`content/scroll.ts`). Sideways scrollers and a field's own scrolling are not second scrollers.
- **A sparkline's drawing is the package's; what its numbers mean is the host's.** `renderSparkline` and `wireLineTooltips` draw and say a line, coloured by `--elements-sparkline-*`; buckets, units and labels come from the host.

## Morph classes

One morph class, `morphing`, belongs to the morph: `prepareMorphTo` adds it beside the element's own classes, and the transaction ends it — commit swaps it for the settled classes (`panel …`, `canvas-fullscreen-adjusted`; a window settles into none, `[data-form="window"]` is its only hook), rollback restores exactly the classes the element had. Which form is in flight is `data-form`'s to say, written at morph start. Position and stacking during a morph are inline, and `raise()` writes a plain z-index.
