/**
 * The spawn menu — what a right-click or a finger held still opens on a canvas.
 *
 * NOT YET WRITTEN. This is the shape the tests pin; every call is a no-op.
 */

/** One thing a canvas can spawn. Plain text throughout. */
export interface SpawnEntry {
    id: string;
    symbol: string;
    title: string;
    description?: string;
    hint?: string;
}

/** What the host is asked, and told. */
export interface SpawnHost {
    /** What can be spawned where `target` was pressed on `canvas`. Empty: no menu opens. */
    entries(where: { target: HTMLElement; canvas: HTMLElement }): SpawnEntry[];
    /**
     * Put the chosen entry down. The host renders INTO `carried` and returns it:
     * an element is one DOM element for its whole life, so any other element
     * returned is an error. The host persists it; the package morphs it.
     */
    place(placing: {
        entry: SpawnEntry;
        canvas: HTMLElement;
        at: { clientX: number; clientY: number };
        carried: HTMLElement;
        symbol: HTMLElement | null;
        content?: string;
    }): Promise<HTMLElement>;
}

export function installSpawn(): void {}
export function isSpawnMenuOpen(): boolean { return false; }
export function isPlacementActive(): boolean { return false; }
export function cancelPlacement(): void {}
/** Menu closed, placement cancelled, listeners and the host's answers gone. */
export function resetSpawn(): void {}
