import { Injectable, inject } from '@angular/core';
import { Sheet, Cell, CellRenderer } from '../models/sheet.model';
import { StateService, HighlightState, MouseMode } from './state.service';
import { AnimationService } from './animation.service';
import { DataService } from './data.service';
import { getAccumulatedHeight, getAccumulatedWidth } from '../utils/sheet.utils';
interface ButtonHitArea {
  cellId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  onClick?: () => void;
}

@Injectable()
export class RenderService {
  private animationService = inject(AnimationService);
  private stateService = inject(StateService);
  private dataService = inject(DataService);
  private canvas?: HTMLCanvasElement;
  private scrollContainer?: HTMLElement;
  private buttonHitAreas: ButtonHitArea[] = [];
  private readonly styleSelectionBorder = '#3A714A';
  private readonly styleSelectionFill = '#00000020';
  private currentHoverPoint: { x: number; y: number } | null = null;
  private hoveredCellCoords: { row: number; col: number } | null = null;
  private dragHandleArea: { x: number; y: number; width: number; height: number } | null = null;

  getDragHandleArea() {
    return this.dragHandleArea;
  }
  // A nice translucent color for previews
  private readonly styleDragFillPreview = 'rgba(30, 144, 255, 0.2)'; // e.g. DodgerBlue, 20% opacity

  setCanvas(canvas: HTMLCanvasElement, scrollContainer: HTMLElement) {
    this.canvas = canvas;
    this.scrollContainer = scrollContainer;
  }

  setHoverPoint(point: { x: number; y: number } | null, cellCoords: { row: number; col: number } | null) {
    this.currentHoverPoint = point;
    this.hoveredCellCoords = cellCoords;
    this.requestRender();
  }
  requestRender(): void {
    if (!this.canvas || !this.scrollContainer) return;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    this.buttonHitAreas = [];

    const clipRegion = {
      left: this.scrollContainer.scrollLeft,
      right: this.scrollContainer.scrollLeft + this.scrollContainer.clientWidth,
      top: this.scrollContainer.scrollTop,
      bottom: this.scrollContainer.scrollTop + this.scrollContainer.clientHeight
    };

    // Clear the canvas
    // ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.drawSheet(ctx, clipRegion);
  }

  public checkButtonHit(x: number, y: number): (() => void) | undefined {
    // See if (x,y) is inside any of the known button hit areas
    for (const area of this.buttonHitAreas) {
      if (
        x >= area.x && x <= area.x + area.width &&
        y >= area.y && y <= area.y + area.height
      ) {
        return area.onClick;
      }
    }
    return undefined;
  }

  private drawSheet(
    ctx: CanvasRenderingContext2D,
    clipRegion: { left: number; right: number; top: number; bottom: number }
  ): void {
    const sheet = this.dataService.getSheetData();
    if (!sheet) return;

    // Update canvas size if resizing
    if (
      this.stateService.mouseMode === MouseMode.RESIZING_COLUMN ||
      this.stateService.mouseMode === MouseMode.RESIZING_ROW
    ) {
      this.updateCanvasSize(ctx.canvas, sheet);
    }

    // Actually draw all cells
    this.drawCells(ctx, sheet, clipRegion);

    // Draw normal selection highlight
    this.drawHighlight(ctx, sheet, clipRegion, this.stateService.selection, false);

    // If copying, show marching ants
    if (this.stateService.showMarchingAnts) {
      this.drawHighlight(ctx, sheet, clipRegion, this.stateService.copyHighlight, true);
    }

    // HERE is the key: draw the drag-fill preview if user is dragging
    const dragFillState = this.stateService.getDragFillState();
    if (
      this.stateService.mouseMode === MouseMode.DRAG_FILL &&
      dragFillState.isDragging &&
      dragFillState.previewStart &&
      dragFillState.previewEnd
    ) {
      this.drawDragFillPreview(
        ctx,
        sheet,
        clipRegion,
        dragFillState.previewStart,
        dragFillState.previewEnd
      );
    }
  }

  private updateCanvasSize(canvas: HTMLCanvasElement, sheet: Sheet): void {
    if (!sheet) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate total dimensions based on current column widths & row heights
    let totalWidth = sheet.columns.reduce((sum, col) => sum + col.width, 0);
    let totalHeight = sheet.rows.reduce((sum, row) => sum + row.height, 0);

    // We no longer add extra space for row/column headers, 
    // because they’re just part of the grid now.

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;

    // Only update if size changed
    const currentWidth = canvas.width / dpr;
    const currentHeight = canvas.height / dpr;

    if (currentWidth !== totalWidth || currentHeight !== totalHeight) {
      canvas.width = totalWidth * dpr;
      canvas.height = totalHeight * dpr;
      canvas.style.width = `${totalWidth}px`;
      canvas.style.height = `${totalHeight}px`;
      ctx.scale(dpr, dpr);
    }
  }


