export function getAccumulatedHeight(rows: { height: number }[], upTo: number): number {
    return rows.slice(0, upTo).reduce((sum, row) => sum + row.height, 0);
}

export function getAccumulatedWidth(columns: { width: number }[], upTo: number): number {
    return columns.slice(0, upTo).reduce((sum, col) => sum + col.width, 0);
}
