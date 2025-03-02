
import { Injectable, inject, ElementRef } from '@angular/core';
import { Sheet } from '../models/sheet.model';
import { StateService, MouseMode } from './state.service';
import { ClipboardService } from './clipboard.service';
import { RenderService } from './render.service';
import { getAccumulatedHeight, getAccumulatedWidth } from '../utils/sheet.utils';
import { DataService } from './data.service';
import { UndoRedoService } from './undo-redo.service';

@Injectable()
export class EventService {
  private stateService = inject(StateService);
  private clipboardService = inject(ClipboardService);
  private dataService = inject(DataService);
  private renderService = inject(RenderService);
  private undoRedoService = inject(UndoRedoService);

  private boundaryThreshold = 3;
  private currentCursorStyle = 'default';

  onMouseDown(event: MouseEvent, sheet: Sheet): void {
    this.stateService.updateContextMenuState({ visible: false });
    if (!sheet) return;
    if (this.stateService.isDragHandleHovered) {
      this.stateService.setMouseMode(MouseMode.DRAG_FILL);
      this.stateService.updateDragFillState({
        isDragging: true,
        previewStart: this.stateService.selection.start,
        previewEnd: this.stateService.selection.end
      });
      event.preventDefault();
      return;
    }

    // 1) Check if user clicked a button
    const onClick = this.renderService.checkButtonHit(event.offsetX, event.offsetY);
    if (onClick) {
      // If so, call the button’s handler
      onClick();
      // We can forcibly re-render if needed:
      this.renderService.requestRender();
      return;
    }

    // 2) Otherwise, normal logic (resize detection, cell selection, etc.)
    if (this.currentCursorStyle === 'col-resize') {
      const colIndex = this.getColumnBoundaryIndex(event, sheet);
      if (colIndex !== -1) {
        this.stateService.updateInputState({ disabled: true });
        this.stateService.setMouseMode(MouseMode.RESIZING_COLUMN);
        this.stateService.updateResizeState({
          resizingColumnIndex: colIndex,
          originalSize: sheet.columns[colIndex].width,
          startPointerPos: event.clientX
        });
        return;
      }
    } else if (this.currentCursorStyle === 'row-resize') {
      const rowIndex = this.getRowBoundaryIndex(event, sheet);
      if (rowIndex !== -1) {
        this.stateService.updateInputState({ disabled: true });
        this.stateService.setMouseMode(MouseMode.RESIZING_ROW);
        this.stateService.updateResizeState({
          resizingRowIndex: rowIndex,
          originalSize: sheet.rows[rowIndex].height,
          startPointerPos: event.clientY
        });
        return;
      }
    } else {

      this.stateService.setMouseMode(MouseMode.SELECTING_CELLS);

      const offsetX = event.offsetX;
      const offsetY = event.offsetY;

      // Convert offsetX/Y into cell row/col
      const { rowIndex, colIndex } = this.getCellFromOffset(offsetX, offsetY, sheet);

      // Safeguard in case user clicks outside total grid area
      if (rowIndex < 0 || colIndex < 0) return;
      if (rowIndex >= sheet.rows.length || colIndex >= sheet.columns.length) return;

      // Update active cell and selection
      this.stateService.updateActiveCell(sheet.cells[rowIndex][colIndex]);
      this.stateService.updateSelection({
        start: { row: rowIndex, col: colIndex },
        end: { row: rowIndex, col: colIndex }
      });

      // Position input box
      const cellValue = sheet.cells[rowIndex][colIndex].value?.toString() ?? '';
      this.stateService.positionInputAt(rowIndex, colIndex, sheet);
      this.stateService.updateInputState({ value: cellValue });
    }
  }

