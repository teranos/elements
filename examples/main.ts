import { configureElements } from '../config';
import { tray } from '../tray/tray';
import { renderPlacementSpecimen } from './placement';
import { renderBorderSpecimen } from './border';
import { renderTooltipSpecimen } from './tooltip';
import { renderButtonSpecimen } from './button';
import { renderPanelSpecimen } from './panel';
import { renderSparklineSpecimen } from './sparkline';
import { renderFieldSpecimen } from './field';
import { renderApproveSpecimen } from './approve';
import { renderTableSpecimen } from './table';
import { renderChatSpecimen } from './chat';
import { renderLateSpecimen } from './late';

configureElements({
    windowBorderRadius: '0',
    dotSymbol: true,
});
tray.init();

renderPlacementSpecimen();
renderBorderSpecimen();
renderTooltipSpecimen();
renderButtonSpecimen();
// Selenium rests between the tray's Zinc and Krypton, as it does in the table.
renderFieldSpecimen();
renderPanelSpecimen();
renderChatSpecimen();
renderApproveSpecimen();
renderSparklineSpecimen();
renderTableSpecimen();
renderLateSpecimen();
