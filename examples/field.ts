// Field specimen — Selenium, the next element after the sparkline's Arsenic.
// It opens as a window holding one field, the first thing here a keyboard comes up for.
// Apple Human Interface Guidelines, Text fields: a label beside the placeholder,
// "because placeholder text disappears when people start typing", and the keyboard
// that matches what is asked for.

import { tray } from '../tray/tray';
import { createInput } from '../canvas/ui-primitives';
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
            const field = createInput({ label: 'Email', placeholder: 'you@example.com', type: 'email' });
            // The keyboard is the type's; what the browser may fill in is the autocomplete's.
            field.querySelector('input')!.autocomplete = 'email';
            body.appendChild(field);
            return body;
        },
    };
    tray.add(item);
}