  public onMouseMove(event: MouseEvent, sheet: Sheet): void {
    if (!sheet) return;

    // Check for drag handle hover first
    if (this.stateService.mouseMode === MouseMode.DEFAULT) {
      const handleArea = this.renderService.getDragHandleArea();
      if (handleArea) {
        const isHovered =
          event.offsetX >= handleArea.x &&
          event.offsetX <= handleArea.x + handleArea.width &&
          event.offsetY >= handleArea.y &&
          event.offsetY <= handleArea.y + handleArea.height;

        this.stateService.updateDragFillState({ isDragHandleHovered: isHovered });
        if (isHovered) {
          document.body.style.cursor = 'crosshair';
          return;
        }
      }
    }

    // Handle drag fill operation
    if (this.stateService.mouseMode === MouseMode.DRAG_FILL) {
      const { rowIndex, colIndex } = this.getCellFromOffset(event.offsetX, event.offsetY, sheet);
      if (rowIndex >= 0 && colIndex >= 0) {
        this.stateService.updateDragFillState({
          previewEnd: { row: rowIndex, col: colIndex }
        });
        this.renderService.requestRender();
      }
      return;
    }

    const { rowIndex, colIndex } = this.getCellFromOffset(event.offsetX, event.offsetY, sheet);

    // Update hover state in render service
    if (rowIndex >= 0 && colIndex >= 0 &&
      rowIndex < sheet.rows.length && colIndex < sheet.columns.length) {
      const x = event.offsetX - getAccumulatedWidth(sheet.columns, colIndex);
      const y = event.offsetY - getAccumulatedHeight(sheet.rows, rowIndex);
      this.renderService.setHoverPoint(
        { x: x, y: y },
        { row: rowIndex, col: colIndex }
      );
    } else {
      this.renderService.setHoverPoint(null, null);
    }

    // If we're in the middle of resizing, handle that
    if (
      this.stateService.mouseMode === MouseMode.RESIZING_COLUMN ||
      this.stateService.mouseMode === MouseMode.RESIZING_ROW
    ) {
      this.handleResizeDrag(event, sheet);
      return;
    }

    // If we're selecting cells with mouse down, handle that
    if (this.stateService.mouseMode === MouseMode.SELECTING_CELLS && event.buttons === 1) {
      const offsetX = event.offsetX;
      const offsetY = event.offsetY;

      const cellPos = this.getCellFromOffset(offsetX, offsetY, sheet);
      if (cellPos.rowIndex < 0 || cellPos.colIndex < 0) return;
      if (cellPos.rowIndex >= sheet.rows.length || cellPos.colIndex >= sheet.columns.length) return;

      this.stateService.updateSelection({
        end: { row: cellPos.rowIndex, col: cellPos.colIndex }
      });
      return;
    }

    // Check for resize boundaries only if not currently in a drag operation
    if (event.buttons === 0) {
      const colIndex = this.getColumnBoundaryIndex(event, sheet);
      const rowIndex = this.getRowBoundaryIndex(event, sheet);
      const isInTopHeaderRow = this.isInTopHeaderRow(event, sheet);
      const isInLeftHeaderCol = this.isInLeftHeaderCol(event, sheet);

      // Set appropriate cursor based on position
      if (colIndex !== -1 && isInTopHeaderRow) {
        this.currentCursorStyle = 'col-resize';
        document.body.style.cursor = 'col-resize';
      } else if (rowIndex !== -1 && isInLeftHeaderCol) {
        this.currentCursorStyle = 'row-resize';
        document.body.style.cursor = 'row-resize';
      } else if (!this.stateService.isDragHandleHovered) {
        // Only reset to default if we're not hovering over the drag handle
        this.currentCursorStyle = 'default';
        document.body.style.cursor = 'default';
      }
    }
  }

  onMouseUp(): void {
    if (this.stateService.mouseMode === MouseMode.DRAG_FILL) {
      const dragState = this.stateService.getDragFillState();
      if (dragState.previewStart && dragState.previewEnd) {
        // Use existing paste logic
        const sheet = this.dataService.getSheetData();
        if (sheet) {
          this.clipboardService.copySelection(sheet);
          this.clipboardService.paste(sheet, {
            start: dragState.previewStart,
            end: dragState.previewEnd
          });
        }
      }
      this.stateService.setMouseMode(MouseMode.DEFAULT);
      this.stateService.updateDragFillState({
        isDragging: false,
        previewStart: undefined,
        previewEnd: undefined
      });
      this.renderService.requestRender();
      return;
    }
  }

