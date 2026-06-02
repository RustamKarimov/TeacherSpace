import { AlignCenter, AlignLeft, AlignRight, Clipboard, Image, Lock, Maximize2, RefreshCw, RotateCcw, RotateCw, Scissors, Upload } from "lucide-react";
import clsx from "clsx";
import { useRef } from "react";
import type { ImageBlock } from "../types";
import { ImageBlockPreview } from "./ImageBlockCard";
import { clipboardImageToBlock, imageFileToBlock } from "./imageUtils";

type ImageBlockInspectorProps = {
  block: ImageBlock;
  onUpdate: (updater: (block: ImageBlock) => ImageBlock) => void;
};

export function ImageBlockInspector({ block, onUpdate }: ImageBlockInspectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function updateSettings<T extends keyof ImageBlock["settings"]>(key: T, value: ImageBlock["settings"][T]) {
    onUpdate((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [key]: value
      }
    }));
  }

  function updateCrop<T extends keyof ImageBlock["settings"]["crop"]>(key: T, value: number) {
    onUpdate((current) => ({
      ...current,
      settings: {
        ...current.settings,
        crop: {
          ...current.settings.crop,
          [key]: value
        }
      }
    }));
  }

  function imageRatio() {
    if (block.asset.naturalWidth && block.asset.naturalHeight) {
      return block.asset.naturalWidth / block.asset.naturalHeight;
    }
    return block.settings.width / block.settings.height || 1;
  }

  function updateWidth(width: number) {
    onUpdate((current) => ({
      ...current,
      settings: {
        ...current.settings,
        width,
        height: current.settings.lockAspectRatio ? Math.max(8, Math.round(width / imageRatio())) : current.settings.height
      }
    }));
  }

  function updateHeight(height: number) {
    onUpdate((current) => ({
      ...current,
      settings: {
        ...current.settings,
        height,
        width: current.settings.lockAspectRatio ? Math.max(10, Math.round(height * imageRatio())) : current.settings.width
      }
    }));
  }

  async function loadFile(file?: File) {
    if (!file) return;
    onUpdate(await imageFileToBlock(file));
  }

  async function pasteImage() {
    try {
      const updater = await clipboardImageToBlock();
      if (updater) {
        onUpdate(updater);
      }
    } catch {
      // Clipboard image access depends on the host shell permissions.
    }
  }

  return (
    <div className="mcq-inspector">
      <header className="mcq-inspector-header">
        <div>
          <span>Selected</span>
          <strong>Image block</strong>
        </div>
        <button
          className={clsx("mcq-lock-pill", block.settings.locked && "is-active")}
          type="button"
          onClick={() => updateSettings("locked", !block.settings.locked)}
        >
          <Lock size={14} />
          {block.settings.locked ? "Locked" : "Editable"}
        </button>
      </header>

      <InspectorSection title="Source" icon={<Image size={15} />}>
        <input
          ref={inputRef}
          accept="image/*"
          hidden
          type="file"
          onChange={(event) => void loadFile(event.target.files?.[0])}
        />
        <div className="mcq-button-row">
          <button type="button" onClick={() => inputRef.current?.click()}>
            <Upload size={14} />
            {block.asset.dataUrl ? "Replace image" : "Choose image"}
          </button>
          <button type="button" onClick={() => void pasteImage()}>
            <Clipboard size={14} />
            Paste image
          </button>
          <button type="button" onClick={() => onUpdate((current) => ({ ...current, asset: { fileName: "", altText: "" } }))}>
            <RefreshCw size={14} />
            Clear
          </button>
        </div>
        <label className="mcq-control mcq-control-full">
          <span>Alt text</span>
          <input
            placeholder="Describe the image for accessibility and search"
            value={block.asset.altText}
            onChange={(event) => onUpdate((current) => ({ ...current, asset: { ...current.asset, altText: event.target.value } }))}
          />
        </label>
      </InspectorSection>

      <InspectorSection title="Size and Rotate" icon={<Maximize2 size={15} />}>
        <div className="mcq-image-control-row">
          <NumberControl label="Width mm" value={block.settings.width} min={10} max={180} onChange={updateWidth} />
          <NumberControl label="Height mm" value={block.settings.height} min={8} max={240} onChange={updateHeight} />
          <NumberControl label="Rotate" value={block.settings.rotation} min={-180} max={180} onChange={(value) => updateSettings("rotation", value)} />
          <label className="mcq-check-row">
            <input checked={block.settings.lockAspectRatio} type="checkbox" onChange={(event) => updateSettings("lockAspectRatio", event.target.checked)} />
            Lock ratio
          </label>
        </div>
        <div className="mcq-button-row">
          <button type="button" onClick={() => updateSettings("rotation", block.settings.rotation - 90)}>
            <RotateCcw size={14} />
            90 left
          </button>
          <button type="button" onClick={() => updateSettings("rotation", block.settings.rotation + 90)}>
            <RotateCw size={14} />
            90 right
          </button>
          <button type="button" onClick={() => onUpdate((current) => ({ ...current, settings: { ...current.settings, rotation: 0, crop: { x: 0, y: 0, width: 100, height: 100 } } }))}>
            Reset
          </button>
        </div>
      </InspectorSection>

      <InspectorSection title="Crop" icon={<Scissors size={15} />}>
        <div className="mcq-image-control-row">
          <NumberControl label="X %" value={block.settings.crop.x} min={0} max={100} onChange={(value) => updateCrop("x", value)} />
          <NumberControl label="Y %" value={block.settings.crop.y} min={0} max={100} onChange={(value) => updateCrop("y", value)} />
          <NumberControl label="W %" value={block.settings.crop.width} min={1} max={100} onChange={(value) => updateCrop("width", value)} />
          <NumberControl label="H %" value={block.settings.crop.height} min={1} max={100} onChange={(value) => updateCrop("height", value)} />
        </div>
      </InspectorSection>

      <InspectorSection title="Placement" icon={<AlignCenter size={15} />}>
        <div className="mcq-image-placement-row">
          <span className="mcq-mini-label">Horizontal</span>
          <IconToggle active={block.settings.horizontalAlignment === "left"} label="Align image left" onClick={() => updateSettings("horizontalAlignment", "left")} icon={<AlignLeft size={15} />} />
          <IconToggle active={block.settings.horizontalAlignment === "center"} label="Align image center" onClick={() => updateSettings("horizontalAlignment", "center")} icon={<AlignCenter size={15} />} />
          <IconToggle active={block.settings.horizontalAlignment === "right"} label="Align image right" onClick={() => updateSettings("horizontalAlignment", "right")} icon={<AlignRight size={15} />} />
          <span className="mcq-mini-label">Vertical</span>
          <button aria-label="Align image top" className={clsx("mcq-icon-toggle", block.settings.verticalAlignment === "top" && "is-active")} type="button" onClick={() => updateSettings("verticalAlignment", "top")}>
            <span className="mcq-vertical-align-icon is-top" />
          </button>
          <button aria-label="Align image middle" className={clsx("mcq-icon-toggle", block.settings.verticalAlignment === "middle" && "is-active")} type="button" onClick={() => updateSettings("verticalAlignment", "middle")}>
            <span className="mcq-vertical-align-icon is-middle" />
          </button>
          <button aria-label="Align image bottom" className={clsx("mcq-icon-toggle", block.settings.verticalAlignment === "bottom" && "is-active")} type="button" onClick={() => updateSettings("verticalAlignment", "bottom")}>
            <span className="mcq-vertical-align-icon is-bottom" />
          </button>
        </div>
        <div className="mcq-image-control-row">
          <NumberControl label="Before" value={block.settings.spacingBefore} min={0} max={48} onChange={(value) => updateSettings("spacingBefore", value)} />
          <NumberControl label="After" value={block.settings.spacingAfter} min={0} max={48} onChange={(value) => updateSettings("spacingAfter", value)} />
          <label className="mcq-check-row">
            <input checked={block.settings.border} type="checkbox" onChange={(event) => updateSettings("border", event.target.checked)} />
            Border
          </label>
        </div>
      </InspectorSection>

      <InspectorSection title="Preview" icon={<Image size={15} />}>
        <div className="mcq-inspector-image-preview">
          <ImageBlockPreview block={block} />
        </div>
      </InspectorSection>
    </div>
  );
}

function InspectorSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
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

function IconToggle({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button aria-label={label} className={clsx("mcq-icon-toggle", active && "is-active")} type="button" onClick={onClick}>
      {icon}
    </button>
  );
}

function NumberControl({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="mcq-control">
      <span>{label}</span>
      <input max={max} min={min} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
