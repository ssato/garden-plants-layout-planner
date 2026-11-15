import Konva from 'konva';
import type { PlantData, PlantType, ShapeData } from '../shared/types';

export type DrawMode = 'select' | 'rect' | 'freehand';

export interface CanvasCallbacks {
  onPlantSelect: (plant: PlantData) => void;
  onDataChange: () => void;
  onHudUpdate: (text: string) => void;
}

const TYPE_COLORS: Record<PlantType, string> = {
  '多年草': 'rgba(76, 175, 80, 0.55)',
  '一年草': 'rgba(255, 193, 7, 0.55)',
  '球根': 'rgba(156, 39, 176, 0.50)',
  '低木・樹木': 'rgba(121, 85, 72, 0.55)',
  '種まき': 'rgba(3, 169, 244, 0.50)',
};

export class GardenCanvasManager {
  public readonly stageWidth = 900;
  public readonly stageHeight = 600;
  public readonly gridSize = 30;

  private stage: Konva.Stage;
  private gridLayer: Konva.Layer;
  private shapeLayer: Konva.Layer;
  private plantLayer: Konva.Layer;
  private transformer: Konva.Transformer;

  private mode: DrawMode = 'select';
  private snapEnabled = true;
  private cmPerGrid = 10;
  private strokeColor = '#795548';

  private isDrawing = false;
  private drawStartPos: { x: number; y: number } | null = null;
  private currentDrawingNode: Konva.Rect | Konva.Line | null = null;

  private plants: PlantData[] = [];
  private shapes: ShapeData[] = [];
  private callbacks: CanvasCallbacks;

  constructor(containerId: string, callbacks: CanvasCallbacks) {
    this.callbacks = callbacks;

    this.stage = new Konva.Stage({
      container: containerId,
      width: this.stageWidth,
      height: this.stageHeight,
    });

    this.gridLayer = new Konva.Layer();
    this.shapeLayer = new Konva.Layer();
    this.plantLayer = new Konva.Layer();

    this.stage.add(this.gridLayer);
    this.stage.add(this.shapeLayer);
    this.stage.add(this.plantLayer);

    this.transformer = new Konva.Transformer({
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      rotateEnabled: false,
      keepRatio: true,
      boundBoxFunc: (oldBox, newBox) => {
        if (newBox.width < 15 || newBox.height < 15) return oldBox;
        if (this.snapEnabled) {
          const snappedSize = this.snapValue(newBox.width, this.gridSize);
          if (snappedSize < this.gridSize) return oldBox;
          const diff = snappedSize - newBox.width;
          return {
            ...newBox,
            x: newBox.x - diff / 2,
            y: newBox.y - diff / 2,
            width: snappedSize,
            height: snappedSize,
          };
        }
        return newBox;
      },
    });
    this.plantLayer.add(this.transformer);

    this.drawGrid();
    this.bindStageEvents();
    this.updateDefaultHud();
  }

  public setData(plants: PlantData[], shapes: ShapeData[]): void {
    this.plants = plants;
    this.shapes = shapes;
    this.renderShapes();
    this.renderPlants();
    this.updateDefaultHud();
  }

  public getData(): { plants: PlantData[]; shapes: ShapeData[] } {
    return { plants: this.plants, shapes: this.shapes };
  }

  public getCmPerGrid(): number {
    return this.cmPerGrid;
  }

  public setMode(mode: DrawMode): void {
    this.mode = mode;
    this.transformer.nodes([]);
    const container = this.stage.container();

    if (mode === 'select') {
      container.style.cursor = 'default';
      this.plantLayer.listening(true);
      this.updateDefaultHud();
    } else {
      container.style.cursor = 'crosshair';
      this.plantLayer.listening(false);
      this.callbacks.onHudUpdate(
        mode === 'rect'
          ? '矩形モード: キャンバスをドラッグして枠を描画'
          : 'フリーハンドモード: ドラッグして自由に描画'
      );
    }
    this.plantLayer.draw();
  }

