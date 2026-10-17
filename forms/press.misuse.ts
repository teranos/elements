// What does not compile, held so by bun run typecheck: an expected error that stops being one fails it.
// Never imported and never published (jsr.json).

import { pressFrom } from './press';

export function misuse(): void {
    // @ts-expect-error a single press cannot be irrevocable: that is a second stage's to say
    pressFrom({ id: 'nuke', title: 'Nuke', irrevocable: true, does: () => {} });
    // @ts-expect-error a press has no colour to choose
    pressFrom({ id: 'save', title: 'Save', variant: 'danger', does: () => {} });
    // @ts-expect-error a press has no size to choose
    pressFrom({ id: 'save', title: 'Save', minWidth: '80px', does: () => {} });
    // @ts-expect-error armed for a while is a second stage's
    pressFrom({ id: 'save', title: 'Save', armedForMs: 8000, does: () => {} });
}
