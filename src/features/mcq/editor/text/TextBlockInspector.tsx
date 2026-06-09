import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  CaseSensitive,
  Italic,
  List,
  ListOrdered,
  Lock,
  Pilcrow,
  Plus,
  RemoveFormatting,
  Underline
} from "lucide-react";
import clsx from "clsx";
import katex from "katex";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Alignment, TextBlock } from "../types";
import { textBlockPlaceholder } from "../textBlockDefaults";

const fonts = ["Calibri", "Arial", "Times New Roman", "Cambria", "Segoe UI"];
const listStyles = [
  { label: "1. 2. 3.", value: "decimal-dot" },
  { label: "(1) (2) (3)", value: "decimal-paren" },
  { label: "a. b. c.", value: "alpha-dot" },
  { label: "(a) (b) (c)", value: "alpha-paren" },
  { label: "i. ii. iii.", value: "roman-dot" },
  { label: "(i) (ii) (iii)", value: "roman-paren" }
] as const;

type TextBlockInspectorProps = {
  block: TextBlock;
  onUpdate: (updater: (block: TextBlock) => TextBlock) => void;
};

export function TextBlockInspector({ block, onUpdate }: TextBlockInspectorProps) {
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const [numberedStyle, setNumberedStyle] = useState<(typeof listStyles)[number]["value"]>("decimal-dot");
  const latexPreview = katex.renderToString(block.inlineLatex.source || "T = mv^2/r", {
    throwOnError: false,
    output: "html"
  });

  function updateSettings<T extends keyof TextBlock["settings"]>(key: T, value: TextBlock["settings"][T]) {
    onUpdate((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [key]: value
      }
    }));
  }

  function updateLatex<T extends keyof TextBlock["inlineLatex"]>(key: T, value: TextBlock["inlineLatex"][T]) {
    onUpdate((current) => ({
      ...current,
      inlineLatex: {
        ...current.inlineLatex,
        [key]: value
      }
    }));
  }

  function setAlignment(alignment: Alignment) {
    updateSettings("alignment", alignment);
  }

  function rememberSelection() {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;
    selectionRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd };
  }

  function wrapSelectedText(tag: "b" | "i" | "u" | "sub" | "sup") {
    const { start, end } = getTextSelection();
    const opening = `<${tag}>`;
    const closing = `</${tag}>`;
    let nextSelectionStart = start + opening.length;
    let nextSelectionEnd = nextSelectionStart + (end - start);

    onUpdate((current) => {
      const selected = current.text.slice(start, end);
      const before = current.text.slice(start - opening.length, start);
      const after = current.text.slice(end, end + closing.length);

      if (selected.startsWith(opening) && selected.endsWith(closing)) {
        const unwrapped = selected.slice(opening.length, selected.length - closing.length);
        nextSelectionStart = start;
        nextSelectionEnd = start + unwrapped.length;
        return {
          ...current,
          text: `${current.text.slice(0, start)}${unwrapped}${current.text.slice(end)}`
        };
      }

      if (before === opening && after === closing) {
        nextSelectionStart = start - opening.length;
        nextSelectionEnd = nextSelectionStart + selected.length;
        return {
          ...current,
          text: `${current.text.slice(0, start - opening.length)}${selected}${current.text.slice(end + closing.length)}`
        };
      }

      return {
        ...current,
        text: `${current.text.slice(0, start)}${opening}${selected}${closing}${current.text.slice(end)}`
      };
    });

    requestAnimationFrame(() => {
      const nextTextarea = contentTextareaRef.current;
      if (!nextTextarea) return;
      nextTextarea.focus();
      nextTextarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
    });
  }

  function wrapSelectedSpan(kind: "font" | "size", value: string | number) {
    const { start, end } = getTextSelection();
    if (start === end) {
      if (kind === "font") {
        updateSettings("fontFamily", String(value));
      } else {
        updateSettings("fontSize", Number(value));
      }
      return;
    }

    const opening = `<span data-${kind}="${value}">`;
    const closing = "</span>";
    onUpdate((current) => ({
      ...current,
      text: `${current.text.slice(0, start)}${opening}${current.text.slice(start, end)}${closing}${current.text.slice(end)}`
    }));
    restoreSelection(start + opening.length, end + opening.length);
  }

  function getTextSelection() {
    const textarea = contentTextareaRef.current;
    if (textarea) {
      selectionRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd };
    }
    return selectionRef.current;
  }

  function restoreSelection(start: number, end: number) {
    requestAnimationFrame(() => {
      const textarea = contentTextareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(start, end);
      selectionRef.current = { start, end };
    });
  }

  function insertInlineLatex() {
    const { start, end } = getTextSelection();
    const source = `$${block.inlineLatex.source || "T = mv^2/r"}$`;
    onUpdate((current) => ({
      ...current,
      text: `${current.text.slice(0, start)}${source}${current.text.slice(end)}`
    }));
    restoreSelection(start + source.length, start + source.length);
  }

  function applyList(kind: "bullet" | "numbered") {
    const { start, end } = getTextSelection();
    onUpdate((current) => {
      const before = current.text.slice(0, start);
      const selected = current.text.slice(start, end || current.text.length);
      const after = current.text.slice(end || current.text.length);
      const lines = selected.split(/\r?\n/);
      const transformed = lines.map((line, index) => {
        const content = stripListMarker(line);
        if (!content.trim()) return content;
        return kind === "bullet" ? `- ${content}` : `${numberedMarker(index + 1, numberedStyle)} ${content}`;
      }).join("\n");
      return { ...current, text: `${before}${transformed}${after}` };
    });
  }

  function clearListMarkers() {
    const { start, end } = getTextSelection();
    onUpdate((current) => {
      const before = current.text.slice(0, start);
      const selected = current.text.slice(start, end || current.text.length);
      const after = current.text.slice(end || current.text.length);
      return { ...current, text: `${before}${selected.split(/\r?\n/).map(stripListMarker).join("\n")}${after}` };
    });
  }

  return (
    <div className="mcq-inspector">
      <header className="mcq-inspector-header">
        <div>
          <span>Selected</span>
          <strong>Text block</strong>
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

      <InspectorSection title="Content" icon={<Pilcrow size={15} />}>
        <label className="mcq-control mcq-control-full">
          <span>Text. Use $...$ for inline LaTeX.</span>
          <textarea
            ref={contentTextareaRef}
            placeholder={textBlockPlaceholder}
            value={block.text}
            onChange={(event) => {
              selectionRef.current = { start: event.target.selectionStart, end: event.target.selectionEnd };
              onUpdate((current) => ({ ...current, text: event.target.value }));
            }}
            onBlur={rememberSelection}
            onClick={rememberSelection}
            onKeyUp={rememberSelection}
            onMouseUp={rememberSelection}
            onSelect={rememberSelection}
          />
        </label>
      </InspectorSection>

      <InspectorSection title="Inline LaTeX Style" icon={<Baseline size={15} />}>
        <div className="mcq-inline-latex-layout">
          <div className="mcq-inline-latex-stack">
            <span className="mcq-mini-label">Selected inline formula</span>
            <input
              value={block.inlineLatex.source}
              onChange={(event) => updateLatex("source", event.target.value)}
            />
            <span className="mcq-mini-label">Render preview</span>
            <div
              className={clsx(
                "mcq-latex-preview",
                block.inlineLatex.bold && "is-bold",
                block.inlineLatex.italic && "is-italic",
                block.inlineLatex.underline && "is-underlined"
              )}
              dangerouslySetInnerHTML={{ __html: latexPreview }}
            />
          </div>
          <div className="mcq-inline-latex-actions">
            <button type="button" onClick={insertInlineLatex}>
              <Plus size={14} />
              Insert into text
            </button>
            <button type="button" onClick={() => updateLatex("source", "")}>
              <RemoveFormatting size={14} />
              Clear helper
            </button>
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Typography" icon={<CaseSensitive size={15} />}>
        <div className="mcq-typography-layout mcq-text-typography-layout">
          <div>
            <div className="mcq-control-grid">
              <SelectControl label="Text font" value={block.settings.fontFamily} options={fonts} onChange={(value) => wrapSelectedSpan("font", value)} />
              <NumberControl label="Text size" value={block.settings.fontSize} min={8} max={22} onChange={(value) => wrapSelectedSpan("size", value)} />
            </div>
            <div className="mcq-icon-toggle-row">
              <IconToggle active={false} label="Bold selected text" onClick={() => wrapSelectedText("b")} icon={<Bold size={15} />} />
              <IconToggle active={false} label="Italic selected text" onClick={() => wrapSelectedText("i")} icon={<Italic size={15} />} />
              <IconToggle active={false} label="Underline selected text" onClick={() => wrapSelectedText("u")} icon={<Underline size={15} />} />
            </div>
          </div>
          <div>
            <div className="mcq-control-grid">
              <SelectControl
                label="Math font (inline)"
                disabled={block.inlineLatex.inheritTextFont}
                value={block.inlineLatex.fontFamily}
                options={fonts}
                onChange={(value) => updateLatex("fontFamily", value)}
              />
              <NumberControl
                label="Math size"
                disabled={block.inlineLatex.inheritTextFont}
                value={block.inlineLatex.fontSize}
                min={8}
                max={22}
                onChange={(value) => updateLatex("fontSize", value)}
              />
            </div>
            <div className="mcq-icon-toggle-row">
              <IconToggle active={block.inlineLatex.bold} label="Bold inline LaTeX" onClick={() => updateLatex("bold", !block.inlineLatex.bold)} icon={<Bold size={15} />} />
              <IconToggle active={block.inlineLatex.italic} label="Italic inline LaTeX" onClick={() => updateLatex("italic", !block.inlineLatex.italic)} icon={<Italic size={15} />} />
              <IconToggle active={block.inlineLatex.underline} label="Underline inline LaTeX" onClick={() => updateLatex("underline", !block.inlineLatex.underline)} icon={<Underline size={15} />} />
            </div>
            <label className="mcq-check-row mcq-inline-inherit">
              <input
                checked={block.inlineLatex.inheritTextFont}
                type="checkbox"
                onChange={(event) => updateLatex("inheritTextFont", event.target.checked)}
              />
              Inherit text font
            </label>
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Lists" icon={<List size={15} />}>
        <div className="mcq-list-tools-row">
          <button className="mcq-icon-toggle" aria-label="Bulleted list" type="button" onClick={() => applyList("bullet")}>
            <List size={15} />
          </button>
          <button className="mcq-icon-toggle" aria-label="Numbered list" type="button" onClick={() => applyList("numbered")}>
            <ListOrdered size={15} />
          </button>
          <label className="mcq-control">
            <span>Numbering</span>
            <select value={numberedStyle} onChange={(event) => setNumberedStyle(event.target.value as typeof numberedStyle)}>
              {listStyles.map((style) => (
                <option key={style.value} value={style.value}>{style.label}</option>
              ))}
            </select>
          </label>
          <button className="mcq-reset-style" type="button" onClick={clearListMarkers}>
            Clear list
          </button>
        </div>
      </InspectorSection>

      <InspectorSection title="Paragraph" icon={<AlignLeft size={15} />}>
        <div className="mcq-paragraph-row">
          <div className="mcq-icon-toggle-row">
            <IconToggle active={block.settings.alignment === "left"} label="Align left" onClick={() => setAlignment("left")} icon={<AlignLeft size={15} />} />
            <IconToggle active={block.settings.alignment === "center"} label="Align center" onClick={() => setAlignment("center")} icon={<AlignCenter size={15} />} />
            <IconToggle active={block.settings.alignment === "right"} label="Align right" onClick={() => setAlignment("right")} icon={<AlignRight size={15} />} />
          </div>
          <NumberControl label="Line height" value={block.settings.lineHeight} min={1} max={2} step={0.05} onChange={(value) => updateSettings("lineHeight", value)} />
          <NumberControl label="Indent" value={block.settings.indent} min={0} max={48} onChange={(value) => updateSettings("indent", value)} />
          <NumberControl label="Before" value={block.settings.spacingBefore} min={0} max={36} onChange={(value) => updateSettings("spacingBefore", value)} />
          <NumberControl label="After" value={block.settings.spacingAfter} min={0} max={36} onChange={(value) => updateSettings("spacingAfter", value)} />
          <NumberControl label="Para gap" value={block.settings.paragraphSpacing ?? 6} min={0} max={24} onChange={(value) => updateSettings("paragraphSpacing", value)} />
        </div>
      </InspectorSection>

      <InspectorSection title="Print behavior" icon={<Pilcrow size={15} />}>
        <div className="mcq-print-row">
          <label className="mcq-check-row">
            <input checked={block.settings.keepWithNext} type="checkbox" onChange={(event) => updateSettings("keepWithNext", event.target.checked)} />
            Keep with next
          </label>
          <label className="mcq-check-row">
            <input checked={block.settings.pageBreakBefore} type="checkbox" onChange={(event) => updateSettings("pageBreakBefore", event.target.checked)} />
            Page break before
          </label>
          <label className="mcq-check-row">
            <input checked={block.settings.allowSplit} type="checkbox" onChange={(event) => updateSettings("allowSplit", event.target.checked)} />
            Allow split across pages
          </label>
        </div>
      </InspectorSection>

      <InspectorSection title="Validation" icon={<Pilcrow size={15} />}>
        <div className="mcq-validation-ok">Text block is valid.</div>
      </InspectorSection>
    </div>
  );
}

