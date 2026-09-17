/**
 * Meldability - Port-aware glyph melding rules
 *
 * Melding is QNTX's spatial composition model where glyphs physically fuse
 * through proximity rather than connecting via wires.
 *
 * Each glyph has directional ports that define valid connections:
 * - right: horizontal data flow (ax → py → prompt, py → py)
 * - bottom: result/output attachment (py ↓ result, prompt ↓ result)
 * - top: (reserved for future upward connections)
 */

import type { EdgeDirection } from '../composition';
import { isPortFree } from '../edge-graph';

// Re-export for consumers within the package
export { isPortFree };
export type { EdgeDirection };

export interface PortRule {
    direction: EdgeDirection;
    targets: readonly string[];
}

/** All glyph classes that participate in melding */
const ALL_ELEMENT_CLASSES = [
    'canvas-ax-element', 'canvas-se-element', 'canvas-py-element',
    'canvas-prompt-element', 'canvas-doc-element', 'canvas-note-element',
    'canvas-result-element', 'canvas-subcanvas-element',
    'canvas-plugin-element',
] as const;

/**
 * Port-aware meldability rules: maps glyph classes to their output ports
 * Each port specifies a direction and which target classes can connect there
 */
export const MELDABILITY: Record<string, readonly PortRule[]> = {
    'canvas-ax-element': [
        { direction: 'right', targets: ['canvas-prompt-element', 'canvas-py-element', 'canvas-subcanvas-element'] }
    ],
    'canvas-se-element': [
        { direction: 'right', targets: ['canvas-prompt-element', 'canvas-py-element', 'canvas-se-element', 'canvas-subcanvas-element'] }
    ],
    'canvas-py-element': [
        { direction: 'right', targets: ['canvas-prompt-element', 'canvas-py-element', 'canvas-subcanvas-element'] },
        { direction: 'bottom', targets: ['canvas-result-element', 'canvas-subcanvas-element'] }
    ],
    'canvas-prompt-element': [
        { direction: 'bottom', targets: ['canvas-result-element', 'canvas-subcanvas-element'] }
    ],
    'canvas-doc-element': [
        { direction: 'right', targets: ['canvas-result-element', 'canvas-prompt-element', 'canvas-doc-element', 'canvas-subcanvas-element'] },
        { direction: 'bottom', targets: ['canvas-prompt-element', 'canvas-doc-element', 'canvas-subcanvas-element'] }
    ],
    'canvas-note-element': [
        { direction: 'bottom', targets: ['canvas-prompt-element', 'canvas-plugin-element', 'canvas-subcanvas-element'] }
    ],
    'canvas-result-element': [
        { direction: 'bottom', targets: ['canvas-result-element'] }
    ],
    'canvas-plugin-element': [
        { direction: 'bottom', targets: ['canvas-result-element', 'canvas-subcanvas-element'] }
    ],
    'canvas-subcanvas-element': [
        { direction: 'right', targets: ALL_ELEMENT_CLASSES },
        { direction: 'bottom', targets: ALL_ELEMENT_CLASSES },
        { direction: 'top', targets: ALL_ELEMENT_CLASSES },
    ],
} as const;

// Cached class lists — derived from static MELDABILITY registry
const _initiatorClasses: string[] = Object.keys(MELDABILITY);
const _targetClasses: string[] = (() => {
    const targets = new Set<string>();
    for (const ports of Object.values(MELDABILITY)) {
        for (const port of ports) {
            for (const target of port.targets) {
                targets.add(target);
            }
        }
    }
    return [...targets];
})();

/**
 * Get all classes that can initiate melding
 */
export function getInitiatorClasses(): readonly string[] {
    return _initiatorClasses;
}

/**
 * Get all classes that can receive meld (across all directions)
 */
export function getTargetClasses(): readonly string[] {
    return _targetClasses;
}

/**
 * Get compatible target classes for a given initiator (across all directions)
 */
export function getCompatibleTargets(initiatorClass: string): string[] {
    const ports = MELDABILITY[initiatorClass];
    if (!ports) return [];
    const targets = new Set<string>();
    for (const port of ports) {
        for (const target of port.targets) {
            targets.add(target);
        }
    }
    return [...targets];
}

/**
 * Check if two glyph classes are compatible for melding
 * Returns all compatible edge directions (empty array if incompatible)
 */
