import clsx from "clsx";
import type { CSSProperties } from "react";
import type { Alignment, McqOption, OptionsBlock, VerticalAlignment } from "../types";
import { defaultOptionsSettings, optionTextPlaceholders } from "../optionsBlockDefaults";
import { normalizeOptionsBlock } from "../normalizeBlocks";
import { TableWithLatex } from "../table/TableWithLatex";
import { OptionTextWithLatex } from "./OptionTextWithLatex";

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

export function alignToFlex(alignment: Alignment) {
  if (alignment === "right") return "flex-end";
  if (alignment === "center") return "center";
  return "flex-start";
}

export function verticalToFlex(alignment: VerticalAlignment) {
  if (alignment === "bottom") return "flex-end";
  if (alignment === "middle") return "center";
  return "flex-start";
}

export function cropToObjectPosition(crop?: NonNullable<McqOption["image"]>["crop"]) {
  if (!crop) return "50% 50%";
  const x = crop.x + crop.width / 2;
  const y = crop.y + crop.height / 2;
  return `${Math.max(0, Math.min(100, x))}% ${Math.max(0, Math.min(100, y))}%`;
}

export function cropToClipPath(crop?: NonNullable<McqOption["image"]>["crop"]) {
  if (!crop) return undefined;
  if (crop.x === 0 && crop.y === 0 && crop.width === 100 && crop.height === 100) return undefined;
  const top = Math.max(0, Math.min(100, crop.y));
  const left = Math.max(0, Math.min(100, crop.x));
  const right = Math.max(0, Math.min(100, 100 - crop.x - crop.width));
  const bottom = Math.max(0, Math.min(100, 100 - crop.y - crop.height));
  return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
}
