// "no element should have content that isnt accesible"
// Nothing in an element is wider than what holds it: text wraps even where a host said nowrap,
// a box is no wider than its holder and gives way in a row, a table divides the width it has.

/** The package's fit for the elements `element` selects, laid into its layer by text.ts. */
export function fitRule(element: string): string {
    return `${element} * { text-wrap-mode: wrap !important; max-width: 100% !important; min-width: 0 !important; flex-shrink: 1 !important; }
${element} table { table-layout: fixed !important; width: 100% !important; }`;
}
