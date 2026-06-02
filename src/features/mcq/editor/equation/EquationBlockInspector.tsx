import { AlignCenter, AlignLeft, AlignRight, Eye, Lock, Sigma } from "lucide-react";
import katex from "katex";
import clsx from "clsx";
import type { ReactNode } from "react";
import type { EquationBlock, Alignment } from "../types";

const fonts = ["Calibri", "Arial", "Times New Roman", "Cambria", "Segoe UI"];
const equationPlaceholder = "s = \\frac{1}{2}at^2";

export function EquationBlockInspector({ block, onUpdate }: { block: EquationBlock; onUpdate: (updater: (block: EquationBlock) => EquationBlock) => void }) {
  const html = katex.renderToString(block.source || equationPlaceholder, { throwOnError: false, output: "html", displayMode: true });

  function updateSettings<T extends keyof EquationBlock["settings"]>(key: T, value: EquationBlock["settings"][T]) {
    onUpdate((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  }

  return (
    <div className="mcq-inspector">
      <header className="mcq-inspector-header">
        <div>
          <span>Selected</span>
          <strong>Equation block</strong>
        </div>
        <button className={clsx("mcq-lock-pill", block.settings.locked && "is-active")} type="button" onClick={() => updateSettings("locked", !block.settings.locked)}>
          <Lock size={14} />
          {block.settings.locked ? "Locked" : "Editable"}
        </button>
      </header>

      <section className="mcq-inspector-section">
        <h3><Sigma size={15} /> Equation</h3>
        <label className="mcq-control mcq-control-full">
          <span>LaTeX source</span>
          <textarea placeholder={equationPlaceholder} value={block.source} onChange={(event) => onUpdate((current) => ({ ...current, source: event.target.value }))} />
        </label>
        <div className={clsx("mcq-equation-render-preview", !block.source.trim() && "is-placeholder")} style={{ fontFamily: block.settings.fontFamily, fontSize: `${block.settings.fontSize}pt`, textAlign: block.settings.alignment }} dangerouslySetInnerHTML={{ __html: html }} />
      </section>

      <section className="mcq-inspector-section">
        <h3><Eye size={15} /> Format</h3>
        <div className="mcq-paragraph-row">
          <div className="mcq-icon-toggle-row">
            <IconToggle active={block.settings.alignment === "left"} label="Align left" onClick={() => updateSettings("alignment", "left")} icon={<AlignLeft size={15} />} />
            <IconToggle active={block.settings.alignment === "center"} label="Align center" onClick={() => updateSettings("alignment", "center")} icon={<AlignCenter size={15} />} />
            <IconToggle active={block.settings.alignment === "right"} label="Align right" onClick={() => updateSettings("alignment", "right")} icon={<AlignRight size={15} />} />
          </div>
          <label className="mcq-control"><span>Font</span><select value={block.settings.fontFamily} onChange={(event) => updateSettings("fontFamily", event.target.value)}>{fonts.map((font) => <option key={font}>{font}</option>)}</select></label>
          <NumberControl label="Size" value={block.settings.fontSize} min={8} max={24} onChange={(fontSize) => updateSettings("fontSize", fontSize)} />
          <NumberControl label="Before" value={block.settings.spacingBefore} min={0} max={36} onChange={(spacingBefore) => updateSettings("spacingBefore", spacingBefore)} />
          <NumberControl label="After" value={block.settings.spacingAfter} min={0} max={36} onChange={(spacingAfter) => updateSettings("spacingAfter", spacingAfter)} />
        </div>
      </section>
    </div>
  );
}

function IconToggle({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return <button aria-label={label} className={clsx("mcq-icon-toggle", active && "is-active")} type="button" onClick={onClick}>{icon}</button>;
}

function NumberControl({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="mcq-control"><span>{label}</span><input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
