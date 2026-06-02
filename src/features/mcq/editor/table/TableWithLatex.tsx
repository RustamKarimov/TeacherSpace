import katex from "katex";
import clsx from "clsx";
import type { ReactNode } from "react";
import type { TableBlock, TableCell } from "../types";
import { getSelectedCellIds } from "./tableOps";

export function TableWithLatex({
  block,
  compact = false,
  editable = false,
  highlightAnswer,
  onSelectCell
}: {
  block: TableBlock;
  compact?: boolean;
  editable?: boolean;
  highlightAnswer?: string;
  onSelectCell?: (id: string, extend: boolean) => void;
}) {
  const width = block.settings.widthMode === "full" ? "100%" : block.settings.widthMode === "custom" ? `${block.settings.customWidth}px` : "auto";
  const selectedIds = editable ? new Set(getSelectedCellIds(block)) : new Set<string>();

  return (
    <div
      className={clsx("mcq-table-wrap", `align-${block.settings.horizontalAlignment}`)}
      style={{ marginTop: block.settings.spacingBefore, marginBottom: block.settings.spacingAfter }}
    >
      <table
        className={clsx("mcq-render-table", `border-${block.settings.borderStyle}`, block.settings.outerBorder && "has-outer-border", compact && "is-compact")}
        style={{
          width,
          fontFamily: block.settings.fontFamily,
          fontSize: `${block.settings.fontSize}pt`
        }}
      >
        <colgroup>
          {block.rows[0]?.map((cell, index) => <col key={cell.id} style={{ width: block.columnWidths?.[index] ? `${block.columnWidths[index]}px` : undefined }} />)}
        </colgroup>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr
              className={row[0]?.text.trim() === highlightAnswer ? "is-correct-answer" : undefined}
              key={`row-${rowIndex}`}
              style={{ height: block.rowHeights?.[rowIndex] ? `${block.rowHeights[rowIndex]}px` : undefined }}
            >
              {row.map((cell, columnIndex) => {
                if (cell.hidden) return null;
                const isHeader = cell.header || (block.settings.showHeaderRow && rowIndex === 0) || (block.settings.showHeaderColumn && columnIndex === 0);
                const CellTag = isHeader ? "th" : "td";
                return (
                  <CellTag
                    className={clsx(selectedIds.has(cell.id) && "is-selected", editable && !cell.text.trim() && !cell.image?.dataUrl && "is-placeholder")}
                    colSpan={cell.colSpan}
                    key={cell.id}
                    rowSpan={cell.rowSpan}
                    style={{
                      minHeight: block.settings.rowHeight,
                      padding: `${block.settings.cellPadding}px`,
                      textAlign: cell.horizontalAlignment,
                      verticalAlign: cell.verticalAlignment,
                      fontWeight: cell.bold || isHeader ? 700 : 400,
                      fontStyle: cell.italic ? "italic" : "normal",
                      borderTop: cell.borders?.top === false ? "0" : undefined,
                      borderRight: cell.borders?.right === false ? "0" : undefined,
                      borderBottom: cell.borders?.bottom === false ? "0" : undefined,
                      borderLeft: cell.borders?.left === false ? "0" : undefined
                    }}
                    onClick={(event) => onSelectCell?.(cell.id, event.shiftKey)}
                  >
                    <CellContent cell={cell} placeholder={editable ? placeholderForCell(rowIndex, columnIndex) : ""} />
                  </CellTag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CellContent({ cell, placeholder }: { cell: TableCell; placeholder: string }) {
  return (
    <>
      {(cell.text || placeholder).split(/\r?\n/).map((line, index) => (
        <div key={`${cell.id}-line-${index}`}>{renderLatexText(line)}</div>
      ))}
      {cell.image?.dataUrl ? (
        <div className={clsx("mcq-table-cell-image-row", `align-${cell.image.horizontalAlignment ?? cell.horizontalAlignment}`)}>
          <img
            alt={cell.image.altText}
            className="mcq-table-cell-image"
            src={cell.image.dataUrl}
            style={{
              width: cell.image.width,
              height: cell.image.height,
              objectFit: "contain"
            }}
          />
        </div>
      ) : null}
    </>
  );
}

function placeholderForCell(row: number, column: number) {
  if (row === 0 && column === 0) return "";
  if (row === 0) return "header";
  if (column === 0) return "row";
  return "cell";
}

function renderLatexText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\$([^$]+)\$|\\(rightarrow|leftarrow|uparrow|downarrow|pm|rho)\b/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const source = match[1] ?? `\\${match[2]}`;
    nodes.push(
      <span
        className="mcq-table-latex"
        dangerouslySetInnerHTML={{ __html: katex.renderToString(source, { throwOnError: false, output: "html" }) }}
        key={`latex-${nodes.length}`}
      />
    );
    cursor = pattern.lastIndex;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
