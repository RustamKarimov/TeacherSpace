import { nanoid } from "nanoid";
import type { EquationBlock } from "./types";

export function createEquationBlock(previous?: EquationBlock): EquationBlock {
  return {
    id: nanoid(),
    type: "equation",
    source: previous?.source ?? "",
    settings: {
      fontFamily: previous?.settings.fontFamily ?? "Calibri",
      fontSize: previous?.settings.fontSize ?? 11,
      bold: previous?.settings.bold ?? false,
      italic: previous?.settings.italic ?? false,
      alignment: previous?.settings.alignment ?? "center",
      spacingBefore: previous?.settings.spacingBefore ?? 6,
      spacingAfter: previous?.settings.spacingAfter ?? 6,
      numbering: previous?.settings.numbering ?? "",
      keepWithNext: previous?.settings.keepWithNext ?? false,
      pageBreakBefore: previous?.settings.pageBreakBefore ?? false,
      allowSplit: previous?.settings.allowSplit ?? true,
      locked: previous?.settings.locked ?? false
    }
  };
}
