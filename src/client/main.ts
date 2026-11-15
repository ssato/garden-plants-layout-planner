import type { LayoutMeta, PlantData, PlantType } from '../shared/types';
import { GardenCanvasManager, type DrawMode } from './canvas_manager';
import {
  fetchInitialState,
  fetchLayoutById,
  removeLayout,
  saveLayout,
} from './gas_api';

const MAX_LAYOUTS = 24;

const statusEl = document.getElementById('status') as HTMLSpanElement;
const measureHudEl = document.getElementById('measureHud') as HTMLDivElement;
const modalOverlayEl = document.getElementById('modalOverlay') as HTMLDivElement;

const layoutSelectEl = document.getElementById('layoutSelect') as HTMLSelectElement;
const layoutQuotaEl = document.getElementById('layoutQuota') as HTMLSpanElement;
const layoutNameInputEl = document.getElementById('layoutNameInput') as HTMLInputElement;
const layoutIdInputEl = document.getElementById('layoutIdInput') as HTMLInputElement;
const cmPerGridInputEl = document.getElementById('cmPerGrid') as HTMLInputElement;

let layoutsList: LayoutMeta[] = [];
let activeLayoutId = '';
let hasUnsavedChanges = false;

function setStatus(msg: string, dirty?: boolean): void {
  statusEl.textContent = msg;
  if (typeof dirty === 'boolean') {
    hasUnsavedChanges = dirty;
  }
}

const canvasManager = new GardenCanvasManager('canvas-container', {
  onPlantSelect: (plant) => openModal(plant),
  onDataChange: () => setStatus('未保存の変更があります', true),
  onHudUpdate: (text) => {
    measureHudEl.textContent = text;
  },
});

function renderLayoutSelector(): void {
  layoutSelectEl.innerHTML = '';
  layoutsList.forEach((meta) => {
    const opt = document.createElement('option');
    opt.value = meta.id;
    opt.textContent = `${meta.name} (${meta.id})`;
    if (meta.id === activeLayoutId) {
      opt.selected = true;
    }
    layoutSelectEl.appendChild(opt);
  });

  // 未保存の新規IDを入力中の場合、一時オプションを表示
  if (activeLayoutId && !layoutsList.some((l) => l.id === activeLayoutId)) {
    const opt = document.createElement('option');
    opt.value = activeLayoutId;
    opt.textContent = `[未保存] ${layoutNameInputEl.value || activeLayoutId} (${activeLayoutId})`;
    opt.selected = true;
    layoutSelectEl.appendChild(opt);
  }

  layoutQuotaEl.textContent = `${layoutsList.length} / ${MAX_LAYOUTS}`;
}

function applyLayoutToForm(meta: LayoutMeta): void {
  activeLayoutId = meta.id;
  layoutNameInputEl.value = meta.name;
  layoutIdInputEl.value = meta.id;
  cmPerGridInputEl.value = String(meta.cmPerGrid);
  canvasManager.setCmPerGrid(meta.cmPerGrid);
  renderLayoutSelector();
}

// 入力欄変更時も未保存フラグを立てる
layoutNameInputEl.addEventListener('input', () => setStatus('未保存の変更があります', true));
layoutIdInputEl.addEventListener('input', () => setStatus('未保存の変更があります', true));

// レイアウト切り替え
layoutSelectEl.addEventListener('change', async () => {
  const targetId = layoutSelectEl.value;
  if (targetId === activeLayoutId) return;

  if (hasUnsavedChanges && !confirm('未保存の変更があります。破棄して別のレイアウト案を開きますか？')) {
    layoutSelectEl.value = activeLayoutId;
    return;
  }

  setStatus('レイアウト読み込み中...');
  try {
    const data = await fetchLayoutById(targetId);
    canvasManager.setData(data.plants || [], data.shapes || []);
    applyLayoutToForm(data.layout);
    setStatus(`「${data.layout.name}」を読み込みました`, false);
  } catch (err) {
    setStatus('読み込みエラー: ' + (err as Error).message);
    layoutSelectEl.value = activeLayoutId;
  }
});

