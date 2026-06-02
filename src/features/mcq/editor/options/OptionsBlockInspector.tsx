import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Baseline,
  Bold,
  Check,
  Clipboard,
  Columns3,
  Copy,
  Eye,
  Image as ImageIcon,
  Italic,
  List,
  Lock,
  Plus,
  RemoveFormatting,
  RotateCcw,
  RotateCw,
  Rows3,
  Scissors,
  Shuffle,
  Table2,
  Trash2,
  Underline
} from "lucide-react";
import clsx from "clsx";
import katex from "katex";
import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Alignment, McqOption, OptionLabelPosition, OptionLayout, OptionTypographySettings, OptionsBlock, TableBlock, TableCell, VerticalAlignment } from "../types";
import { defaultOptionsSettings, optionTextPlaceholders } from "../optionsBlockDefaults";
import { OptionTextWithLatex } from "./OptionTextWithLatex";
import { createTableCell } from "../tableBlockDefaults";
import { TableWithLatex } from "../table/TableWithLatex";
import { BorderButton, borderModes, TableToolbar } from "../table/TableBlockInspector";
import { clearSelectedCells, findCellPosition, getSelectionBounds, mergeSelectedCells, selectCell, unmergeSelectedCells, updateSelectedCells } from "../table/tableOps";
import { normalizeOptionsBlock } from "../normalizeBlocks";

const fonts = ["Calibri", "Arial", "Times New Roman", "Cambria", "Segoe UI"];
const colors = ["Default", "Black", "Blue", "Red"];
const defaultCrop = { x: 0, y: 0, width: 100, height: 100 };
type BorderMode = "bottom" | "top" | "left" | "right" | "none" | "all" | "outer" | "inner" | "inside-horizontal" | "inside-vertical";

type OptionsBlockInspectorProps = {
  block: OptionsBlock;
  onUpdate: (updater: (block: OptionsBlock) => OptionsBlock) => void;
};

