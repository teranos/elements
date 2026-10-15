/**
 * Chat specimen — Xenon, a conversation that opens at what was said last.
 *
 * "claude element should not start at top when opening requiring user to
 * scroll down every single time" (#40).
 */

import { tray } from '../tray/tray';
import type { Element } from '../element';
import { createInput } from '../canvas/ui-primitives';

export function renderChatSpecimen(): void {
    const item: Element = {
        id: 'chat-specimen',
        title: 'Xenon',
        symbol: 'Xe',
        opensAs: 'panel',
        opensAt: 'end',
        color: '#000',
        renderContent: () => {
            const body = document.createElement('div');
            const log = document.createElement('div');
            log.className = 'content';
            for (let i = 1; i <= 60; i++) {
                const line = document.createElement('div');
                line.textContent = `line ${i} · ${i % 2 ? 'you' : 'xenon'} said something`;
                log.appendChild(line);
            }
            body.append(log, createInput({ label: 'Say', placeholder: 'say something', type: 'text' }));
            return body;
        },
    };
    tray.add(item);
}