function stripListMarker(line: string) {
  return line.replace(/^(\s*)([-*]|\u2022|\d+[.)]|\(\d+\)|[a-zA-Z][.)]|\([a-zA-Z]\)|[ivxlcdmIVXLCDM]+[.)]|\([ivxlcdmIVXLCDM]+\))\s+/, "$1");
}

function numberedMarker(index: number, style: (typeof listStyles)[number]["value"]) {
  if (style === "decimal-paren") return `(${index})`;
  if (style === "alpha-dot") return `${toAlpha(index)}.`;
  if (style === "alpha-paren") return `(${toAlpha(index)})`;
  if (style === "roman-dot") return `${toRoman(index)}.`;
  if (style === "roman-paren") return `(${toRoman(index)})`;
  return `${index}.`;
}

function toAlpha(index: number) {
  return String.fromCharCode(96 + ((index - 1) % 26) + 1);
}

function toRoman(index: number) {
  const romans = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
  return romans[index - 1] ?? String(index);
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

function IconToggle({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button aria-label={label} className={clsx("mcq-icon-toggle", active && "is-active")} type="button" onClick={onClick}>
      {icon}
    </button>
  );
}

function SelectControl({
  label,
  value,
  options,
  disabled,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
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

function NumberControl({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mcq-control">
      <span>{label}</span>
      <input
        disabled={disabled}
        max={max}
        min={min}
        step={step}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
