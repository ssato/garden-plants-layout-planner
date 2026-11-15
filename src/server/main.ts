import {
  deleteGardenLayout,
  getInitialGardenState,
  loadGardenLayout,
  saveGardenLayout,
} from './sheet_service';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ガーデンレイアウト管理')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

const g = globalThis as Record<string, unknown>;
g.doGet = doGet;
g.getInitialGardenState = getInitialGardenState;
g.loadGardenLayout = loadGardenLayout;
g.saveGardenLayout = saveGardenLayout;
g.deleteGardenLayout = deleteGardenLayout;
