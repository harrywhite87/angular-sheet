import { Injectable } from '@angular/core';
import { Sheet } from '../models/sheet.model';

/**
 * A simple Undo/Redo service that stores snapshots
 * of the Sheet state.
 * 
 * For multi-level Undo, we keep a stack of history snapshots.
 * TODO, REDO
 */

@Injectable({ providedIn: 'root' })
export class UndoRedoService {
  private historyStack: Sheet[] = [];
  /**
   * Capture (push) the current sheet snapshot before mutating it.
   * We do a deep-ish clone using JSON parse/stringify for simplicity.
   */
  public captureSheetState(sheet: Sheet): void {
    const clonedSheet = this.cloneSheet(sheet);
    this.historyStack.push(clonedSheet);
  }

  /**
   * Undo the last sheet mutation.
   * Returns the restored sheet or null if none available.
   */
  public undo(): Sheet | null {
    if (this.historyStack.length === 0) {
      return null;
    }
    const restoredSheet = this.historyStack.pop() as Sheet;
    return restoredSheet;
  }

  /**
   * Helper to deep-clone a sheet via JSON. 
   */
  private cloneSheet(sheet: Sheet): Sheet {
    // For large data, we might implement a more optimized clone.
    return JSON.parse(JSON.stringify(sheet));
  }
}
