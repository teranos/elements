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

Host apps call `configureElements()` at startup to inject logger, persistence, canvas coordinate bridge, `CanvasHost`, and cleanup callbacks. `CanvasHost` bridges canvas interaction (drag, resize, meld) to host-specific state — persistence, selection, composition CRUD, and sync. Without configuration, safe defaults apply: no-op logger, no-op persistence, no-op canvas host, identity coordinate transforms, and no meld table, so nothing melds.

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
- **How elements meld is the package's; which kinds meld, and on which side, is the host's.** Ports, one connection per side, meld options and composition layout are the package's (`canvas/meld/`). The table of element classes and their ports comes from `configureElements({ meldability })`; without one, nothing melds.
- **A canvas is the element carrying `data-canvas-id`.** Drag, meld, and the window ↔ canvas morphs find the canvas an element stands on by that attribute, and its value is the id the host is asked about. The package knows no host class name for it.
- **ElementUI's I/O is the host's.** `pluginFetch`, `pluginWebSocket`, `onMeld`, and config persistence belong to the host factory. The DOM building blocks (`createInput`, `createButton`, `createStatusLine`) are package-owned in `canvas/ui-primitives.ts`; the host factory delegates to them.
- **Titles arrive plain.** Callers strip markup before passing items.
- **Where a window stands while the keyboard is up is the package's; how its fields look is the host's.** A window with a focused field rises clear of the on-screen keyboard and goes back after (`window/keyboard.ts`), because placement is the package's.
- **That a tap on a field brings the keyboard and nothing else is the package's, and the host has no say.** "You tap a box to type, and the only thing that should happen is the keyboard coming up. Nothing on the screen should move, zoom or refocus." The package holds the page's scale (`scale.ts`): whatever the page's viewport line says, it also says `maximum-scale=1`, said again whenever the line changes. It holds where the page stands too (`position.ts`): while a field has the keyboard, the window goes back to where it stood when the field took focus, whatever scrolls it. No host has to remember anything for it, and none can turn it off. The real keyboard run dresses its field small and fails if the page zooms.
- **A panel on a touch screen has no title bar row; the package's, and no page makes it one.** "Inefficient use of space." Its title and minimize button said nothing the grabber and the swipe do not. The bar is the grabber's 16px strip, written important; the swipe to the tray is taken there, and the minimize button is kept for a screen reader, unseen (`forms/panel.ts`, `foldToStrip`). Out of a panel, the bar is a row again.
- **Text size inside an element is the package's, entirely; the host picks from its sizes.** "Text size needs to be owned by Elements entirely and misuse should result into compilation error." The sizes are `TEXT_SIZES`: xs 10, sm 11, md 13, lg 14, and text is at sm until said otherwise. A field (`input`, `textarea`, `select`) is at 16 (`FIELD_TEXT_SIZE`), whatever is around it: under 16, iOS zooms the page when it is tapped. The one way to size text is `sizeText(node, size)`, and a size not in the set does not compile (`TextSize`); a caller with no types gets a `TypeError`. What the compiler cannot see, a host's stylesheet (important or not), a style attribute or an em, is inert inside an element: the package puts one layered, important rule in the page, and a size written in a style attribute inside an element, important or not, is taken off as it is written (`text.ts`). A dot's symbol is the tray's and not sized by it.
- **That nothing runs off an element's edge is the package's, and the host has no say.** "This, I never want to have happen": a status line in a panel on a phone ran off the edge, and since nothing scrolls sideways, what did not fit was gone. Inside an element text breaks to the width it has, a word too long for it anywhere in it (`overflow-wrap: anywhere`, in the same layered, important rule as text size, `text.ts`). A host's `overflow-wrap` or `word-break` changes nothing. Text a host holds on one line (`white-space: nowrap`) it still holds.
- **Content wider than its element drops the element dead; the package's, and the host has no say.** Wrapping text was not enough: a row held on one line, a table cell, a button row or a fixed width still ran past the edge, cut off, with a warning nobody read. Now, measured on every change and every change of width, an element whose scroller holds content wider than itself hides that content where the host put it, says in a notice how wide in how wide and which nodes reach past the edge, and logs it as an error until the content fits; then it is alive again (`content/scroll.ts`, `dropDeadIfTooWide`). `expectFits(element)` fails a host's browser test on the same measure.
- **What a host writes fits its element; the package's, and the host has no say.**
  "no element should have content that isnt accesible"
  Dropping dead names what does not fit; the fit makes it fit (`fit.ts`). Text wraps where a host held it on one line, a box is no wider than what holds it, a table divides the width it has, a grid's tracks give way, a box placed past the edge is brought inside. A flex row wraps once it runs out of room, measured, and not before: a row that fits stays one line, and what is in it keeps the height the row gives it, so a scroller in a row still scrolls.
- **A window stands whole on its screen; the package's, and the host has no say.**
  "i cant even use the mail element on desktop"
  "if it overflows width, hard fail, die"
  A window sized by what it holds grew with what arrived after it opened, from where it stood, past the screen's edge: content never ran past the window, so the drop-dead measure saw nothing. Now a window that would run past the right edge slides back, and one wider than the screen is the screen's width and wraps what it holds: as it settles, as what it holds grows, as anything writes where it stands, and as the screen changes (`window/settle.ts`, `holdOnScreen`). `expectFits(element)` fails an element that runs off its screen, not only content that runs off its element.