export function getCompatibleDirections(initiatorClass: string, targetClass: string): EdgeDirection[] {
    const ports = MELDABILITY[initiatorClass];
    if (!ports) return [];
    const directions: EdgeDirection[] = [];
    for (const port of ports) {
        if (port.targets.includes(targetClass)) {
            directions.push(port.direction);
        }
    }
    return directions;
}

/**
 * Check if two glyph classes are compatible for melding
 * Returns the first edge direction if compatible, null if not
 */
export function areClassesCompatible(initiatorClass: string, targetClass: string): EdgeDirection | null {
    const dirs = getCompatibleDirections(initiatorClass, targetClass);
    return dirs.length > 0 ? dirs[0] : null;
}

/**
 * Extract glyph IDs from a composition element's children
 */
export function getCompositionElementIds(composition: HTMLElement): string[] {
    const members = composition.querySelectorAll('[data-element-id]');
    const elementIds: string[] = [];

    members.forEach(el => {
        const id = el.getAttribute('data-element-id');
        if (id) elementIds.push(id);
    });

    return elementIds;
}

/**
 * Extract the canonical glyph class (e.g. 'canvas-py-glyph') from an element's classList
 */
export function getElementClass(element: HTMLElement): string | null {
    for (const cls of element.classList) {
        if (cls.startsWith('canvas-') && cls.endsWith('-element')) return cls;
    }
    return null;
}

export interface MeldOption {
    /** The glyph in the composition that the incoming glyph connects with */
    elementId: string;
    /** Edge direction for this connection */
    direction: EdgeDirection;
    /** Whether the incoming glyph is the 'from' (prepend) or 'to' (append) in the edge */
    incomingRole: 'from' | 'to';
}

/**
 * Get all possible ways an incoming glyph could meld with a composition.
 *
 * Checks every glyph in the composition for a free port:
 * 1. Append (incoming is 'to'): glyph's outgoing port in the compatible direction must be unoccupied
 * 2. Prepend (incoming is 'from'): glyph's incoming port in the compatible direction must be unoccupied
 *
 * Axiom: each side of a glyph accepts at most one connection.
 */
export function getMeldOptions(
    incomingClass: string,
    compositionElement: HTMLElement,
    edges: Array<{ from: string; to: string; direction: string }>
): MeldOption[] {
    const options: MeldOption[] = [];

    // Collect all glyph IDs from edges
    const allIds = new Set<string>();
    for (const edge of edges) {
        allIds.add(edge.from);
        allIds.add(edge.to);
    }

    // Build port occupancy: which directions are taken for each glyph
    const outgoing = new Map<string, Set<string>>();
    const incoming = new Map<string, Set<string>>();
    for (const edge of edges) {
        if (!outgoing.has(edge.from)) outgoing.set(edge.from, new Set());
        outgoing.get(edge.from)!.add(edge.direction);
        if (!incoming.has(edge.to)) incoming.set(edge.to, new Set());
        incoming.get(edge.to)!.add(edge.direction);
    }

    for (const elementId of allIds) {
        const el = compositionElement.querySelector(`[data-element-id="${elementId}"]`) as HTMLElement | null;
        if (!el) continue;
        const cls = getElementClass(el);
        if (!cls) continue;

        // 1. Append: this glyph sends to the incoming glyph (outgoing port)
        for (const appendDir of getCompatibleDirections(cls, incomingClass)) {
            if (!outgoing.get(elementId)?.has(appendDir)) {
                options.push({ elementId, direction: appendDir, incomingRole: 'to' });
            }
        }

        // 2. Prepend: the incoming glyph sends to this glyph (incoming port)
        for (const prependDir of getCompatibleDirections(incomingClass, cls)) {
            if (!incoming.get(elementId)?.has(prependDir)) {
                options.push({ elementId, direction: prependDir, incomingRole: 'from' });
            }
        }
    }

    return options;
}

/**
 * Select the best meld option, preferring the one matching the anchor glyph
 * AND the spatially-detected direction. Falls back to anchor match, then first option.
 */
export function selectPreferredMeldOption(
    options: MeldOption[],
    anchorElementId: string,
    preferredDirection?: EdgeDirection
): MeldOption | null {
    if (options.length === 0) return null;

    // Best: matches both anchor glyph and detected direction
    if (preferredDirection) {
        const exact = options.find(o => o.elementId === anchorElementId && o.direction === preferredDirection);
        if (exact) return exact;
    }

    // Good: matches anchor glyph
    const anchorMatch = options.find(o => o.elementId === anchorElementId);
    if (anchorMatch) return anchorMatch;

    return options[0];
}
