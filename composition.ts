/**
 * Composition types and pure helpers.
 *
 * These are the canonical types for element compositions — the package owns them.
 * Proto-generated types (from canvas.proto) are wire format, mapped at the
 * API boundary in web/.
 */

/**
 * Edge direction in the composition DAG.
 * 'right' = horizontal data flow, 'bottom' = vertical attachment, 'top' = reserved.
 */
export type EdgeDirection = 'right' | 'bottom' | 'top';

/**
 * A directed edge in the composition DAG.
 * Supports multi-directional melding: horizontal (right), vertical (top/bottom).
 */
export interface CompositionEdge {
    /** source element ID */
    from: string;
    /** target element ID */
    to: string;
    /** 'right', 'top', 'bottom' */
    direction: string;
    /** ordering for multiple edges in same direction */
    position: number;
}

/**
 * A composition of melded elements — a DAG with spatial anchor.
 * Edges define the graph structure, x/y anchor the composition on canvas.
 */
export interface CompositionState {
    id: string;
    edges: CompositionEdge[];
    /** anchor X position in pixels */
    x: number;
    /** anchor Y position in pixels */
    y: number;
    created_at?: string;
    updated_at?: string;
}

/**
 * Build edges from a linear chain of element IDs.
 * Creates consecutive edges connecting elements in order.
 */
export function buildEdgesFromChain(
    elementIds: string[],
    direction: EdgeDirection = 'right'
): CompositionEdge[] {
    if (elementIds.length < 2) {
        return [];
    }

    const edges: CompositionEdge[] = [];
    for (let i = 0; i < elementIds.length - 1; i++) {
        edges.push({
            from: elementIds[i],
            to: elementIds[i + 1],
            direction,
            position: i
        });
    }
    return edges;
}

/**
 * Extract all unique element IDs from edges.
 * Returns deduplicated array of element IDs.
 */
export function extractElementIds(edges: CompositionEdge[]): string[] {
    const ids = new Set<string>();
    for (const edge of edges) {
        ids.add(edge.from);
        ids.add(edge.to);
    }
    return Array.from(ids);
}
