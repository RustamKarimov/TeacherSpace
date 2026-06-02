import type { EquationBlock, ImageBlock, McqBlock, OptionsBlock, TableBlock, TextBlock } from "./types";
import { nanoid } from "nanoid";

export function moveBlock(blocks: McqBlock[], id: string, direction: "up" | "down") {
  const index = blocks.findIndex((block) => block.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (index < 0 || targetIndex < 0 || targetIndex >= blocks.length) {
    return blocks;
  }

  const nextBlocks = [...blocks];
  const [block] = nextBlocks.splice(index, 1);
  nextBlocks.splice(targetIndex, 0, block);
  return nextBlocks;
}

export function duplicateTextBlock(block: TextBlock): TextBlock {
  return {
    ...block,
    id: nanoid(),
    text: block.text
  };
}

export function duplicateImageBlock(block: ImageBlock): ImageBlock {
  return {
    ...block,
    id: nanoid(),
    asset: { ...block.asset },
    settings: {
      ...block.settings,
      crop: { ...block.settings.crop }
    }
  };
}

export function duplicateEquationBlock(block: EquationBlock): EquationBlock {
  return {
    ...block,
    id: nanoid(),
    settings: { ...block.settings }
  };
}

export function duplicateTableBlock(block: TableBlock): TableBlock {
  return {
    ...block,
    id: nanoid(),
    rows: block.rows.map((row) => row.map((cell) => ({ ...cell, id: nanoid(), image: cell.image ? { ...cell.image } : undefined }))),
    settings: { ...block.settings }
  };
}

export function duplicateOptionsBlock(block: OptionsBlock): OptionsBlock {
  return {
    ...block,
    id: nanoid(),
    options: block.options.map((option) => ({ ...option, id: nanoid(), image: option.image ? { ...option.image } : undefined })),
    table: duplicateTableBlock(block.table)
  };
}