  private drawCells(
    ctx: CanvasRenderingContext2D,
    sheet: Sheet,
    clipRegion: { left: number; right: number; top: number; bottom: number }
  ): void {
    let yOffset = 0;
    sheet.rows.forEach((row, rowIndex) => {
      const rowTop = yOffset;
      const rowBottom = rowTop + row.height;
      if (rowBottom < clipRegion.top || rowTop > clipRegion.bottom) {
        yOffset += row.height;
        return; // skip
      }

      let xOffset = 0;
      sheet.columns.forEach((col, colIndex) => {
        const colLeft = xOffset;
        const colRight = colLeft + col.width;
        if (colRight < clipRegion.left || colLeft > clipRegion.right) {
          xOffset += col.width;
          return; // skip
        }

        // Actually draw the cell
        const cell = sheet.cells[rowIndex][colIndex];
        const returnedHitArea = this.drawCell(ctx, cell, colLeft, rowTop, col.width, row.height);

        // If there’s a custom button area, store it
        if (returnedHitArea) {
          // Adjust for scrolling:
          //   The renderer draws at (colLeft, rowTop) in *canvas space*,
          //   but the user’s mouse event offsets are also in *canvas space*.
          //   So we do NOT subtract scroll amounts here; we keep raw canvas coords.
          this.buttonHitAreas.push({
            cellId: returnedHitArea.cellId,
            x: returnedHitArea.hitArea.x,
            y: returnedHitArea.hitArea.y,
            width: returnedHitArea.hitArea.width,
            height: returnedHitArea.hitArea.height,
            onClick: returnedHitArea.onClick
          });
        }

        xOffset += col.width;
      });

      yOffset += row.height;
    });
  }

