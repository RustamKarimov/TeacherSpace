import { ArrowDown, ArrowUp, Copy, GripVertical, Lock, MoreVertical, Sigma, Trash2, Unlock } from "lucide-react";
import katex from "katex";
import clsx from "clsx";
import type { EquationBlock } from "../types";

type EquationBlockCardProps = {
  block: EquationBlock;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (direction: "up" | "down") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
};

const equationPlaceholder = "s = \\frac{1}{2}at^2";

export function EquationBlockCard({ block, index, isSelected, onSelect, onMove, onDuplicate, onDelete, onToggleLock }: EquationBlockCardProps) {
  const html = katex.renderToString(block.source || equationPlaceholder, { throwOnError: false, output: "html", displayMode: true });

  return (
    <article className={clsx("mcq-block-card mcq-equation-card", isSelected && "is-selected", block.settings.locked && "is-locked")} onClick={onSelect}>
      <div className="mcq-block-number">{index + 1}</div>
      <div className="mcq-block-handle"><GripVertical size={18} /></div>
      <div className="mcq-block-type-icon"><Sigma size={22} /></div>
      <div className="mcq-block-content">
        <div className="mcq-block-title">Equation block</div>
        <div
          className={clsx("mcq-equation-preview", !block.source.trim() && "is-placeholder")}
          style={{
            fontFamily: block.settings.fontFamily,
            fontSize: `${block.settings.fontSize}pt`,
            textAlign: block.settings.alignment,
            marginTop: block.settings.spacingBefore,
            marginBottom: block.settings.spacingAfter
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
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
