# Elements

The element is the universal UI primitive: exactly one DOM element for its
entire lifetime, morphing between forms while its identity never
changes. The axioms are in [AXIOMAS.md](AXIOMAS.md); this is why they exist.

## The element IS the window

The element resting as a dot in the tray is the element that becomes the
window: it grows out of its place, takes chrome, and is the window until it
shrinks back. Nothing is created, nothing is destroyed, nothing teleports.
The user watches one thing change state, and the visual continuity makes the
relationship unmistakable.

## The state continuum

At rest an element is a dot — presence without demand. As the pointer
approaches it grows, and its symbol and title fade in: attention is answered
before commitment. Interaction commits it to a form — a window with
chrome, a fullscreen panel, a canvas, an element placed on a workspace.
Leaving a form is the same road driven backwards, down to the dot
it never stopped being.

A morph between states is a transaction. It ends one of two ways: the element
takes the new state, or the attempt is abandoned and the element keeps the one
it had. Nothing about a morph outlives the morph.

## Universal form

A form is a state, not a component. The same element, the same
identity, another form — and any form an interface needs tomorrow is a new
form type, not a new primitive.

```
element → [intent] → form → [interaction] → another form, or back
```

Users learn the morphing grammar once, not each UI.

## Visual identity

What an element wears is data on the element, never a property of a
form: its symbol, its color, its border. Every form reads
them and every form shows them — the dot a note minimizes into
wears the note's border. Everything about an element survives every transition.

## Memory

An element remembers: where its window last stood, what its content held, where
it sits on a canvas. Expanding an element reveals what was always there;
nothing is reconstructed. The user knows where a thing lives because it
never left.

## The tray

The tray is where elements rest. It holds every minimized element as a dot and
answers proximity — pointer and thumb alike. The tray is the continuum made
visible: a screen of windows and a tray of dots are one population in
different states.

## Melding

Elements compose by touch. Dragged close enough, they fuse into spatial
compositions with typed, directed edges — data flows along the geometry the
user built by hand. Each side of an element accepts one connection; the
composition is a graph the user can see because it is the layout itself.

## The host

A host expresses itself through elements — its symbols, its panels, its
grammar. What a host builds on top of the primitive is the host's vision. Where the primitive
ends and a host begins is the Boundary section of the [README](README.md).
