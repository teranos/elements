/**
 * Chat specimen — Xenon, a conversation that opens at what was said last.
 *
 * "claude element should not start at top when opening requiring user to
 * scroll down every single time" (#40).
 */

import { tray } from '../tray/tray';
import type { Element } from '../element';
import { sayFrom } from '../content/say';
import { choicesFrom } from '../content/choices';

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
            // The row a chat says from, as a host draws it.
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '4px';
            // "Why not do it like anthropic does, where its a combined model+effort pill"
            const choices = choicesFrom({
                id: 'xenon-choices',
                label: 'Model and effort',
                choices: [
                    { name: 'Model', options: ['Opus 5.5', 'Sonnet 5.5', 'Haiku 5.5'], value: 'Opus 5.5' },
                    { name: 'Effort', options: ['low', 'medium', 'high', 'xhigh', 'max'], value: 'high' },
                ],
            });
            // "the inputfield take up the entire bottom of the screen for chat elements"
            // The package's chat field, which takes that bottom (#40).
            // Its presses in its box: the + at its start, the → at its end.
            // Drawn, as a host's are: a press in the pill is SAY_PRESS square whatever it holds.
            const icon = (label: string, path: string) => {
                const press = document.createElement('button');
                press.setAttribute('aria-label', label);
                press.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="${path}"/></svg>`;
                return press;
            };
            const attach = icon('Picture', 'M12 5v14M5 12h14');
            const send = icon('Say', 'M12 19V5M6 11l6-6 6 6');
            const says = sayFrom({ id: 'xenon-says', label: 'say something', start: attach, end: send, choices });
            row.append(choices, says, attach, send);
            body.append(log, row);
            return body;
        },
    };
    tray.add(item);
}
