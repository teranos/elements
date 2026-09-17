/**
 * Proximity morphing for glyphs
 *
 * Handles the smooth transformation of glyphs from resting dot to expanded state
 * based on pointer proximity (mouse cursor or touch position). The two ends of
 * that morph are host-configurable: configureElements({ dotGeometry }).
 * This modifies the SAME DOM element in place.
 *
 * Desktop: mousemove drives proximity continuously.
 * Mobile:  touchstart near tray enters browse mode, touchmove drives proximity,
 *          touchend opens the peaked glyph. Between touches there is no pointer.
 *
 * CRITICAL: We ONLY change styles, never recreate or replace the element.
 * The element persists through: dot → proximity → window → dot
 */

import { type Element, DEFAULT_COLOR } from '../element';
import { hasProximityText, setProximityText } from '../dataset';
import { getDotGeometry } from '../config';

/**
 * Apply the resting (proximity 0) geometry to a dot element.
 *
 * The dot's size is owned here, not by CSS: the proximity engine writes width,
 * height and border-radius inline on every frame, and inline styles beat any
 * stylesheet rule. A dot that is born — or returns to rest — must therefore be
 * sized from the same config the engine interpolates from, otherwise it renders
 * at one size until the pointer first moves and another size afterwards.
 */
export function applyRestingDotGeometry(element: HTMLElement): void {
    const dot = getDotGeometry();
    element.style.width = `${dot.minWidth}px`;
    element.style.height = `${dot.minHeight}px`;
    element.style.borderRadius = `${dot.borderRadiusMax}px`;
}

export class Proximity {
    // Proximity morphing configuration
    private readonly PROXIMITY_THRESHOLD_HORIZONTAL = 30; // Max distance for horizontal approach (px)
    private readonly PROXIMITY_THRESHOLD_VERTICAL = 110; // Max distance for vertical approach (px)
    private readonly SNAP_THRESHOLD = 0.9; // Snap to 100% at this proximity to prevent flickering
    private readonly BASELINE_BOOST_TRIGGER = 0.80; // Trigger baseline boost when any item this close
    private readonly BASELINE_BOOST_AMOUNT = 0.3; // Amount to boost all items (0.0-1.0)
    private readonly TEXT_FADE_THRESHOLD = 0.5; // Show text when proximity exceeds this

    // Horizontal easing: gradual approach, dramatic finish
    private readonly HORIZONTAL_EASE_BREAKPOINT = 0.8; // 80% proximity
    private readonly HORIZONTAL_EASE_EARLY = 0.4; // Transform 40% by breakpoint
    private readonly HORIZONTAL_EASE_LATE = 0.6; // Remaining 60% in final stretch

    // Vertical easing: fast bloom, slow refinement (inverted)
    private readonly VERTICAL_EASE_BREAKPOINT = 0.55; // 55% proximity
    private readonly VERTICAL_EASE_EARLY = 0.8; // Transform 80% by breakpoint
    private readonly VERTICAL_EASE_LATE = 0.2; // Remaining 20% in final stretch

    // Morphing dimensions come from configureElements({ dotGeometry }) — read per
    // frame, never cached, because a host may configure after this engine exists.

    private mouseX: number = 0;
    private mouseY: number = 0;
    private proximityRAF: number | null = null;

    // Touch browse state — active while finger is down in the tray zone
    private _isTouchBrowsing: boolean = false;

    constructor() {
        this.setupPointerTracking();
    }

    /** True while the user's finger is down and sliding through the tray */
    public get isTouchBrowsing(): boolean {
        return this._isTouchBrowsing;
    }

    public set isTouchBrowsing(v: boolean) {
        this._isTouchBrowsing = v;
    }

    /** Feed pointer coordinates from any input source */
    public setPointerPosition(x: number, y: number): void {
        this.mouseX = x;
        this.mouseY = y;
    }

