import type { TableBlock, TableCell } from "../types";

export function findCellPosition(table: TableBlock, id: string) {
  for (let row = 0; row < table.rows.length; row += 1) {
    const column = table.rows[row].findIndex((cell) => cell.id === id);
    if (column >= 0) return { row, column };
  }
  return null;
}

export function getSelectedCellIds(table: TableBlock) {
  return table.selectedCellIds?.length ? table.selectedCellIds : table.selectedCellId ? [table.selectedCellId] : [];
}

export function getSelectedCells(table: TableBlock) {
  const ids = new Set(getSelectedCellIds(table));
  return table.rows.flat().filter((cell) => ids.has(cell.id));
}

export function getSelectionBounds(table: TableBlock) {
  const ids = new Set(getSelectedCellIds(table));
  const positions = table.rows.flatMap((row, rowIndex) =>
    row.map((cell, columnIndex) => (ids.has(cell.id) ? { row: rowIndex, column: columnIndex } : null)).filter(Boolean)
  ) as Array<{ row: number; column: number }>;

  if (positions.length === 0) {
    const position = findCellPosition(table, table.selectedCellId) ?? { row: 0, column: 0 };
    return { top: position.row, bottom: position.row, left: position.column, right: position.column };
  }

  return {
    top: Math.min(...positions.map((position) => position.row)),
    bottom: Math.max(...positions.map((position) => position.row)),
    left: Math.min(...positions.map((position) => position.column)),
    right: Math.max(...positions.map((position) => position.column))
  };
}

export function selectCell(table: TableBlock, id: string, extend = false): TableBlock {
  if (!extend) {
    return { ...table, selectedCellId: id, selectionAnchorCellId: id, selectedCellIds: [id] };
  }

  const anchor = findCellPosition(table, table.selectionAnchorCellId ?? table.selectedCellId);
  const target = findCellPosition(table, id);
  if (!anchor || !target) return { ...table, selectedCellId: id, selectedCellIds: [id] };

  const top = Math.min(anchor.row, target.row);
  const bottom = Math.max(anchor.row, target.row);
  const left = Math.min(anchor.column, target.column);
  const right = Math.max(anchor.column, target.column);
  const selectedCellIds = table.rows
    .slice(top, bottom + 1)
    .flatMap((row) => row.slice(left, right + 1).map((cell) => cell.id));

  return { ...table, selectedCellId: id, selectedCellIds };
}

export function updateSelectedCells(table: TableBlock, patch: Partial<TableCell>) {
  const ids = new Set(getSelectedCellIds(table));
  return {
    ...table,
    rows: table.rows.map((row) => row.map((cell) => (ids.has(cell.id) ? { ...cell, ...patch } : cell)))
  };
}

export function mergeSelectedCells(table: TableBlock) {
  const bounds = getSelectionBounds(table);
  const master = table.rows[bounds.top]?.[bounds.left];
  if (!master) return table;

  return {
    ...table,
    selectedCellId: master.id,
    selectionAnchorCellId: master.id,
    selectedCellIds: [master.id],
    rows: table.rows.map((row, rowIndex) =>
      row.map((cell, columnIndex) => {
        const inRange = rowIndex >= bounds.top && rowIndex <= bounds.bottom && columnIndex >= bounds.left && columnIndex <= bounds.right;
        if (!inRange) return cell;
        if (cell.id === master.id) {
          return { ...cell, rowSpan: bounds.bottom - bounds.top + 1, colSpan: bounds.right - bounds.left + 1, hidden: false };
        }
        return { ...cell, hidden: true, rowSpan: 1, colSpan: 1 };
      })
    )
  };
}

export function unmergeSelectedCells(table: TableBlock) {
  const ids = new Set(getSelectedCellIds(table));
  return {
    ...table,
    rows: table.rows.map((row) =>
      row.map((cell) => (ids.has(cell.id) || cell.hidden ? { ...cell, hidden: false, rowSpan: 1, colSpan: 1 } : cell))
    )
  };
}

export function clearSelectedCells(table: TableBlock) {
  return updateSelectedCells(table, { text: "", image: undefined, contentType: "text" });
}
