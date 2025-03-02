import { Injectable } from '@angular/core';
import { Cell, Sheet } from '../models/sheet.model';
import { BehaviorSubject, Observable } from 'rxjs';

// --- [RESIZE LOGIC ADDED] ---
// Keep track of whether we're resizing columns, rows, or doing something else
export enum MouseMode {
  DEFAULT = 'DEFAULT',
  SELECTING_CELLS = 'SELECTING_CELLS',
  RESIZING_COLUMN = 'RESIZING_COLUMN',
  RESIZING_ROW = 'RESIZING_ROW',
  DRAG_FILL = 'DRAG_FILL'  // New mode
}

// Optional structure to store info about the active resize
export interface ResizeState {
  resizingRowIndex?: number;
  resizingColumnIndex?: number;
  originalSize?: number;       // Original column width or row height
  startPointerPos?: number;    // X or Y position where the drag started
}

export interface HighlightState {
  start: { row: number; col: number };
  end: { row: number; col: number };
}

export interface InputState {
  top: number;
  left: number;
  width: number;
  height: number;
  value: string;
  disabled: boolean;
}

export interface DragFillState {
  isDragHandleHovered: boolean;
  isDragging: boolean;
  previewStart?: { row: number; col: number };
  previewEnd?: { row: number; col: number };
}

@Injectable()
export class StateService {
  // Default dimensions
  readonly defaultCellHeight = 20;
  readonly defaultCellWidth = 50;
  readonly defaultCellPaddingTop = 5;
  readonly defaultCellPaddingLeft = 10;

  // Selection state
  private selectionState = new BehaviorSubject<HighlightState>({
    start: { row: -1, col: -1 },
    end: { row: 0, col: 0 }
  });

  // Copy state
  private copyHighlightState = new BehaviorSubject<HighlightState>({
    start: { row: -1, col: -1 },
    end: { row: 0, col: 0 }
  });

  // Active cell state
  private activeCellState = new BehaviorSubject<Cell | null>(null);

  // Input state
  private inputState = new BehaviorSubject<InputState>({
    top: -1,
    left: -1,
    width: this.defaultCellWidth,
    height: this.defaultCellHeight,
    value: '',
    disabled: true
  });

  // Scroll state
  private scrollState = new BehaviorSubject<{ x: number; y: number }>({ x: 0, y: 0 });

  // Marching ants state
  private marchingAntsState = new BehaviorSubject<boolean>(false);

  // Context menu state
  private contextMenuState = new BehaviorSubject<{
    visible: boolean;
    position: { x: number; y: number };
  }>({
    visible: false,
    position: { x: 0, y: 0 }
  });

  private dragFillState = new BehaviorSubject<DragFillState>({
    isDragHandleHovered: false,
    isDragging: false
  });

  get isDragHandleHovered(): boolean {
    return this.dragFillState.value.isDragHandleHovered;
  }

  updateDragFillState(state: Partial<DragFillState>) {
    this.dragFillState.next({
      ...this.dragFillState.value,
      ...state
    });
  }

  getDragFillState(): DragFillState {
    return this.dragFillState.value;
  }


  // --- [RESIZE LOGIC ADDED] ---
  // Mouse mode and resizing details
  private mouseModeState = new BehaviorSubject<MouseMode>(MouseMode.DEFAULT);
  private resizeState = new BehaviorSubject<ResizeState>({});
  inputElement!: HTMLInputElement;

  // Observable getters
  getSelection$(): Observable<HighlightState> {
    return this.selectionState.asObservable();
  }

  // Observable getters
  getCopyHighlight$(): Observable<HighlightState> {
    return this.copyHighlightState.asObservable();
  }

  getActiveCell$(): Observable<Cell | null> {
    return this.activeCellState.asObservable();
  }

  getInputState$(): Observable<InputState> {
    return this.inputState.asObservable();
  }

  getScrollState$(): Observable<{ x: number; y: number }> {
    return this.scrollState.asObservable();
  }