  /**
   * Draws a single cell, optionally using a customRenderer.
   * Returns a `hitArea` object if the renderer provides one.
   */
  private drawCell(
    ctx: CanvasRenderingContext2D,
    cell: Cell,
    x: number,
    y: number,
    width: number,
    height: number
  ): { cellId: string; hitArea: { x: number; y: number; width: number; height: number }; onClick?: () => void } | undefined {
    if (cell.customRenderer) {

      let hoverPoint;
      const currentRow = cell.rowIndex ?? -1;
      const currentCol = cell.columnIndex ?? -1;

      if (this.currentHoverPoint &&
        this.hoveredCellCoords &&
        (currentRow === this.hoveredCellCoords.row &&
          currentCol === this.hoveredCellCoords.col ||
          // Fallback: if cell doesn't have position info, use current hover point
          (currentRow === -1 && currentCol === -1))) {
        // Transform the hover point to be relative to the cell's top-left corner

        hoverPoint = {
          x: this.currentHoverPoint.x,
          y: this.currentHoverPoint.y
        };
      }

      const renderContext = {
        value: cell.value,
        width,
        height,
        x,
        y,
        ctx,
        styles: cell.styles,
        isSelected: this.isCellSelected(cell),
        isFocused: cell.isFocused,
        hoverPoint
      };

      ctx.save();
      const result = cell.customRenderer(renderContext);
      ctx.restore();
      return result as any; // Assume it returns { cellId, hitArea, onClick }
    } else {
      // Default canvas-based rendering
      ctx.fillStyle = cell.styles.backgroundColor;
      ctx.fillRect(x, y, width, height);

      // Draw grid lines with a lighter color
      ctx.strokeStyle = '#e0e0e0';
      ctx.beginPath();
      ctx.moveTo(x + width, y);
      ctx.lineTo(x + width, y + height);
      ctx.moveTo(x, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.stroke();

      ctx.fillStyle = cell.styles.color;
      ctx.font = `${cell.styles.fontSize} ${cell.styles.fontFamily}`;
      const fontSizeNum = parseInt(cell.styles.fontSize.replace('px', ''), 10) || 12;
      const textY = y + Math.floor(height / 2 + fontSizeNum / 2) - 2;
      ctx.fillText(
        cell.value?.toString() ?? '',
        x + this.stateService.defaultCellPaddingLeft,
        textY
      );
      return undefined;
    }
  }

  private isCellSelected(cell: Cell): boolean {
    if (cell.rowIndex == null || cell.columnIndex == null) return false;
    const { start, end } = this.stateService.selection;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    return (
      cell.rowIndex >= minRow &&
      cell.rowIndex <= maxRow &&
      cell.columnIndex >= minCol &&
      cell.columnIndex <= maxCol
    );
  }

  // =============================================
  // NEW METHOD: drawDragFillPreview
  // =============================================
  private drawDragFillPreview(
    ctx: CanvasRenderingContext2D,
    sheet: Sheet,
    clipRegion: { left: number; right: number; top: number; bottom: number },
    previewStart: { row: number; col: number },
    previewEnd: { row: number; col: number }
  ): void {
    // This is basically the same as drawHighlight, but with a different fill style
    const startRow = Math.min(previewStart.row, previewEnd.row);
    const endRow = Math.max(previewStart.row, previewEnd.row);
    const startCol = Math.min(previewStart.col, previewEnd.col);
    const endCol = Math.max(previewStart.col, previewEnd.col);

    const highlightY = getAccumulatedHeight(sheet.rows, startRow);
    const highlightX = getAccumulatedWidth(sheet.columns, startCol);

    // The total height/width of the preview region
    const highlightHeight = getAccumulatedHeight(
      sheet.rows.slice(startRow, endRow + 1),
      endRow - startRow + 1
    );
    const highlightWidth = getAccumulatedWidth(
      sheet.columns.slice(startCol, endCol + 1),
      endCol - startCol + 1
    );

    const selRight = highlightX + highlightWidth;
    const selBottom = highlightY + highlightHeight;

    // Skip rendering if completely out of the visible region
    if (
      selRight <= clipRegion.left ||
      highlightX >= clipRegion.right ||
      selBottom <= clipRegion.top ||
      highlightY >= clipRegion.bottom
    ) {
      return;
    }

    // Draw a translucent fill for the drag area
    ctx.fillStyle = this.styleDragFillPreview;
    ctx.fillRect(highlightX, highlightY, highlightWidth, highlightHeight);

    // Optional: draw a dashed border or something distinct
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = '#1E90FF'; // DodgerBlue
    ctx.lineWidth = 1.5;
    ctx.strokeRect(highlightX, highlightY, highlightWidth, highlightHeight);

    // Reset dash
    ctx.setLineDash([]);
  }
  private drawHighlight(
    ctx: CanvasRenderingContext2D,
    sheet: Sheet,
    clipRegion: { left: number; right: number; top: number; bottom: number },
    highlight: HighlightState,
    showMarchingAnts: boolean
  ): void {
    if (highlight.start.row < 0) return;

    const startRow = Math.min(highlight.start.row, highlight.end.row);
    const endRow = Math.max(highlight.start.row, highlight.end.row);
    const startCol = Math.min(highlight.start.col, highlight.end.col);
    const endCol = Math.max(highlight.start.col, highlight.end.col);

    const highlightY = getAccumulatedHeight(sheet.rows, startRow);
    const highlightX = getAccumulatedWidth(sheet.columns, startCol);

    const highlightHeight = getAccumulatedHeight(
      sheet.rows.slice(startRow, endRow + 1),
      endRow - startRow + 1
    );
    const highlightWidth = getAccumulatedWidth(
      sheet.columns.slice(startCol, endCol + 1),
      endCol - startCol + 1
    );

    const selRight = highlightX + highlightWidth;
    const selBottom = highlightY + highlightHeight;

    // Skip if highlight is outside visible region
    if (
      selRight <= clipRegion.left ||
      highlightX >= clipRegion.right ||
      selBottom <= clipRegion.top ||
      highlightY >= clipRegion.bottom
    ) {
      return;
    }

    // Fill highlight background
    ctx.setLineDash([]);
    ctx.fillStyle = this.styleSelectionFill;
    ctx.fillRect(highlightX, highlightY, highlightWidth, highlightHeight);

    // Draw highlight border
    if (showMarchingAnts) {
      ctx.setLineDash([4, 2]);
      ctx.lineDashOffset = this.animationService.getDashOffset(); // Use the animated offset
      ctx.strokeStyle = this.styleSelectionBorder;
      ctx.lineWidth = 1.5;
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = this.styleSelectionBorder;
      ctx.lineWidth = 2;
    }

    ctx.strokeRect(highlightX, highlightY, highlightWidth, highlightHeight);
    ctx.setLineDash([]);

    // Draw drag handle if not showing marching ants
    if (!showMarchingAnts) {
      const handleRadius = 4;
      const handleX = highlightX + highlightWidth;
      const handleY = highlightY + highlightHeight;

      ctx.beginPath();
      ctx.arc(handleX, handleY, handleRadius, 0, Math.PI * 2);
      ctx.fillStyle = this.stateService.isDragHandleHovered ? '#2196F3' : '#3A714A';
      ctx.fill();

      // Store handle position for hit testing
      this.dragHandleArea = {
        x: handleX - handleRadius,
        y: handleY - handleRadius,
        width: handleRadius * 2,
        height: handleRadius * 2
      };
    }
  }

  initCanvasSize(canvas: HTMLCanvasElement, sheet: Sheet): void {
    if (!sheet) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let totalWidth = sheet.columns.reduce((sum, col) => sum + col.width, 0);
    let totalHeight = sheet.rows.reduce((sum, row) => sum + row.height, 0);

    // No extra space for headers — they're in the grid now.

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;

    // Set the canvas size in pixels
    canvas.width = totalWidth * dpr;
    canvas.height = totalHeight * dpr;

    // Set the display size in CSS pixels
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${totalHeight}px`;

    // Scale the context to handle high DPI screens
    ctx.scale(dpr, dpr);

    // Immediately draw after initializing size
    this.drawSheet(ctx, {
      left: 0,
      right: totalWidth,
      top: 0,
      bottom: totalHeight
    });
  }

  public getLastHitArea(x: number, y: number): ButtonHitArea | undefined {
    return this.buttonHitAreas.find(area =>
      x >= area.x &&
      x <= area.x + area.width &&
      y >= area.y &&
      y <= area.y + area.height
    );
  }
}