export function OptionsBlockInspector({ block, onUpdate }: OptionsBlockInspectorProps) {
  const optionRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const optionImageRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const tableCellTextRef = useRef<HTMLTextAreaElement | null>(null);
  const tableCellImageInputRef = useRef<HTMLInputElement | null>(null);
  const selectedOption = block.options.find((option) => option.id === block.selectedOptionId) ?? block.options[0];
  const selectedTableCell = block.table ? findTableCell(block.table) : undefined;
  const selectedImageCrop = selectedOption.image?.crop ?? block.settings.image.crop ?? defaultCrop;
  const latexPreview = katex.renderToString(block.inlineLatexSource || "15\\,m\\,s^{-1}", {
    throwOnError: false,
    output: "html"
  });

  function updateSettings(updater: (settings: OptionsBlock["settings"]) => OptionsBlock["settings"]) {
    onUpdate((current) => ({ ...current, settings: updater(current.settings) }));
  }

  function updateTypography(type: "label" | "text" | "math", patch: Partial<OptionTypographySettings>) {
    updateSettings((settings) => ({
      ...settings,
      [type]: { ...(settings[type] ?? defaultOptionsSettings[type]), ...patch }
    }));
  }

  function setMode(mode: OptionsBlock["mode"]) {
    onUpdate((current) => ({ ...current, mode }));
  }

  function updateTable(updater: (table: TableBlock) => TableBlock) {
    onUpdate((current) => ({ ...current, table: updater(current.table) }));
  }

  function updateTableCell(patch: Partial<TableCell>) {
    updateTable((table) => updateSelectedCells(table, patch));
  }

  useEffect(() => {
    if (block.mode === "table") tableCellTextRef.current?.focus();
  }, [block.mode, block.table?.selectedCellId, block.table?.selectedCellIds?.join("|")]);

  function addTableColumn(where: "left" | "right") {
    updateTable((table) => ({
      ...table,
      rows: table.rows.map((row, rowIndex) => {
        const position = findCellPosition(table, table.selectedCellId) ?? { row: 0, column: row.length - 1 };
        const insertIndex = where === "left" ? position.column : position.column + 1;
        const next = [...row];
        next.splice(insertIndex, 0, createTableCell(rowIndex === 0 ? "" : "", rowIndex === 0));
        return next;
      }),
      columnWidths: insertNumber(table.columnWidths ?? table.rows[0].map(() => 96), where === "left" ? (findCellPosition(table, table.selectedCellId)?.column ?? 0) : (findCellPosition(table, table.selectedCellId)?.column ?? 0) + 1, 96)
    }));
  }

  function addTableRow(where: "above" | "below") {
    updateTable((table) => ({
      ...table,
      rows: insertRow(table.rows, where === "above" ? (findCellPosition(table, table.selectedCellId)?.row ?? table.rows.length - 1) : (findCellPosition(table, table.selectedCellId)?.row ?? table.rows.length - 1) + 1, table.rows[0].map((_, index) => createTableCell("", index === 0))),
      rowHeights: insertNumber(table.rowHeights ?? table.rows.map(() => table.settings.rowHeight), where === "above" ? (findCellPosition(table, table.selectedCellId)?.row ?? table.rows.length - 1) : (findCellPosition(table, table.selectedCellId)?.row ?? table.rows.length - 1) + 1, table.settings.rowHeight)
    }));
  }

  function loadTableCellImage(file?: File) {
    if (!file || !selectedTableCell) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateTableCell({
        contentType: selectedTableCell.text.trim() ? "mixed" : "image",
        image: {
          ...(selectedTableCell.image ?? {}),
          dataUrl: String(reader.result),
          fileName: file.name,
          altText: selectedTableCell.image?.altText || file.name.replace(/\.[^.]+$/, ""),
          width: selectedTableCell.image?.width ?? 72,
          height: selectedTableCell.image?.height ?? 42,
          lockAspectRatio: selectedTableCell.image?.lockAspectRatio ?? true,
          horizontalAlignment: selectedTableCell.image?.horizontalAlignment ?? selectedTableCell.horizontalAlignment,
          verticalAlignment: selectedTableCell.image?.verticalAlignment ?? selectedTableCell.verticalAlignment
        }
      });
    };
    reader.readAsDataURL(file);
  }

  async function pasteTableCellImage() {
    const items = await navigator.clipboard?.read?.().catch(() => []);
    const imageItem = items?.flatMap((item) => item.types.map((type) => ({ item, type }))).find(({ type }) => type.startsWith("image/"));
    if (!imageItem) return;
    const blob = await imageItem.item.getType(imageItem.type);
    loadTableCellImage(new File([blob], `clipboard-cell-${Date.now()}.png`, { type: blob.type || "image/png" }));
  }

  function setTableCellImageWidth(width: number) {
    if (!selectedTableCell?.image) return;
    const ratio = selectedTableCell.image.width / selectedTableCell.image.height;
    updateTableCell({
      image: {
        ...selectedTableCell.image,
        width,
        height: selectedTableCell.image.lockAspectRatio ? Math.max(8, Math.round(width / ratio)) : selectedTableCell.image.height
      }
    });
  }

  function setTableCellImageHeight(height: number) {
    if (!selectedTableCell?.image) return;
    const ratio = selectedTableCell.image.width / selectedTableCell.image.height;
    updateTableCell({
      image: {
        ...selectedTableCell.image,
        height,
        width: selectedTableCell.image.lockAspectRatio ? Math.max(8, Math.round(height * ratio)) : selectedTableCell.image.width
      }
    });
  }

  function updateOption(id: string, text: string) {
    onUpdate((current) => ({
      ...current,
      options: current.options.map((option) => (option.id === id ? { ...option, text } : option))
    }));
  }

  function updateOptionContentType(id: string, contentType: McqOption["contentType"]) {
    onUpdate((current) => ({
      ...current,
      options: current.options.map((option) => (option.id === id ? { ...option, contentType } : option))
    }));
  }

  function loadOptionImage(optionId: string, file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      const dimensions = await readImageDimensions(dataUrl);
      onUpdate((current) => ({
        ...current,
        options: current.options.map((option) =>
          option.id === optionId
            ? {
                ...option,
                contentType: option.text.trim() ? "mixed" : "image",
                image: {
                  ...(option.image ?? {}),
                  dataUrl,
                  fileName: file.name,
                  altText: option.image?.altText || file.name.replace(/\.[^.]+$/, ""),
                  naturalWidth: dimensions.width,
                  naturalHeight: dimensions.height,
                  aspectRatio: dimensions.ratio,
                  width: option.image?.width ?? current.settings.image.width,
                  height: option.image?.height ?? current.settings.image.height,
                  lockAspectRatio: option.image?.lockAspectRatio ?? current.settings.image.lockAspectRatio,
                  rotation: option.image?.rotation ?? current.settings.image.rotation,
                  crop: option.image?.crop ?? current.settings.image.crop ?? defaultCrop,
                  horizontalAlignment: option.image?.horizontalAlignment ?? current.settings.image.horizontalAlignment,
                  verticalAlignment: option.image?.verticalAlignment ?? current.settings.image.verticalAlignment,
                  spacingBefore: option.image?.spacingBefore ?? current.settings.image.spacingBefore,
                  spacingAfter: option.image?.spacingAfter ?? current.settings.image.spacingAfter,
                  border: option.image?.border ?? current.settings.image.border
                }
              }
            : option
        )
      }));
    };
    reader.readAsDataURL(file);
  }

  async function pasteOptionImage(optionId: string) {
    const items = await navigator.clipboard?.read?.().catch(() => []);
    const imageItem = items?.flatMap((item) => item.types.map((type) => ({ item, type }))).find(({ type }) => type.startsWith("image/"));
    if (!imageItem) return;
    const blob = await imageItem.item.getType(imageItem.type);
    loadOptionImage(optionId, new File([blob], `clipboard-option-${Date.now()}.png`, { type: blob.type || "image/png" }));
  }

  function setSelectedOption(id: string) {
    onUpdate((current) => ({ ...current, selectedOptionId: id }));
  }

  function wrapSelection(tag: "b" | "i" | "u" | "sub" | "sup") {
    const textarea = optionRefs.current[selectedOption.id];
    const start = textarea?.selectionStart ?? selectedOption.text.length;
    const end = textarea?.selectionEnd ?? selectedOption.text.length;
    const opening = `<${tag}>`;
    const closing = `</${tag}>`;

    onUpdate((current) => ({
      ...current,
      options: current.options.map((option) => {
        if (option.id !== selectedOption.id) return option;
        const selected = option.text.slice(start, end);
        return { ...option, text: `${option.text.slice(0, start)}${opening}${selected}${closing}${option.text.slice(end)}` };
      })
    }));

    requestAnimationFrame(() => {
      const nextTextarea = optionRefs.current[selectedOption.id];
      if (!nextTextarea) return;
      nextTextarea.focus();
      nextTextarea.setSelectionRange(start + opening.length, start + opening.length + (end - start));
    });
  }

  function insertLatex(replace = false) {
    const textarea = optionRefs.current[selectedOption.id];
    const start = textarea?.selectionStart ?? selectedOption.text.length;
    const end = textarea?.selectionEnd ?? selectedOption.text.length;
    const source = `$${block.inlineLatexSource || "15\\,m\\,s^{-1}"}$`;
    let nextCaret = start + source.length;

    onUpdate((current) => ({
      ...current,
      options: current.options.map((option) => {
        if (option.id !== selectedOption.id) return option;
        const insertAt = start;
        const replaceEnd = replace ? end : start;
        const spacerBefore = !replace && insertAt > 0 && !/\s/.test(option.text[insertAt - 1]) ? " " : "";
        const spacerAfter = !replace && option.text[insertAt] && !/\s/.test(option.text[insertAt]) ? " " : "";
        nextCaret = insertAt + spacerBefore.length + source.length;
        return { ...option, text: `${option.text.slice(0, insertAt)}${spacerBefore}${source}${spacerAfter}${option.text.slice(replaceEnd)}` };
      })
    }));

    requestAnimationFrame(() => {
      const nextTextarea = optionRefs.current[selectedOption.id];
      if (!nextTextarea) return;
      nextTextarea.focus();
      nextTextarea.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function clearOption(optionId: string) {
    onUpdate((current) => ({
      ...current,
      options: current.options.map((option) => (option.id === optionId ? { ...option, text: "", image: undefined, contentType: "text" } : option))
    }));
  }

  function duplicateOption(option: McqOption) {
    updateOption(option.id, option.text);
  }

  function updateSelectedImage(patch: Partial<NonNullable<McqOption["image"]>>) {
    onUpdate((current) => ({
      ...current,
      options: current.options.map((option) =>
        option.id === selectedOption.id
          ? {
              ...option,
              image: {
                fileName: "",
                altText: "",
                width: current.settings.image.width,
                height: current.settings.image.height,
                rotation: current.settings.image.rotation,
                crop: current.settings.image.crop ?? defaultCrop,
                horizontalAlignment: current.settings.image.horizontalAlignment,
                verticalAlignment: current.settings.image.verticalAlignment,
                lockAspectRatio: current.settings.image.lockAspectRatio,
                spacingBefore: current.settings.image.spacingBefore,
                spacingAfter: current.settings.image.spacingAfter,
                border: current.settings.image.border,
                ...(option.image ?? {}),
                ...patch
              }
            }
          : option
      )
    }));
  }

  function setImageWidth(width: number) {
    if (!Number.isFinite(width) || width <= 0) return;
    const ratio = imageAspectRatio(selectedOption.image, block.settings.image.width / block.settings.image.height);
    const lockAspectRatio = selectedOption.image?.lockAspectRatio ?? block.settings.image.lockAspectRatio;
    updateSelectedImage({
      width,
      height: lockAspectRatio ? Math.max(8, Math.round(width / ratio)) : selectedOption.image?.height
    });
  }

  function setImageHeight(height: number) {
    if (!Number.isFinite(height) || height <= 0) return;
    const ratio = imageAspectRatio(selectedOption.image, block.settings.image.width / block.settings.image.height);
    const lockAspectRatio = selectedOption.image?.lockAspectRatio ?? block.settings.image.lockAspectRatio;
    updateSelectedImage({
      height,
      width: lockAspectRatio ? Math.max(8, Math.round(height * ratio)) : selectedOption.image?.width
    });
  }

  function applyImageSettingsToAll() {
    const image = selectedOption.image;
    if (!image) return;
    onUpdate((current) => ({
      ...current,
      settings: {
        ...current.settings,
        image: {
          width: image.width,
          height: image.height,
          lockAspectRatio: image.lockAspectRatio ?? current.settings.image.lockAspectRatio,
          rotation: image.rotation ?? current.settings.image.rotation,
          crop: image.crop ?? current.settings.image.crop ?? defaultCrop,
          horizontalAlignment: image.horizontalAlignment ?? current.settings.image.horizontalAlignment,
          verticalAlignment: image.verticalAlignment ?? current.settings.image.verticalAlignment,
          spacingBefore: image.spacingBefore ?? current.settings.image.spacingBefore,
          spacingAfter: image.spacingAfter ?? current.settings.image.spacingAfter,
          border: image.border ?? current.settings.image.border
        }
      },
      options: current.options.map((option) =>
        option.image
          ? {
              ...option,
              image: {
                ...option.image,
                width: image.width,
                height: image.height,
                lockAspectRatio: image.lockAspectRatio,
                rotation: image.rotation,
                crop: image.crop,
                horizontalAlignment: image.horizontalAlignment,
                verticalAlignment: image.verticalAlignment,
                spacingBefore: image.spacingBefore,
                spacingAfter: image.spacingAfter,
                border: image.border
              }
            }
          : option
      )
    }));
  }

  function clearSelectedImage() {
    onUpdate((current) => ({
      ...current,
      options: current.options.map((option) =>
        option.id === selectedOption.id
          ? {
              ...option,
              image: undefined,
              contentType: option.text.trim() ? "text" : "text"
            }
          : option
      )
    }));
  }

  function rotateSelectedImage(delta: number) {
    updateSelectedImage({ rotation: ((selectedOption.image?.rotation ?? block.settings.image.rotation) + delta + 360) % 360 });
  }

  function updateSelectedCrop(patch: Partial<NonNullable<NonNullable<McqOption["image"]>["crop"]>>) {
    updateSelectedImage({ crop: { ...(selectedOption.image?.crop ?? block.settings.image.crop ?? defaultCrop), ...patch } });
  }

  function resetSelectedImageFrame() {
    updateSelectedImage({
      width: block.settings.image.width,
      height: block.settings.image.height,
      rotation: 0,
      crop: { ...defaultCrop },
      spacingBefore: block.settings.image.spacingBefore,
      spacingAfter: block.settings.image.spacingAfter,
      border: false
    });
  }

  const hasEmptyOption = block.options.some((option) => option.text.trim().length === 0 && !option.image?.dataUrl);

  return (
    <div className="mcq-inspector">
      <header className="mcq-inspector-header">
        <div>
          <span>Selected</span>
          <strong>Options block</strong>
        </div>
        <button
          className={clsx("mcq-lock-pill", block.settings.locked && "is-active")}
          type="button"
          onClick={() => updateSettings((settings) => ({ ...settings, locked: !settings.locked }))}
        >
          <Lock size={14} />
          {block.settings.locked ? "Locked" : "Editable"}
        </button>
      </header>

      <InspectorSection title="Option mode" icon={<List size={15} />}>
        <div className="mcq-segment-row">
          <SegmentButton active={block.mode === "standard"} compact label="Standard options" onClick={() => setMode("standard")}>
            <List size={14} />
          </SegmentButton>
          <SegmentButton active={block.mode === "table"} compact label="Table options" onClick={() => setMode("table")}>
            <Table2 size={14} />
          </SegmentButton>
        </div>
      </InspectorSection>

      {block.mode === "table" ? (
        <InspectorSection title="Table options" icon={<Table2 size={15} />}>
          <div className="mcq-selected-range">Selected {tableRangeLabel(block.table)}</div>
          <TableToolbar
            onAddColumnLeft={() => addTableColumn("left")}
            onAddColumnRight={() => addTableColumn("right")}
            onAddRowAbove={() => addTableRow("above")}
            onAddRowBelow={() => addTableRow("below")}
            onClear={() => updateTable(clearSelectedCells)}
            onDeleteColumn={() => updateTable(deleteTableColumns)}
            onDeleteRow={() => updateTable(deleteTableRows)}
            onMerge={() => updateTable(mergeSelectedCells)}
            onUnmerge={() => updateTable(unmergeSelectedCells)}
          />
          <div className="mcq-table-tools-row">
            <button type="button" onClick={() => onUpdate((current) => ({ ...current, correctAnswer: selectedTableRowLetter(current.table) ?? current.correctAnswer }))}>Use selected row as answer</button>
          </div>
          <TableWithLatex block={block.table} compact editable onSelectCell={(selectedCellId, extend) => updateTable((table) => selectCell(table, selectedCellId, extend))} />
          <label className="mcq-control mcq-control-full">
            <span>Selected cell text. Use $...$ or commands such as \rightarrow.</span>
            <textarea ref={tableCellTextRef} value={selectedTableCell?.text ?? ""} onChange={(event) => updateTableCell({ text: event.target.value, contentType: selectedTableCell?.image?.dataUrl ? "mixed" : "text" })} />
          </label>
          <input ref={tableCellImageInputRef} accept="image/*" hidden type="file" onChange={(event) => loadTableCellImage(event.target.files?.[0])} />
          <div className="mcq-table-cell-image-tools">
            <button type="button" onClick={() => tableCellImageInputRef.current?.click()}><ImageIcon size={14} /> Choose image</button>
            <button type="button" onClick={() => void pasteTableCellImage()}><Clipboard size={14} /> Paste</button>
            <button type="button" disabled={!selectedTableCell?.image} onClick={() => updateTableCell({ image: undefined, contentType: selectedTableCell?.text.trim() ? "text" : "text" })}><Trash2 size={14} /> Clear</button>
          </div>
          {selectedTableCell?.image?.dataUrl ? (
            <div className="mcq-table-cell-image-panel">
              <div className="mcq-table-cell-image-preview">
                <img alt={selectedTableCell.image.altText} src={selectedTableCell.image.dataUrl} style={{ width: selectedTableCell.image.width, height: selectedTableCell.image.height }} />
              </div>
              <div className="mcq-table-cell-grid">
                <NumberControl label="Image width" value={selectedTableCell.image.width} min={12} max={240} onChange={setTableCellImageWidth} />
                <NumberControl label="Image height" value={selectedTableCell.image.height} min={10} max={180} onChange={setTableCellImageHeight} />
                <label className="mcq-check-row"><input checked={selectedTableCell.image.lockAspectRatio ?? true} type="checkbox" onChange={(event) => updateTableCell({ image: { ...selectedTableCell.image!, lockAspectRatio: event.target.checked } })} /> Lock ratio</label>
              </div>
            </div>
          ) : null}
          <div className="mcq-table-cell-grid">
            <NumberControl label="Col span" value={findTableCell(block.table)?.colSpan ?? 1} min={1} max={6} onChange={(colSpan) => updateTableCell({ colSpan })} />
            <NumberControl label="Row span" value={findTableCell(block.table)?.rowSpan ?? 1} min={1} max={6} onChange={(rowSpan) => updateTableCell({ rowSpan })} />
            <label className="mcq-check-row"><input checked={findTableCell(block.table)?.header ?? false} type="checkbox" onChange={(event) => updateTableCell({ header: event.target.checked, bold: event.target.checked })} /> Header</label>
            <label className="mcq-check-row"><input checked={findTableCell(block.table)?.hidden ?? false} type="checkbox" onChange={(event) => updateTableCell({ hidden: event.target.checked })} /> Hide covered</label>
          </div>
          <div className="mcq-table-layout-strip">
            <span className="mcq-mini-label">Table alignment</span>
            <IconToggle active={block.table.settings.horizontalAlignment === "left"} label="Align table left" onClick={() => updateTable((table) => ({ ...table, settings: { ...table.settings, horizontalAlignment: "left" } }))} icon={<AlignLeft size={15} />} />
            <IconToggle active={block.table.settings.horizontalAlignment === "center"} label="Align table center" onClick={() => updateTable((table) => ({ ...table, settings: { ...table.settings, horizontalAlignment: "center" } }))} icon={<AlignCenter size={15} />} />
            <IconToggle active={block.table.settings.horizontalAlignment === "right"} label="Align table right" onClick={() => updateTable((table) => ({ ...table, settings: { ...table.settings, horizontalAlignment: "right" } }))} icon={<AlignRight size={15} />} />
          </div>
          <div className="mcq-table-cell-grid mcq-table-cell-grid-compact">
            <NumberControl label="Column width" value={block.table.columnWidths?.[getSelectionBounds(block.table).left] ?? 96} min={24} max={260} onChange={(width) => updateTable((table) => updateTableColumnsWidth(table, width))} />
            <NumberControl label="Row height" value={block.table.rowHeights?.[getSelectionBounds(block.table).top] ?? block.table.settings.rowHeight} min={16} max={120} onChange={(height) => updateTable((table) => updateTableRowsHeight(table, height))} />
            <IconToggle active={false} label="Distribute selected columns equally" onClick={() => updateTable(distributeTableColumns)} icon={<Columns3 size={15} />} />
            <IconToggle active={false} label="Distribute selected rows equally" onClick={() => updateTable(distributeTableRows)} icon={<Rows3 size={15} />} />
          </div>
          <div className="mcq-border-tool-grid">
            {borderModes.map((mode) => (
              <BorderButton key={mode} mode={mode as BorderMode} onClick={() => updateTable((table) => setTableBorders(table, mode as BorderMode))} />
            ))}
          </div>
        </InspectorSection>
      ) : null}

      {block.mode === "standard" ? <InspectorSection title="Layout" icon={<AlignLeft size={15} />}>
        <div className="mcq-layout-control-row">
          <div className="mcq-segment-row">
            <SegmentButton active={block.settings.layout === "one"} compact label="One column" onClick={() => setLayout("one")}>
              <span className="mcq-column-icon is-one"><i /></span>
            </SegmentButton>
            <SegmentButton active={block.settings.layout === "two"} compact label="Two columns" onClick={() => setLayout("two")}>
              <span className="mcq-column-icon is-two"><i /><i /></span>
            </SegmentButton>
            <SegmentButton active={block.settings.layout === "four"} compact label="Four columns" onClick={() => setLayout("four")}>
              <span className="mcq-column-icon is-four"><i /><i /><i /><i /></span>
            </SegmentButton>
          </div>
          <NumberControl label="Label width" value={block.settings.labelWidth} min={18} max={42} onChange={(value) => updateSettings((settings) => ({ ...settings, labelWidth: value }))} />
          <NumberControl label="Option gap" value={block.settings.optionGap} min={0} max={24} onChange={(value) => updateSettings((settings) => ({ ...settings, optionGap: value }))} />
          <NumberControl label="Label gap" value={block.settings.labelContentGap ?? 4} min={0} max={24} onChange={(value) => updateSettings((settings) => ({ ...settings, labelContentGap: value }))} />
          <div className="mcq-icon-toggle-row mcq-alignment-toggle-group">
            <IconToggle active={block.settings.alignment === "left"} label="Align left" onClick={() => setAlignment("left")} icon={<AlignLeft size={15} />} />
            <IconToggle active={block.settings.alignment === "center"} label="Align center" onClick={() => setAlignment("center")} icon={<AlignCenter size={15} />} />
            <IconToggle active={block.settings.alignment === "right"} label="Align right" onClick={() => setAlignment("right")} icon={<AlignRight size={15} />} />
          </div>
          <div className="mcq-icon-toggle-row mcq-alignment-toggle-group">
            <IconToggle active={block.settings.verticalAlignment === "top"} label="Align options by top" onClick={() => setOptionVerticalAlignment("top")} icon={<AlignVerticalJustifyStart size={15} />} />
            <IconToggle active={block.settings.verticalAlignment === "middle"} label="Align options by middle" onClick={() => setOptionVerticalAlignment("middle")} icon={<AlignVerticalJustifyCenter size={15} />} />
            <IconToggle active={block.settings.verticalAlignment === "bottom"} label="Align options by bottom" onClick={() => setOptionVerticalAlignment("bottom")} icon={<AlignVerticalJustifyEnd size={15} />} />
          </div>
        </div>
        <div className="mcq-layout-control-row mcq-layout-control-row-secondary">
          <span className="mcq-mini-label">Letter position</span>
          <div className="mcq-segment-row">
            <SegmentButton active={block.settings.labelPosition === "beside"} compact label="Letter beside option" onClick={() => setLabelPosition("beside")}>
              <span className="mcq-label-position-glyph is-beside" />
            </SegmentButton>
            <SegmentButton active={block.settings.labelPosition === "above"} compact label="Letter above option" onClick={() => setLabelPosition("above")}>
              <span className="mcq-label-position-glyph is-above" />
            </SegmentButton>
            <SegmentButton active={block.settings.labelPosition === "below"} compact label="Letter below option" onClick={() => setLabelPosition("below")}>
              <span className="mcq-label-position-glyph is-below" />
            </SegmentButton>
          </div>
        </div>
        <label className="mcq-check-row">
          <input checked={block.settings.boxedLabels} type="checkbox" onChange={(event) => updateSettings((settings) => ({ ...settings, boxedLabels: event.target.checked }))} />
          Show option letters in boxes
        </label>
      </InspectorSection> : null}

      <InspectorSection title="Correct answer" icon={<Check size={15} />}>
        <div className="mcq-answer-row">
          {block.options.map((option) => (
            <button
              className={clsx(option.letter === block.correctAnswer && "is-active")}
              key={option.id}
              type="button"
              onClick={() => onUpdate((current) => ({ ...current, correctAnswer: option.letter }))}
            >
              {option.letter}
            </button>
          ))}
        </div>
      </InspectorSection>

      {block.mode === "standard" ? <InspectorSection title="Option content" icon={<List size={15} />}>
        <div className="mcq-option-content-mode">
          <span>Selected option {selectedOption.letter}</span>
          <div className="mcq-segment-row">
            <SegmentButton active={selectedOption.contentType === "text"} compact label="Text option" onClick={() => updateOptionContentType(selectedOption.id, "text")}>
              T
            </SegmentButton>
            <SegmentButton active={selectedOption.contentType === "mixed"} compact label="Text and image option" onClick={() => updateOptionContentType(selectedOption.id, "mixed")}>
              <ImageIcon size={14} />
            </SegmentButton>
            <SegmentButton active={selectedOption.contentType === "image"} compact label="Image-only option" onClick={() => updateOptionContentType(selectedOption.id, "image")}>
              <span className="mcq-image-option-icon" />
            </SegmentButton>
          </div>
        </div>
        <div className="mcq-option-source-list">
          {block.options.map((option) => (
            <label className={clsx("mcq-option-source-row", option.id === selectedOption.id && "is-selected")} key={option.id} onClick={() => setSelectedOption(option.id)}>
              <span className="mcq-option-letter">{option.letter}</span>
              <textarea
                ref={(element) => {
                  optionRefs.current[option.id] = element;
                }}
                placeholder={optionTextPlaceholders[option.letter]}
                value={option.text}
                onChange={(event) => updateOption(option.id, event.target.value)}
              />
              <span className={clsx("mcq-option-thumb", option.image?.dataUrl && "has-image")}>
                {option.image?.dataUrl ? <img alt="" src={option.image.dataUrl} /> : <ImageIcon size={14} />}
              </span>
              <button aria-label={`Insert LaTeX in option ${option.letter}`} type="button" onClick={() => setSelectedOption(option.id)}>
                <Baseline size={14} />
              </button>
              <input
                ref={(element) => {
                  optionImageRefs.current[option.id] = element;
                }}
                accept="image/*"
                hidden
                type="file"
                onChange={(event) => loadOptionImage(option.id, event.target.files?.[0])}
              />
              <button aria-label={`Add image to option ${option.letter}`} type="button" onClick={() => optionImageRefs.current[option.id]?.click()}>
                <ImageIcon size={14} />
              </button>
              <button aria-label={`Paste image to option ${option.letter}`} type="button" onClick={() => void pasteOptionImage(option.id)}>
                <Clipboard size={14} />
              </button>
              <button aria-label={`Duplicate option ${option.letter}`} type="button" onClick={() => duplicateOption(option)}>
                <Copy size={14} />
              </button>
              <button aria-label={`Clear option ${option.letter}`} type="button" onClick={() => clearOption(option.id)}>
                <Trash2 size={14} />
              </button>
            </label>
          ))}
        </div>
      </InspectorSection> : null}

      {block.mode === "standard" && (selectedOption.contentType === "image" || selectedOption.contentType === "mixed") ? (
      <InspectorSection title={`Selected option ${selectedOption.letter} image`} icon={<ImageIcon size={15} />}>
        <div className="mcq-selected-option-image">
          <div className={clsx("mcq-selected-option-image-preview", selectedOption.image?.border && "has-border")}>
            {selectedOption.image?.dataUrl ? (
              <img
                alt={selectedOption.image.altText}
                src={selectedOption.image.dataUrl}
                style={{
                  width: `${selectedOption.image.width}px`,
                  height: `${selectedOption.image.height}px`,
                  objectFit: "contain",
                  objectPosition: cropToObjectPosition(selectedOption.image.crop),
                  clipPath: cropToClipPath(selectedOption.image.crop),
                  transform: `rotate(${selectedOption.image.rotation ?? 0}deg)`
                }}
              />
            ) : (
              <button type="button" onClick={() => optionImageRefs.current[selectedOption.id]?.click()}>
                <ImageIcon size={18} />
                Choose image for option {selectedOption.letter}
              </button>
            )}
          </div>
          <div className="mcq-selected-option-image-actions">
            <button type="button" onClick={() => optionImageRefs.current[selectedOption.id]?.click()}>
              <ImageIcon size={14} />
              Choose
            </button>
            <button type="button" onClick={() => void pasteOptionImage(selectedOption.id)}>
              <Clipboard size={14} />
              Paste
            </button>
            <button type="button" onClick={clearSelectedImage} disabled={!selectedOption.image}>
              <Trash2 size={14} />
              Clear
            </button>
          </div>
        </div>

        <div className="mcq-option-image-control-grid">
          <NumberControl label="Width" value={selectedOption.image?.width ?? block.settings.image.width} min={12} max={260} onChange={setImageWidth} />
          <NumberControl label="Height" value={selectedOption.image?.height ?? block.settings.image.height} min={10} max={220} onChange={setImageHeight} />
          <label className="mcq-check-row">
            <input
              checked={selectedOption.image?.lockAspectRatio ?? block.settings.image.lockAspectRatio}
              type="checkbox"
              onChange={(event) => updateSelectedImage({ lockAspectRatio: event.target.checked })}
            />
            Lock ratio
          </label>
          <button className="mcq-reset-style" type="button" onClick={resetSelectedImageFrame}>Reset</button>
        </div>

        <div className="mcq-option-image-action-row">
          <button type="button" onClick={() => rotateSelectedImage(-90)}><RotateCcw size={14} />90 left</button>
          <button type="button" onClick={() => rotateSelectedImage(90)}><RotateCw size={14} />90 right</button>
          <NumberControl label="Angle" value={selectedOption.image?.rotation ?? block.settings.image.rotation} min={0} max={359} onChange={(rotation) => updateSelectedImage({ rotation })} />
          <button type="button" onClick={applyImageSettingsToAll}>Apply size to all</button>
        </div>

        <div className="mcq-option-image-crop-grid">
          <span className="mcq-option-image-subtitle"><Scissors size={14} /> Crop %</span>
          <NumberControl label="X" value={selectedImageCrop.x} min={0} max={100} onChange={(x) => updateSelectedCrop({ x })} />
          <NumberControl label="Y" value={selectedImageCrop.y} min={0} max={100} onChange={(y) => updateSelectedCrop({ y })} />
          <NumberControl label="W" value={selectedImageCrop.width} min={5} max={100} onChange={(width) => updateSelectedCrop({ width })} />
          <NumberControl label="H" value={selectedImageCrop.height} min={5} max={100} onChange={(height) => updateSelectedCrop({ height })} />
        </div>

        <div className="mcq-option-image-placement-grid">
          <span className="mcq-mini-label">Image horizontal</span>
          <IconToggle active={(selectedOption.image?.horizontalAlignment ?? block.settings.image.horizontalAlignment) === "left"} label="Align option image left" onClick={() => updateSelectedImage({ horizontalAlignment: "left" })} icon={<AlignLeft size={15} />} />
          <IconToggle active={(selectedOption.image?.horizontalAlignment ?? block.settings.image.horizontalAlignment) === "center"} label="Align option image center" onClick={() => updateSelectedImage({ horizontalAlignment: "center" })} icon={<AlignCenter size={15} />} />
          <IconToggle active={(selectedOption.image?.horizontalAlignment ?? block.settings.image.horizontalAlignment) === "right"} label="Align option image right" onClick={() => updateSelectedImage({ horizontalAlignment: "right" })} icon={<AlignRight size={15} />} />
          <span className="mcq-mini-label">Image vertical</span>
          <VerticalButton active={(selectedOption.image?.verticalAlignment ?? block.settings.image.verticalAlignment) === "top"} value="top" onClick={() => updateSelectedImage({ verticalAlignment: "top" })} />
          <VerticalButton active={(selectedOption.image?.verticalAlignment ?? block.settings.image.verticalAlignment) === "middle"} value="middle" onClick={() => updateSelectedImage({ verticalAlignment: "middle" })} />
          <VerticalButton active={(selectedOption.image?.verticalAlignment ?? block.settings.image.verticalAlignment) === "bottom"} value="bottom" onClick={() => updateSelectedImage({ verticalAlignment: "bottom" })} />
        </div>

        <div className="mcq-option-image-control-grid">
          <NumberControl label="Before" value={selectedOption.image?.spacingBefore ?? block.settings.image.spacingBefore} min={0} max={36} onChange={(spacingBefore) => updateSelectedImage({ spacingBefore })} />
          <NumberControl label="After" value={selectedOption.image?.spacingAfter ?? block.settings.image.spacingAfter} min={0} max={36} onChange={(spacingAfter) => updateSelectedImage({ spacingAfter })} />
          <label className="mcq-check-row">
            <input checked={selectedOption.image?.border ?? block.settings.image.border} type="checkbox" onChange={(event) => updateSelectedImage({ border: event.target.checked })} />
            Border
          </label>
        </div>

        <label className="mcq-control mcq-control-full">
          <span>Alt text</span>
          <input
            value={selectedOption.image?.altText ?? ""}
            onChange={(event) => updateSelectedImage({ altText: event.target.value })}
          />
        </label>
      </InspectorSection>
      ) : null}

      {block.mode === "standard" ? <InspectorSection title={`Inline LaTeX for option ${selectedOption.letter}`} icon={<Baseline size={15} />}>
        <div className="mcq-inline-latex-layout">
          <div className="mcq-inline-latex-stack">
            <span className="mcq-mini-label">Selected formula</span>
            <input value={block.inlineLatexSource} onChange={(event) => onUpdate((current) => ({ ...current, inlineLatexSource: event.target.value }))} />
            <span className="mcq-mini-label">Render preview</span>
            <div
              className={clsx(
                "mcq-latex-preview",
                block.settings.math.bold && "is-bold",
                block.settings.math.italic && "is-italic",
                block.settings.math.underline && "is-underlined"
              )}
              dangerouslySetInnerHTML={{ __html: latexPreview }}
            />
          </div>
          <div className="mcq-inline-latex-actions">
            <button type="button" onClick={() => insertLatex(false)}>
              <Plus size={14} />
              Insert
            </button>
            <button type="button" onClick={() => insertLatex(true)}>
              <Baseline size={14} />
              Replace
            </button>
            <button type="button" onClick={() => onUpdate((current) => ({ ...current, inlineLatexSource: "" }))}>
              <RemoveFormatting size={14} />
              Clear
            </button>
          </div>
        </div>
      </InspectorSection> : null}

      <InspectorSection title="Option typography" icon={<Baseline size={15} />}>
        <div className="mcq-typography-layout">
          <TypographyColumn title="Letters" value={block.settings.label ?? defaultOptionsSettings.label} onChange={(patch) => updateTypography("label", patch)} />
          <TypographyColumn title="Text" value={block.settings.text} onChange={(patch) => updateTypography("text", patch)} onWrap={wrapSelection} />
          <TypographyColumn
            title="Math"
            value={block.settings.math}
            disabled={block.settings.inheritMathFont}
            headerAction={
              <label className="mcq-mini-check">
                <input
                  checked={block.settings.inheritMathFont}
                  type="checkbox"
                  onChange={(event) => updateSettings((settings) => ({ ...settings, inheritMathFont: event.target.checked }))}
                />
                Inherit
              </label>
            }
            onChange={(patch) => updateTypography("math", patch)}
            onWrap={wrapSelection}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Shuffle and print" icon={<Shuffle size={15} />}>
        <label className="mcq-check-row">
          <input checked={block.settings.allowShuffle} type="checkbox" onChange={(event) => updateSettings((settings) => ({ ...settings, allowShuffle: event.target.checked }))} />
          Allow future option shuffle
        </label>
        <label className="mcq-check-row">
          <input checked={block.settings.preserveCorrectAfterShuffle} type="checkbox" onChange={(event) => updateSettings((settings) => ({ ...settings, preserveCorrectAfterShuffle: event.target.checked }))} />
          Preserve correct answer after shuffle
        </label>
        <label className="mcq-check-row">
          <input checked={block.settings.keepTogether} type="checkbox" onChange={(event) => updateSettings((settings) => ({ ...settings, keepTogether: event.target.checked }))} />
          Keep options together
        </label>
        <label className="mcq-check-row">
          <input checked={block.settings.allowSplit} type="checkbox" onChange={(event) => updateSettings((settings) => ({ ...settings, allowSplit: event.target.checked }))} />
          Allow split across pages
        </label>
      </InspectorSection>

      <InspectorSection title="Validation" icon={<Eye size={15} />}>
        <div className={hasEmptyOption ? "mcq-validation-warning" : "mcq-validation-ok"}>
          {hasEmptyOption ? "Every option needs content." : "Options block is valid."}
        </div>
      </InspectorSection>

      <InspectorSection title="Preview (student view)" icon={<Eye size={15} />}>
        <div className="mcq-inspector-preview mcq-options-mini-preview">
          <strong>1</strong>
          <div>
            <p>The table shows values of speed and tension for a rotating mass.</p>
            <OptionsPreview block={block} student />
          </div>
        </div>
      </InspectorSection>
    </div>
  );

  function setLayout(layout: OptionLayout) {
    updateSettings((settings) => ({ ...settings, layout }));
  }

  function setAlignment(alignment: Alignment) {
    updateSettings((settings) => ({ ...settings, alignment }));
  }

  function setOptionVerticalAlignment(verticalAlignment: VerticalAlignment) {
    updateSettings((settings) => ({ ...settings, verticalAlignment }));
  }

  function setLabelPosition(labelPosition: OptionLabelPosition) {
    updateSettings((settings) => ({ ...settings, labelPosition }));
  }
}

export function OptionsPreview({ block, student = false, showPlaceholders = true }: { block: OptionsBlock; student?: boolean; showPlaceholders?: boolean }) {
  block = normalizeOptionsBlock(block);
  if (block.mode === "table") {
    return <TableWithLatex block={block.table} compact highlightAnswer={student ? undefined : block.correctAnswer} />;
  }

  const labelTypography = block.settings.label ?? defaultOptionsSettings.label;
  const style = {
    fontFamily: block.settings.text.fontFamily,
    fontSize: `${block.settings.text.fontSize}pt`,
    fontWeight: block.settings.text.bold ? 700 : 400,
    fontStyle: block.settings.text.italic ? "italic" : "normal",
    textDecoration: block.settings.text.underline ? "underline" : "none",
    textAlign: block.settings.alignment,
    gap: block.settings.optionGap,
    "--option-label-gap": `${block.settings.labelContentGap ?? 4}px`
  } as CSSProperties;
  const labelStyle = {
    width: block.settings.labelWidth,
    fontFamily: labelTypography.fontFamily,
    fontSize: `${labelTypography.fontSize}pt`,
    fontWeight: labelTypography.bold ? 700 : 400,
    fontStyle: labelTypography.italic ? "italic" : "normal",
    textDecoration: labelTypography.underline ? "underline" : "none",
    justifySelf: block.settings.alignment === "center" ? "center" : block.settings.alignment === "right" ? "end" : "start"
  } as const;
  const optionImageFrameHeight = block.options.reduce((height, option) => {
    if (!option.image?.dataUrl) return height;
    const optionHeight = option.image.height + (option.image.spacingBefore ?? 0) + (option.image.spacingAfter ?? 0);
    return Math.max(height, optionHeight);
  }, 0);

  return (
    <div
      className={clsx(
        "mcq-options-preview-list",
        `is-${block.settings.layout}`,
        `labels-${block.settings.labelPosition}`,
        `valign-${block.settings.verticalAlignment}`,
        !block.settings.boxedLabels && "is-plain-labels"
      )}
      style={style}
    >
      {block.options.map((option) => {
        const image = option.image;
        const imageHorizontal = image?.horizontalAlignment ?? block.settings.image.horizontalAlignment;
        const imageVertical = image?.verticalAlignment ?? block.settings.image.verticalAlignment;
        const hasImage = Boolean(image?.dataUrl);

        return (
        <div className={clsx("mcq-option-preview-row", hasImage && "has-image", !student && option.letter === block.correctAnswer && "is-correct")} key={option.id}>
          <span style={labelStyle}>{option.letter}</span>
          <p
            className={clsx(showPlaceholders && !option.text.trim() && "is-placeholder")}
            style={{
              alignItems: hasImage ? alignToFlex(imageHorizontal) : "stretch",
              justifyContent: verticalToFlex(imageVertical),
              minHeight: image ? `${Math.max(24, optionImageFrameHeight)}px` : undefined
            }}
          >
            {option.contentType !== "image" ? (
              <OptionTextWithLatex block={block} text={option.text.trim() ? option.text : showPlaceholders ? optionTextPlaceholders[option.letter] : ""} />
            ) : null}
            {image?.dataUrl ? (
              <img
                alt={image.altText}
                className="mcq-option-image-preview"
                src={image.dataUrl}
                style={{
                  width: `${image.width}px`,
                  height: `${image.height}px`,
                  objectFit: "contain",
                  objectPosition: cropToObjectPosition(image.crop),
                  clipPath: cropToClipPath(image.crop),
                  alignSelf: alignToFlex(imageHorizontal),
                  marginTop: `${image.spacingBefore ?? 0}px`,
                  marginBottom: `${image.spacingAfter ?? 0}px`,
                  transform: `rotate(${image.rotation ?? 0}deg)`,
                  border: image.border ? "1px solid #64748b" : "0"
                }}
              />
            ) : null}
          </p>
        </div>
      );
      })}
    </div>
  );
}

function alignToFlex(alignment: Alignment) {
  if (alignment === "right") return "flex-end";
  if (alignment === "center") return "center";
  return "flex-start";
}

function verticalToFlex(alignment: VerticalAlignment) {
  if (alignment === "bottom") return "flex-end";
  if (alignment === "middle") return "center";
  return "flex-start";
}

function cropToObjectPosition(crop?: NonNullable<McqOption["image"]>["crop"]) {
  if (!crop) return "50% 50%";
  const x = crop.x + crop.width / 2;
  const y = crop.y + crop.height / 2;
  return `${Math.max(0, Math.min(100, x))}% ${Math.max(0, Math.min(100, y))}%`;
}

function cropToClipPath(crop?: NonNullable<McqOption["image"]>["crop"]) {
  if (!crop) return undefined;
  if (crop.x === 0 && crop.y === 0 && crop.width === 100 && crop.height === 100) return undefined;
  const top = Math.max(0, Math.min(100, crop.y));
  const left = Math.max(0, Math.min(100, crop.x));
  const right = Math.max(0, Math.min(100, 100 - crop.x - crop.width));
  const bottom = Math.max(0, Math.min(100, 100 - crop.y - crop.height));
  return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
}

function readImageDimensions(dataUrl: string): Promise<{ width?: number; height?: number; ratio?: number }> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || undefined;
      const height = image.naturalHeight || undefined;
      resolve({ width, height, ratio: width && height ? width / height : undefined });
    };
    image.onerror = () => resolve({});
    image.src = dataUrl;
  });
}

