import { nanoid } from "nanoid";
import type { OptionsBlock, OptionsBlockSettings } from "./types";
import { createOptionsTableBlock } from "./tableBlockDefaults";

export const optionTextPlaceholders = {
  A: "Only $5\\,m\\,s^{-1}$",
  B: "Only $10\\,m\\,s^{-1}$",
  C: "Only $15\\,m\\,s^{-1}$",
  D: "Only $20\\,m\\,s^{-1}$"
} as const;

const defaultTypography = {
  fontFamily: "Calibri",
  fontSize: 11,
  bold: false,
  italic: false,
  underline: false,
  subscript: false,
  superscript: false,
  color: "Default"
};

export const defaultOptionsSettings: OptionsBlockSettings = {
  layout: "one",
  boxedLabels: false,
  labelPosition: "beside",
  labelContentGap: 4,
  labelWidth: 24,
  optionGap: 6,
  alignment: "left",
  verticalAlignment: "middle",
  label: { ...defaultTypography, bold: true },
  text: { ...defaultTypography },
  math: { ...defaultTypography, italic: false },
  inheritMathFont: true,
  image: {
    width: 92,
    height: 76,
    lockAspectRatio: true,
    rotation: 0,
    crop: {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    },
    horizontalAlignment: "center",
    verticalAlignment: "middle",
    spacingBefore: 0,
    spacingAfter: 0,
    border: false
  },
  allowShuffle: true,
  preserveCorrectAfterShuffle: true,
  keepTogether: true,
  allowSplit: true,
  locked: false
};

export function createOptionsBlock(previous?: OptionsBlock): OptionsBlock {
  const options = previous?.options.map((option) => ({ ...option, id: nanoid(), text: "", image: undefined, contentType: "text" as const })) ?? [
    { id: nanoid(), letter: "A" as const, contentType: "text" as const, text: "" },
    { id: nanoid(), letter: "B" as const, contentType: "text" as const, text: "" },
    { id: nanoid(), letter: "C" as const, contentType: "text" as const, text: "" },
    { id: nanoid(), letter: "D" as const, contentType: "text" as const, text: "" }
  ];

  return {
    id: nanoid(),
    type: "options",
    mode: previous?.mode ?? "standard",
    options,
    correctAnswer: previous?.correctAnswer ?? "C",
    selectedOptionId: options.find((option) => option.letter === (previous?.correctAnswer ?? "C"))?.id ?? options[0].id,
    inlineLatexSource: previous?.inlineLatexSource ?? "15\\,m\\,s^{-1}",
    table: previous?.table ?? createOptionsTableBlock(),
    settings: {
      ...(previous?.settings ?? defaultOptionsSettings),
      label: { ...(previous?.settings.label ?? defaultOptionsSettings.label) },
      text: { ...(previous?.settings.text ?? defaultOptionsSettings.text) },
      math: { ...(previous?.settings.math ?? defaultOptionsSettings.math) },
      image: { ...(previous?.settings.image ?? defaultOptionsSettings.image) }
    }
  };
}
