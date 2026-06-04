import type { TableBlock } from "../types";
import { findCellPosition, getSelectionBounds } from "../table/tableOps";

export type BorderMode = "bottom" | "top" | "left" | "right" | "none" | "all" | "outer" | "inner" | "inside-horizontal" | "inside-vertical";

export function findTableCell(table: TableBlock) {
  return table.rows.flat().find((cell) => cell.id === table.selectedCellId);
}

export function selectedTableRowLetter(table: TableBlock) {
  const row = table.rows.find((candidate) => candidate.some((cell) => cell.id === table.selectedCellId));
  const first = row?.[0]?.text.trim();
  return first === "A" || first === "B" || first === "C" || first === "D" ? first : undefined;
}

export function insertNumber(values: number[], index: number, value: number) {
  const next = [...values];
  next.splice(index, 0, value);
  return next;
}

export function insertRow<T>(rows: T[], index: number, row: T) {
  const next = [...rows];
  next.splice(index, 0, row);
  return next;
}

export function tableRangeLabel(table: TableBlock) {
  const bounds = getSelectionBounds(table);
  return `R${bounds.top + 1}:C${bounds.left + 1}${bounds.top !== bounds.bottom || bounds.left !== bounds.right ? ` - R${bounds.bottom + 1}:C${bounds.right + 1}` : ""}`;
}

export function deleteTableRows(table: TableBlock) {
  if (table.rows.length <= 1) return table;
  const bounds = getSelectionBounds(table);
  const deleteRows = new Set(Array.from({ length: bounds.bottom - bounds.top + 1 }, (_, index) => bounds.top + index));
  const rows = table.rows.filter((_, rowIndex) => !deleteRows.has(rowIndex));
  const rowHeights = (table.rowHeights ?? table.rows.map(() => table.settings.rowHeight)).filter((_, rowIndex) => !deleteRows.has(rowIndex));
  const selectedCellId = rows[0]?.[0]?.id ?? "";
  return { ...table, rows, rowHeights, selectedCellId, selectionAnchorCellId: selectedCellId, selectedCellIds: selectedCellId ? [selectedCellId] : [] };
}

export function deleteTableColumns(table: TableBlock) {
  if (table.rows[0].length <= 1) return table;
  const bounds = getSelectionBounds(table);
  const deleteColumns = new Set(Array.from({ length: bounds.right - bounds.left + 1 }, (_, index) => bounds.left + index));
  const rows = table.rows.map((row) => row.filter((_, columnIndex) => !deleteColumns.has(columnIndex)));
  const columnWidths = (table.columnWidths ?? table.rows[0].map(() => 96)).filter((_, columnIndex) => !deleteColumns.has(columnIndex));
  const selectedCellId = rows[0]?.[0]?.id ?? "";
  return { ...table, rows, columnWidths, selectedCellId, selectionAnchorCellId: selectedCellId, selectedCellIds: selectedCellId ? [selectedCellId] : [] };
}

export function updateTableColumnsWidth(table: TableBlock, width: number) {
  const bounds = getSelectionBounds(table);
  const columnWidths = [...(table.columnWidths ?? table.rows[0].map(() => 96))];
  for (let column = bounds.left; column <= bounds.right; column += 1) columnWidths[column] = width;
  return { ...table, columnWidths };
}

export function updateTableRowsHeight(table: TableBlock, height: number) {
  const bounds = getSelectionBounds(table);
  const rowHeights = [...(table.rowHeights ?? table.rows.map(() => table.settings.rowHeight))];
  for (let row = bounds.top; row <= bounds.bottom; row += 1) rowHeights[row] = height;
  return { ...table, rowHeights };
}

export function distributeTableColumns(table: TableBlock) {
  const bounds = getSelectionBounds(table);
  const columnWidths = [...(table.columnWidths ?? table.rows[0].map(() => 96))];
  const count = bounds.right - bounds.left + 1;
  const total = Array.from({ length: count }, (_, index) => columnWidths[bounds.left + index] ?? 96).reduce((sum, width) => sum + width, 0);
  const width = Math.round(total / count);
  for (let column = bounds.left; column <= bounds.right; column += 1) columnWidths[column] = width;
  return { ...table, columnWidths };
}

export function distributeTableRows(table: TableBlock) {
  const bounds = getSelectionBounds(table);
  const rowHeights = [...(table.rowHeights ?? table.rows.map(() => table.settings.rowHeight))];
  const count = bounds.bottom - bounds.top + 1;
  const total = Array.from({ length: count }, (_, index) => rowHeights[bounds.top + index] ?? table.settings.rowHeight).reduce((sum, height) => sum + height, 0);
  const height = Math.round(total / count);
  for (let row = bounds.top; row <= bounds.bottom; row += 1) rowHeights[row] = height;
  return { ...table, rowHeights };
}

export function setTableBorders(table: TableBlock, mode: BorderMode) {
  const ids = new Set(table.selectedCellIds ?? [table.selectedCellId]);
  const bounds = getSelectionBounds(table);
  return {
    ...table,
    rows: table.rows.map((row) =>
      row.map((cell, cellColumn) => {
        if (!ids.has(cell.id)) return cell;
        const position = findCellPosition(table, cell.id) ?? { row: 0, column: cellColumn };
        const borders = cell.borders ?? { top: true, right: true, bottom: true, left: true };
        if (mode === "all") return { ...cell, borders: { top: true, right: true, bottom: true, left: true } };
        if (mode === "none") return { ...cell, borders: { top: false, right: false, bottom: false, left: false } };
        if (mode === "outer") {
          return {
            ...cell,
            borders: {
              top: position.row === bounds.top,
              right: position.column === bounds.right,
              bottom: position.row === bounds.bottom,
              left: position.column === bounds.left
            }
          };
        }
        if (mode === "inner") {
          return {
            ...cell,
            borders: {
              top: position.row > bounds.top,
              right: false,
              bottom: false,
              left: position.column > bounds.left
            }
          };
        }
        if (mode === "inside-horizontal") return { ...cell, borders: { top: position.row > bounds.top, right: false, bottom: false, left: false } };
        if (mode === "inside-vertical") return { ...cell, borders: { top: false, right: false, bottom: false, left: position.column > bounds.left } };
        return { ...cell, borders: { ...borders, [mode]: !borders[mode] } };
      })
    )
  };
}
