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
import { outboxFrom } from './outbox';
import { exchangeFrom } from './exchange';
import { waitingFrom } from './waiting';
import { saidFrom } from './said';

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
            // 「[Fable 5.2] What was said: a person and an agent, as words.」
            const log = exchangeFrom();
            // 「[Opus 5.5] The row a chat says from, as a host draws it.」
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
            // "add another inputfieldpillmenu for attached repositories": any of them, none or all.
            const repositories = choicesFrom({
                id: 'xenon-repositories',
                label: 'Attached repositories',
                choices: [
                    { name: 'Repositories', options: ['QNTX', 'QNTX-Web', 'elements', 'ground'], chosen: ['QNTX', 'elements'], many: true },
                ],
            });
            // "I want you to use the pills for it instead": what waits to be said, seen whether or not anything is.
            const outbox = outboxFrom();
            // 「[Fable 5.2] What waits on the person: one thing, one pill, each a surface of its own.」
            const waits = waitingFrom();
            // 「[Fable 5.2] What agents said that waits to go: one pill for what one said to one other, as ag has it.」
            const said = saidFrom();
            // "the inputfield take up the entire bottom of the screen for chat elements"
            // The package's chat field, which takes that bottom (#40).
            // 「[Opus 5.5] Its presses in its box: the + at its start, the → at its end.」
            // 「[Opus 5.5] Drawn, as a host's are: a press in the pill is SAY_PRESS square whatever it holds.」
            const icon = (label: string, path: string) => {
                const press = document.createElement('button');
                press.setAttribute('aria-label', label);
                press.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="${path}"/></svg>`;
                return press;
            };
            const attach = icon('Picture', 'M12 5v14M5 12h14');
            const send = icon('Say', 'M12 19V5M6 11l6-6 6 6');
            const says = sayFrom({ id: 'xenon-says', label: 'say something', start: attach, end: send, waiting: [outbox, ...said, ...waits], pills: [choices, repositories] });
            row.append(outbox, ...said, ...waits, choices, repositories, says, attach, send);
            body.append(log, row);
            return body;
        },
    };
    tray.add(item);
}
