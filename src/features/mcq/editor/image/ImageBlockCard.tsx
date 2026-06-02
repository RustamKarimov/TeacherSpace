import { ArrowDown, ArrowUp, Copy, GripVertical, Image, Lock, MoreVertical, Trash2, Unlock } from "lucide-react";
import clsx from "clsx";
import { useRef } from "react";
import type { ImageBlock } from "../types";
import { imageFileToBlock } from "./imageUtils";

type ImageBlockCardProps = {
  block: ImageBlock;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (direction: "up" | "down") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onUpdate: (updater: (block: ImageBlock) => ImageBlock) => void;
};

export function ImageBlockCard({
  block,
  index,
  isSelected,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onToggleLock,
  onUpdate
}: ImageBlockCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadFile(file?: File) {
    if (!file) return;
    const updater = await imageFileToBlock(file);
    onUpdate(updater);
  }

  return (
    <article className={clsx("mcq-block-card mcq-image-card", isSelected && "is-selected", block.settings.locked && "is-locked")} onClick={onSelect}>
      <div className="mcq-block-number">{index + 1}</div>
      <div className="mcq-block-handle" aria-label="Drag image block">
        <GripVertical size={18} />
      </div>
      <div className="mcq-block-type-icon">
        <Image size={22} />
      </div>
      <div className="mcq-block-content">
        <div className="mcq-block-title">Image block</div>
        <div className="mcq-block-subtitle">
          {block.asset.fileName || "No image selected"} • {block.settings.width} x {block.settings.height} mm
        </div>
        <input
          ref={inputRef}
          accept="image/*"
          hidden
          type="file"
          onChange={(event) => void loadFile(event.target.files?.[0])}
        />
        <ImageBlockPreview block={block} onChooseImage={() => inputRef.current?.click()} />
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

export function ImageBlockPreview({ block, a4 = false, onChooseImage }: { block: ImageBlock; a4?: boolean; onChooseImage?: () => void }) {
  const boxStyle = {
    width: `${block.settings.width * (a4 ? 3.78 : 2.2)}px`,
    height: `${block.settings.height * (a4 ? 3.78 : 2.2)}px`
  };

  return (
    <figure
      className={clsx("mcq-image-preview", a4 && "is-a4", block.settings.border && "has-border", `align-${block.settings.horizontalAlignment}`)}
      style={{
        marginTop: block.settings.spacingBefore,
        marginBottom: block.settings.spacingAfter
      }}
    >
      <div className="mcq-image-preview-box" style={boxStyle}>
        {block.asset.dataUrl ? (
          <img
            alt={block.asset.altText}
            src={block.asset.dataUrl}
            style={{
              transform: `rotate(${block.settings.rotation}deg)`,
              objectPosition: `${block.settings.crop.x + block.settings.crop.width / 2}% ${block.settings.crop.y + block.settings.crop.height / 2}%`
            }}
          />
        ) : (
          <button className="mcq-image-placeholder" type="button" onClick={(event) => { event.stopPropagation(); onChooseImage?.(); }}>
            <Image size={24} />
            <span>Choose image</span>
          </button>
        )}
      </div>
      {block.settings.caption ? <figcaption>{block.settings.caption}</figcaption> : null}
    </figure>
  );
}
