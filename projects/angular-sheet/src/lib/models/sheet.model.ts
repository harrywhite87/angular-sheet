// Base class for cell styles
export class CellStyles {
  backgroundColor: string;
  color: string;
  fontSize: string;
  fontWeight: string;
  fontFamily: string;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  borderTop: string;
  borderBottom: string;
  borderLeft: string;
  borderRight: string;
  padding: string;
  wrap: boolean;

  constructor(config: Partial<CellStyles> = {}) {
    this.backgroundColor = config.backgroundColor ?? 'white';
    this.color = config.color ?? 'black';
    this.fontSize = config.fontSize ?? '12px';
    this.fontWeight = config.fontWeight ?? 'normal';
    this.fontFamily = config.fontFamily ?? 'Arial';
    this.textAlign = config.textAlign ?? 'left';
    this.verticalAlign = config.verticalAlign ?? 'top';
    this.borderTop = config.borderTop ?? '1px solid black';
    this.borderBottom = config.borderBottom ?? '1px solid black';
    this.borderLeft = config.borderLeft ?? '1px solid black';
    this.borderRight = config.borderRight ?? '1px solid black';
    this.padding = config.padding ?? '2px';
    this.wrap = config.wrap ?? true;
  }

  /**
   * Static helper to create typical "header" style
   */
  static createHeaderStyles(): CellStyles {
    return new CellStyles({
      backgroundColor: '#e0e0e0',
      fontWeight: 'bold'
    });
  }
}

export interface CellRenderContext {
  value: string | number | boolean | Date | null;
  width: number;
  height: number;
  x: number;
  y: number;
  ctx: CanvasRenderingContext2D;
  styles: CellStyles;
  isSelected: boolean;
  isFocused: boolean;
  hoverPoint?: { x: number; y: number };
}

export type CellRenderer = (context: CellRenderContext) => void;

// Base class for cell
export class Cell {
  value: string | number | boolean | Date | null;
  datatype: 'string' | 'number' | 'boolean' | 'date' | 'formula';
  formatter?: string;
  styles: CellStyles;
  isHighlighted: boolean;
  isFocused: boolean;

  // New property to mark reference cells (headers)
  isReferenceCell: boolean;

  // rowIndex and columnIndex help with layout
  rowIndex?: number;
  columnIndex?: number;
  metadata?: Record<string, any>;
  customRenderer!: CellRenderer;

  constructor(
    value: string | number | boolean | Date | null,
    config: Partial<Cell> = {}
  ) {
    this.value = value;
    this.datatype = config.datatype ?? 'string';
    this.formatter = config.formatter;
    this.styles = config.styles ?? new CellStyles();
    this.isHighlighted = config.isHighlighted ?? false;
    this.isFocused = config.isFocused ?? false;

    // Initialize with custom config or default to false
    this.isReferenceCell = config.isReferenceCell ?? false;

    this.rowIndex = config.rowIndex;
    this.columnIndex = config.columnIndex;
    this.metadata = config.metadata;
    if (config.customRenderer) {
      this.customRenderer = config.customRenderer
    }
    this.updateStyles();
  }

  handleInput(newValue: string | number | boolean | Date) {
    this.value = newValue;
    this.updateStyles();
  }

  updateStyles() {
    if (this.isFocused) {
      this.styles.backgroundColor = '#d1e0ff'; // light blue for focus
    } else if (this.isHighlighted) {
      this.styles.backgroundColor = '#ffe0e0'; // light red for highlight
    } else if (this.isReferenceCell) {
      // If it's a reference cell, we might set a default background
      // but only if the user hasn't already customized it.
      if (this.styles.backgroundColor === 'white') {
        this.styles.backgroundColor = '#e0e0e0';
      }
      this.styles.fontWeight = 'bold';
    } else {
      this.styles.backgroundColor = 'white';
    }
  }
}


// Interface for column styles
export interface ColumnStyle {
  width: number;
  styles?: CellStyles;
}

// Interface for row styles
export interface RowStyle {
  height: number;
  styles?: CellStyles;
}

// Interface for sheet
export interface Sheet {
  cells: Cell[][];
  columns: ColumnStyle[];
  rows: RowStyle[];
  metadata?: Record<string, any>;
}

export type Range = { start: { row: number, col: number }, end: { row: number, col: number } };

export interface Debug {
  showFpsCounter?: boolean;
}

