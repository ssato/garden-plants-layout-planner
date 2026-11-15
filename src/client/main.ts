import type { PlantData, PlantType } from '../shared/types';
import { GardenCanvasManager, type DrawMode } from './canvas_manager';
import { fetchGardenData, saveGardenData } from './gas_api';

const statusEl = document.getElementById('status') as HTMLSpanElement;
const measureHudEl = document.getElementById('measureHud') as HTMLDivElement;
const modalOverlayEl = document.getElementById('modalOverlay') as HTMLDivElement;

function setStatus(msg: string): void {
  statusEl.textContent = msg;
}

const canvasManager = new GardenCanvasManager('canvas-container', {
  onPlantSelect: (plant) => openModal(plant),
  onDataChange: () => setStatus('未保存の変更があります'),
  onHudUpdate: (text) => {
    measureHudEl.textContent = text;
  },
});

// モード切替ボタン
document.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode as DrawMode;
    if (!mode) return;
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    canvasManager.setMode(mode);
  });
});

// ツールバー各コントロール
(document.getElementById('strokeColor') as HTMLInputElement).addEventListener('input', (e) => {
  canvasManager.setStrokeColor((e.target as HTMLInputElement).value);
});

(document.getElementById('snapToggle') as HTMLInputElement).addEventListener('change', (e) => {
  canvasManager.setSnapEnabled((e.target as HTMLInputElement).checked);
});

(document.getElementById('cmPerGrid') as HTMLInputElement).addEventListener('change', (e) => {
  const val = Number((e.target as HTMLInputElement).value);
  canvasManager.setCmPerGrid(val);
});

document.getElementById('btnUndoShape')?.addEventListener('click', () => {
  canvasManager.undoLastShape();
});

document.getElementById('btnClearShapes')?.addEventListener('click', () => {
  const { shapes } = canvasManager.getData();
  if (shapes.length === 0) return;
  if (!confirm('描いた庭の枠線・フリーハンド線をすべて消去しますか？')) return;
  canvasManager.clearAllShapes();
});

document.getElementById('btnAddPlant')?.addEventListener('click', () => {
  // 選択モードへ戻す
  document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
  document.querySelector('[data-mode="select"]')?.classList.add('active');
  canvasManager.setMode('select');

  const newPlant: PlantData = {
    id: 'p_' + Date.now(),
    x: canvasManager.gridSize * 5,
    y: canvasManager.gridSize * 5,
    radius: canvasManager.gridSize * 1.5,
    species: '',
    name: '',
    label: '新規植物',
    type: '多年草',
    height: '',
    flowering: '',
    plantedDate: new Date().toISOString().slice(0, 10),
    memo: '',
  };
  canvasManager.addPlant(newPlant);
});

// モーダル関連ヘルパー
function getInput(id: string): HTMLInputElement {
  return document.getElementById(id) as HTMLInputElement;
}

function openModal(plant: PlantData): void {
  getInput('editId').value = plant.id;
  getInput('f_species').value = plant.species;
  getInput('f_name').value = plant.name;
  getInput('f_label').value = plant.label;
  (document.getElementById('f_type') as HTMLSelectElement).value = plant.type || '多年草';
  getInput('f_height').value = plant.height;
  getInput('f_flowering').value = plant.flowering;
  getInput('f_plantedDate').value = plant.plantedDate;
  getInput('f_spreadInfo').value = `約 ${canvasManager.pxToCm(plant.radius * 2)} cm（半径 ${canvasManager.pxToCm(plant.radius)} cm）`;
  (document.getElementById('f_memo') as HTMLTextAreaElement).value = plant.memo;
  modalOverlayEl.style.display = 'flex';
}

function closeModal(): void {
  modalOverlayEl.style.display = 'none';
}

document.getElementById('btnCloseModal')?.addEventListener('click', closeModal);

document.getElementById('btnApplyModal')?.addEventListener('click', () => {
  const id = getInput('editId').value;
  const { plants } = canvasManager.getData();
  const plant = plants.find((p) => p.id === id);

  if (plant) {
    plant.species = getInput('f_species').value;
    plant.name = getInput('f_name').value;
    plant.label = getInput('f_label').value;
    plant.type = (document.getElementById('f_type') as HTMLSelectElement).value as PlantType;
    plant.height = getInput('f_height').value;
    plant.flowering = getInput('f_flowering').value;
    plant.plantedDate = getInput('f_plantedDate').value;
    plant.memo = (document.getElementById('f_memo') as HTMLTextAreaElement).value;

    canvasManager.renderPlants();
    canvasManager.updatePlantHud(plant);
    setStatus('未保存の変更があります');
  }
  closeModal();
});

document.getElementById('btnDeletePlant')?.addEventListener('click', () => {
  const id = getInput('editId').value;
  canvasManager.removePlant(id);
  closeModal();
});

// 保存・読み込み処理
document.getElementById('btnSaveAll')?.addEventListener('click', async () => {
  setStatus('保存中...');
  try {
    const payload = canvasManager.getData();
    const res = await saveGardenData(payload);
    setStatus(`保存完了（植物:${res.plantCount}件 / 枠線:${res.shapeCount}件）`);
  } catch (err) {
    setStatus('保存エラー: ' + (err as Error).message);
  }
});

async function init(): Promise<void> {
  setStatus('読み込み中...');
  try {
    const data = await fetchGardenData();
    canvasManager.setData(data.plants || [], data.shapes || []);
    setStatus(`読み込み完了（植物:${data.plants.length}件 / 枠線:${data.shapes.length}件）`);
  } catch (err) {
    setStatus('読み込みエラー: ' + (err as Error).message);
  }
}

init();
