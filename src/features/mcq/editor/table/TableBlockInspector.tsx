import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Clipboard,
  Columns3,
  Grid3X3,
  Image as ImageIcon,
  Lock,
  Merge,
  Rows3,
  Split,
  Trash2
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { Alignment, TableBlock, TableCell, VerticalAlignment } from "../types";
import { createTableCell } from "../tableBlockDefaults";
import { TableWithLatex } from "./TableWithLatex";
import { clearSelectedCells, findCellPosition, getSelectedCells, getSelectionBounds, mergeSelectedCells, selectCell, unmergeSelectedCells, updateSelectedCells } from "./tableOps";

export function TableBlockInspector({ block, onUpdate }: { block: TableBlock; onUpdate: (updater: (block: TableBlock) => TableBlock) => void }) {
  const cellTextRef = useRef<HTMLTextAreaElement | null>(null);
  const cellImageInputRef = useRef<HTMLInputElement | null>(null);
  const selected = getSelectedCells(block)[0] ?? block.rows[0]?.[0];
  const bounds = getSelectionBounds(block);
  const selectedLabel = `R${bounds.top + 1}:C${bounds.left + 1}${bounds.top !== bounds.bottom || bounds.left !== bounds.right ? ` - R${bounds.bottom + 1}:C${bounds.right + 1}` : ""}`;

  useEffect(() => {
    cellTextRef.current?.focus();
  }, [block.selectedCellId, block.selectedCellIds?.join("|")]);

  function updateSettings<T extends keyof TableBlock["settings"]>(key: T, value: TableBlock["settings"][T]) {
    onUpdate((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  }

  function updateCell(patch: Partial<TableCell>) {
    onUpdate((current) => updateSelectedCells(current, patch));
  }

  function loadCellImage(file?: File) {
    if (!file || !selected) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateCell({
        contentType: selected.text.trim() ? "mixed" : "image",
        image: {
          ...(selected.image ?? {}),
          dataUrl: String(reader.result),
          fileName: file.name,
          altText: selected.image?.altText || file.name.replace(/\.[^.]+$/, ""),
          width: selected.image?.width ?? 72,
          height: selected.image?.height ?? 42,
          lockAspectRatio: selected.image?.lockAspectRatio ?? true,
          horizontalAlignment: selected.image?.horizontalAlignment ?? selected.horizontalAlignment,
          verticalAlignment: selected.image?.verticalAlignment ?? selected.verticalAlignment
        }
      });
    };
    reader.readAsDataURL(file);
  }

  async function pasteCellImage() {
    const items = await navigator.clipboard?.read?.().catch(() => []);
    const imageItem = items?.flatMap((item) => item.types.map((type) => ({ item, type }))).find(({ type }) => type.startsWith("image/"));
    if (!imageItem) return;
    const blob = await imageItem.item.getType(imageItem.type);
    loadCellImage(new File([blob], `clipboard-cell-${Date.now()}.png`, { type: blob.type || "image/png" }));
  }

  function setCellImageWidth(width: number) {
    if (!selected?.image) return;
    const ratio = selected.image.width / selected.image.height;
    updateCell({
      image: {
        ...selected.image,
        width,
        height: selected.image.lockAspectRatio ? Math.max(8, Math.round(width / ratio)) : selected.image.height
      }
    });
  }

  function setCellImageHeight(height: number) {
    if (!selected?.image) return;
    const ratio = selected.image.width / selected.image.height;
    updateCell({
      image: {
        ...selected.image,
        height,
        width: selected.image.lockAspectRatio ? Math.max(8, Math.round(height * ratio)) : selected.image.width
      }
    });
  }

  function addRow(where: "above" | "below") {
    onUpdate((current) => {
      const position = findCellPosition(current, current.selectedCellId) ?? { row: current.rows.length - 1, column: 0 };
      const insertIndex = where === "above" ? position.row : position.row + 1;
      const newRow = current.rows[0].map((_, index) => createTableCell(index === 0 && current.settings.showHeaderColumn ? "" : "", index === 0 && current.settings.showHeaderColumn));
      const rows = [...current.rows];
      rows.splice(insertIndex, 0, newRow);
      const rowHeights = [...(current.rowHeights ?? current.rows.map(() => current.settings.rowHeight))];
      rowHeights.splice(insertIndex, 0, current.settings.rowHeight);
      return { ...current, rows, rowHeights, selectedCellId: newRow[0].id, selectionAnchorCellId: newRow[0].id, selectedCellIds: [newRow[0].id] };
    });
  }

  function addColumn(where: "left" | "right") {
    onUpdate((current) => {
      const position = findCellPosition(current, current.selectedCellId) ?? { row: 0, column: current.rows[0].length - 1 };
      const insertIndex = where === "left" ? position.column : position.column + 1;
      let selectedCellId = current.selectedCellId;
      const rows = current.rows.map((row, rowIndex) => {
        const cell = createTableCell(rowIndex === 0 && current.settings.showHeaderRow ? "" : "", rowIndex === 0 && current.settings.showHeaderRow);
        if (rowIndex === 0) selectedCellId = cell.id;
        const next = [...row];
        next.splice(insertIndex, 0, cell);
        return next;
      });
      const columnWidths = [...(current.columnWidths ?? current.rows[0].map(() => 96))];
      columnWidths.splice(insertIndex, 0, 96);
      return { ...current, rows, columnWidths, selectedCellId, selectionAnchorCellId: selectedCellId, selectedCellIds: [selectedCellId] };
    });
  }

  function deleteSelectedRows() {
    onUpdate((current) => {
      if (current.rows.length <= 1) return current;
      const deleteRows = new Set(Array.from({ length: bounds.bottom - bounds.top + 1 }, (_, index) => bounds.top + index));
      const rows = current.rows.filter((_, rowIndex) => !deleteRows.has(rowIndex));
      const rowHeights = (current.rowHeights ?? current.rows.map(() => current.settings.rowHeight)).filter((_, rowIndex) => !deleteRows.has(rowIndex));
      const selectedCellId = rows[0]?.[0]?.id ?? "";
      return { ...current, rows, rowHeights, selectedCellId, selectionAnchorCellId: selectedCellId, selectedCellIds: selectedCellId ? [selectedCellId] : [] };
    });
  }

  function deleteSelectedColumns() {
    onUpdate((current) => {
      if (current.rows[0].length <= 1) return current;
      const deleteColumns = new Set(Array.from({ length: bounds.right - bounds.left + 1 }, (_, index) => bounds.left + index));
      const rows = current.rows.map((row) => row.filter((_, columnIndex) => !deleteColumns.has(columnIndex)));
      const columnWidths = (current.columnWidths ?? current.rows[0].map(() => 96)).filter((_, columnIndex) => !deleteColumns.has(columnIndex));
      const selectedCellId = rows[0]?.[0]?.id ?? "";
      return { ...current, rows, columnWidths, selectedCellId, selectionAnchorCellId: selectedCellId, selectedCellIds: selectedCellId ? [selectedCellId] : [] };
    });
  }

  function updateColumnWidth(width: number) {
    onUpdate((current) => {
      const columnWidths = [...(current.columnWidths ?? current.rows[0].map(() => 96))];
      for (let column = bounds.left; column <= bounds.right; column += 1) columnWidths[column] = width;
      return { ...current, columnWidths };
    });
  }

  function updateRowHeight(height: number) {
    onUpdate((current) => {
      const rowHeights = [...(current.rowHeights ?? current.rows.map(() => current.settings.rowHeight))];
      for (let row = bounds.top; row <= bounds.bottom; row += 1) rowHeights[row] = height;
      return { ...current, rowHeights };
    });
  }

  function distributeColumns() {
    onUpdate((current) => {
      const columnWidths = [...(current.columnWidths ?? current.rows[0].map(() => 96))];
      const total = Array.from({ length: bounds.right - bounds.left + 1 }, (_, index) => columnWidths[bounds.left + index] ?? 96).reduce((sum, width) => sum + width, 0);
      const width = Math.round(total / (bounds.right - bounds.left + 1));
      for (let column = bounds.left; column <= bounds.right; column += 1) columnWidths[column] = width;
      return { ...current, columnWidths };
    });
  }

  function distributeRows() {
    onUpdate((current) => {
      const rowHeights = [...(current.rowHeights ?? current.rows.map(() => current.settings.rowHeight))];
      const total = Array.from({ length: bounds.bottom - bounds.top + 1 }, (_, index) => rowHeights[bounds.top + index] ?? current.settings.rowHeight).reduce((sum, height) => sum + height, 0);
      const height = Math.round(total / (bounds.bottom - bounds.top + 1));
      for (let row = bounds.top; row <= bounds.bottom; row += 1) rowHeights[row] = height;
      return { ...current, rowHeights };
    });
  }

  function setBorders(mode: BorderButtonMode) {
    onUpdate((current) => {
      const ids = new Set(current.selectedCellIds ?? [current.selectedCellId]);
      return {
        ...current,
        rows: current.rows.map((row) =>
          row.map((cell, cellColumn) => {
            if (!ids.has(cell.id)) return cell;
            const position = findCellPosition(current, cell.id) ?? { row: 0, column: cellColumn };
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
    });
  }

  return (
    <div className="mcq-inspector">
      <header className="mcq-inspector-header">
        <div><span>Selected</span><strong>Table block</strong></div>
        <button className={clsx("mcq-lock-pill", block.settings.locked && "is-active")} type="button" onClick={() => updateSettings("locked", !block.settings.locked)}>
          <Lock size={14} />{block.settings.locked ? "Locked" : "Editable"}
        </button>
      </header>

      <section className="mcq-inspector-section">
        <h3><Grid3X3 size={15} /> Table canvas</h3>
        <div className="mcq-selected-range">Selected {selectedLabel}</div>
        <TableToolbar
          onAddColumnLeft={() => addColumn("left")}
          onAddColumnRight={() => addColumn("right")}
          onAddRowAbove={() => addRow("above")}
          onAddRowBelow={() => addRow("below")}
          onClear={() => onUpdate(clearSelectedCells)}
          onDeleteColumn={deleteSelectedColumns}
          onDeleteRow={deleteSelectedRows}
          onMerge={() => onUpdate(mergeSelectedCells)}
          onUnmerge={() => onUpdate(unmergeSelectedCells)}
        />
        <TableWithLatex block={block} compact editable onSelectCell={(id, extend) => onUpdate((current) => selectCell(current, id, extend))} />
      </section>

      <section className="mcq-inspector-section">
        <h3><Grid3X3 size={15} /> Cell content</h3>
        <label className="mcq-control mcq-control-full">
          <span>Type cell text, $...$ LaTeX, arrows, or paste image</span>
          <textarea ref={cellTextRef} placeholder="Cell content" value={selected?.text ?? ""} onChange={(event) => updateCell({ text: event.target.value, contentType: selected?.image?.dataUrl ? "mixed" : "text" })} />
        </label>
        <input ref={cellImageInputRef} accept="image/*" hidden type="file" onChange={(event) => loadCellImage(event.target.files?.[0])} />
        <div className="mcq-table-cell-image-tools">
          <button type="button" onClick={() => cellImageInputRef.current?.click()}><ImageIcon size={14} /> Choose image</button>
          <button type="button" onClick={() => void pasteCellImage()}><Clipboard size={14} /> Paste</button>
          <button type="button" disabled={!selected?.image} onClick={() => updateCell({ image: undefined, contentType: selected?.text.trim() ? "text" : "text" })}><Trash2 size={14} /> Clear</button>
        </div>
        {selected?.image?.dataUrl ? (
          <div className="mcq-table-cell-image-panel">
            <div className="mcq-table-cell-image-preview">
              <img alt={selected.image.altText} src={selected.image.dataUrl} style={{ width: selected.image.width, height: selected.image.height }} />
            </div>
            <div className="mcq-table-cell-grid">
              <NumberControl label="Image width" value={selected.image.width} min={12} max={240} onChange={setCellImageWidth} />
              <NumberControl label="Image height" value={selected.image.height} min={10} max={180} onChange={setCellImageHeight} />
              <label className="mcq-check-row"><input checked={selected.image.lockAspectRatio ?? true} type="checkbox" onChange={(event) => updateCell({ image: { ...selected.image!, lockAspectRatio: event.target.checked } })} /> Lock ratio</label>
            </div>
          </div>
        ) : null}
        <div className="mcq-table-cell-grid">
          <label className="mcq-check-row"><input checked={selected?.header ?? false} type="checkbox" onChange={(event) => updateCell({ header: event.target.checked, bold: event.target.checked })} /> Header cell</label>
          <label className="mcq-check-row"><input checked={selected?.hidden ?? false} type="checkbox" onChange={(event) => updateCell({ hidden: event.target.checked })} /> Hide covered cell</label>
          <label className="mcq-check-row"><input checked={selected?.bold ?? false} type="checkbox" onChange={(event) => updateCell({ bold: event.target.checked })} /> Bold</label>
          <label className="mcq-check-row"><input checked={selected?.italic ?? false} type="checkbox" onChange={(event) => updateCell({ italic: event.target.checked })} /> Italic</label>
        </div>
        <div className="mcq-option-image-placement-grid">
          <span className="mcq-mini-label">Horizontal</span>
          <IconToggle active={selected?.horizontalAlignment === "left"} label="Left" onClick={() => updateCell({ horizontalAlignment: "left" })} icon={<AlignLeft size={15} />} />
          <IconToggle active={selected?.horizontalAlignment === "center"} label="Center" onClick={() => updateCell({ horizontalAlignment: "center" })} icon={<AlignCenter size={15} />} />
          <IconToggle active={selected?.horizontalAlignment === "right"} label="Right" onClick={() => updateCell({ horizontalAlignment: "right" })} icon={<AlignRight size={15} />} />
          <span className="mcq-mini-label">Vertical</span>
          <VerticalToggle active={selected?.verticalAlignment === "top"} value="top" onClick={() => updateCell({ verticalAlignment: "top" })} />
          <VerticalToggle active={selected?.verticalAlignment === "middle"} value="middle" onClick={() => updateCell({ verticalAlignment: "middle" })} />
          <VerticalToggle active={selected?.verticalAlignment === "bottom"} value="bottom" onClick={() => updateCell({ verticalAlignment: "bottom" })} />
        </div>
      </section>

      <section className="mcq-inspector-section">
        <h3><Grid3X3 size={15} /> Borders</h3>
        <div className="mcq-border-tool-grid">
          {borderModes.map((mode) => (
            <BorderButton key={mode} mode={mode as BorderButtonMode} onClick={() => setBorders(mode as Parameters<typeof setBorders>[0])} />
          ))}
        </div>
      </section>

      <section className="mcq-inspector-section">
        <h3><Grid3X3 size={15} /> Dimensions and layout</h3>
        <div className="mcq-table-layout-strip">
          <span className="mcq-mini-label">Table alignment</span>
          <IconToggle active={block.settings.horizontalAlignment === "left"} label="Align table left" onClick={() => updateSettings("horizontalAlignment", "left")} icon={<AlignLeft size={15} />} />
          <IconToggle active={block.settings.horizontalAlignment === "center"} label="Align table center" onClick={() => updateSettings("horizontalAlignment", "center")} icon={<AlignCenter size={15} />} />
          <IconToggle active={block.settings.horizontalAlignment === "right"} label="Align table right" onClick={() => updateSettings("horizontalAlignment", "right")} icon={<AlignRight size={15} />} />
          <span className="mcq-mini-label">Width</span>
          <button className={clsx("mcq-table-mode-button", block.settings.widthMode === "auto" && "is-active")} type="button" onClick={() => updateSettings("widthMode", "auto")}>Auto</button>
          <button className={clsx("mcq-table-mode-button", block.settings.widthMode === "full" && "is-active")} type="button" onClick={() => updateSettings("widthMode", "full")}>Full</button>
          <button className={clsx("mcq-table-mode-button", block.settings.widthMode === "custom" && "is-active")} type="button" onClick={() => updateSettings("widthMode", "custom")}>Custom</button>
        </div>
        <div className="mcq-table-cell-grid mcq-table-cell-grid-compact">
          <NumberControl label="Column width" value={block.columnWidths?.[bounds.left] ?? 96} min={24} max={260} onChange={updateColumnWidth} />
          <NumberControl label="Row height" value={block.rowHeights?.[bounds.top] ?? block.settings.rowHeight} min={16} max={120} onChange={updateRowHeight} />
          <IconToggle active={false} label="Distribute selected columns equally" onClick={distributeColumns} icon={<Columns3 size={15} />} />
          <IconToggle active={false} label="Distribute selected rows equally" onClick={distributeRows} icon={<Rows3 size={15} />} />
        </div>
        <div className="mcq-table-cell-grid">
          <NumberControl label="Custom width" value={block.settings.customWidth} min={120} max={680} onChange={(customWidth) => updateSettings("customWidth", customWidth)} />
          <NumberControl label="Font size" value={block.settings.fontSize} min={8} max={18} onChange={(fontSize) => updateSettings("fontSize", fontSize)} />
          <NumberControl label="Padding" value={block.settings.cellPadding} min={1} max={18} onChange={(cellPadding) => updateSettings("cellPadding", cellPadding)} />
          <NumberControl label="Before" value={block.settings.spacingBefore} min={0} max={36} onChange={(spacingBefore) => updateSettings("spacingBefore", spacingBefore)} />
          <NumberControl label="After" value={block.settings.spacingAfter} min={0} max={36} onChange={(spacingAfter) => updateSettings("spacingAfter", spacingAfter)} />
        </div>
      </section>
    </div>
  );
}

export type BorderButtonMode = "bottom" | "top" | "left" | "right" | "none" | "all" | "outer" | "inner" | "inside-horizontal" | "inside-vertical";

export const borderModes: BorderButtonMode[] = ["bottom", "top", "left", "right", "none", "all", "outer", "inner", "inside-horizontal", "inside-vertical"];

const borderModeLabels: Record<BorderButtonMode, string> = {
  bottom: "Bottom border",
  top: "Top border",
  left: "Left border",
  right: "Right border",
  none: "No border",
  all: "All borders",
  outer: "Outside borders",
  inner: "Inside borders",
  "inside-horizontal": "Inside horizontal border",
  "inside-vertical": "Inside vertical border"
};

export function BorderButton({ mode, onClick }: { mode: BorderButtonMode; onClick: () => void }) {
  return (
    <button aria-label={borderModeLabels[mode]} className="mcq-border-icon-button" title={borderModeLabels[mode]} type="button" onClick={onClick}>
      <span className={clsx("mcq-border-glyph", `is-${mode}`)}>
        <i /><b />
      </span>
    </button>
  );
}

export function TableToolbar({
  onAddRowAbove,
  onAddRowBelow,
  onDeleteRow,
  onAddColumnLeft,
  onAddColumnRight,
  onDeleteColumn,
  onMerge,
  onUnmerge,
  onClear
}: {
  onAddRowAbove: () => void;
  onAddRowBelow: () => void;
  onDeleteRow: () => void;
  onAddColumnLeft: () => void;
  onAddColumnRight: () => void;
  onDeleteColumn: () => void;
  onMerge: () => void;
  onUnmerge: () => void;
  onClear: () => void;
}) {
  return (
    <div className="mcq-table-tools-row">
      <button type="button" onClick={onAddRowAbove}><Rows3 size={14} /> Row above</button>
      <button type="button" onClick={onAddRowBelow}><Rows3 size={14} /> Row below</button>
      <button type="button" onClick={onDeleteRow}><Trash2 size={14} /> Row</button>
      <button type="button" onClick={onAddColumnLeft}><Columns3 size={14} /> Col left</button>
      <button type="button" onClick={onAddColumnRight}><Columns3 size={14} /> Col right</button>
      <button type="button" onClick={onDeleteColumn}><Trash2 size={14} /> Col</button>
      <button type="button" onClick={onMerge}><Merge size={14} /> Merge</button>
      <button type="button" onClick={onUnmerge}><Split size={14} /> Unmerge</button>
      <button type="button" onClick={onClear}>Clear</button>
    </div>
  );
}

function IconToggle({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return <button aria-label={label} className={clsx("mcq-icon-toggle", active && "is-active")} type="button" onClick={onClick}>{icon}</button>;
}

function VerticalToggle({ active, value, onClick }: { active: boolean; value: VerticalAlignment; onClick: () => void }) {
  const icon = value === "top" ? <AlignVerticalJustifyStart size={15} /> : value === "bottom" ? <AlignVerticalJustifyEnd size={15} /> : <AlignVerticalJustifyCenter size={15} />;
  return <button aria-label={`Align ${value}`} className={clsx("mcq-icon-toggle", active && "is-active")} type="button" onClick={onClick}>{icon}</button>;
}

function NumberControl({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="mcq-control"><span>{label}</span><input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
