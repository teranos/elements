# AXIOMAS

## Element Axioma

A glyph is exactly one DOM element for its entire lifetime. Elements are reparented, never cloned. Everything about it survives every transition between forms.

## Morph Axioma

A morph is a state transition of a glyph between forms, ending one of two ways: the glyph takes the new state, or the attempt is abandoned and it keeps the one it had.

A glyph is in one transition at any time.

## One-Per-Side Axioma

Each side of a glyph accepts at most one meld connection.