function imageAspectRatio(image: McqOption["image"] | undefined, fallbackRatio: number) {
  const naturalRatio = image?.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : undefined;
  const ratio = naturalRatio ?? image?.aspectRatio ?? fallbackRatio;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

function findTableCell(table: TableBlock) {
  return table.rows.flat().find((cell) => cell.id === table.selectedCellId);
}

function selectedTableRowLetter(table: TableBlock) {
  const row = table.rows.find((candidate) => candidate.some((cell) => cell.id === table.selectedCellId));
  const first = row?.[0]?.text.trim();
  return first === "A" || first === "B" || first === "C" || first === "D" ? first : undefined;
}

function insertNumber(values: number[], index: number, value: number) {
  const next = [...values];
  next.splice(index, 0, value);
  return next;
}

function insertRow<T>(rows: T[], index: number, row: T) {
  const next = [...rows];
  next.splice(index, 0, row);
  return next;
}

function tableRangeLabel(table: TableBlock) {
  const bounds = getSelectionBounds(table);
  return `R${bounds.top + 1}:C${bounds.left + 1}${bounds.top !== bounds.bottom || bounds.left !== bounds.right ? ` - R${bounds.bottom + 1}:C${bounds.right + 1}` : ""}`;
}

function deleteTableRows(table: TableBlock) {
  if (table.rows.length <= 1) return table;
  const bounds = getSelectionBounds(table);
  const deleteRows = new Set(Array.from({ length: bounds.bottom - bounds.top + 1 }, (_, index) => bounds.top + index));
  const rows = table.rows.filter((_, rowIndex) => !deleteRows.has(rowIndex));
  const rowHeights = (table.rowHeights ?? table.rows.map(() => table.settings.rowHeight)).filter((_, rowIndex) => !deleteRows.has(rowIndex));
  const selectedCellId = rows[0]?.[0]?.id ?? "";
  return { ...table, rows, rowHeights, selectedCellId, selectionAnchorCellId: selectedCellId, selectedCellIds: selectedCellId ? [selectedCellId] : [] };
}

function deleteTableColumns(table: TableBlock) {
  if (table.rows[0].length <= 1) return table;
  const bounds = getSelectionBounds(table);
  const deleteColumns = new Set(Array.from({ length: bounds.right - bounds.left + 1 }, (_, index) => bounds.left + index));
  const rows = table.rows.map((row) => row.filter((_, columnIndex) => !deleteColumns.has(columnIndex)));
  const columnWidths = (table.columnWidths ?? table.rows[0].map(() => 96)).filter((_, columnIndex) => !deleteColumns.has(columnIndex));
  const selectedCellId = rows[0]?.[0]?.id ?? "";
  return { ...table, rows, columnWidths, selectedCellId, selectionAnchorCellId: selectedCellId, selectedCellIds: selectedCellId ? [selectedCellId] : [] };
}

function updateTableColumnsWidth(table: TableBlock, width: number) {
  const bounds = getSelectionBounds(table);
  const columnWidths = [...(table.columnWidths ?? table.rows[0].map(() => 96))];
  for (let column = bounds.left; column <= bounds.right; column += 1) columnWidths[column] = width;
  return { ...table, columnWidths };
}

function updateTableRowsHeight(table: TableBlock, height: number) {
  const bounds = getSelectionBounds(table);
  const rowHeights = [...(table.rowHeights ?? table.rows.map(() => table.settings.rowHeight))];
  for (let row = bounds.top; row <= bounds.bottom; row += 1) rowHeights[row] = height;
  return { ...table, rowHeights };
}

function distributeTableColumns(table: TableBlock) {
  const bounds = getSelectionBounds(table);
  const columnWidths = [...(table.columnWidths ?? table.rows[0].map(() => 96))];
  const count = bounds.right - bounds.left + 1;
  const total = Array.from({ length: count }, (_, index) => columnWidths[bounds.left + index] ?? 96).reduce((sum, width) => sum + width, 0);
  const width = Math.round(total / count);
  for (let column = bounds.left; column <= bounds.right; column += 1) columnWidths[column] = width;
  return { ...table, columnWidths };
}

function distributeTableRows(table: TableBlock) {
  const bounds = getSelectionBounds(table);
  const rowHeights = [...(table.rowHeights ?? table.rows.map(() => table.settings.rowHeight))];
  const count = bounds.bottom - bounds.top + 1;
  const total = Array.from({ length: count }, (_, index) => rowHeights[bounds.top + index] ?? table.settings.rowHeight).reduce((sum, height) => sum + height, 0);
  const height = Math.round(total / count);
  for (let row = bounds.top; row <= bounds.bottom; row += 1) rowHeights[row] = height;
  return { ...table, rowHeights };
}

function setTableBorders(table: TableBlock, mode: BorderMode) {
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

function VerticalButton({ active, value, onClick }: { active: boolean; value: VerticalAlignment; onClick: () => void }) {
  const icon = value === "top" ? <AlignVerticalJustifyStart size={15} /> : value === "bottom" ? <AlignVerticalJustifyEnd size={15} /> : <AlignVerticalJustifyCenter size={15} />;
  return (
    <button aria-label={`Align image ${value}`} className={clsx("mcq-icon-toggle", active && "is-active")} type="button" onClick={onClick}>
      {icon}
    </button>
  );
}

function TypographyColumn({
  title,
  value,
  disabled,
  headerAction,
  onChange,
  onWrap
}: {
  title: string;
  value: OptionTypographySettings;
  disabled?: boolean;
  headerAction?: ReactNode;
  onChange: (patch: Partial<OptionTypographySettings>) => void;
  onWrap?: (tag: "b" | "i" | "u" | "sub" | "sup") => void;
}) {
  return (
    <div className="mcq-typography-column">
      <div className="mcq-typography-heading">
        <span>{title}</span>
        {headerAction}
      </div>
      <div className="mcq-control-grid">
        <SelectControl label="Font" disabled={disabled} value={value.fontFamily} options={fonts} onChange={(fontFamily) => onChange({ fontFamily })} />
        <NumberControl label="Size" disabled={disabled} value={value.fontSize} min={8} max={22} onChange={(fontSize) => onChange({ fontSize })} />
        <SelectControl label="Color" disabled={disabled} value={value.color} options={colors} onChange={(color) => onChange({ color })} />
        <button className="mcq-reset-style" disabled={disabled} type="button" onClick={() => onChange({ bold: false, italic: false, underline: false, subscript: false, superscript: false, color: "Default" })}>
          <RotateCcw size={13} />
          Reset
        </button>
      </div>
      <div className="mcq-icon-toggle-row">
        <IconToggle active={value.bold} disabled={disabled} label={`${title} bold`} onClick={() => (title === "Text" && onWrap ? onWrap("b") : onChange({ bold: !value.bold }))} icon={<Bold size={15} />} />
        <IconToggle active={value.italic} disabled={disabled} label={`${title} italic`} onClick={() => (title === "Text" && onWrap ? onWrap("i") : onChange({ italic: !value.italic }))} icon={<Italic size={15} />} />
        <IconToggle active={value.underline} disabled={disabled} label={`${title} underline`} onClick={() => (title === "Text" && onWrap ? onWrap("u") : onChange({ underline: !value.underline }))} icon={<Underline size={15} />} />
      </div>
    </div>
  );
}

function InspectorSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="mcq-inspector-section">
      <h3>
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function SegmentButton({
  active,
  disabled,
  compact,
  label,
  children,
  onClick
}: {
  active?: boolean;
  disabled?: boolean;
  compact?: boolean;
  label?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button aria-label={label} title={label} className={clsx(active && "is-active", compact && "is-compact")} disabled={disabled} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function IconToggle({ active, disabled, label, icon, onClick }: { active: boolean; disabled?: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button aria-label={label} className={clsx("mcq-icon-toggle", active && "is-active")} disabled={disabled} type="button" onClick={onClick}>
      {icon}
    </button>
  );
}

function SelectControl({ label, value, options, disabled, onChange }: { label: string; value: string; options: string[]; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="mcq-control">
      <span>{label}</span>
      <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function NumberControl({ label, value, min, max, disabled, onChange }: { label: string; value: number; min: number; max: number; disabled?: boolean; onChange: (value: number) => void }) {
  return (
    <label className="mcq-control">
      <span>{label}</span>
      <input disabled={disabled} max={max} min={min} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
