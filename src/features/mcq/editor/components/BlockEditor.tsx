import { useState } from "react";
import type { ReactNode } from "react";
import type { EquationBlock, ImageBlock, McqBlock, OptionsBlock, TableBlock, TextBlock } from "../types";
import { TextBlockCard } from "../text/TextBlockCard";
import { OptionsBlockCard } from "../options/OptionsBlockCard";
import { ImageBlockCard } from "../image/ImageBlockCard";
import { TableBlockCard } from "../table/TableBlockCard";
import { EquationBlockCard } from "../equation/EquationBlockCard";

type BlockEditorProps = {
  blocks: McqBlock[];
  selectedBlockId: string;
  onSelect: (id: string) => void;
  onUpdateTextBlock: (id: string, patch: Partial<TextBlock>) => void;
  onUpdateEquationBlock: (id: string, updater: (block: EquationBlock) => EquationBlock) => void;
  onUpdateImageBlock: (id: string, updater: (block: ImageBlock) => ImageBlock) => void;
  onUpdateTableBlock: (id: string, updater: (block: TableBlock) => TableBlock) => void;
  onUpdateOptionsBlock: (id: string, updater: (block: OptionsBlock) => OptionsBlock) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onReorder: (draggedId: string, targetId: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleLock: (id: string) => void;
};

export function BlockEditor({
  blocks,
  selectedBlockId,
  onSelect,
  onUpdateTextBlock,
  onUpdateEquationBlock,
  onUpdateImageBlock,
  onUpdateTableBlock,
  onUpdateOptionsBlock,
  onMove,
  onReorder,
  onDuplicate,
  onDelete,
  onToggleLock
}: BlockEditorProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function renderDraggable(block: McqBlock, child: ReactNode) {
    return (
      <div
        className="mcq-block-drag-wrap"
        draggable
        key={block.id}
        onDragStart={(event) => {
          setDraggingId(block.id);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", block.id);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          event.preventDefault();
          const draggedId = event.dataTransfer.getData("text/plain") || draggingId;
          if (draggedId && draggedId !== block.id) onReorder(draggedId, block.id);
          setDraggingId(null);
        }}
        onDragEnd={() => setDraggingId(null)}
      >
        {child}
      </div>
    );
  }

  return (
    <section className="mcq-block-editor" aria-label="Block editor">
      <header>
        <span>Block editor</span>
      </header>
      <div className="mcq-block-list">
        {blocks.map((block, index) => {
          if (block.type === "text") {
            return renderDraggable(block,
            <TextBlockCard
              block={block}
              index={index}
              isSelected={block.id === selectedBlockId}
              onSelect={() => onSelect(block.id)}
              onUpdate={(patch) => onUpdateTextBlock(block.id, patch)}
              onMove={(direction) => onMove(block.id, direction)}
              onDuplicate={() => onDuplicate(block.id)}
              onDelete={() => onDelete(block.id)}
              onToggleLock={() => onToggleLock(block.id)}
            />
            );
          }

          if (block.type === "equation") {
            return renderDraggable(block,
              <EquationBlockCard
                block={block}
                index={index}
                isSelected={block.id === selectedBlockId}
                onSelect={() => onSelect(block.id)}
                onMove={(direction) => onMove(block.id, direction)}
                onDuplicate={() => onDuplicate(block.id)}
                onDelete={() => onDelete(block.id)}
                onToggleLock={() => onUpdateEquationBlock(block.id, (current) => ({ ...current, settings: { ...current.settings, locked: !current.settings.locked } }))}
              />
            );
          }

          if (block.type === "image") {
            return renderDraggable(block,
              <ImageBlockCard
                block={block}
                index={index}
                isSelected={block.id === selectedBlockId}
                onSelect={() => onSelect(block.id)}
                onMove={(direction) => onMove(block.id, direction)}
                onDuplicate={() => onDuplicate(block.id)}
                onDelete={() => onDelete(block.id)}
                onUpdate={(updater) => onUpdateImageBlock(block.id, updater)}
                onToggleLock={() =>
                  onUpdateImageBlock(block.id, (current) => ({
                    ...current,
                    settings: { ...current.settings, locked: !current.settings.locked }
                  }))
                }
              />
            );
          }

          if (block.type === "table") {
            return renderDraggable(block,
              <TableBlockCard
                block={block}
                index={index}
                isSelected={block.id === selectedBlockId}
                onSelect={() => onSelect(block.id)}
                onMove={(direction) => onMove(block.id, direction)}
                onDuplicate={() => onDuplicate(block.id)}
                onDelete={() => onDelete(block.id)}
                onToggleLock={() => onUpdateTableBlock(block.id, (current) => ({ ...current, settings: { ...current.settings, locked: !current.settings.locked } }))}
              />
            );
          }

          return renderDraggable(block,
            <OptionsBlockCard
              block={block}
              index={index}
              isSelected={block.id === selectedBlockId}
              onSelect={() => onSelect(block.id)}
              onMove={(direction) => onMove(block.id, direction)}
              onDuplicate={() => onDuplicate(block.id)}
              onDelete={() => onDelete(block.id)}
              onToggleLock={() =>
                onUpdateOptionsBlock(block.id, (current) => ({
                  ...current,
                  settings: { ...current.settings, locked: !current.settings.locked }
                }))
              }
            />
          );
        })}
      </div>
    </section>
  );
}
