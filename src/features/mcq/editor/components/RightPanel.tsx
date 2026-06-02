import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import type { EquationBlock, ImageBlock, InspectorTab, McqBlock, McqEditorMetadata, OptionsBlock, TableBlock, TextBlock } from "../types";
import { TextBlockInspector } from "../text/TextBlockInspector";
import { OptionsBlockInspector } from "../options/OptionsBlockInspector";
import { ImageBlockInspector } from "../image/ImageBlockInspector";
import { EquationBlockInspector } from "../equation/EquationBlockInspector";
import { TableBlockInspector } from "../table/TableBlockInspector";
import { PreviewPanel } from "./PreviewPanel";
import { MetadataPanel } from "./MetadataPanel";

type RightPanelProps = {
  activeTab: InspectorTab;
  blocks: McqBlock[];
  hasMetadataWarning: boolean;
  metadata: McqEditorMetadata;
  metadataIssues: string[];
  selectedBlock?: McqBlock;
  onActiveTabChange: (tab: InspectorTab) => void;
  onMetadataChange: (updater: (metadata: McqEditorMetadata) => McqEditorMetadata) => void;
  onUpdateTextBlock: (id: string, updater: (block: TextBlock) => TextBlock) => void;
  onUpdateEquationBlock: (id: string, updater: (block: EquationBlock) => EquationBlock) => void;
  onUpdateImageBlock: (id: string, updater: (block: ImageBlock) => ImageBlock) => void;
  onUpdateTableBlock: (id: string, updater: (block: TableBlock) => TableBlock) => void;
  onUpdateOptionsBlock: (id: string, updater: (block: OptionsBlock) => OptionsBlock) => void;
};

export function RightPanel({
  activeTab,
  blocks,
  hasMetadataWarning,
  metadata,
  metadataIssues,
  selectedBlock,
  onActiveTabChange,
  onMetadataChange,
  onUpdateTextBlock,
  onUpdateEquationBlock,
  onUpdateImageBlock,
  onUpdateTableBlock,
  onUpdateOptionsBlock
}: RightPanelProps) {
  return (
    <aside className="mcq-right-panel">
      <div className="mcq-panel-tabs">
        <button
          className={clsx(activeTab === "inspector" && "is-active")}
          type="button"
          onClick={() => onActiveTabChange("inspector")}
        >
          Inspector
        </button>
        <button
          className={clsx(activeTab === "metadata" && "is-active", hasMetadataWarning && "has-warning")}
          type="button"
          onClick={() => onActiveTabChange("metadata")}
        >
          Metadata
          {hasMetadataWarning ? <AlertTriangle size={14} /> : null}
        </button>
        <button
          className={clsx(activeTab === "preview" && "is-active")}
          type="button"
          onClick={() => onActiveTabChange("preview")}
        >
          Preview
        </button>
      </div>

      <div className="mcq-panel-body">
        {activeTab === "inspector" && selectedBlock?.type === "text" ? (
          <TextBlockInspector block={selectedBlock} onUpdate={(updater) => onUpdateTextBlock(selectedBlock.id, updater)} />
        ) : null}
        {activeTab === "inspector" && selectedBlock?.type === "equation" ? (
          <EquationBlockInspector block={selectedBlock} onUpdate={(updater) => onUpdateEquationBlock(selectedBlock.id, updater)} />
        ) : null}
        {activeTab === "inspector" && selectedBlock?.type === "image" ? (
          <ImageBlockInspector block={selectedBlock} onUpdate={(updater) => onUpdateImageBlock(selectedBlock.id, updater)} />
        ) : null}
        {activeTab === "inspector" && selectedBlock?.type === "table" ? (
          <TableBlockInspector block={selectedBlock} onUpdate={(updater) => onUpdateTableBlock(selectedBlock.id, updater)} />
        ) : null}
        {activeTab === "inspector" && selectedBlock?.type === "options" ? (
          <OptionsBlockInspector block={selectedBlock} onUpdate={(updater) => onUpdateOptionsBlock(selectedBlock.id, updater)} />
        ) : null}
        {activeTab === "metadata" ? <MetadataPanel metadata={metadata} onChange={onMetadataChange} /> : null}
        {activeTab === "preview" ? (
          <PreviewPanel
            blocks={blocks}
            metadataIssues={metadataIssues}
            selectedBlock={selectedBlock}
            onUpdateOptionsBlock={onUpdateOptionsBlock}
          />
        ) : null}
      </div>
    </aside>
  );
}
