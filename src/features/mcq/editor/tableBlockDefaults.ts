import { nanoid } from "nanoid";
import type { TableBlock, TableBlockSettings, TableCell } from "./types";

export const defaultTableSettings: TableBlockSettings = {
  fontFamily: "Calibri",
  fontSize: 11,
  widthMode: "auto",
  customWidth: 420,
  horizontalAlignment: "center",
  borderStyle: "standard",
  outerBorder: true,
  cellPadding: 6,
  rowHeight: 28,
  showHeaderRow: true,
  showHeaderColumn: false,
  spacingBefore: 6,
  spacingAfter: 6,
  keepWithNext: false,
  pageBreakBefore: false,
  allowSplit: true,
  locked: false
};

export function createTableCell(text = "", header = false): TableCell {
  return {
    id: nanoid(),
    text,
    contentType: "text",
    rowSpan: 1,
    colSpan: 1,
    header,
    bold: header,
    italic: false,
    borders: {
      top: true,
      right: true,
      bottom: true,
      left: true
    },
    horizontalAlignment: "center",
    verticalAlignment: "middle"
  };
}

export function createTableBlock(previous?: TableBlock): TableBlock {
  if (previous) {
    const rows = previous.rows.map((row) => row.map((cell) => ({ ...cell, id: nanoid(), image: cell.image ? { ...cell.image } : undefined })));
    return {
      ...previous,
      id: nanoid(),
      rows,
      columnWidths: previous.columnWidths ? [...previous.columnWidths] : rows[0]?.map(() => 96) ?? [],
      rowHeights: previous.rowHeights ? [...previous.rowHeights] : rows.map(() => previous.settings.rowHeight),
      selectedCellId: rows[0]?.[0]?.id ?? "",
      selectionAnchorCellId: rows[0]?.[0]?.id ?? "",
      selectedCellIds: rows[0]?.[0]?.id ? [rows[0][0].id] : [],
      settings: { ...previous.settings }
    };
  }

  const rows = [
    [createTableCell("", true), createTableCell("", true), createTableCell("", true), createTableCell("", true)],
    [createTableCell("", false), createTableCell(""), createTableCell(""), createTableCell("")],
    [createTableCell("", false), createTableCell(""), createTableCell(""), createTableCell("")]
  ];

  return {
    id: nanoid(),
    type: "table",
    rows,
    columnWidths: rows[0].map((_, index) => (index === 0 ? 48 : 96)),
    rowHeights: rows.map(() => defaultTableSettings.rowHeight),
    selectedCellId: rows[0][0].id,
    selectionAnchorCellId: rows[0][0].id,
    selectedCellIds: [rows[0][0].id],
    settings: { ...defaultTableSettings }
  };
}

export function createOptionsTableBlock(): TableBlock {
  const rows = [
    [createTableCell("", true), createTableCell("", true), createTableCell("", true)],
    [createTableCell("A", true), createTableCell(""), createTableCell("")],
    [createTableCell("B", true), createTableCell(""), createTableCell("")],
    [createTableCell("C", true), createTableCell(""), createTableCell("")],
    [createTableCell("D", true), createTableCell(""), createTableCell("")]
  ];

  return {
    id: nanoid(),
    type: "table",
    rows,
    columnWidths: [46, 132, 132],
    rowHeights: rows.map((_, index) => (index === 0 ? 32 : 42)),
    selectedCellId: rows[1][1].id,
    selectionAnchorCellId: rows[1][1].id,
    selectedCellIds: [rows[1][1].id],
    settings: {
      ...defaultTableSettings,
      customWidth: 360,
      rowHeight: 34,
      showHeaderColumn: true,
      spacingBefore: 0,
      spacingAfter: 0
    }
  };
}
