import type {
  GardenPayload,
  InitialLoadResult,
  LayoutMeta,
  PlantData,
  PlantType,
  SaveResult,
  ShapeData,
} from '../shared/types';

const INDEX_SHEET_NAME = 'Layouts';
const PLAN_SHEET_PREFIX = 'Plan_';
const MAX_LAYOUTS = 24;

const INDEX_HEADERS = ['ID', 'レイアウト名', '1マス(cm)', '更新日時'];

const PLAN_HEADERS = [
  'RecordType', // 'PLANT' | 'SHAPE'
  'ID',
  'X',
  'Y',
  'Radius_or_Width',
  'Height',
  'Color_or_Type',
  '品目',
  '名前',
  'ラベル',
  '草丈',
  '花期',
  '植付け日',
  '手入れメモ_or_PointsJSON',
];

function getPlanSheetName(layoutId: string): string {
  // シート名に使えない文字を除去し、長さを制限
  const safeId = layoutId.replace(/[\\/?*[\]:]/g, '_').slice(0, 40);
  return `${PLAN_SHEET_PREFIX}${safeId}`;
}

function getOrCreateIndexSheet(ss: GoogleAppsScript.Spreadsheet.Spreadsheet): GoogleAppsScript.Spreadsheet.Sheet {
  let sheet = ss.getSheetByName(INDEX_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(INDEX_SHEET_NAME, 0);
    sheet.appendRow(INDEX_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readLayoutsList(ss: GoogleAppsScript.Spreadsheet.Spreadsheet): LayoutMeta[] {
  const indexSheet = getOrCreateIndexSheet(ss);
  const lastRow = indexSheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = indexSheet.getRange(2, 1, lastRow - 1, INDEX_HEADERS.length).getValues();
  return values
    .filter((row) => String(row[0]).trim() !== '')
    .map((row) => ({
      id: String(row[0]),
      name: String(row[1]) || '無題のレイアウト',
      cmPerGrid: Number(row[2]) > 0 ? Number(row[2]) : 10,
      updatedAt:
        row[3] instanceof Date
          ? Utilities.formatDate(row[3], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
          : String(row[3] || ''),
    }));
}

function readPlanData(
  ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
  meta: LayoutMeta
): GardenPayload {
  const sheetName = getPlanSheetName(meta.id);
  const sheet = ss.getSheetByName(sheetName);
  const plants: PlantData[] = [];
  const shapes: ShapeData[] = [];

  if (sheet && sheet.getLastRow() > 1) {
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, PLAN_HEADERS.length).getValues();
    for (const row of values) {
      const recType = String(row[0]);
      if (recType === 'PLANT') {
        plants.push({
          id: String(row[1]),
          x: Number(row[2]),
          y: Number(row[3]),
          radius: Number(row[4]),
          type: (String(row[6]) || '多年草') as PlantType,
          species: String(row[7]),
          name: String(row[8]),
          label: String(row[9]),
          height: String(row[10]),
          flowering: String(row[11]),
          plantedDate:
            row[12] instanceof Date
              ? Utilities.formatDate(row[12], Session.getScriptTimeZone(), 'yyyy-MM-dd')
              : String(row[12]),
          memo: String(row[13]),
        });
      } else if (recType === 'SHAPE') {
        const shapeType = String(row[7]);
        if (shapeType === 'rect') {
          shapes.push({
            id: String(row[1]),
            type: 'rect',
            x: Number(row[2]),
            y: Number(row[3]),
            width: Number(row[4]),
            height: Number(row[5]),
            color: String(row[6]) || '#795548',
          });
        } else if (shapeType === 'freehand') {
          try {
            const pts = JSON.parse(String(row[13]));
            shapes.push({
              id: String(row[1]),
              type: 'freehand',
              color: String(row[6]) || '#795548',
              points: Array.isArray(pts) ? pts.map(Number) : [],
            });
          } catch {
            // 不正なJSON行はスキップ
          }
        }
      }
    }
  }

  return { layout: meta, plants, shapes };
}

// 初回起動時: 全レイアウト一覧と、先頭のレイアウトデータを返す
export function getInitialGardenState(): InitialLoadResult {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let layouts = readLayoutsList(ss);

  if (layouts.length === 0) {
    const defaultMeta: LayoutMeta = {
      id: 'layout_1',
      name: '基本レイアウト案',
      cmPerGrid: 10,
      updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
    };
    const initialPayload: GardenPayload = { layout: defaultMeta, plants: [], shapes: [] };
    saveGardenLayout(initialPayload);
    layouts = [defaultMeta];
    return { layouts, activeGarden: initialPayload };
  }

  const activeGarden = readPlanData(ss, layouts[0]);
  return { layouts, activeGarden };
}

// 指定IDのレイアウトデータを取得
export function loadGardenLayout(layoutId: string): GardenPayload {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const layouts = readLayoutsList(ss);
  const meta = layouts.find((l) => l.id === layoutId);
  if (!meta) {
    throw new Error(`レイアウトID "${layoutId}" が見つかりません。`);
  }
  return readPlanData(ss, meta);
}

// レイアウトを新規保存または上書き保存（上限24件）
export function saveGardenLayout(payload: GardenPayload): SaveResult {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const indexSheet = getOrCreateIndexSheet(ss);
  const layouts = readLayoutsList(ss);

  const layoutId = payload.layout.id.trim();
  if (!layoutId) {
    throw new Error('レイアウトIDが空です。');
  }

  const existingIndex = layouts.findIndex((l) => l.id === layoutId);
  if (existingIndex === -1 && layouts.length >= MAX_LAYOUTS) {
    throw new Error(`保存できるレイアウト案は最大${MAX_LAYOUTS}個までです。不要な案を削除してから保存してください。`);
  }

  const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  const savedMeta: LayoutMeta = {
    id: layoutId,
    name: payload.layout.name.trim() || layoutId,
    cmPerGrid: payload.layout.cmPerGrid > 0 ? payload.layout.cmPerGrid : 10,
    updatedAt: nowStr,
  };

  if (existingIndex >= 0) {
    layouts[existingIndex] = savedMeta;
  } else {
    layouts.push(savedMeta);
  }

  // 目次シートの更新
  indexSheet.clearContents();
  indexSheet.appendRow(INDEX_HEADERS);
  if (layouts.length > 0) {
    const indexRows = layouts.map((l) => [l.id, l.name, l.cmPerGrid, l.updatedAt]);
    indexSheet.getRange(2, 1, indexRows.length, INDEX_HEADERS.length).setValues(indexRows);
  }

  // 個別シート (Plan_<ID>) の更新
  const sheetName = getPlanSheetName(layoutId);
  let planSheet = ss.getSheetByName(sheetName);
  if (!planSheet) {
    planSheet = ss.insertSheet(sheetName);
  }
  planSheet.clearContents();
  planSheet.appendRow(PLAN_HEADERS);
  planSheet.setFrozenRows(1);

  const rows: (string | number)[][] = [];

  for (const p of payload.plants || []) {
    rows.push([
      'PLANT',
      p.id,
      Math.round(p.x),
      Math.round(p.y),
      Math.round(p.radius),
      '',
      p.type || '多年草',
      p.species || '',
      p.name || '',
      p.label || '',
      p.height || '',
      p.flowering || '',
      p.plantedDate || '',
      p.memo || '',
    ]);
  }

  for (const s of payload.shapes || []) {
    if (s.type === 'rect') {
      rows.push([
        'SHAPE',
        s.id,
        Math.round(s.x),
        Math.round(s.y),
        Math.round(s.width),
        Math.round(s.height),
        s.color || '#795548',
        'rect',
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
    } else if (s.type === 'freehand') {
      rows.push([
        'SHAPE',
        s.id,
        0,
        0,
        0,
        0,
        s.color || '#795548',
        'freehand',
        '',
        '',
        '',
        '',
        '',
        JSON.stringify(s.points),
      ]);
    }
  }

  if (rows.length > 0) {
    planSheet.getRange(2, 1, rows.length, PLAN_HEADERS.length).setValues(rows);
  }

  return {
    status: 'ok',
    layouts,
    savedLayout: savedMeta,
    plantCount: (payload.plants || []).length,
    shapeCount: (payload.shapes || []).length,
  };
}

// レイアウト案の削除（目次行＋個別シート削除）
export function deleteGardenLayout(layoutId: string): LayoutMeta[] {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const indexSheet = getOrCreateIndexSheet(ss);
  const layouts = readLayoutsList(ss);

  if (layouts.length <= 1) {
    throw new Error('最後の1件は削除できません。');
  }

  const nextLayouts = layouts.filter((l) => l.id !== layoutId);

  indexSheet.clearContents();
  indexSheet.appendRow(INDEX_HEADERS);
  const indexRows = nextLayouts.map((l) => [l.id, l.name, l.cmPerGrid, l.updatedAt]);
  indexSheet.getRange(2, 1, indexRows.length, INDEX_HEADERS.length).setValues(indexRows);

  const planSheet = ss.getSheetByName(getPlanSheetName(layoutId));
  if (planSheet) {
    ss.deleteSheet(planSheet);
  }

  return nextLayouts;
}
