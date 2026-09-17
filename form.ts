/**
 * The forms an element can take.
 *
 * AXIOMAS.md: "A morph is a state transition of an element between forms."
 * That names the noun and the verb. This names the forms, once, so the
 * type, the stylesheets and the morph functions stop each keeping their own list.
 *
 * Fullscreen is not among them, because three of them are it: `workspace` is
 * edge to edge, `canvasExpanded` is edge to edge, and a `panel` dragged past
 * 90% of the viewport becomes edge to edge (.panel--fullscreen). One
 * word for three forms names none of them.
 */

/**
 * Every form, in the order an element meets them, and whether a tray dot
 * opens as it.
 *
 * `opensFromTray` is what Tray.morphElement() dispatches on: exactly the
 * entries marked true; the rest are reached another way, or are where a morph
 * begins. It is written as a literal `true`/`false` rather than `boolean` so
 * TrayDestination can derive from it.
 *
 * Each name is what a file in this package already calls itself — the comment
 * says which file, so a name here can always be checked against the code that
 * implements it.
 *
 * The values live in FORMS below, and the compiler holds the two
 * together both ways: a row here with no value there fails, and a value there
 * with no row here fails too.
 */
export interface FormTable {
    /**
     * Resting in the tray. `applyRestingDotGeometry()` puts an element here at birth
     * and when an existing element joins the tray (tray/tray.ts), and on the way back
     * from panel (forms/panel.ts) and window (forms/morphology.ts).
     * Where a morph starts, never where one ends.
     */
    readonly dot: { readonly opensFromTray: false };

    /**
     * The dot expanded by pointer nearness. tray/proximity.ts calls itself "Proximity
     * morphing" and states the sequence this list follows: "The element persists
     * through: dot → proximity → window → dot". A way there, not a destination.
     */
    readonly proximity: { readonly opensFromTray: false };

    /** Floating, with chrome. window/window.ts. */
    readonly window: { readonly opensFromTray: true };

    /**
     * Anchored to an edge at full height, snapping to fullscreen when dragged past
     * 90% of the viewport. forms/panel.ts.
     */
    readonly panel: { readonly opensFromTray: true };

    /**
     * "Canvas Form - Fullscreen, no chrome" — the workspace itself,
     * which is an element. canvas/workspace.ts.
     *
     * `canvas` sat one suffix from `canvasPlaced` while meaning the
     * opposite thing — the surface, not an element on it. The word was already
     * here: canvas-placed.ts calls its subjects "elements on the canvas workspace".
     */
    readonly workspace: { readonly opensFromTray: true };

    /**
     * "Canvas-Placed Form" — an element sitting on that workspace, with
     * container, position, drag, title bar and resize. canvas/placed.ts.
     * Reached by being placed, not by a dot being opened.
     */
    readonly canvasPlaced: { readonly opensFromTray: false };

    /**
     * "Canvas-Expanded Form" — a canvas-placed element filling the
     * viewport, reparented to document.body. The host's, not the package's.
     *
     * It fills the viewport like `workspace` and shares nothing else with it —
     * it comes from a placed element rather than from the tray, and goes back to
     * one. Listed because it is a form an element can be in, and a list
     * that omits one is how "fullscreen" ended up meaning two things.
     */
    readonly canvasExpanded: { readonly opensFromTray: false };

    /**
     * Following the pointer during placement. cursor.ts: "not persisted, have no
     * chrome, and do not participate in the tray morph lifecycle."
     */
    readonly cursor: { readonly opensFromTray: false };
}

// Annotated here rather than only on FORMS: a literal assigned straight
// to an annotated name is checked for excess properties too, so a value with no
// row above is caught. Passed through Object.freeze() it would not be.
const TABLE: FormTable = {
    dot: { opensFromTray: false },
    proximity: { opensFromTray: false },
    window: { opensFromTray: true },
    panel: { opensFromTray: true },
    workspace: { opensFromTray: true },
    canvasPlaced: { opensFromTray: false },
    canvasExpanded: { opensFromTray: false },
    cursor: { opensFromTray: false },
};

export const FORMS: FormTable = Object.freeze(TABLE);

// Each row too, not just the table. TRAY_DESTINATIONS is computed once below
// while isTrayDestination reads the table live, so a writable row lets the two
// answer differently for the same name — the drift this file exists to end.
for (const row of Object.values(FORMS)) Object.freeze(row);

export type Form = keyof FormTable;

/**
 * What a tray dot opens as — the entries above marked `opensFromTray`.
 *
 * Derived rather than listed, so it cannot drift from the table it narrows.
 */
export type TrayDestination = {
    [M in Form]: FormTable[M]['opensFromTray'] extends true ? M : never;
}[Form];

export const TRAY_DESTINATIONS: readonly TrayDestination[] = Object.freeze(
    (Object.keys(FORMS) as Form[]).filter(
        (m): m is TrayDestination => FORMS[m].opensFromTray,
    ),
);

/** Whether a name is in the table. Own keys only — `toString` is not a form. */
export function isForm(name: string): name is Form {
    return Object.prototype.hasOwnProperty.call(FORMS, name);
}

/** Whether a name is something a tray dot can open as. */
export function isTrayDestination(name: string): name is TrayDestination {
    return isForm(name) && FORMS[name].opensFromTray;
}
