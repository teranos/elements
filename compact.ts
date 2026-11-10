// "Some kinds of col, I just don't want to display depending on how much width the screen gives us"
// 「[Sonnet 5.5] A screen is Compact or Regular by its width: Apple's size classes, which Material's window size classes」
// 「[Sonnet 5.5] (compact, medium, expanded) divide differently. The edge is the one the package already draws for a phone」
// 「[Sonnet 5.5] (tray/look.ts) and QNTX-Web's wide-only columns drew by hand; one line moves it.」

/** The media query for a Compact screen: a phone held upright. */
export const COMPACT = '(max-width: 768px)';
