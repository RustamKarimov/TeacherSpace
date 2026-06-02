import { ArrowDown, ArrowUp, Copy, Grid3X3, GripVertical, Lock, MoreVertical, Trash2, Unlock } from "lucide-react";
import clsx from "clsx";
import type { TableBlock } from "../types";
import { TableWithLatex } from "./TableWithLatex";

type TableBlockCardProps = {
  block: TableBlock;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (direction: "up" | "down") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
};

export function TableBlockCard({ block, index, isSelected, onSelect, onMove, onDuplicate, onDelete, onToggleLock }: TableBlockCardProps) {
  return (
    <article className={clsx("mcq-block-card mcq-table-card", isSelected && "is-selected")} onClick={onSelect}>
      <span className="mcq-block-number">{index + 1}</span>
      <div className="mcq-block-handle"><GripVertical size={18} /></div>
      <div className="mcq-block-type-icon"><Grid3X3 size={22} /></div>
      <div className="mcq-block-content">
        <div className="mcq-block-title">Table block</div>
        <div className="mcq-block-subtitle">{block.rows.length} rows × {block.rows[0]?.length ?? 0} columns</div>
        <TableWithLatex block={block} compact />
      </div>
      <div className="mcq-block-actions" onClick={(event) => event.stopPropagation()}>
        <button aria-label="Move block up" type="button" onClick={() => onMove("up")}><ArrowUp size={17} /></button>
        <button aria-label="Move block down" type="button" onClick={() => onMove("down")}><ArrowDown size={17} /></button>
        <button aria-label="Duplicate block" type="button" onClick={onDuplicate}><Copy size={17} /></button>
        <button className="mcq-danger-icon" aria-label="Delete block" type="button" onClick={onDelete}><Trash2 size={17} /></button>
        <button aria-label={block.settings.locked ? "Unlock block" : "Lock block"} type="button" onClick={onToggleLock}>
          {block.settings.locked ? <Lock size={17} /> : <Unlock size={17} />}
        </button>
        <button aria-label="More block actions" type="button"><MoreVertical size={17} /></button>
      </div>
    </article>
  );
}
