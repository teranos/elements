import { configureElements } from '../config';
import { tray } from '../tray/tray';
import { renderPlacementSpecimen } from './placement';
import { renderBorderSpecimen } from './border';
import { renderTooltipSpecimen } from './tooltip';
import { renderButtonSpecimen } from './button';
import { renderOverlaySpecimen } from './overlay';
import { renderPanelSpecimen } from './panel';
import { renderSparklineSpecimen } from './sparkline';
import { renderFieldSpecimen } from './field';
import { renderApproveSpecimen } from './approve';
import { renderTableSpecimen } from './table';
import { renderUsersSpecimen, renderUsersCompactSpecimen } from './users';
import { renderChatSpecimen } from './chat';
import { renderLateSpecimen } from './late';
import { renderSpawnSpecimen } from './spawn';

configureElements({
    windowBorderRadius: '0',
    dotSymbol: true,
});
tray.init();

renderPlacementSpecimen();
renderBorderSpecimen();
renderTooltipSpecimen();
renderButtonSpecimen();
renderOverlaySpecimen();
// Selenium rests between the tray's Zinc and Krypton, as it does in the table.
renderFieldSpecimen();
renderPanelSpecimen();
renderChatSpecimen();
renderApproveSpecimen();
renderSparklineSpecimen();
renderTableSpecimen();
renderUsersSpecimen();
renderUsersCompactSpecimen();
renderLateSpecimen();
renderSpawnSpecimen();
