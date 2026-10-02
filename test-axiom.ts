/**
 * The axioms, asked of an element in a test (AXIOMAS.md).
 *
 * "An element is exactly one DOM element for its entire lifetime. Elements are
 * reparented, never cloned." Asked after any step: exactly one node in the page
 * carries the id, it is the node the test has held since the start, and it is
 * in a form the form table names.
 */

import { isForm } from './form';

export function expectAxiom(id: string, node: HTMLElement): void {
    const found = document.querySelectorAll(`[data-element-id="${id}"]`);
    if (found.length !== 1) {
        throw new Error(`AXIOM: ${found.length} elements carry data-element-id="${id}", not exactly 1`);
    }
    if (found[0] !== node) {
        throw new Error(`AXIOM: the element carrying data-element-id="${id}" is not the one it was`);
    }
    const form = node.dataset.form ?? '';
    if (!isForm(form)) {
        throw new Error(`AXIOM: ${id} is in form "${form}", which the form table does not name`);
    }
}