  public setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled;
  }

  public setCmPerGrid(cm: number): void {
    this.cmPerGrid = cm > 0 ? cm : 10;
    this.renderPlants();
    this.updateDefaultHud();
  }

  public setStrokeColor(color: string): void {
    this.strokeColor = color;
  }

  public pxToCm(px: number): number {
    return Math.round((px / this.gridSize) * this.cmPerGrid * 10) / 10;
  }

  private snapValue(val: number, step: number): number {
    return Math.round(val / step) * step;
  }

  public updateDefaultHud(): void {
    const w = this.pxToCm(this.stageWidth);
    const h = this.pxToCm(this.stageHeight);
    this.callbacks.onHudUpdate(`1マス = ${this.cmPerGrid}cm（全体: ${w}cm × ${h}cm）`);
  }

  public updatePlantHud(plant: PlantData): void {
    const xCm = this.pxToCm(plant.x);
    const yCm = this.pxToCm(plant.y);
    const diameterCm = this.pxToCm(plant.radius * 2);
    const title = plant.label || plant.name || plant.species || '選択中';
    this.callbacks.onHudUpdate(`${title} ｜ 位置: (${xCm}cm, ${yCm}cm) ｜ 株張り: ${diameterCm}cm`);
  }

  private drawGrid(): void {
    for (let x = 0; x <= this.stageWidth; x += this.gridSize) {
      this.gridLayer.add(
        new Konva.Line({
          points: [x, 0, x, this.stageHeight],
          stroke: x % (this.gridSize * 5) === 0 ? '#aaa' : '#e5e5e5',
          strokeWidth: 1,
        })
      );
    }
    for (let y = 0; y <= this.stageHeight; y += this.gridSize) {
      this.gridLayer.add(
        new Konva.Line({
          points: [0, y, this.stageWidth, y],
          stroke: y % (this.gridSize * 5) === 0 ? '#aaa' : '#e5e5e5',
          strokeWidth: 1,
        })
      );
    }
    this.gridLayer.draw();
  }

  private bindStageEvents(): void {
    this.stage.on('mousedown touchstart', (e) => {
      if (this.mode === 'select') {
        if (e.target === this.stage) {
          this.transformer.nodes([]);
          this.updateDefaultHud();
        }
        return;
      }

      const pos = this.stage.getPointerPosition();
      if (!pos) return;

      this.isDrawing = true;

      if (this.mode === 'rect') {
        const startX = this.snapEnabled ? this.snapValue(pos.x, this.gridSize) : pos.x;
        const startY = this.snapEnabled ? this.snapValue(pos.y, this.gridSize) : pos.y;
        this.drawStartPos = { x: startX, y: startY };

        this.currentDrawingNode = new Konva.Rect({
          x: startX,
          y: startY,
          width: 0,
          height: 0,
          stroke: this.strokeColor,
          strokeWidth: 3,
          fill: this.strokeColor + '18',
        });
        this.shapeLayer.add(this.currentDrawingNode);
      } else if (this.mode === 'freehand') {
        this.currentDrawingNode = new Konva.Line({
          points: [pos.x, pos.y],
          stroke: this.strokeColor,
          strokeWidth: 3,
          lineCap: 'round',
          lineJoin: 'round',
          tension: 0.3,
        });
        this.shapeLayer.add(this.currentDrawingNode);
      }
    });

    this.stage.on('mousemove touchmove', () => {
      if (!this.isDrawing || !this.currentDrawingNode) return;
      const pos = this.stage.getPointerPosition();
      if (!pos) return;

      if (this.mode === 'rect' && this.drawStartPos && this.currentDrawingNode instanceof Konva.Rect) {
        const curX = this.snapEnabled ? this.snapValue(pos.x, this.gridSize) : pos.x;
        const curY = this.snapEnabled ? this.snapValue(pos.y, this.gridSize) : pos.y;

        const x = Math.min(this.drawStartPos.x, curX);
        const y = Math.min(this.drawStartPos.y, curY);
        const width = Math.abs(curX - this.drawStartPos.x);
        const height = Math.abs(curY - this.drawStartPos.y);

        this.currentDrawingNode.x(x);
        this.currentDrawingNode.y(y);
        this.currentDrawingNode.width(width);
        this.currentDrawingNode.height(height);

        this.callbacks.onHudUpdate(
          `矩形サイズ: 幅 ${this.pxToCm(width)}cm × 高さ ${this.pxToCm(height)}cm`
        );
      } else if (this.mode === 'freehand' && this.currentDrawingNode instanceof Konva.Line) {
        const newPoints = this.currentDrawingNode.points().concat([pos.x, pos.y]);
        this.currentDrawingNode.points(newPoints);
      }

      this.shapeLayer.batchDraw();
    });

    this.stage.on('mouseup touchend', () => {
      if (!this.isDrawing || !this.currentDrawingNode) return;
      this.isDrawing = false;

      if (this.mode === 'rect' && this.currentDrawingNode instanceof Konva.Rect) {
        const w = this.currentDrawingNode.width();
        const h = this.currentDrawingNode.height();
        if (w >= 5 && h >= 5) {
          this.shapes.push({
            id: 's_' + Date.now(),
            type: 'rect',
            color: this.strokeColor,
            x: Math.round(this.currentDrawingNode.x()),
            y: Math.round(this.currentDrawingNode.y()),
            width: Math.round(w),
            height: Math.round(h),
          });
          this.callbacks.onDataChange();
        } else {
          this.currentDrawingNode.destroy();
        }
      } else if (this.mode === 'freehand' && this.currentDrawingNode instanceof Konva.Line) {
        const pts = this.currentDrawingNode.points().map((v) => Math.round(v));
        if (pts.length >= 4) {
          this.shapes.push({
            id: 's_' + Date.now(),
            type: 'freehand',
            color: this.strokeColor,
            points: pts,
          });
          this.callbacks.onDataChange();
        } else {
          this.currentDrawingNode.destroy();
        }
      }

      this.currentDrawingNode = null;
      this.shapeLayer.draw();
      this.updateDefaultHud();
    });
  }

  public renderShapes(): void {
    this.shapeLayer.destroyChildren();

    this.shapes.forEach((shape) => {
      if (shape.type === 'rect') {
        this.shapeLayer.add(
          new Konva.Rect({
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            stroke: shape.color || '#795548',
            strokeWidth: 3,
            fill: (shape.color || '#795548') + '18',
          })
        );
      } else if (shape.type === 'freehand') {
        this.shapeLayer.add(
          new Konva.Line({
            points: shape.points,
            stroke: shape.color || '#795548',
            strokeWidth: 3,
            lineCap: 'round',
            lineJoin: 'round',
            tension: 0.3,
          })
        );
      }
    });

    this.shapeLayer.draw();
  }

  public renderPlants(): void {
    this.plantLayer.find('.plant-group').forEach((node) => node.destroy());
    this.transformer.nodes([]);

    this.plants.forEach((plant) => {
      const group = new Konva.Group({
        x: plant.x,
        y: plant.y,
        draggable: true,
        name: 'plant-group',
        id: plant.id,
      });

      const circle = new Konva.Circle({
        radius: plant.radius,
        fill: TYPE_COLORS[plant.type] || TYPE_COLORS['多年草'],
        stroke: '#2e7d32',
        strokeWidth: 2,
      });

      const displayText = plant.label || plant.name || plant.species || '未設定';
      const label = new Konva.Text({
        text: displayText,
        fontSize: 12,
        fontStyle: 'bold',
        fill: '#1b1b1b',
        width: plant.radius * 2,
        offsetX: plant.radius,
        offsetY: 12,
        align: 'center',
      });

      const sizeText = new Konva.Text({
        text: `φ${this.pxToCm(plant.radius * 2)}cm`,
        fontSize: 10,
        fill: '#333',
        width: plant.radius * 2,
        offsetX: plant.radius,
        offsetY: -3,
        align: 'center',
      });

      group.add(circle);
      group.add(label);
      group.add(sizeText);

      group.on('dragmove', () => {
        if (this.snapEnabled) {
          group.x(this.snapValue(group.x(), this.gridSize));
          group.y(this.snapValue(group.y(), this.gridSize));
        }
        this.updatePlantHud({ ...plant, x: group.x(), y: group.y() });
      });

      group.on('dragend', () => {
        plant.x = group.x();
        plant.y = group.y();
        this.updatePlantHud(plant);
        this.callbacks.onDataChange();
      });

      group.on('transform', () => {
        const currentRadius = Math.round(plant.radius * group.scaleX());
        this.updatePlantHud({ ...plant, x: group.x(), y: group.y(), radius: currentRadius });
      });

      group.on('transformend', () => {
        const scale = group.scaleX();
        plant.radius = Math.max(10, Math.round(plant.radius * scale));
        if (this.snapEnabled) {
          group.x(this.snapValue(group.x(), this.gridSize / 2));
          group.y(this.snapValue(group.y(), this.gridSize / 2));
        }
        plant.x = group.x();
        plant.y = group.y();

        group.scaleX(1);
        group.scaleY(1);
        circle.radius(plant.radius);
        label.width(plant.radius * 2);
        label.offsetX(plant.radius);
        sizeText.width(plant.radius * 2);
        sizeText.offsetX(plant.radius);
        sizeText.text(`φ${this.pxToCm(plant.radius * 2)}cm`);

        this.updatePlantHud(plant);
        this.callbacks.onDataChange();
      });

      let isDragging = false;
      group.on('dragstart', () => {
        isDragging = true;
        this.transformer.nodes([group]);
      });

      group.on('click tap', (e) => {
        if (this.mode !== 'select') return;
        e.cancelBubble = true;
        this.transformer.nodes([group]);
        this.updatePlantHud(plant);
        if (!isDragging) {
          this.callbacks.onPlantSelect(plant);
        }
        isDragging = false;
      });

      this.plantLayer.add(group);
    });

    this.transformer.moveToTop();
    this.plantLayer.draw();
  }

  public addPlant(plant: PlantData): void {
    this.plants.push(plant);
    this.renderPlants();
    this.updatePlantHud(plant);
    this.callbacks.onDataChange();
  }

  public removePlant(id: string): void {
    this.plants = this.plants.filter((p) => p.id !== id);
    this.renderPlants();
    this.updateDefaultHud();
    this.callbacks.onDataChange();
  }

  public undoLastShape(): void {
    if (this.shapes.length === 0) return;
    this.shapes.pop();
    this.renderShapes();
    this.callbacks.onDataChange();
  }

  public clearAllShapes(): void {
    this.shapes = [];
    this.renderShapes();
    this.callbacks.onDataChange();
  }
}
