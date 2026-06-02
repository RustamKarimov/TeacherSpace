import { nanoid } from "nanoid";
import { defaultOptionsSettings } from "./optionsBlockDefaults";
import { createOptionsTableBlock, createTableBlock, createTableCell, defaultTableSettings } from "./tableBlockDefaults";
import type { McqBlock, McqOption, OptionsBlock, TableBlock, TableCell } from "./types";

export function normalizeMcqBlocks(blocks: McqBlock[] | undefined | null): McqBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((block) => {
    if (!block || typeof block !== "object") return block;
    if (block.type === "options") return normalizeOptionsBlock(block);
    if (block.type === "table") return normalizeTableBlock(block);
    return block;
  }).filter(Boolean) as McqBlock[];
}

export function normalizeOptionsBlock(block: OptionsBlock): OptionsBlock {
  const options = Array.isArray(block.options) ? block.options.map(normalizeOption) : [];
  const selectedOptionId = options.some((option) => option.id === block.selectedOptionId) ? block.selectedOptionId : options[0]?.id ?? "";

  return {
    ...block,
    mode: block.mode ?? "standard",
    options,
    correctAnswer: block.correctAnswer ?? "C",
    selectedOptionId,
    inlineLatexSource: block.inlineLatexSource ?? "",
    table: normalizeTableBlock(block.table ?? createOptionsTableBlock()),
    settings: {
      ...defaultOptionsSettings,
      ...(block.settings ?? {}),
      label: { ...defaultOptionsSettings.label, ...(block.settings?.label ?? {}) },
      text: { ...defaultOptionsSettings.text, ...(block.settings?.text ?? {}) },
      math: { ...defaultOptionsSettings.math, ...(block.settings?.math ?? {}) },
      image: {
        ...defaultOptionsSettings.image,
        ...(block.settings?.image ?? {}),
        crop: { ...defaultOptionsSettings.image.crop, ...(block.settings?.image?.crop ?? {}) }
      }
    }
  };
}

export function normalizeTableBlock(block: TableBlock): TableBlock {
  const fallback = createTableBlock();
  const settings = { ...defaultTableSettings, ...(block?.settings ?? {}) };
  const rows = Array.isArray(block?.rows) && block.rows.length > 0
    ? block.rows.map((row) => row.map(normalizeTableCell))
    : fallback.rows;
  const firstCell = rows[0]?.[0]?.id ?? "";
  const selectedCellId = rows.flat().some((cell) => cell.id === block?.selectedCellId) ? block.selectedCellId : firstCell;

  return {
    ...fallback,
    ...block,
    type: "table",
    rows,
    columnWidths: block?.columnWidths?.length ? block.columnWidths : rows[0]?.map((_, index) => (index === 0 && settings.showHeaderColumn ? 46 : 96)) ?? [],
    rowHeights: block?.rowHeights?.length ? block.rowHeights : rows.map(() => settings.rowHeight),
    selectedCellId,
    selectionAnchorCellId: block?.selectionAnchorCellId ?? selectedCellId,
    selectedCellIds: block?.selectedCellIds?.length ? block.selectedCellIds : selectedCellId ? [selectedCellId] : [],
    settings
  };
}

function normalizeOption(option: McqOption): McqOption {
  return {
    ...option,
    id: option.id ?? nanoid(),
    contentType: option.contentType ?? (option.image?.dataUrl ? (option.text?.trim() ? "mixed" : "image") : "text"),
    text: option.text ?? "",
    image: option.image
      ? {
          ...option.image,
          width: option.image.width ?? defaultOptionsSettings.image.width,
          height: option.image.height ?? defaultOptionsSettings.image.height,
          lockAspectRatio: option.image.lockAspectRatio ?? defaultOptionsSettings.image.lockAspectRatio,
          rotation: option.image.rotation ?? defaultOptionsSettings.image.rotation,
          crop: { ...defaultOptionsSettings.image.crop, ...(option.image.crop ?? {}) },
          horizontalAlignment: option.image.horizontalAlignment ?? defaultOptionsSettings.image.horizontalAlignment,
          verticalAlignment: option.image.verticalAlignment ?? defaultOptionsSettings.image.verticalAlignment,
          spacingBefore: option.image.spacingBefore ?? defaultOptionsSettings.image.spacingBefore,
          spacingAfter: option.image.spacingAfter ?? defaultOptionsSettings.image.spacingAfter,
          border: option.image.border ?? defaultOptionsSettings.image.border
        }
      : undefined
  };
}

function normalizeTableCell(cell: TableCell): TableCell {
  const fallback = createTableCell();
  return {
    ...fallback,
    ...cell,
    id: cell.id ?? nanoid(),
    text: cell.text ?? "",
    contentType: cell.contentType ?? (cell.image?.dataUrl ? (cell.text?.trim() ? "mixed" : "image") : "text"),
    rowSpan: cell.rowSpan ?? 1,
    colSpan: cell.colSpan ?? 1,
    borders: { top: true, right: true, bottom: true, left: true, ...(cell.borders ?? {}) },
    horizontalAlignment: cell.horizontalAlignment ?? "center",
    verticalAlignment: cell.verticalAlignment ?? "middle",
    image: cell.image
      ? {
          ...cell.image,
          width: cell.image.width ?? 70,
          height: cell.image.height ?? 45,
          lockAspectRatio: cell.image.lockAspectRatio ?? true,
          horizontalAlignment: cell.image.horizontalAlignment ?? "center",
          verticalAlignment: cell.image.verticalAlignment ?? "middle"
        }
      : undefined
  };
}
