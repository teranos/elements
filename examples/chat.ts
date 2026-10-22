/**
 * Chat specimen — Xenon, a conversation that opens at what was said last.
 *
 * "claude element should not start at top when opening requiring user to
 * scroll down every single time" (#40).
 */

import { tray } from '../tray/tray';
import type { Element } from '../element';
import { createButton } from '../canvas/ui-primitives';
import { sayFrom } from '../content/say';

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
            // The row a chat says from: a choice beside the field and a button, as a host draws it.
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '4px';
            const mode = document.createElement('select');
            mode.appendChild(new Option('', ''));
            // "the inputfield take up the entire bottom of the screen for chat elements"
            // The package's chat field, which takes that bottom (#40).
            const says = sayFrom({ id: 'xenon-says', label: 'say something' });
            const send = createButton({ label: 'Say', onClick: () => {} });
            row.append(mode, says, send);
            body.append(log, row);
            return body;
        },
    };
    tray.add(item);
}