- **A window's size, once a person gives it one, is the person's; what it holds fills it.** "want to be able to rezise it and have it actually respect my resize, horizontally and vertically." Dragged by its corner, or reopened at the size it was dragged to, a window's content fills its body both ways, written important: a host's fixed size on its content does not leave it small in a window dragged big (`window/resize.ts`, `fillWithContent`). Before a drag the content is the size its host draws it, and the window measures it.
- **Where an element opens in its scroller is the package's; that it opens at its end is the element's to say.** "claude element should not start at top when opening requiring user to scroll down every single time." An element saying `opensAt: 'end'` opens scrolled to what was said last, in its own scroller, and follows what is said after while it is at the end; scrolled up, the person is left reading (`content/end.ts`). Xenon is the specimen.
- **Where a chat's field sits is the package's; which field it is, the host's to say.** "making the inputfield take up the entire bottom of the screen for chat elements like claude or pi." A host declares the field its element says from (`declareSay`). It has the last line of its row to itself, the whole width; what the host put beside it wraps above it; the row stays at the bottom of the element, in the element's colour, while what was said scrolls above it. Written important (`content/say.ts`).
- **Where an element scrolls is the package's; what scrolls is the host's to say.** An element scrolls vertically in one place (Apple HIG, Scroll views: no scroll view inside another of the same orientation): the body the package gives it, or a node the host names with `declareScroller()`, and the body then stops scrolling and makes room for it: the body's child holding it is bounded by the body, and from there down the host's layout carries the bound. Whatever the package does for scrolling it does there. Any other vertical scroller in an element is named — `data-scroller="undeclared"` and one warning saying what to do instead — and fails `expectScroll()` in the host's tests (`content/scroll.ts`). Sideways scrollers and a field's own scrolling are not second scrollers.
- **The scrollbar is the package's, the only one.** "i want one cemtrally managed elements owned scrollbar and they the elements are only allowed to use that one" — "there should not be a system one" (#2). Inside an element no system scrollbar is drawn, whatever a host's stylesheet says (layered and important); the element's scroller shows the package's bar, one per element, unseen by a screen reader, and a mouse can drag it (`content/scrollbar.ts`).
- **A sparkline's drawing is the package's; what its numbers mean is the host's.** `renderSparkline` and `wireLineTooltips` draw and say a line, coloured by `--elements-sparkline-*`; buckets, units and labels come from the host.
- **A table's shape and look are the package's; what each cell says and what a press on a row opens are the host's.**
  "The elements package should own Tables"
  `createTable` builds the heads and rows under one class, `element-table`, and puts its stylesheet in the page once; a cell is text, or a cell the host built whole (`tableCell`, or its own `td`).
  "TABLES BEING MAX 4 col." A table has one to four columns (`MAX_TABLE_COLUMNS`), and every row is as wide as its heads: a fifth column, or a row of another width, does not compile (`TableHeads`, `TableCells`); a caller with no types gets a `TypeError`.
- **A press's size, look and stages are the package's; what it does is the host's.**
  "a button should just be the same size"
  "the immediate red communicates, irrevocable click, which is wrong for this."
  `pressFrom` is Button Form's variation that does rather than opens: its name (`id`, written `data-press`), its title and what a second press does (`again`). It is part of the element it sits in and never a second element in it, so nothing that finds an element by `data-element-id` finds a press. Every face it will ever show is in it from birth, in one grid, unseen when not shown and never taken out, so it is as big as its biggest face at rest, armed, doing and failed; a failure is said beside it, not in it. Its dress and its faces' sizes are written important on it, so no stylesheet sizes it by its stage, inside an element or on a bare page. It looks the way an approval's option does. At rest it is white whatever it does; armed it is red only when its second press cannot be undone (`irrevocable`), and green and shimmering only when it creates (`creates`), "press once to check, button becomes green and shimmers, 2nd click actually creates it". ElementUI's `createButton` is a press too: there is no other button. A single press cannot be irrevocable, or create: that, or a colour or a size chosen by the host, does not compile (`forms/press.misuse.ts`), and a caller with no types gets a `TypeError`.
- **An approval's choosing is the package's; what a press does is the host's.** "Do you hear how little it matters what the 'thing' is to approve?" `renderApprovals` shows the list, every option, the confidence the fast classifier answers, the checks and the time in the buttons, and the roll's order; every press is handed to the host (`pressed`), which says what the checks are doing (`checks`) and when what stood took effect (`settled`). An aside (`asides`) opens what the host hands it and chooses nothing. Merging, mailing, creating an account: the host's.

## Morph classes

One morph class, `morphing`, belongs to the morph: `prepareMorphTo` adds it beside the element's own classes, and the transaction ends it — commit swaps it for the settled classes (`panel …`, `canvas-fullscreen-adjusted`; a window settles into none, `[data-form="window"]` is its only hook), rollback restores exactly the classes the element had. Which form is in flight is `data-form`'s to say, written at morph start. Position and stacking during a morph are inline, and `raise()` writes a plain z-index.
