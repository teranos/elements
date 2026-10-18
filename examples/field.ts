// Field specimen — Selenium, the next element after the sparkline's Arsenic.
// It opens as a window holding one field, the first thing here a keyboard comes up for.
// Apple Human Interface Guidelines, Text fields: a label beside the placeholder,
// "because placeholder text disappears when people start typing", and the keyboard
// that matches what is asked for.

// "and demonstrate it in one of the example elements"

import { tray } from '../tray/tray';
import { fieldFrom } from '../forms/field';
import { pressFrom, AtField } from '../forms/press';
import type { Element } from '../element';

export function renderFieldSpecimen(): void {
    const item: Element = {
        id: 'field-specimen',
        title: 'Selenium',
        symbol: 'Se',
        opensAs: 'window',
        renderContent: () => {
            const body = document.createElement('div');
            body.className = 'content';
            const email = fieldFrom({ id: 'selenium-email', label: 'Email', placeholder: 'you@example.com', keyboard: 'email' });
            // The keyboard is the field's; what the browser may fill in is the autocomplete's.
            email.input.autocomplete = 'email';
            // What is wrong is said at the field, never a send that cannot be pressed.
            const send = pressFrom({ id: 'selenium-send', title: 'Send', does: () => {
                if (!email.input.value.includes('@')) throw new AtField(email.input, 'an email has an @ in it');
            } });
            // Held back, it can still be reached, and pressed it says why.
            const invite = pressFrom({ id: 'selenium-invite', title: 'Invite', does: () => {} });
            invite.hold('only a session invites, and this page reaches the node as a token');
            const presses = document.createElement('div');
            presses.style.display = 'flex';
            presses.style.flexWrap = 'wrap';
            presses.style.gap = '8px';
            presses.style.marginTop = '12px';
            presses.append(send.element, invite.element);
            body.append(email.element, presses);
            return body;
        },
    };
    tray.add(item);
}
