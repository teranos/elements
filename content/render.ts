/**
 * Shared content rendering for element forms.
 *
 * Two paths: restore from stash (same DOM nodes) or fresh render via callbacks.
 * Used by window.ts and panel.ts.
 */

import { getLogger, getLogSegment } from '../config';
import type { Element } from '../element';
import { CANVAS_ELEMENT_CONTENT_PADDING } from '../element';
import { createSymbolSpan } from '../symbol-span';
import { restoreContent } from './stash';
import { setContentState } from '../dataset';
import { watchContent } from './watch';

export interface RenderContentResult {
    titleBar: HTMLElement;
    contentElement: HTMLElement | null;
}

export function renderContent(
    element: HTMLElement,
    item: Element,
    logLabel: string,
    preRenderedContent?: HTMLElement,
): RenderContentResult {
    const log = getLogger();
    const seg = getLogSegment();
    const restored = restoreContent(element);

    let titleBar: HTMLElement;
    let contentElement: HTMLElement | null = null;

    if (restored) {
        // Content restored from stash — find existing title bar
        titleBar = element.querySelector('.title-bar') as HTMLElement;
        if (!titleBar) {
            // Stash had no title bar — create generic
            titleBar = createGenericTitleBar(item);
            element.insertBefore(titleBar, element.firstChild);
        }

        // Find content element (first non-title-bar child)
        for (const child of Array.from(element.children)) {
            if (child !== titleBar) {
                contentElement = child as HTMLElement;
                break;
            }
        }

        log.debug(seg, `[${logLabel}] Restored stashed content for ${item.id}`);

        // A stash that holds chrome and no body is how an element comes back from
        // the tray as a title bar over nothing: `restored` is true, so nothing
        // here renders fresh content, and renderContent() is never called again
        // for the life of the element. Say so rather than show it.
        if (!contentElement) {
            setContentState(element, 'refused');
            log.warn(seg, `[${logLabel}] ${item.id} restored with chrome and no body`, {
                item: item.id,
                title: item.title,
                form: logLabel,
                children: element.children.length,
            });
        } else {
            watchContent(element, contentElement, item, logLabel);
        }
    } else {
        // No stash: initial creation — use renderTitleBar/renderContent callbacks
        if (item.renderTitleBar) {
            titleBar = item.renderTitleBar();
        } else {
            titleBar = createGenericTitleBar(item);
        }

        element.appendChild(titleBar);

        // Add content area with error boundary
        try {
            // Use the pre-rendered content when the caller pre-measured for
            // fit-content sizing (window/window.ts);
            // otherwise render fresh. Ensures renderContent() runs exactly once.
            const content = preRenderedContent ?? item.renderContent();
            const contentArea = document.createElement('div');
            contentArea.classList.add('content-area');
            contentArea.style.padding = `${CANVAS_ELEMENT_CONTENT_PADDING}px`;
            contentArea.appendChild(content);
            element.appendChild(contentArea);
            contentElement = contentArea;
            watchContent(element, contentArea, item, logLabel);
        } catch (error) {
            log.error(seg, `[${logLabel} ${item.id}] Error rendering content: ${error instanceof Error ? error.message : String(error)}`);
            const errorContent = document.createElement('div');
            errorContent.className = 'content-area';
            errorContent.style.color = 'var(--color-error)';
            errorContent.style.fontFamily = 'var(--font-mono)';

            const errorTitle = document.createElement('div');
            errorTitle.style.marginBottom = '8px';
            errorTitle.style.fontWeight = 'bold';
            errorTitle.textContent = 'Error rendering content';
            errorContent.appendChild(errorTitle);

            const errorMsg = document.createElement('div');
            errorMsg.style.opacity = '0.8';
            errorMsg.style.fontSize = '12px';
            errorMsg.textContent = error instanceof Error ? error.message : String(error);
            errorContent.appendChild(errorMsg);

            element.appendChild(errorContent);
            contentElement = errorContent;
            // The body is settled and says why. No watch: nothing more is coming.
            setContentState(element, 'refused');
        }
    }

    return { titleBar, contentElement };
}

function createGenericTitleBar(item: Element): HTMLElement {
    const titleBar = document.createElement('div');
    titleBar.className = 'title-bar';
    if (item.symbol) {
        titleBar.appendChild(createSymbolSpan(item.symbol));
    }
    const titleText = document.createElement('span');
    // Titles are plain text — hosts strip any markup before passing the element
    titleText.textContent = item.title;
    titleText.style.flex = '1';
    titleBar.appendChild(titleText);
    return titleBar;
}
