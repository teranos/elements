/**
 * Test setup for @teranos/elements — provides DOM environment.
 *
 * Uses happy-dom for local runs, JSDOM when USE_JSDOM=1 (CI).
 */

const USE_JSDOM = process.env.USE_JSDOM === '1';

if (USE_JSDOM) {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        pretendToBeVisual: true,
    });
    const { window } = dom;

    // @ts-ignore
    globalThis.window = window;
    // @ts-ignore
    globalThis.document = window.document;
    // @ts-ignore
    globalThis.HTMLElement = window.HTMLElement;
    // @ts-ignore
    globalThis.Element = window.Element;
    // @ts-ignore
    globalThis.Event = window.Event;
    // @ts-ignore
    globalThis.MouseEvent = window.MouseEvent;
    // @ts-ignore
    globalThis.navigator = window.navigator;
    // @ts-ignore
    globalThis.getComputedStyle = window.getComputedStyle;
    // @ts-ignore
    globalThis.MutationObserver = window.MutationObserver;
    // JSDOM's addEventListener realm-checks the `signal` option against its own
    // AbortSignal class. Bun's native AbortController fails that isinstance
    // check ("parameter 3 dictionary has member 'signal' that is not of type
    // 'AbortSignal'"). Route both through JSDOM's realm.
    // @ts-ignore
    globalThis.AbortController = window.AbortController;
    // @ts-ignore
    globalThis.AbortSignal = window.AbortSignal;

    if (!globalThis.requestAnimationFrame) {
        globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0) as any;
        globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
    }

    // @ts-ignore
    globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };

    if (!globalThis.CSS) {
        // @ts-ignore
        globalThis.CSS = { escape: (s: string) => s };
    }

    if (!globalThis.crypto?.randomUUID) {
        // @ts-ignore
        globalThis.crypto = {
            ...globalThis.crypto,
            randomUUID: () => 'test-uuid-' + Math.random() as `${string}-${string}-${string}-${string}-${string}`,
        };
    }
} else {
    const { Window } = await import('happy-dom');
    const window = new Window();

    // @ts-ignore
    globalThis.window = window;
    // @ts-ignore
    globalThis.document = window.document;
    // @ts-ignore
    globalThis.HTMLElement = window.HTMLElement;
    // @ts-ignore
    globalThis.localStorage = window.localStorage;
    // happy-dom 20.0.11 holds an observer's reporting function only through a WeakRef
    // (MutationObserverListener: callback: new WeakRef((record) => this.report(record))): nothing else
    // references it, so a garbage collection frees it and the observer is told nothing more, in silence.
    // Each observer keeps the functions it observes with. (20.14 keeps them itself, but also brings the
    // Web Animations API, a change of its own.)
    const HappyMutationObserver = window.MutationObserver as unknown as typeof MutationObserver;
    class KeptMutationObserver extends HappyMutationObserver {
        #kept = new Set<unknown>();
        observe(target: Node, options?: MutationObserverInit): void {
            super.observe(target, options);
            const key = Object.getOwnPropertySymbols(target).find((symbol) => symbol.description === 'mutationListeners');
            const listeners = key ? (target as unknown as Record<symbol, { callback?: WeakRef<object> }[]>)[key] : undefined;
            const reporting = listeners?.[listeners.length - 1]?.callback?.deref();
            if (reporting) this.#kept.add(reporting);
        }
        disconnect(): void {
            super.disconnect();
            this.#kept.clear();
        }
    }
    // @ts-ignore
    globalThis.MutationObserver = KeptMutationObserver;
    // What JSDOM's branch hands out bare, handed out here too: a bare
    // getComputedStyle was undefined, and a bare Event or MouseEvent was Bun's
    // own, which happy-dom's elements do not take. Either failed in silence.
    // @ts-ignore
    globalThis.getComputedStyle = window.getComputedStyle.bind(window);
    // @ts-ignore
    globalThis.Element = window.Element;
    // @ts-ignore
    globalThis.Event = window.Event;
    // @ts-ignore
    globalThis.MouseEvent = window.MouseEvent;
}
