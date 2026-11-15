import { getAllGardenData, saveAllGardenData } from './sheet_service';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ガーデンレイアウト管理')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// GASランタイムのグローバルスコープへ公開
const g = globalThis as Record<string, unknown>;
g.doGet = doGet;
g.getAllGardenData = getAllGardenData;
g.saveAllGardenData = saveAllGardenData;