  onKeyDown(event: KeyboardEvent, sheet: Sheet): void {
    // Handle Escape key regardless of active cell
    if (event.key === 'Escape') {
      this.stateService.setMarchingAnts(false);
      this.stateService.updateCopyHighlight({
        start: { row: -1, col: -1 },
        end: { row: -1, col: -1 }
      });
      return;
    }

    // Check for Ctrl+Z
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      const undoneSheet = this.undoRedoService.undo();
      if (undoneSheet) {
        const cellValues = undoneSheet.cells.map(row => row.map(cell => cell.value));
        this.dataService.updateCellValues(0, 0, cellValues, false);
      }
      return;
    }

    // Ctrl+A or for Select All
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();

      if (!sheet) return;

      const lastRow = sheet.rows.length - 1;
      const lastCol = sheet.columns.length - 1;

      // Update the selection state to cover the entire grid
      this.stateService.updateSelection({
        start: { row: 0, col: 0 },
        end: { row: lastRow, col: lastCol }
      });

      // Optionally, clear the active cell or set it to the top-left
      // e.g. focus on top-left
      // this.stateService.updateActiveCell(sheet.cells[0][0]);

      // Request a re-render to show the highlight
      this.renderService.requestRender();
      return;
    }


    if (!sheet || !this.stateService.activeCell) return;

    const totalRows = sheet.rows.length;
    const totalCols = sheet.columns.length;


    if (event.key === 'Delete' && this.stateService.input.disabled) {
      const { start, end } = this.stateService.selection;
      const startRow = Math.min(start.row, end.row);
      const endRow = Math.max(start.row, end.row);
      const startCol = Math.min(start.col, end.col);
      const endCol = Math.max(start.col, end.col);

      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          this.dataService.updateCellValues(row, col, '');
        }
      }

      // Add these two lines:
      this.renderService.requestRender();
      this.dataService.emitSheetChanges(sheet);

      return;
    }

    // Handle copy/paste shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 'c':
          event.preventDefault();
          this.clipboardService.copySelection(sheet);
          return;
        case 'v':
          event.preventDefault();
          this.clipboardService.pasteSelection(sheet);
          return;
      }
    }

    // Get current selection
    const { row, col } = this.stateService.selection.start;
    const input = this.stateService.input;


    if (input.disabled) {
      // Check if it's a typing event (not a control key)
      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault(); // Prevent double input
        this.stateService.updateInputState({
          disabled: false,
          value: event.key
        });
        const inputElement = this.stateService.inputElement;
        if (inputElement) {
          inputElement.focus();
        }
        return;
      }

      // Handle arrow key navigation
      if (event.shiftKey) {
        this.handleShiftNavigation(event, sheet);
      } else {
        this.handleNavigation(event, sheet);
      }
    } else {
      // Handle edit mode keys
      this.handleEditModeKeys(event, sheet);
    }
  }

  // --- [RESIZE LOGIC] ---
  private handleResizeDrag(event: MouseEvent, sheet: Sheet): void {
    const resizeState = this.stateService.getResizeState();
    const mode = this.stateService.mouseMode;

    if (
      mode === MouseMode.RESIZING_COLUMN &&
      resizeState.resizingColumnIndex !== undefined
    ) {
      const colIndex = resizeState.resizingColumnIndex;
      const delta = event.clientX - (resizeState.startPointerPos ?? 0);
      const newWidth = (resizeState.originalSize ?? 0) + delta;

      if (newWidth > 10) {
        sheet.columns[colIndex].width = newWidth;

        // If the active cell is in that column, update input width
        const activeCell = this.stateService.activeCell;
        if (activeCell && activeCell.columnIndex === colIndex) {
          this.stateService.updateInputState({
            width: newWidth - 4
          });
        }
      }
    } else if (
      mode === MouseMode.RESIZING_ROW &&
      resizeState.resizingRowIndex !== undefined
    ) {
      const rowIndex = resizeState.resizingRowIndex;
      const delta = event.clientY - (resizeState.startPointerPos ?? 0);
      const newHeight = (resizeState.originalSize ?? 0) + delta;

      if (newHeight > 10) {
        sheet.rows[rowIndex].height = newHeight;

        // If the active cell is in that row, update input height
        const activeCell = this.stateService.activeCell;
        if (activeCell && activeCell.rowIndex === rowIndex) {
          this.stateService.updateInputState({
            height: newHeight - 4
          });
        }
      }
    }
  }

  public getColumnBoundaryIndex(event: MouseEvent, sheet: Sheet): number {
    // Return -1 if not near a boundary
    const offsetX = event.offsetX;
    if (offsetX < 0) return -1;

    let accumulatedWidth = 0;
    for (let i = 0; i < sheet.columns.length; i++) {
      const colWidth = sheet.columns[i].width;
      const leftEdge = accumulatedWidth;
      const rightEdge = accumulatedWidth + colWidth;

      // If within boundaryThreshold px of the left edge, resize prev column (if any)
      if (Math.abs(offsetX - leftEdge) < this.boundaryThreshold && i > 0) {
        return i - 1;
      }
      // If within boundaryThreshold px of the right edge, resize current column
      if (Math.abs(offsetX - rightEdge) < this.boundaryThreshold) {
        return i;
      }

      accumulatedWidth += colWidth;
      if (offsetX < rightEdge) break; // we found the column
    }

    return -1;
  }

  public getRowBoundaryIndex(event: MouseEvent, sheet: Sheet): number {
    // Return -1 if not near a boundary
    const offsetY = event.offsetY;
    if (offsetY < 0) return -1;

    let accumulatedHeight = 0;
    for (let i = 0; i < sheet.rows.length; i++) {
      const rowHeight = sheet.rows[i].height;
      const topEdge = accumulatedHeight;
      const bottomEdge = accumulatedHeight + rowHeight;

      // If within threshold of the top boundary, that means resize previous row
      if (Math.abs(offsetY - topEdge) < this.boundaryThreshold && i > 0) {
        return i - 1;
      }
      // If within threshold of the bottom boundary, that means resize current row
      if (Math.abs(offsetY - bottomEdge) < this.boundaryThreshold) {
        return i;
      }

      accumulatedHeight += rowHeight;
      if (offsetY < bottomEdge) break; // found the row
    }

    return -1;
  }

  private setCursorStyle(style: string) {
    if (this.currentCursorStyle !== style) {
      this.currentCursorStyle = style;
      document.body.style.cursor = style;
    }
  }

  public onDoubleClick(sheet: Sheet, sheetInput: ElementRef<HTMLInputElement>): void {
    if (this.stateService.isDragHandleHovered) {
      const { start, end } = this.stateService.selection;
      const startRow = Math.min(start.row, end.row);
      const endRow = Math.max(start.row, end.row);
      const startCol = Math.min(start.col, end.col);
      const endCol = Math.max(start.col, end.col);

      // Calculate last row in the sheet
      const lastRow = sheet.rows.length - 1;

      // Only proceed if we're not already at the last row
      if (endRow < lastRow) {
        // Original selection will be the source
        const originalRange = {
          start: { row: startRow, col: startCol },
          end: { row: endRow, col: endCol }
        };

        // Fill range goes from start of selection to last row
        const fillRange = {
          start: { row: startRow, col: startCol },
          end: { row: lastRow, col: endCol }
        };

        // Use the data service to perform the auto-fill
        this.dataService.autoFillSelection(sheet, originalRange, fillRange);

        // Update the selection to cover the filled area
        this.stateService.updateSelection({
          start: { row: startRow, col: startCol },
          end: { row: lastRow, col: endCol }
        });
      }
    } else {
      if (!this.stateService.activeCell) return;
      this.stateService.updateInputState({ disabled: false });
      sheetInput.nativeElement.focus();
    }
  }

  // --- [NAVIGATION LOGIC] ---
  private handleShiftNavigation(event: KeyboardEvent, sheet: Sheet): void {
    const { end } = this.stateService.selection;
    const totalRows = sheet.rows.length;
    const totalCols = sheet.columns.length;

    const newEnd = { ...end };

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        if (end.row > 0) newEnd.row--;
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (end.row < totalRows - 1) newEnd.row++;
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (end.col > 0) newEnd.col--;
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (end.col < totalCols - 1) newEnd.col++;
        break;
    }

    this.stateService.updateSelection({ end: newEnd });
  }

  private handleNavigation(event: KeyboardEvent, sheet: Sheet): void {
    const { start } = this.stateService.selection;
    const totalRows = sheet.rows.length;
    const totalCols = sheet.columns.length;

    const newPos = { ...start };

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        if (start.row > 0) newPos.row--;
        break;
      case 'ArrowDown':
      case 'Enter':
        event.preventDefault();
        if (start.row < totalRows - 1) newPos.row++;
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (start.col > 0) newPos.col--;
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (start.col < totalCols - 1) newPos.col++;
        break;
      default:
        return;
    }

    // Update selection, focus, and input position
    this.stateService.updateSelection({
      start: newPos,
      end: newPos
    });
    this.stateService.updateActiveCell(sheet.cells[newPos.row][newPos.col]);
    this.stateService.positionInputAt(newPos.row, newPos.col, sheet);
    this.stateService.updateInputState({
      value: sheet.cells[newPos.row][newPos.col].value?.toString() ?? ''
    });
  }

  private handleEditModeKeys(event: KeyboardEvent, sheet: Sheet): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const { start } = this.stateService.selection;
      // const currentCell = sheet.cells[start.row][start.col];

      // // Update cell with input's current value
      // currentCell.handleInput(this.stateService.input.value);

      this.dataService.updateCellValues(start.row, start.col, this.stateService.input.value);

      // Move down one row if possible
      const nextRow = start.row + 1;
      if (nextRow < sheet.rows.length) {
        this.stateService.updateSelection({
          start: { row: nextRow, col: start.col },
          end: { row: nextRow, col: start.col }
        });
        this.stateService.updateActiveCell(sheet.cells[nextRow][start.col]);
        this.stateService.positionInputAt(nextRow, start.col, sheet);
        this.stateService.updateInputState({
          value: sheet.cells[nextRow][start.col].value?.toString() ?? '',
          disabled: true
        });
      }
    }
  }

  private getCellFromOffset(
    offsetX: number,
    offsetY: number,
    sheet: Sheet
  ): { rowIndex: number; colIndex: number } {
    // If user clicked above/left of the sheet, or beyond, return an invalid index
    if (offsetX < 0 || offsetY < 0) {
      return { rowIndex: -1, colIndex: -1 };
    }

    let accumulatedWidth = 0;
    let colIndex = -1;
    for (let i = 0; i < sheet.columns.length; i++) {
      const colWidth = sheet.columns[i].width;
      if (offsetX < accumulatedWidth + colWidth) {
        colIndex = i;
        break;
      }
      accumulatedWidth += colWidth;
    }

    let accumulatedHeight = 0;
    let rowIndex = -1;
    for (let j = 0; j < sheet.rows.length; j++) {
      const rowHeight = sheet.rows[j].height;
      if (offsetY < accumulatedHeight + rowHeight) {
        rowIndex = j;
        break;
      }
      accumulatedHeight += rowHeight;
    }

    return { rowIndex, colIndex };
  }

  private isInTopHeaderRow(event: MouseEvent, sheet: Sheet): boolean {
    // If the sheet shows column headers, the top header row is from Y=0 to Y=defaultCellHeight.
    // So check event.offsetY <= defaultCellHeight.
    // If rowHeaders exist, we also need to see if event.offsetX is > rowHeaderWidth.
    const withinTopHeaderY = event.offsetY >= 0 && event.offsetY <= this.stateService.defaultCellHeight;
    const beyondRowHeaderX = (event.offsetX > this.stateService.defaultCellWidth);
    return withinTopHeaderY && beyondRowHeaderX;
  }

  private isInLeftHeaderCol(event: MouseEvent, sheet: Sheet): boolean {
    // If the sheet shows row headers, the leftmost column is from X=0 to X=defaultCellWidth.
    // Also check if event.offsetY is > columnHeaderHeight if we have column headers.
    const withinLeftHeaderX = event.offsetX >= 0 && event.offsetX <= this.stateService.defaultCellWidth;
    const beyondColumnHeaderY = (event.offsetY > this.stateService.defaultCellHeight);
    return withinLeftHeaderX && beyondColumnHeaderY;
  }
}
