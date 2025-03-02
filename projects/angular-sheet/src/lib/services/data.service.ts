// apps/cms-frontend/src/app/shared/components/sheet/services/data.service.ts

import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Sheet } from '../models/sheet.model';
import { UndoRedoService } from './undo-redo.service';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private sheetData = new BehaviorSubject<Sheet | null>(null);
  private sheetChanges = new BehaviorSubject<Sheet | null>(null);

  public sheetData$ = this.sheetData.asObservable();
  public sheetChanges$ = this.sheetChanges.asObservable();
  private undoRedoService = inject(UndoRedoService);

  /**
   * If your app only wants one-time setting of sheet data,
   * you can keep setSheetData as is. 
   */
  setSheetData(data: Sheet) {
    this.sheetData.next(data);
  }

  getSheetData(): Sheet | null {
    return this.sheetData.value;
  }

  emitSheetChanges(sheet: Sheet) {
    this.sheetChanges.next(sheet);
  }

  /**
   * [NEW] Consolidated method to update the entire sheet in one go.
   * Also captures the old state for Undo/Redo before overwriting.
   */
  public updateSheet(newSheet: Sheet): void {
    const currentSheet = this.sheetData.value;
    if (!currentSheet) {
      this.sheetData.next(newSheet);
      this.emitSheetChanges(newSheet);
      return;
    }
    this.undoRedoService.captureSheetState(currentSheet);

    this.sheetData.next(newSheet);
    this.emitSheetChanges(newSheet);
  }

  /**
   * Method to update a range of cells.
   */
  public updateCellValues(
    rowStart: number,
    columnStart: number,
    input: string | number | boolean | Date | null | (string | number | boolean | Date | null)[][],
    recordUndo = true
  ) {

    const rowEnd = Array.isArray(input) ? rowStart + (input as (string | number | boolean | Date | null)[][]).length - 1 : rowStart;
    const columnEnd = Array.isArray(input) ? columnStart + (input as (string | number | boolean | Date | null)[][])[0].length - 1 : columnStart;
    const currentSheet = this.sheetData.value;
    if (!currentSheet) return;
    const isSingleValue = typeof input !== 'object';
    // Capture sheet state for undo
    if (recordUndo)
      this.undoRedoService.captureSheetState(currentSheet);
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = columnStart; col <= columnEnd; col++) {
        const cell = currentSheet.cells[row][col];
        if (cell) {
          if (isSingleValue) {
            cell.handleInput(input);
          } else {
            const value = (input as (string | number | boolean | Date | null)[][])[row - rowStart][col - columnStart];
            cell.handleInput(value ?? '');
          }
        }
      }
    }
    this.emitSheetChanges(currentSheet);
  }

  /**
   * autoFillSelection can remain similar if you want partial updates
   * or adapt it to also call updateSheet at the end.
   */
  autoFillSelection(
    sheet: Sheet,
    originalRange: { start: { row: number; col: number }; end: { row: number; col: number } },
    fillRange: { start: { row: number; col: number }; end: { row: number; col: number } }
  ) {
    // Example from your existing logic...
    this.undoRedoService.captureSheetState(sheet);
    // ... mutate 'sheet' ...
    this.sheetData.next({ ...sheet });
    this.emitSheetChanges(sheet);
  }
}
