import { configureElements } from '../config';
import { tray } from '../tray/tray';
import { renderPlacementSpecimen } from './placement';
import { renderBorderSpecimen } from './border';
import { renderTooltipSpecimen } from './tooltip';
import { renderButtonSpecimen } from './button';
import { renderSparklineSpecimen } from './sparkline';

// Resting dot doubled from the 10px default — a 10px dot on a black page is
// hard to aim at.
configureElements({
    dotGeometry: { minWidth: 20, minHeight: 20 },
    windowBorderRadius: '0',
    dotSymbol: true,
});
tray.init();

renderPlacementSpecimen();
renderBorderSpecimen();
renderTooltipSpecimen();
renderButtonSpecimen();
renderSparklineSpecimen();
