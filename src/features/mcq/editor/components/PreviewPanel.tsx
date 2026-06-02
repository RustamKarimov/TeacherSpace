import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Info,
  List,
  RefreshCw,
  Ruler,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import clsx from "clsx";
import { useState } from "react";
import type { McqBlock, OptionLabelPosition, OptionLayout, OptionsBlock } from "../types";
import { TextWithInlineLatex } from "../text/TextWithInlineLatex";
import { OptionsPreview } from "../options/OptionsBlockInspector";
import { ImageBlockPreview } from "../image/ImageBlockCard";
import { TableWithLatex } from "../table/TableWithLatex";
import katex from "katex";

type PreviewPanelProps = {
  blocks: McqBlock[];
  metadataIssues: string[];
  selectedBlock?: McqBlock;
  onUpdateOptionsBlock: (id: string, updater: (block: OptionsBlock) => OptionsBlock) => void;
};

export function PreviewPanel({ blocks, metadataIssues, selectedBlock, onUpdateOptionsBlock }: PreviewPanelProps) {
  const [mode, setMode] = useState<"student" | "teacher">("student");
  const [zoom, setZoom] = useState<"fit" | "width" | "100">("fit");
  const [showPageGuides, setShowPageGuides] = useState(true);
  const [showMarginGuides, setShowMarginGuides] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshedAt, setRefreshedAt] = useState("now");
  const [isFullPreviewOpen, setIsFullPreviewOpen] = useState(false);
  const [showOutline, setShowOutline] = useState(false);

  const optionsBlock =
    selectedBlock?.type === "options" ? selectedBlock : blocks.find((block): block is OptionsBlock => block.type === "options");
  const hasEmptyOption = optionsBlock?.options.some((option) => option.text.trim().length === 0) ?? false;
  const zoomLabel = zoom === "fit" ? "Fit" : zoom === "width" ? "Width" : "100%";

  function updateOptionSettings(updater: (block: OptionsBlock) => OptionsBlock) {
    if (!optionsBlock) return;
    onUpdateOptionsBlock(optionsBlock.id, updater);
  }

  return (
    <div className="mcq-preview-panel">
      <div className="mcq-preview-controls">
        <div className="mcq-mode-toggle">
          <button className={mode === "student" ? "is-active" : undefined} type="button" onClick={() => setMode("student")}>
            Student
          </button>
          <button className={mode === "teacher" ? "is-active" : undefined} type="button" onClick={() => setMode("teacher")}>
            Teacher
          </button>
        </div>
        <div className="mcq-preview-zoom">
          <button aria-label="Zoom out" type="button" onClick={zoomOut}>
            <ZoomOut size={15} />
          </button>
          <button className="mcq-preview-zoom-value" type="button" onClick={() => setZoom(zoom === "fit" ? "width" : zoom === "width" ? "100" : "fit")}>
            {zoomLabel}
          </button>
          <button aria-label="Zoom in" type="button" onClick={zoomIn}>
            <ZoomIn size={15} />
          </button>
        </div>
        <button className={showPageGuides ? "is-active" : undefined} aria-label="Toggle page guides" type="button" onClick={() => setShowPageGuides((value) => !value)}>
          <FileText size={15} />
        </button>
        <button className={showMarginGuides ? "is-active" : undefined} aria-label="Toggle margin guides" type="button" onClick={() => setShowMarginGuides((value) => !value)}>
          <Ruler size={15} />
        </button>
        <button aria-label="Refresh renderer" type="button" onClick={refreshRenderer}>
          <RefreshCw size={15} />
        </button>
        <button aria-label="Open full preview" type="button" onClick={() => setIsFullPreviewOpen(true)}>
          <ExternalLink size={15} />
        </button>
        <button className={showOutline ? "is-active" : undefined} aria-label="Preview outline" type="button" onClick={() => setShowOutline((value) => !value)}>
          <List size={16} />
        </button>
      </div>

      {showOutline ? (
        <div className="mcq-preview-outline">
          {blocks.map((block, index) => (
            <button className={selectedBlock?.id === block.id ? "is-active" : undefined} key={block.id} type="button">
              <span>{index + 1}</span>
              {block.type === "text" ? "Text block" : block.type === "equation" ? "Equation block" : block.type === "image" ? "Image block" : block.type === "table" ? "Table block" : "Options block"}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mcq-preview-note">
        <Info size={15} />
        <span>Preview uses placeholder question number 1</span>
        <strong>Renderer v1.0 - A4 210 x 297 mm</strong>
      </div>

      {optionsBlock ? (
        <div className="mcq-preview-settings-strip">
          <button className={optionsBlock.settings.boxedLabels ? "is-active" : undefined} aria-label="Toggle boxed option letters" type="button" onClick={() => updateOptionSettings((block) => ({ ...block, settings: { ...block.settings, boxedLabels: !block.settings.boxedLabels } }))}>
            <span className="mcq-boxed-label-icon">A</span>
          </button>
          <button className={optionsBlock.settings.labelPosition === "beside" ? "is-active" : undefined} aria-label="Letter beside option" type="button" onClick={() => setLabelPosition("beside")}>
            <span className="mcq-label-position-glyph is-beside" />
          </button>
          <button className={optionsBlock.settings.labelPosition === "above" ? "is-active" : undefined} aria-label="Letter above option" type="button" onClick={() => setLabelPosition("above")}>
            <span className="mcq-label-position-glyph is-above" />
          </button>
          <button className={optionsBlock.settings.labelPosition === "below" ? "is-active" : undefined} aria-label="Letter below option" type="button" onClick={() => setLabelPosition("below")}>
            <span className="mcq-label-position-glyph is-below" />
          </button>
          <span className="mcq-preview-strip-divider" />
          <button className={optionsBlock.settings.layout === "one" ? "is-active" : undefined} aria-label="One column options" type="button" onClick={() => setLayout("one")}>
            <span className="mcq-column-icon is-one"><i /></span>
          </button>
          <button className={optionsBlock.settings.layout === "two" ? "is-active" : undefined} aria-label="Two column options" type="button" onClick={() => setLayout("two")}>
            <span className="mcq-column-icon is-two"><i /><i /></span>
          </button>
          <button className={optionsBlock.settings.layout === "four" ? "is-active" : undefined} aria-label="Four column options" type="button" onClick={() => setLayout("four")}>
            <span className="mcq-column-icon is-four"><i /><i /><i /><i /></span>
          </button>
        </div>
      ) : null}

      <div className={clsx("mcq-a4-frame", `is-zoom-${zoom}`)}>
        <div className="mcq-a4-page-shell">
          {renderA4Page()}
        </div>
      </div>
      <div className="mcq-preview-footer">
        <span>A4 210 x 297 mm</span>
        <span>{zoomLabel}</span>
        <span>{mode === "student" ? "Student copy" : "Teacher copy"}</span>
      </div>

      <div className="mcq-preview-status-grid">
        <div className="mcq-preview-status is-ok">
          <CheckCircle2 size={15} />
          Preview rendered successfully. Refreshed {refreshedAt}.
        </div>
        {metadataIssues.length > 0 ? (
          <div className="mcq-preview-status is-warning">
            <AlertTriangle size={15} />
            Metadata warning: {metadataIssues[0]}
          </div>
        ) : null}
        {hasEmptyOption ? (
          <div className="mcq-preview-status is-warning">
            <AlertTriangle size={15} />
            Every option needs content before saving.
          </div>
        ) : (
          <div className="mcq-preview-status is-muted">Invalid LaTeX warnings will appear here.</div>
        )}
      </div>
      <div className={clsx("mcq-teacher-note", mode === "student" && "is-disabled")}>
        Teacher markers {mode === "teacher" ? "are visible in this preview." : "are hidden in student mode."}
      </div>

      {isFullPreviewOpen ? (
        <div className="mcq-full-preview" role="dialog" aria-label="Full preview">
          <div className="mcq-full-preview-header">
            <strong>Full preview</strong>
            <div>
              <button type="button" onClick={() => setMode("student")}>Student</button>
              <button type="button" onClick={() => setMode("teacher")}>Teacher</button>
              <button type="button" onClick={() => setIsFullPreviewOpen(false)}>Close</button>
            </div>
          </div>
          <div className="mcq-full-preview-stage">
            {renderA4Page()}
          </div>
        </div>
      ) : null}
    </div>
  );

  function renderA4Page() {
    return (
      <div
        className={clsx("mcq-a4-page", showPageGuides && "has-page-guides", showMarginGuides && "has-margin-guides")}
        key={refreshKey}
      >
        <div className="mcq-a4-question">
          <strong>1</strong>
          <div className="mcq-a4-body">
            {blocks.map((block) =>
              block.type === "text" ? (
                <div
                  key={block.id}
                  style={{
                    fontFamily: block.settings.fontFamily,
                    fontSize: `${block.settings.fontSize}pt`,
                    lineHeight: block.settings.lineHeight,
                    textAlign: block.settings.alignment,
                    marginTop: block.settings.spacingBefore,
                    marginBottom: block.settings.spacingAfter
                  }}
                >
                  <TextWithInlineLatex block={block} />
                </div>
              ) : block.type === "equation" ? (
                block.source.trim() ? (
                <div
                  className="mcq-a4-equation"
                  key={block.id}
                  style={{
                    fontFamily: block.settings.fontFamily,
                    fontSize: `${block.settings.fontSize}pt`,
                    textAlign: block.settings.alignment,
                    marginTop: block.settings.spacingBefore,
                    marginBottom: block.settings.spacingAfter
                  }}
                  dangerouslySetInnerHTML={{ __html: katex.renderToString(block.source, { throwOnError: false, output: "html", displayMode: true }) }}
                />
                ) : null
              ) : block.type === "image" ? (
                <ImageBlockPreview a4 block={block} key={block.id} />
              ) : block.type === "table" ? (
                <TableWithLatex block={block} key={block.id} />
              ) : (
                <OptionsPreview block={block} key={block.id} student={mode === "student"} />
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  function zoomOut() {
    setZoom((current) => (current === "100" ? "width" : "fit"));
  }

  function zoomIn() {
    setZoom((current) => (current === "fit" ? "width" : "100"));
  }

  function refreshRenderer() {
    setRefreshKey((value) => value + 1);
    setRefreshedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }

  function setLayout(layout: OptionLayout) {
    updateOptionSettings((block) => ({ ...block, settings: { ...block.settings, layout } }));
  }

  function setLabelPosition(labelPosition: OptionLabelPosition) {
    updateOptionSettings((block) => ({ ...block, settings: { ...block.settings, labelPosition } }));
  }
}
