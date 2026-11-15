import type { GardenPayload, SaveResult } from '../shared/types';

const LOCAL_STORAGE_KEY = 'garden_planner_dev_data';

function isGasEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof window.google?.script?.run !== 'undefined';
}

export function fetchGardenData(): Promise<GardenPayload> {
  if (!isGasEnvironment()) {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return Promise.resolve({ plants: [], shapes: [] });
    return Promise.resolve(JSON.parse(raw) as GardenPayload);
  }

  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler((res: GardenPayload) => resolve(res))
      .withFailureHandler((err: Error) => reject(err))
      .getAllGardenData();
  });
}

export function saveGardenData(payload: GardenPayload): Promise<SaveResult> {
  if (!isGasEnvironment()) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    return Promise.resolve({
      status: 'ok',
      plantCount: payload.plants.length,
      shapeCount: payload.shapes.length,
    });
  }

  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler((res: SaveResult) => resolve(res))
      .withFailureHandler((err: Error) => reject(err))
      .saveAllGardenData(payload);
  });
}
