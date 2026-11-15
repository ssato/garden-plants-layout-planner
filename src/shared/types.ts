export type PlantType = '多年草' | '一年草' | '球根' | '低木・樹木' | '種まき';

export interface PlantData {
  id: string;
  x: number;
  y: number;
  radius: number;
  species: string;
  name: string;
  label: string;
  type: PlantType;
  height: string;
  flowering: string;
  plantedDate: string;
  memo: string;
}

export interface RectShapeData {
  id: string;
  type: 'rect';
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FreehandShapeData {
  id: string;
  type: 'freehand';
  color: string;
  points: number[];
}

export type ShapeData = RectShapeData | FreehandShapeData;

export interface LayoutMeta {
  id: string;
  name: string;
  cmPerGrid: number;
  updatedAt: string;
}

export interface GardenPayload {
  layout: LayoutMeta;
  plants: PlantData[];
  shapes: ShapeData[];
}

export interface InitialLoadResult {
  layouts: LayoutMeta[];
  activeGarden: GardenPayload;
}

export interface SaveResult {
  status: 'ok';
  layouts: LayoutMeta[];
  savedLayout: LayoutMeta;
  plantCount: number;
  shapeCount: number;
}
