[AXIOMAS.md](AXIOMAS.md) — read it before changing anything here.

[README.md](README.md) — what this project is.

`bun examples/serve.ts` runs the live examples at http://localhost:5180 — look at a change there, not only in tests.

Strict TDD.

Organize tests by persona: Tim (happy path), Spike (edge cases), Jenny (complex scenarios).

Where this package ends and a host begins is settled by one test, asked of every change: does it express an element, or does it orchestrate host state? The Boundary section of the README records the answers given so far.

The examples are the pattern to copy: "I intend on future sessions to look at the elements work and accept it as exemplary". Every text an example draws reads at WCAG 4.5 to 1, what is typed and placeholders included (`browser/contrast.browser.ts`). A colour that fails it is fixed, never excused.
