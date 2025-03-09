import { Injectable, inject } from '@angular/core';
import { Sheet, Range } from '../models/sheet.model';
import { StateService } from './state.service';
import { RenderService } from './render.service';
import { DataService } from './data.service';

@Injectable()
export class ClipboardService {
  private stateService = inject(StateService);
  private renderService = inject(RenderService);
  private dataService = inject(DataService);

  async copySelection(sheet: Sheet): Promise<void> {
    if (!sheet) return;
    const { start, end } = this.stateService.selection;
    const startRow = Math.min(start.row, end.row);
    const endRow = Math.max(start.row, end.row);
    const startCol = Math.min(start.col, end.col);
    const endCol = Math.max(start.col, end.col);

    const range = {
      start: { row: startRow, col: startCol },
      end: { row: endRow, col: endCol }
    };
    await this.copy(sheet, range);
  }

  public async copy(sheet: Sheet, range: Range) {
    // Build TSV string from selected cells
    let copiedData = '';
    for (let row = range.start.row; row <= range.end.row; row++) {
      const rowValues: string[] = [];
      for (let col = range.start.col; col <= range.end.col; col++) {
        // Ensure that the cell value doesn't contain tab characters that would break paste
        const cellValue = sheet.cells[row][col].value?.toString() ?? '';
        // Replace any tab characters with spaces to prevent splitting issues
        rowValues.push(cellValue.replace(/\t/g, ' '));
      }
      copiedData += rowValues.join('\t');
      if (row < range.end.row) {
        copiedData += '\n';
      }
    }

    try {
      await navigator.clipboard.writeText(copiedData);
      // Update copy highlight and enable marching ants
      this.stateService.updateCopyHighlight(range);
      this.stateService.setMarchingAnts(true);
    } catch (err) {
      console.error('Failed to copy data:', err);
    }
  }

  async pasteSelection(sheet: Sheet): Promise<void> {
    if (!sheet) return;
    const startRow = Math.min(this.stateService.selection.start.row, this.stateService.selection.end.row);
    const startCol = Math.min(this.stateService.selection.start.col, this.stateService.selection.end.col);
    let endRow = Math.max(this.stateService.selection.start.row, this.stateService.selection.end.row);
    let endCol = Math.max(this.stateService.selection.start.col, this.stateService.selection.end.col);

    const pasteRange = {
      start: { row: startRow, col: startCol },
      end: { row: endRow, col: endCol }
    };
    await this.paste(sheet, pasteRange);
  }

  async paste(originalSheet: Sheet, range: Range) {
    try {
      const text = (await navigator.clipboard.readText());
      if (!text) return;

      // Parse the clipboard data more carefully
      const lines = text.split('\n');

      // Handle special characters and ensure accurate splitting
      const copiedData = lines.map(line => {
        // If we detect that this is CSV data with quotes, handle it specially
        if (line.includes('"') && line.includes(',')) {
          return this.parseCSVLine(line);
        }

        // Otherwise, use the normal tab splitting
        return line.split('\t');
      });

      const copyHeight = lines.length;
      const copyWidth = Math.max(...copiedData.map(row => row.length));
      const selectionHeight = range.end.row - range.start.row + 1;
      const selectionWidth = range.end.col - range.start.col + 1;

      let pasteWidth;
      let pasteHeight;

      if (selectionHeight === 1 && selectionWidth === 1) {
        pasteWidth = copyWidth;
        pasteHeight = copyHeight;
      } else {
        pasteWidth = selectionWidth;
        pasteHeight = selectionHeight;
      }

      const pasteData: any[] = [];

      for (let row = 0; row < pasteHeight; row++) {
        const rowData: any[] = [];
        for (let col = 0; col < pasteWidth; col++) {
          const copyRow = row % copyHeight;
          const copyCol = col % copyWidth;
          rowData.push((copiedData)[copyRow][copyCol]);
        }
        pasteData.push(rowData);
      }
      const pasteRange = {
        start: range.start,
        end: { row: range.start.row + pasteHeight - 1, col: range.start.col + pasteWidth - 1 }
      };

      this.dataService.updateCellValues(pasteRange.start.row, pasteRange.start.col, pasteData);

      // Clear marching ants/copy highlight
      this.stateService.setMarchingAnts(false);
      this.stateService.updateCopyHighlight({
        start: { row: -1, col: -1 },
        end: { row: -1, col: -1 }
      });

      // Update current selection to reflect the paste region
      this.stateService.updateSelection(pasteRange);
      this.renderService.requestRender();

    } catch (err) {
      console.error('Failed to paste data:', err);
    }
  }

  /**
   * Parses a CSV line, handling quoted values properly
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        // Toggle quote state
        inQuotes = !inQuotes;
      } else if (char === '\t' && !inQuotes) {
        // Tab found outside quotes - end of field
        result.push(current);
        current = '';
      } else {
        // Add character to current field
        current += char;
      }
    }

    // Add the last field
    result.push(current);

    return result;
  }
}