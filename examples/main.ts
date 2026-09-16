import { configureGlyphs } from '../config';
import { tray } from '../tray/tray';
import { renderPlacementSpecimen } from './placement';
import { renderBorderSpecimen } from './border';

// Resting dot doubled from the 10px default, as sbvh.nl does — a 10px dot on
// a black page is hard to aim at.
configureGlyphs({
    dotGeometry: { minWidth: 20, minHeight: 20 },
    windowBorderRadius: '0',
});
tray.init();

renderPlacementSpecimen();
renderBorderSpecimen();