    private setupPointerTracking(): void {
        if (typeof document === 'undefined') return;

        // Desktop: track mouse position globally for proximity effect
        document.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });

        // Mobile: touchmove feeds the same coordinates during browse mode.
        // The actual touchstart/touchend lifecycle is managed by Tray
        // which calls setPointerPosition and sets isTouchBrowsing.
    }

    /**
     * Calculate proximity metrics for a glyph element
     */
    public calculateProximity(dot: HTMLElement): {
        distance: number;
        distanceX: number;
        distanceY: number;
        proximityRaw: number;
        isVerticalApproach: boolean;
    } {
        const rect = dot.getBoundingClientRect();
        let distanceX = 0, distanceY = 0;

        // Horizontal distance to nearest edge
        if (this.mouseX < rect.left) {
            distanceX = rect.left - this.mouseX;
        } else if (this.mouseX > rect.right) {
            distanceX = this.mouseX - rect.right;
        }

        // Vertical distance to nearest edge
        if (this.mouseY < rect.top) {
            distanceY = rect.top - this.mouseY;
        } else if (this.mouseY > rect.bottom) {
            distanceY = this.mouseY - rect.bottom;
        }

        // Euclidean distance to nearest edge (0 if inside)
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

        // Determine approach direction
        const isVerticalApproach = distanceY > distanceX;

        // Use appropriate threshold based on approach direction
        const threshold = isVerticalApproach
            ? this.PROXIMITY_THRESHOLD_VERTICAL
            : this.PROXIMITY_THRESHOLD_HORIZONTAL;

        // Calculate proximity factor (1.0 = at dot, 0.0 = at threshold or beyond)
        const proximityRaw = Math.max(0, 1 - (distance / threshold));

        return { distance, distanceX, distanceY, proximityRaw, isVerticalApproach };
    }

    /**
     * Update proximity-based morphing for glyphs in the indicator container
     * Uses requestAnimationFrame for smooth 60fps updates
     */
    public updateProximity(
        indicatorContainer: HTMLElement | null,
        items: Map<string, Element>,
        isRestoring: boolean
    ): void {
        if (this.proximityRAF) {
            cancelAnimationFrame(this.proximityRAF);
        }

        this.proximityRAF = requestAnimationFrame(() => {
            if (!indicatorContainer || isRestoring) return;

            const dots = Array.from(indicatorContainer.querySelectorAll('.dot')) as HTMLElement[];

            // Read at use time — the host may have configured geometry after construction
            const geometry = getDotGeometry();

            // First pass: check if any glyph is highly proximate (gives baseline boost to all)
            let maxProximityRaw = 0;
            dots.forEach((dot) => {
                const { proximityRaw } = this.calculateProximity(dot);
                maxProximityRaw = Math.max(maxProximityRaw, proximityRaw);
            });

            // Calculate baseline boost when any glyph is nearly fully expanded
            const baselineBoost = maxProximityRaw > this.BASELINE_BOOST_TRIGGER ? this.BASELINE_BOOST_AMOUNT : 0;

            dots.forEach((dot) => {
                const elementId = dot.dataset.elementId ?? '';
                const item = items.get(elementId);

                const { proximityRaw, isVerticalApproach } = this.calculateProximity(dot);

                // Apply different easing based on approach direction
                let proximity: number;

                // Snap to 100% when very close to prevent flickering
                if (proximityRaw >= this.SNAP_THRESHOLD) {
                    proximity = 1.0;
                } else {

                    if (isVerticalApproach) {
                        // VERTICAL: Inverted easing - fast early growth, slow refinement
                        if (proximityRaw < this.VERTICAL_EASE_BREAKPOINT) {
                            proximity = (proximityRaw / this.VERTICAL_EASE_BREAKPOINT) * this.VERTICAL_EASE_EARLY;
                        } else {
                            const remaining = 1.0 - this.VERTICAL_EASE_BREAKPOINT;
                            proximity = this.VERTICAL_EASE_EARLY +
                                      ((proximityRaw - this.VERTICAL_EASE_BREAKPOINT) / remaining) * this.VERTICAL_EASE_LATE;
                        }
                    } else {
                        // HORIZONTAL: Gradual growth, dramatic finish
                        if (proximityRaw < this.HORIZONTAL_EASE_BREAKPOINT) {
                            proximity = (proximityRaw / this.HORIZONTAL_EASE_BREAKPOINT) * this.HORIZONTAL_EASE_EARLY;
                        } else {
                            const remaining = this.SNAP_THRESHOLD - this.HORIZONTAL_EASE_BREAKPOINT;
                            proximity = this.HORIZONTAL_EASE_EARLY +
                                      ((proximityRaw - this.HORIZONTAL_EASE_BREAKPOINT) / remaining) * this.HORIZONTAL_EASE_LATE;
                        }
                    }
                }

                // Apply baseline boost when any item is being hovered
                proximity = Math.min(1.0, proximity + baselineBoost);

                // Interpolate dimensions to match actual tray item size
                const width = geometry.minWidth + (geometry.maxWidth - geometry.minWidth) * proximity;
                const height = geometry.minHeight + (geometry.maxHeight - geometry.minHeight) * proximity;

                // Interpolate border radius (starts at max, goes to 0 for full item)
                const borderRadius = geometry.borderRadiusMax * (1 - proximity);

                // Use the glyph's own color
                const color = item?.color ?? DEFAULT_COLOR;

                // Apply morphing styles
                dot.style.width = `${width}px`;
                dot.style.height = `${height}px`;
                dot.style.borderRadius = `${borderRadius}px`;
                dot.style.backgroundColor = color;
                // Visual identity, like color — the dot wears the glyph's border
                if (item?.border) dot.style.border = item.border;
                dot.style.backdropFilter = 'blur(2px)';
                dot.style.filter = dot.matches(':hover') ? 'brightness(1.2)' : '';

                // Show title text when proximity exceeds threshold
                if (proximity > this.TEXT_FADE_THRESHOLD && item) {
                    // Titles are plain text — hosts strip any markup before add()
                    const title = item.symbol ? `${item.symbol} ${item.title}` : item.title;

                    // Add text content if not already present
                    if (!hasProximityText(dot)) {
                        dot.style.display = 'flex';
                        dot.style.alignItems = 'center';
                        dot.style.justifyContent = 'flex-start'; // Left-align text (normal)
                        dot.style.padding = '6px 10px';
                        dot.style.whiteSpace = 'nowrap';
                        dot.textContent = title;
                        setProximityText(dot, true);
                    }
                    // Fade in text based on proximity (above threshold)
                    dot.style.opacity = String(this.TEXT_FADE_THRESHOLD + (proximity - this.TEXT_FADE_THRESHOLD));
                } else {
                    // Hide text when far away
                    if (hasProximityText(dot)) {
                        dot.textContent = '';
                        dot.style.display = '';
                        dot.style.alignItems = '';
                        dot.style.justifyContent = '';
                        dot.style.padding = '';
                        dot.style.whiteSpace = '';
                        dot.style.textAlign = '';
                        setProximityText(dot, false);
                    }
                    dot.style.opacity = '1';
                }
            });

            this.proximityRAF = null;
        });
    }

    /**
     * Get current mouse position
     */
    public getMousePosition(): { x: number, y: number } {
        return { x: this.mouseX, y: this.mouseY };
    }
}
