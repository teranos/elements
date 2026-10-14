/**
 * Meldability - Port-aware element melding rules
 *
 * Melding is the spatial composition model where elements physically fuse
 * through proximity rather than connecting via wires.
 *
 * Each element class has directional ports (right, bottom, top) naming the
 * classes that may connect there. Which classes, and which ports, is the
 * host's to say: configureElements({ meldability }).
 */

import type { EdgeDirection } from '../composition';
import { isPortFree } from '../edge-graph';
import { getMeldability } from '../../config';

// Re-export for consumers within the package
export { isPortFree };
export type { EdgeDirection };

export interface PortRule {
    direction: EdgeDirection;
    targets: readonly string[];
}

/** Element class → its output ports. Supplied by the host; the package has none of its own. */
export type Meldability = Readonly<Record<string, readonly PortRule[]>>;

// Class lists derived from the table they were read off; rebuilt when the host gives another.
let derivedFrom: Meldability | null = null;
let initiatorClasses: string[] = [];
let targetClasses: string[] = [];

function derive(): void {
    const table = getMeldability();
    if (table === derivedFrom) return;
    const targets = new Set<string>();
    for (const ports of Object.values(table)) {
        for (const port of ports) {
            for (const target of port.targets) {
                targets.add(target);
            }
        }
    }
    initiatorClasses = Object.keys(table);
    targetClasses = [...targets];
    derivedFrom = table;
}

/**
 * Get all classes that can initiate melding
 */
export function getInitiatorClasses(): readonly string[] {
    derive();
    return initiatorClasses;
}

/**
 * Get all classes that can receive meld (across all directions)
 */
export function getTargetClasses(): readonly string[] {
    derive();
    return targetClasses;
}

/**
 * Get compatible target classes for a given initiator (across all directions)
 */
export function getCompatibleTargets(initiatorClass: string): string[] {
    const ports = getMeldability()[initiatorClass];
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
 * Check if two element classes are compatible for melding
 * Returns all compatible edge directions (empty array if incompatible)
 */
export function getCompatibleDirections(initiatorClass: string, targetClass: string): EdgeDirection[] {
    const ports = getMeldability()[initiatorClass];
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
 * Check if two element classes are compatible for melding
 * Returns the first edge direction if compatible, null if not
 */
export function areClassesCompatible(initiatorClass: string, targetClass: string): EdgeDirection | null {
    const dirs = getCompatibleDirections(initiatorClass, targetClass);
    return dirs.length > 0 ? dirs[0] : null;
}

/**
 * Extract element IDs from a composition element's children
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
 * The element's meld class: the first class in its classList that the host's table names
 */
export function getElementClass(element: HTMLElement): string | null {
    derive();
    for (const cls of element.classList) {
        if (initiatorClasses.includes(cls) || targetClasses.includes(cls)) return cls;
    }
    return null;
}

export interface MeldOption {
    /** The element in the composition that the incoming element connects with */
    elementId: string;
    /** Edge direction for this connection */
    direction: EdgeDirection;
    /** Whether the incoming element is the 'from' (prepend) or 'to' (append) in the edge */
    incomingRole: 'from' | 'to';
}

/**
 * Get all possible ways an incoming element could meld with a composition.
 *
 * Checks every element in the composition for a free port:
 * 1. Append (incoming is 'to'): element's outgoing port in the compatible direction must be unoccupied
 * 2. Prepend (incoming is 'from'): element's incoming port in the compatible direction must be unoccupied
 *
 * Axiom: each side of an element accepts at most one connection.
 */
export function getMeldOptions(
    incomingClass: string,
    compositionElement: HTMLElement,
    edges: Array<{ from: string; to: string; direction: string }>
): MeldOption[] {
    const options: MeldOption[] = [];

    // Collect all element IDs from edges
    const allIds = new Set<string>();
    for (const edge of edges) {
        allIds.add(edge.from);
        allIds.add(edge.to);
    }

    // Build port occupancy: which directions are taken for each element
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

        // 1. Append: this element sends to the incoming element (outgoing port)
        for (const appendDir of getCompatibleDirections(cls, incomingClass)) {
            if (!outgoing.get(elementId)?.has(appendDir)) {
                options.push({ elementId, direction: appendDir, incomingRole: 'to' });
            }
        }

        // 2. Prepend: the incoming element sends to this element (incoming port)
        for (const prependDir of getCompatibleDirections(incomingClass, cls)) {
            if (!incoming.get(elementId)?.has(prependDir)) {
                options.push({ elementId, direction: prependDir, incomingRole: 'from' });
            }
        }
    }

    return options;
}

/**
 * Select the best meld option, preferring the one matching the anchor element
 * AND the spatially-detected direction. Falls back to anchor match, then first option.
 */
export function selectPreferredMeldOption(
    options: MeldOption[],
    anchorElementId: string,
    preferredDirection?: EdgeDirection
): MeldOption | null {
    if (options.length === 0) return null;

    // Best: matches both anchor element and detected direction
    if (preferredDirection) {
        const exact = options.find(o => o.elementId === anchorElementId && o.direction === preferredDirection);
        if (exact) return exact;
    }

    // Good: matches anchor element
    const anchorMatch = options.find(o => o.elementId === anchorElementId);
    if (anchorMatch) return anchorMatch;

    return options[0];
}
