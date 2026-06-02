import { nanoid } from "nanoid";
import type { TextBlock, TextBlockSettings } from "./types";

export const textBlockPlaceholder =
  "The diagram shows a ball of mass 2.0 kg attached to a string of length 0.80 m and whirled in a horizontal circle at a constant speed. The tension is $T = mv^2/r$.";

export const defaultTextSettings: TextBlockSettings = {
  fontFamily: "Calibri",
  fontSize: 11,
  bold: false,
  italic: false,
  underline: false,
  alignment: "left",
  lineHeight: 1.25,
  indent: 0,
  spacingBefore: 0,
  spacingAfter: 6,
  paragraphSpacing: 6,
  visibleToStudents: true,
  keepWithNext: false,
  pageBreakBefore: false,
  allowSplit: true,
  locked: false
};

export function createTextBlock(previous?: TextBlock): TextBlock {
  return {
    id: nanoid(),
    type: "text",
    text: previous?.text ?? "",
    inlineLatex: {
      source: previous?.inlineLatex.source ?? "T = mv^2 / r",
      inheritTextFont: previous?.inlineLatex.inheritTextFont ?? true,
      fontFamily: previous?.inlineLatex.fontFamily ?? previous?.settings.fontFamily ?? "Calibri",
      fontSize: previous?.inlineLatex.fontSize ?? previous?.settings.fontSize ?? 11,
      bold: previous?.inlineLatex.bold ?? false,
      italic: previous?.inlineLatex.italic ?? false,
      underline: previous?.inlineLatex.underline ?? false,
      subscript: previous?.inlineLatex.subscript ?? false,
      superscript: previous?.inlineLatex.superscript ?? false
    },
    settings: {
      ...(previous?.settings ?? defaultTextSettings)
    }
  };
}
