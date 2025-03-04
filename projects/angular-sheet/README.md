# `angular-sheet`

A high-performance canvas-based spreadsheet component for Angular applications, providing Excel-like functionality with a minimal footprint.

<p align="center">
  <img src="https://raw.githubusercontent.com/harrywhite87/assets/refs/heads/main/images/angular-sheets/screenshot.webp" alt="angular-sheet Screenshot" />
</p>

## Features

- 🚀 **High Performance**: Canvas-based rendering for handling large datasets efficiently
- 📱 **Responsive**: Adapts to different screen sizes
- 🧮 **Excel-like Functionality**: Selection, copy/paste, context menu, and more
- 🎨 **Customizable**: Configurable cell styles, column widths, and row heights
- 🔄 **Two-way Data Binding**: Updates both UI and data model
- 🌈 **Styling**: Custom cell styling with background colors, fonts, and alignments
- 👆 **UX Features**: Context menu, drag handle, and resize functionality

## Basic Usage


### 1. Use the component in your template

```html
<sheet [sheetData]="mySpreadsheetData" (sheetDataChange)="onSheetDataChange($event)"></sheet>
```

### 2. Set up your component class

```typescript
import { Component } from '@angular/core';
import { SheetComponent, Sheet, Cell, CellStyles } from "angular-sheet";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SheetComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  mySpreadsheetData: Sheet = {
    cells: [
      [
        new Cell("Segment", { isReferenceCell: true }),
        new Cell("Country", { isReferenceCell: true }),
        new Cell("Product", { isReferenceCell: true }),
        new Cell("Discount Band", { isReferenceCell: true }),
        new Cell("Units Sold", { isReferenceCell: true }),
      ],
      [new Cell("Government"), new Cell("Canada"), new Cell("Carretera"), new Cell("None"), new Cell(1618.5)],
      [new Cell("Government"), new Cell("Germany"), new Cell("Carretera"), new Cell("None"), new Cell(1321)],
      [new Cell("Midmarket"), new Cell("France"), new Cell("Carretera"), new Cell("None"), new Cell(2178)],
      [new Cell("Midmarket"), new Cell("Germany"), new Cell("Carretera"), new Cell("None"), new Cell(888)],
      [new Cell("Midmarket"), new Cell("Mexico"), new Cell("Carretera"), new Cell("None"), new Cell(2470)],
      [new Cell("Government"), new Cell("Germany"), new Cell("Carretera"), new Cell("None"), new Cell(1513)],
      [new Cell("Midmarket"), new Cell("Germany"), new Cell("Montana"), new Cell("None"), new Cell(921)],
      [new Cell("Channel Partners"), new Cell("Canada"), new Cell("Montana"), new Cell("None"), new Cell(2518)],
      [new Cell("Government"), new Cell("France"), new Cell("Montana"), new Cell("None"), new Cell(1899)],
      [new Cell("Channel Partners"), new Cell("Germany"), new Cell("Montana"), new Cell("None"), new Cell(1545)],
      [new Cell("Midmarket"), new Cell("Mexico"), new Cell("Montana"), new Cell("None"), new Cell(2470)],
      [new Cell("Enterprise"), new Cell("Canada"), new Cell("Montana"), new Cell("None"), new Cell(2665.5)],
      [new Cell("Small Business"), new Cell("Mexico"), new Cell("Montana"), new Cell("None"), new Cell(958)],
      [new Cell("Government"), new Cell("Germany"), new Cell("Montana"), new Cell("None"), new Cell(2146)],
      [new Cell("Enterprise"), new Cell("Canada"), new Cell("Montana"), new Cell("None"), new Cell(345)],
      [new Cell("Midmarket"), new Cell("United States of America"), new Cell("Montana"), new Cell("None"), new Cell(615)],

    ],
    columns: [
      { width: 100, styles: new CellStyles() },
      { width: 100, styles: new CellStyles() },
      { width: 100, styles: new CellStyles() },
      { width: 100, styles: new CellStyles() },
      { width: 100, styles: new CellStyles() },
    ],
    rows: [
      { height: 20, styles: new CellStyles() },
      { height: 20, styles: new CellStyles() },
      { height: 20, styles: new CellStyles() },
      { height: 20, styles: new CellStyles() },
      { height: 20, styles: new CellStyles() },
      { height: 20, styles: new CellStyles() },
      { height: 20, styles: new CellStyles() },
      { height: 20, styles: new CellStyles() },
      { height: 20, styles: new CellStyles() },
      { height: 20, styles: new CellStyles() },
      { height: 20, styles: new CellStyles() },
      { height: 20, styles: new CellStyles() },
      { height: 20, styles: new CellStyles() },
      { height: 20, styles: new CellStyles() },
      { height: 20, styles: new CellStyles() },
      { height: 20, styles: new CellStyles() },
    ],
  };


  onSheetDataChange(updatedData: Sheet) {
    console.log("Sheet data updated:", updatedData);
    // Handle data changes here
  }
}
```

## Advanced Usage

### Custom Cell Styling

```typescript

// Create a custom cell with specific styling
const customCell = new Cell("Custom Cell", {
  styles: new CellStyles({
    backgroundColor: "#e6f7ff",
    color: "#0066cc",
    fontWeight: "bold",
    textAlign: "center",
  }),
});
```

### Custom Cell Renderers

You can create custom cell renderers for advanced visualizations:

```typescript
import { createButtonRenderer } from "angular-sheet";

const actionCell = new Cell("Click Me", {
  customRenderer: createButtonRenderer({
    backgroundColor: "#4CAF50",
    hoverColor: "#45a049",
    textColor: "white",
    onClick: () => alert("Button clicked!"),
  }),
});
```

### Copy/Paste Functionality

The sheet component supports copy/paste functionality:

- `Ctrl+C` (or `Cmd+C` on Mac) to copy selected cells
- `Ctrl+V` (or `Cmd+V` on Mac) to paste copied cells
- Right-click context menu for copy/paste options

## API Reference

### Input Properties

| Property  | Type  | Description                        |
| --------- | ----- | ---------------------------------- |
| sheetData | Sheet | The data model for the spreadsheet |

### Output Events

| Event           | Type                | Description                       |
| --------------- | ------------------- | --------------------------------- |
| sheetDataChange | EventEmitter<Sheet> | Emits when the sheet data changes |

### Sheet Model

```typescript
interface Sheet {
  cells: Cell[][];
  columns: ColumnStyle[];
  rows: RowStyle[];
  metadata?: Record<string, any>;
}
```

### Cell Model

```typescript
class Cell {
  value: string | number | boolean | Date | null;
  datatype: "string" | "number" | "boolean" | "date" | "formula";
  styles: CellStyles;
  isReferenceCell: boolean;
  // ... additional properties
}
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Edge (latest)
- Safari (latest)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
