/**
 * Approve specimen — Rubidium, the next element after the panel's Krypton.
 *
 * "After it's approved, I want to be able to say, No again, and yes again and no."
 * One tap flips it, as often as the thumb likes, until it becomes final. Here
 * time running out makes it final; in a host it could be something else.
 */

import { tray } from '../tray/tray';
import type { Element } from '../element';

const OPEN_FOR_SECONDS = 30;

export function renderApproveSpecimen(): void {
    const item: Element = {
        id: 'approve-specimen',
        title: 'Rubidium',
        symbol: 'Rb',
        opensAs: 'window',
        color: '#000',
        renderContent: () => {
            const body = document.createElement('div');
            body.className = 'content';

            let approved = false;
            let final = false;
            let left = OPEN_FOR_SECONDS;

            const toggle = document.createElement('button');
            toggle.style.width = '100%';
            toggle.style.minHeight = '96px';
            toggle.style.fontSize = '32px';
            toggle.style.border = 'none';
            toggle.style.borderRadius = '0';
            toggle.style.color = '#fff';
            toggle.style.touchAction = 'manipulation';

            const clock = document.createElement('div');
            clock.style.marginTop = '8px';
            clock.style.fontFamily = 'monospace';

            const show = () => {
                toggle.textContent = approved ? 'Yes' : 'No';
                toggle.style.background = approved ? '#15803d' : '#991b1b';
                toggle.disabled = final;
                toggle.style.opacity = final ? '0.6' : '1';
                clock.textContent = final ? `final: ${approved ? 'yes' : 'no'}` : `final in ${left}s`;
            };

            toggle.addEventListener('click', () => {
                if (final) return;
                approved = !approved;
                show();
            });

            const timer = setInterval(() => {
                left -= 1;
                if (left <= 0) {
                    final = true;
                    clearInterval(timer);
                }
                show();
            }, 1000);

            show();
            body.append(toggle, clock);
            return body;
        },
    };
    tray.add(item);
}