  getMarchingAnts$(): Observable<boolean> {
    return this.marchingAntsState.asObservable();
  }

  getContextMenuState$(): Observable<{ visible: boolean; position: { x: number; y: number } }> {
    return this.contextMenuState.asObservable();
  }

  // Context Menu
  get contextMenu() {
    return this.contextMenuState.value;
  }

  updateContextMenuState(state: Partial<{ visible: boolean; position: { x: number; y: number } }>) {
    this.contextMenuState.next({
      ...this.contextMenuState.value,
      ...state
    });
  }

  // Current value getters
  get selection(): HighlightState {
    return this.selectionState.value;
  }

  // Current value getters
  get copyHighlight(): HighlightState {
    return this.copyHighlightState.value;
  }

  get activeCell(): Cell | null {
    return this.activeCellState.value;
  }

  get input(): InputState {
    return this.inputState.value;
  }

  get scrollPosition(): { x: number; y: number } {
    return this.scrollState.value;
  }

  get showMarchingAnts(): boolean {
    return this.marchingAntsState.value;
  }

  // --- [RESIZE LOGIC ADDED] ---
  // Mouse mode
  get mouseMode(): MouseMode {
    return this.mouseModeState.value;
  }

  setMouseMode(mode: MouseMode) {
    this.mouseModeState.next(mode);
  }

  // Resize state
  getResizeState(): ResizeState {
    return this.resizeState.value;
  }

  updateResizeState(state: Partial<ResizeState>) {
    this.resizeState.next({
      ...this.resizeState.value,
      ...state
    });
  }

  // State update methods
  updateSelection(selection: Partial<HighlightState>) {
    this.selectionState.next({
      ...this.selectionState.value,
      ...selection
    });
  }

  updateCopyHighlight(copyHighlight: Partial<HighlightState>) {
    this.copyHighlightState.next({
      ...this.copyHighlightState.value,
      ...copyHighlight
    });
  }

  updateActiveCell(cell: Cell | null) {
    this.activeCellState.next(cell);
  }

  updateInputState(state: Partial<InputState>) {
    this.inputState.next({
      ...this.inputState.value,
      ...state
    });
  }

  updateScrollPosition(x: number, y: number) {
    this.scrollState.next({ x, y });
  }

  setMarchingAnts(show: boolean) {
    this.marchingAntsState.next(show);
  }

  // Helper methods
  positionInputAt(row: number, col: number, sheet: Sheet) {
    if (!sheet) return;

    // Calculate the left & top positions in canvas-space
    const xOffset =
      this.accumulatedWidthUntil(col, sheet.columns);
    const yOffset =
      this.accumulatedHeightUntil(row, sheet.rows);

    // Update input state with new position
    this.updateInputState({
      left: xOffset - this.scrollPosition.x,
      top: yOffset - this.scrollPosition.y,
      width: sheet.columns[col].width,
      height: sheet.rows[row].height
    });
  }

  private accumulatedWidthUntil(colIndex: number, columns: { width: number }[]): number {
    return columns.slice(0, colIndex).reduce((sum, col) => sum + col.width, 0);
  }

  private accumulatedHeightUntil(rowIndex: number, rows: { height: number }[]): number {
    return rows.slice(0, rowIndex).reduce((sum, row) => sum + row.height, 0);
  }

  // Reset states
  reset() {
    this.selectionState.next({
      start: { row: -1, col: -1 },
      end: { row: 0, col: 0 }
    });
    this.activeCellState.next(null);
    this.inputState.next({
      top: -1,
      left: -1,
      width: this.defaultCellWidth,
      height: this.defaultCellHeight,
      value: '',
      disabled: true
    });
    this.scrollState.next({ x: 0, y: 0 });
    this.marchingAntsState.next(false);

    // --- [RESIZE LOGIC ADDED] ---
    this.mouseModeState.next(MouseMode.DEFAULT);
    this.resizeState.next({});
  }

  setInputElement(input: HTMLInputElement) {
    this.inputElement = input;
  }

}
