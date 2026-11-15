import type {
  GardenPayload,
  InitialLoadResult,
  LayoutMeta,
  SaveResult,
} from '../shared/types';

const LOCAL_STORAGE_KEY = 'garden_planner_multi_layouts_v1';
const MAX_LAYOUTS = 24;

function isGasEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof window.google?.script?.run !== 'undefined';
}

interface LocalStore {
  layouts: LayoutMeta[];
  plans: Record<string, GardenPayload>;
}

function readLocalStore(): LocalStore {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (raw) {
    return JSON.parse(raw) as LocalStore;
  }
  const defaultMeta: LayoutMeta = {
    id: 'layout_1',
    name: '基本レイアウト案',
    cmPerGrid: 10,
    updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
  const initStore: LocalStore = {
    layouts: [defaultMeta],
    plans: {
      [defaultMeta.id]: { layout: defaultMeta, plants: [], shapes: [] },
    },
  };
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initStore));
  return initStore;
}

export function fetchInitialState(): Promise<InitialLoadResult> {
  if (!isGasEnvironment()) {
    const store = readLocalStore();
    const first = store.layouts[0];
    return Promise.resolve({
      layouts: store.layouts,
      activeGarden: store.plans[first.id],
    });
  }

  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler((res: InitialLoadResult) => resolve(res))
      .withFailureHandler((err: Error) => reject(err))
      .getInitialGardenState();
  });
}

export function fetchLayoutById(layoutId: string): Promise<GardenPayload> {
  if (!isGasEnvironment()) {
    const store = readLocalStore();
    const plan = store.plans[layoutId];
    if (!plan) return Promise.reject(new Error('レイアウトが見つかりません'));
    return Promise.resolve(plan);
  }

  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler((res: GardenPayload) => resolve(res))
      .withFailureHandler((err: Error) => reject(err))
      .loadGardenLayout(layoutId);
  });
}

export function saveLayout(payload: GardenPayload): Promise<SaveResult> {
  if (!isGasEnvironment()) {
    const store = readLocalStore();
    const idx = store.layouts.findIndex((l) => l.id === payload.layout.id);
    if (idx === -1 && store.layouts.length >= MAX_LAYOUTS) {
      return Promise.reject(new Error(`保存できるレイアウト案は最大${MAX_LAYOUTS}個までです。`));
    }
    const savedMeta: LayoutMeta = {
      ...payload.layout,
      updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };
    if (idx >= 0) {
      store.layouts[idx] = savedMeta;
    } else {
      store.layouts.push(savedMeta);
    }
    store.plans[savedMeta.id] = { ...payload, layout: savedMeta };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));

    return Promise.resolve({
      status: 'ok',
      layouts: store.layouts,
      savedLayout: savedMeta,
      plantCount: payload.plants.length,
      shapeCount: payload.shapes.length,
    });
  }

  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler((res: SaveResult) => resolve(res))
      .withFailureHandler((err: Error) => reject(err))
      .saveGardenLayout(payload);
  });
}

export function removeLayout(layoutId: string): Promise<LayoutMeta[]> {
  if (!isGasEnvironment()) {
    const store = readLocalStore();
    if (store.layouts.length <= 1) {
      return Promise.reject(new Error('最後の1件は削除できません。'));
    }
    store.layouts = store.layouts.filter((l) => l.id !== layoutId);
    delete store.plans[layoutId];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
    return Promise.resolve(store.layouts);
  }

  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler((res: LayoutMeta[]) => resolve(res))
      .withFailureHandler((err: Error) => reject(err))
      .deleteGardenLayout(layoutId);
  });
}
