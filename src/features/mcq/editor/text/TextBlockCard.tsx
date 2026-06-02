import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Lock,
  MoreVertical,
  Trash2,
  Type,
  Unlock
} from "lucide-react";
import clsx from "clsx";
import type { TextBlock } from "../types";
import { textBlockPlaceholder } from "../textBlockDefaults";
import { TextWithInlineLatex } from "./TextWithInlineLatex";

type TextBlockCardProps = {
  block: TextBlock;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<TextBlock>) => void;
  onMove: (direction: "up" | "down") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
};

export function TextBlockCard({
  block,
  index,
  isSelected,
  onSelect,
  onUpdate,
  onMove,
  onDuplicate,
  onDelete,
  onToggleLock
}: TextBlockCardProps) {
  const styles = {
    fontFamily: block.settings.fontFamily,
    fontSize: `${block.settings.fontSize}pt`,
    fontWeight: block.settings.bold ? 700 : 400,
    fontStyle: block.settings.italic ? "italic" : "normal",
    textDecoration: block.settings.underline ? "underline" : "none",
    textAlign: block.settings.alignment,
    lineHeight: block.settings.lineHeight,
    paddingTop: block.settings.spacingBefore,
    paddingBottom: block.settings.spacingAfter,
    paddingLeft: block.settings.indent
  } as const;

  return (
    <article
      className={clsx("mcq-block-card", isSelected && "is-selected", block.settings.locked && "is-locked")}
      onClick={onSelect}
    >
      <div className="mcq-block-number">{index + 1}</div>
      <div className="mcq-block-handle" aria-label="Drag text block">
        <GripVertical size={18} />
      </div>
      <div className="mcq-block-type-icon">
        <Type size={22} />
      </div>
      <div className="mcq-block-content">
        <div className="mcq-block-title">Text block</div>
        <div className={clsx("mcq-text-preview", !block.text.trim() && "is-placeholder")} style={styles}>
          <TextWithInlineLatex block={block.text.trim() ? block : { ...block, text: textBlockPlaceholder }} />
        </div>
      </div>
      <div className="mcq-block-actions" onClick={(event) => event.stopPropagation()}>
        <button aria-label="Move block up" type="button" onClick={() => onMove("up")}>
          <ArrowUp size={17} />
        </button>
        <button aria-label="Move block down" type="button" onClick={() => onMove("down")}>
          <ArrowDown size={17} />
        </button>
        <button aria-label="Duplicate block" type="button" onClick={onDuplicate}>
          <Copy size={17} />
        </button>
        <button className="mcq-danger-icon" aria-label="Delete block" type="button" onClick={onDelete}>
          <Trash2 size={17} />
        </button>
        <button aria-label={block.settings.locked ? "Unlock block" : "Lock block"} type="button" onClick={onToggleLock}>
          {block.settings.locked ? <Lock size={17} /> : <Unlock size={17} />}
        </button>
        <button aria-label="More block actions" type="button">
          <MoreVertical size={17} />
        </button>
      </div>
    </article>
  );
}