// 白紙の新規レイアウト案を作成（保存ボタンを押すまでシートには作成されない）
document.getElementById('btnNewBlankLayout')?.addEventListener('click', () => {
  if (layoutsList.length >= MAX_LAYOUTS) {
    alert(`保存できるレイアウト案は最大${MAX_LAYOUTS}個までです。不要な案を削除してから作成してください。`);
    return;
  }
  if (hasUnsavedChanges && !confirm('現在の未保存の変更を破棄して、白紙の新規レイアウトを作成しますか？')) {
    return;
  }

  // 未使用の連番IDを生成
  let num = layoutsList.length + 1;
  while (layoutsList.some((l) => l.id === `layout_${num}`)) {
    num++;
  }

  const newMeta: LayoutMeta = {
    id: `layout_${num}`,
    name: `レイアウト案 ${num}`,
    cmPerGrid: canvasManager.getCmPerGrid(),
    updatedAt: '',
  };

  canvasManager.setData([], []);
  applyLayoutToForm(newMeta);
  setStatus('新規案を作成しました（「保存」でシートに確定します）', true);
});

// 現在のレイアウト案を削除
document.getElementById('btnDeleteLayout')?.addEventListener('click', async () => {
  const isSaved = layoutsList.some((l) => l.id === activeLayoutId);
  if (!isSaved) {
    // まだシートに保存されていない新規案なら、先頭の案に戻すだけ
    if (layoutsList.length > 0) {
      const fallback = await fetchLayoutById(layoutsList[0].id);
      canvasManager.setData(fallback.plants, fallback.shapes);
      applyLayoutToForm(fallback.layout);
      setStatus('未保存の新規案を取り消しました', false);
    }
    return;
  }

  if (layoutsList.length <= 1) {
    alert('最後の1件は削除できません。');
    return;
  }

  if (!confirm(`レイアウト案「${layoutNameInputEl.value} (${activeLayoutId})」と対応するシートを削除しますか？`)) {
    return;
  }

  setStatus('削除中...');
  try {
    layoutsList = await removeLayout(activeLayoutId);
    const next = await fetchLayoutById(layoutsList[0].id);
    canvasManager.setData(next.plants || [], next.shapes || []);
    applyLayoutToForm(next.layout);
    setStatus('削除しました', false);
  } catch (err) {
    setStatus('削除エラー: ' + (err as Error).message);
  }
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

cmPerGridInputEl.addEventListener('change', (e) => {
  const val = Number((e.target as HTMLInputElement).value);
  canvasManager.setCmPerGrid(val);
  setStatus('未保存の変更があります', true);
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

// モーダル関連
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
    setStatus('未保存の変更があります', true);
  }
  closeModal();
});

document.getElementById('btnDeletePlant')?.addEventListener('click', () => {
  const id = getInput('editId').value;
  canvasManager.removePlant(id);
  closeModal();
});

// 保存処理（既存IDなら上書き、新しいIDなら別案として新規保存）
document.getElementById('btnSaveAll')?.addEventListener('click', async () => {
  const inputId = layoutIdInputEl.value.trim();
  const inputName = layoutNameInputEl.value.trim();

  if (!inputId) {
    alert('レイアウトのIDを入力してください（半角英数字推奨）。');
    layoutIdInputEl.focus();
    return;
  }

  const isNewId = !layoutsList.some((l) => l.id === inputId);
  if (isNewId && layoutsList.length >= MAX_LAYOUTS) {
    alert(`保存できるレイアウト案は最大${MAX_LAYOUTS}個までです。不要な案を削除してから保存してください。`);
    return;
  }

  setStatus('保存中...');
  try {
    const { plants, shapes } = canvasManager.getData();
    const res = await saveLayout({
      layout: {
        id: inputId,
        name: inputName || inputId,
        cmPerGrid: canvasManager.getCmPerGrid(),
        updatedAt: '',
      },
      plants,
      shapes,
    });

    layoutsList = res.layouts;
    applyLayoutToForm(res.savedLayout);
    setStatus(
      `保存完了: 「${res.savedLayout.name}」 (植物:${res.plantCount}件 / 枠線:${res.shapeCount}件)`,
      false
    );
  } catch (err) {
    setStatus('保存エラー: ' + (err as Error).message);
  }
});

async function init(): Promise<void> {
  setStatus('読み込み中...');
  try {
    const initial = await fetchInitialState();
    layoutsList = initial.layouts;
    const active = initial.activeGarden;
    canvasManager.setData(active.plants || [], active.shapes || []);
    applyLayoutToForm(active.layout);
    setStatus(`読み込み完了: 「${active.layout.name}」`, false);
  } catch (err) {
    setStatus('読み込みエラー: ' + (err as Error).message);
  }
}

init();
