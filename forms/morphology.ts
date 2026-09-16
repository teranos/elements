/**
 * Glyph Morphology — shared helpers for form transitions.
 *
 * Extracted from window.ts, panel.ts, canvas.ts to eliminate duplication
 * in the morph lifecycle (axiom verification, tray targeting, element reset).
 */

import { type Glyph } from '../glyph';
import { readPaint, wearPaint } from '../paint';
import type { Form } from '../form';
import { setForm, setProximityText, hasProximityText } from '../dataset';
import { getLogger, getLogSegment } from '../config';
import { applyRestingDotGeometry } from '../tray/proximity';

/**
 * On the element for the length of a morph, and nothing else. Which morph is
 * data-form's to say, so this does not repeat it.
 */
const MORPHING_CLASS = 'glyph-morphing';

/**
 * Verify the glyph axiom: exactly one DOM element for this glyph.
 * Calls the tracking verifier, then checks for duplicate data-element-id attributes.
 */
export function verifyElementAxiom(
    id: string,
    element: HTMLElement,
    verifyElement: (id: string, element: HTMLElement) => void
): void {
    verifyElement(id, element);

    const elements = document.querySelectorAll(`[data-element-id="${id}"]`);
    if (elements.length !== 1) {
        throw new Error(
            `AXIOM VIOLATION: Expected exactly 1 element for ${id}, found ${elements.length}`
        );
    }
}

/** Handle returned by prepareMorphTo — the morph transaction's class lifecycle. */
export interface MorphPreparation {
    /** Rect the glyph occupied before the morph — the animation's origin. */
    rect: DOMRect;
    /**
     * Commit: the morph class leaves with the morph; the settled class(es)
     * carry the rules that still apply. The glyph's own classes stay.
     *
     * Called with nothing when a form has no rules beyond the ones
     * [data-form] already carries — a window is that case.
     */
    commitClass(settledClasses?: string): void;
    /** Abandon: the glyph keeps the classes it had (Morph Axioma). */
    rollbackClass(): void;
}

/**
 * Morph-to preamble shared by all forms.
 * Verifies axiom, captures current rect, detaches, clears proximity text,
 * reparents to body with fixed positioning, and records which form
 * the glyph is entering.
 *
 * `form` is a parameter because this runs for window, panel and
 * workspace alike. It used to mark all three "window state" — one bit was all
 * setWindowState() had, so the three destinations arrived indistinguishable.
 *
 * The morph class says a morph is in flight and nothing more. There used to be
 * one per destination — glyph-morphing-to-panel and glyph-morphing-to-canvas
 * were strings no stylesheet ever read — and the destination is the attribute's
 * to say.
 *
 * The morph class is added, not assigned — the glyph keeps its own classes
 * through the morph. The dot class leaves with the dot state. The caller
 * ends the transaction through the returned handle: commitClass() on animation
 * finish, rollbackClass() on cancel.
 */
export function prepareMorphTo(
    element: HTMLElement,
    glyph: Glyph,
    verifyElement: (id: string, element: HTMLElement) => void,
    form: Form,
    zIndex: string
): MorphPreparation {
    verifyElementAxiom(glyph.id, element, verifyElement);

    const glyphRect = element.getBoundingClientRect();

    // THE GLYPH ITSELF TAKES THE FORM - NO CLONING
    element.remove();

    if (hasProximityText(element)) {
        element.textContent = '';
        setProximityText(element, false);
    }

    const previousClassName = element.className;
    element.classList.remove('glyph-run-glyph');
    element.classList.add(MORPHING_CLASS);
    element.style.position = 'fixed';
    element.style.zIndex = zIndex;

    document.body.appendChild(element);
    setForm(element, form);

    return {
        rect: glyphRect,
        commitClass(settledClasses?: string): void {
            element.classList.remove(MORPHING_CLASS);
            const settled = (settledClasses ?? '').split(' ').filter(c => c !== '');
            if (settled.length > 0) element.classList.add(...settled);
        },
        rollbackClass(): void {
            element.className = previousClassName;
        },
    };
}

/**
 * Calculate the target position for minimizing to the glyph tray.
 * If elementId is provided, targets that dot's position.
 * Otherwise targets the end of the tray (where new dots append).
 */
export function calculateTrayTarget(elementId?: string): { x: number; y: number } {
    const trayElement = document.querySelector('.glyph-run');
    if (!trayElement) {
        return { x: window.innerWidth - 50, y: window.innerHeight / 2 };
    }

    if (elementId) {
        const dot = trayElement.querySelector(`[data-element-id="${elementId}"]`);
        if (dot) {
            const dotRect = dot.getBoundingClientRect();
            return {
                x: dotRect.left + dotRect.width / 2,
                y: dotRect.top + dotRect.height / 2,
            };
        }
    }

    const indicators = trayElement.querySelector('.glyph-run-indicators');
    const lastDot = indicators?.lastElementChild;
    if (lastDot) {
        const lastRect = lastDot.getBoundingClientRect();
        return {
            x: lastRect.left + lastRect.width / 2,
            y: lastRect.bottom + 6,
        };
    }

    const trayRect = trayElement.getBoundingClientRect();
    return {
        x: trayRect.right - 20,
        y: trayRect.top + trayRect.height / 2,
    };
}

/**
 * Reset a glyph element to its resting state after minimize animation completes.
 * Clears state flags, removes from DOM, wipes inline styles, restores base class,
 * and hands back to the tray via onMorphComplete.
 */
export function resetElement(
    element: HTMLElement,
    glyph: Glyph,
    label: string,
    onMorphComplete: (element: HTMLElement, glyph: Glyph) => void
): void {
    const log = getLogger();
    const seg = getLogSegment();
    log.debug(seg, `[${label}] Animation complete for ${glyph.id}`);
    setForm(element, 'dot');
    setProximityText(element, false);
    element.remove();
    // The paint is read off the element, so the wipe takes the layout and not
    // what the glyph is (Element Axioma).
    const was = readPaint(element);
    element.style.cssText = '';
    element.className = 'glyph-run-glyph';
    applyRestingDotGeometry(element);
    wearPaint(element, was, glyph);
    onMorphComplete(element, glyph);
}
