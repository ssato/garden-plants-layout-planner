import type { GardenPayload, PlantData, PlantType, SaveResult, ShapeData } from '../shared/types';

const PLANT_SHEET_NAME = 'Plants';
const SHAPE_SHEET_NAME = 'Shapes';

const PLANT_HEADERS = [
  'ID', 'X', 'Y', 'Radius',
  '品目', '名前', 'ラベル', '種類', '草丈', '花期', '植付け日', '手入れメモ'
];

const SHAPE_HEADERS = [
  'ID', 'Type', 'Color', 'DataJSON'
];

export function getAllGardenData(): GardenPayload {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. 植物データの読み込み
  let plantSheet = ss.getSheetByName(PLANT_SHEET_NAME);
  let plants: PlantData[] = [];

  if (!plantSheet) {
    plantSheet = ss.insertSheet(PLANT_SHEET_NAME);
    plantSheet.appendRow(PLANT_HEADERS);
  } else {
    const lastRow = plantSheet.getLastRow();
    if (lastRow > 1) {
      const values = plantSheet.getRange(2, 1, lastRow - 1, PLANT_HEADERS.length).getValues();
      plants = values.map((row) => ({
        id: String(row[0]),
        x: Number(row[1]),
        y: Number(row[2]),
        radius: Number(row[3]),
        species: String(row[4]),
        name: String(row[5]),
        label: String(row[6]),
        type: (String(row[7]) || '多年草') as PlantType,
        height: String(row[8]),
        flowering: String(row[9]),
        plantedDate:
          row[10] instanceof Date
            ? Utilities.formatDate(row[10], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(row[10]),
        memo: String(row[11]),
      }));
    }
  }

  // 2. 背景図形データの読み込み
  let shapeSheet = ss.getSheetByName(SHAPE_SHEET_NAME);
  let shapes: ShapeData[] = [];

  if (!shapeSheet) {
    shapeSheet = ss.insertSheet(SHAPE_SHEET_NAME);
    shapeSheet.appendRow(SHAPE_HEADERS);
  } else {
    const lastRow = shapeSheet.getLastRow();
    if (lastRow > 1) {
      const values = shapeSheet.getRange(2, 1, lastRow - 1, SHAPE_HEADERS.length).getValues();
      shapes = values
        .map((row): ShapeData | null => {
          try {
            const parsed = JSON.parse(String(row[3]));
            const type = String(row[1]);
            if (type === 'rect') {
              return {
                id: String(row[0]),
                type: 'rect',
                color: String(row[2]),
                x: Number(parsed.x),
                y: Number(parsed.y),
                width: Number(parsed.width),
                height: Number(parsed.height),
              };
            }
            if (type === 'freehand') {
              return {
                id: String(row[0]),
                type: 'freehand',
                color: String(row[2]),
                points: Array.isArray(parsed.points) ? parsed.points.map(Number) : [],
              };
            }
            return null;
          } catch {
            return null;
          }
        })
        .filter((item): item is ShapeData => item !== null);
    }
  }

  return { plants, shapes };
}

export function saveAllGardenData(payload: GardenPayload): SaveResult {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const plants = payload.plants || [];
  const shapes = payload.shapes || [];

  // 1. 植物データの保存
  let plantSheet = ss.getSheetByName(PLANT_SHEET_NAME);
  if (!plantSheet) plantSheet = ss.insertSheet(PLANT_SHEET_NAME);
  plantSheet.clearContents();
  plantSheet.appendRow(PLANT_HEADERS);

  if (plants.length > 0) {
    const plantRows = plants.map((p) => [
      p.id,
      Math.round(p.x),
      Math.round(p.y),
      Math.round(p.radius),
      p.species || '',
      p.name || '',
      p.label || '',
      p.type || '',
      p.height || '',
      p.flowering || '',
      p.plantedDate || '',
      p.memo || '',
    ]);
    plantSheet.getRange(2, 1, plantRows.length, PLANT_HEADERS.length).setValues(plantRows);
  }

  // 2. 背景図形データの保存
  let shapeSheet = ss.getSheetByName(SHAPE_SHEET_NAME);
  if (!shapeSheet) shapeSheet = ss.insertSheet(SHAPE_SHEET_NAME);
  shapeSheet.clearContents();
  shapeSheet.appendRow(SHAPE_HEADERS);

  if (shapes.length > 0) {
    const shapeRows = shapes.map((s) => {
      const { id, type, color, ...coords } = s;
      return [id, type, color, JSON.stringify(coords)];
    });
    shapeSheet.getRange(2, 1, shapeRows.length, SHAPE_HEADERS.length).setValues(shapeRows);
  }

  return {
    status: 'ok',
    plantCount: plants.length,
    shapeCount: shapes.length,
  };
}
