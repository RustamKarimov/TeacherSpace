import { ArrowDown, ArrowUp, Copy, GripVertical, List, Lock, MoreVertical, Trash2, Unlock } from "lucide-react";
import clsx from "clsx";
import type { CSSProperties } from "react";
import type { OptionsBlock } from "../types";
import { defaultOptionsSettings, optionTextPlaceholders } from "../optionsBlockDefaults";
import { OptionTextWithLatex } from "./OptionTextWithLatex";
import { TableWithLatex } from "../table/TableWithLatex";
import { normalizeOptionsBlock } from "../normalizeBlocks";

type OptionsBlockCardProps = {
  block: OptionsBlock;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (direction: "up" | "down") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
};

export function OptionsBlockCard({
  block,
  index,
  isSelected,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onToggleLock
}: OptionsBlockCardProps) {
  const normalizedBlock = normalizeOptionsBlock(block);
  block = normalizedBlock;
  const labelTypography = block.settings.label ?? defaultOptionsSettings.label;
  const labelStyle = {
    width: block.settings.labelWidth,
    fontFamily: labelTypography.fontFamily,
    fontSize: `${labelTypography.fontSize}pt`,
    fontWeight: labelTypography.bold ? 700 : 400,
    fontStyle: labelTypography.italic ? "italic" : "normal",
    textDecoration: labelTypography.underline ? "underline" : "none",
    justifySelf: block.settings.alignment === "center" ? "center" : block.settings.alignment === "right" ? "end" : "start"
  } as const;

  return (
    <article className={clsx("mcq-block-card mcq-options-card", isSelected && "is-selected", block.settings.locked && "is-locked")} onClick={onSelect}>
      <div className="mcq-block-number">{index + 1}</div>
      <div className="mcq-block-handle" aria-label="Drag options block">
        <GripVertical size={18} />
      </div>
      <div className="mcq-block-type-icon">
        <List size={22} />
      </div>
      <div className="mcq-block-content">
        <div className="mcq-block-title">Options block</div>
        <div className="mcq-block-subtitle">{block.mode === "table" ? "Table options" : `Standard options - ${layoutLabel(block.settings.layout)}`}</div>
        {block.mode === "table" ? (
          <TableWithLatex block={block.table} compact highlightAnswer={block.correctAnswer} />
        ) : (
        <div
          className={clsx(
            "mcq-options-preview-list",
            `is-${block.settings.layout}`,
            `labels-${block.settings.labelPosition}`,
            `valign-${block.settings.verticalAlignment}`,
            !block.settings.boxedLabels && "is-plain-labels"
          )}
          style={{
            fontFamily: block.settings.text.fontFamily,
            fontSize: `${block.settings.text.fontSize}pt`,
            fontWeight: block.settings.text.bold ? 700 : 400,
            fontStyle: block.settings.text.italic ? "italic" : "normal",
            textDecoration: block.settings.text.underline ? "underline" : "none",
            textAlign: block.settings.alignment,
            gap: block.settings.optionGap,
            "--option-label-gap": `${block.settings.labelContentGap ?? 4}px`
          } as CSSProperties}
        >
          {block.options.map((option) => {
            const hasImage = Boolean(option.image?.dataUrl);
            const imageHorizontal = option.image?.horizontalAlignment ?? block.settings.image.horizontalAlignment;
            const imageVertical = option.image?.verticalAlignment ?? block.settings.image.verticalAlignment;
            const maxImageHeight = block.options.reduce((height, candidate) => {
              if (!candidate.image?.dataUrl) return height;
              return Math.max(height, candidate.image.height + (candidate.image.spacingBefore ?? 0) + (candidate.image.spacingAfter ?? 0));
            }, 0);
            return (
            <div className={clsx("mcq-option-preview-row", hasImage && "has-image", option.letter === block.correctAnswer && "is-correct")} key={option.id}>
              <span style={labelStyle}>{option.letter}</span>
              <p
                className={clsx(!option.text.trim() && "is-placeholder")}
                style={{
                  alignItems: hasImage ? imageAlignToFlex(imageHorizontal) : "stretch",
                  justifyContent: verticalAlignToFlex(imageVertical),
                  minHeight: hasImage ? Math.max(24, maxImageHeight) : undefined
                }}
              >
                {option.contentType !== "image" ? (
                  <OptionTextWithLatex block={block} text={option.text.trim() ? option.text : optionTextPlaceholders[option.letter]} />
                ) : null}
                {option.image?.dataUrl ? (
                  <img
                    alt={option.image.altText}
                    className="mcq-option-image-preview"
                    src={option.image.dataUrl}
                    style={{
                      width: option.image.width,
                      height: option.image.height,
                      objectFit: "contain",
                      marginTop: option.image.spacingBefore ?? 0,
                      marginBottom: option.image.spacingAfter ?? 0,
                      alignSelf: imageAlignToFlex(imageHorizontal)
                    }}
                  />
                ) : null}
              </p>
            </div>
          );
          })}
        </div>
        )}
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

function layoutLabel(layout: OptionsBlock["settings"]["layout"]) {
  if (layout === "two") return "Two columns";
  if (layout === "four") return "Four columns";
  return "One column";
}

function imageAlignToFlex(alignment: "left" | "center" | "right") {
  if (alignment === "right") return "flex-end";
  if (alignment === "center") return "center";
  return "flex-start";
}

function verticalAlignToFlex(alignment: "top" | "middle" | "bottom") {
  if (alignment === "bottom") return "flex-end";
  if (alignment === "middle") return "center";
  return "flex-start";
}
