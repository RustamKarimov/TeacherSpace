export type InspectorTab = "inspector" | "metadata" | "preview";
export type BlockType = "text" | "equation" | "image" | "table" | "options";
export type Alignment = "left" | "center" | "right";
export type VerticalAlignment = "top" | "middle" | "bottom";
export type OptionLayout = "one" | "two" | "four";
export type OptionLabelPosition = "beside" | "above" | "below";

export interface InlineLatexSettings {
  source: string;
  inheritTextFont: boolean;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  subscript: boolean;
  superscript: boolean;
}

export interface TextBlockSettings {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  alignment: Alignment;
  lineHeight: number;
  indent: number;
  spacingBefore: number;
  spacingAfter: number;
  paragraphSpacing: number;
  visibleToStudents: boolean;
  keepWithNext: boolean;
  pageBreakBefore: boolean;
  allowSplit: boolean;
  locked: boolean;
}

export interface TextBlock {
  id: string;
  type: "text";
  text: string;
  inlineLatex: InlineLatexSettings;
  settings: TextBlockSettings;
}

export interface ImageAsset {
  dataUrl?: string;
  relativePath?: string;
  fileName: string;
  altText: string;
  naturalWidth?: number;
  naturalHeight?: number;
  aspectRatio?: number;
}

export interface ImageBlockSettings {
  width: number;
  height: number;
  lockAspectRatio: boolean;
  rotation: number;
  crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  horizontalAlignment: Alignment;
  verticalAlignment: VerticalAlignment;
  spacingBefore: number;
  spacingAfter: number;
  border: boolean;
  caption: string;
  keepWithNext: boolean;
  pageBreakBefore: boolean;
  allowSplit: boolean;
  locked: boolean;
}

export interface ImageBlock {
  id: string;
  type: "image";
  asset: ImageAsset;
  settings: ImageBlockSettings;
}

export interface EquationBlockSettings {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  alignment: Alignment;
  spacingBefore: number;
  spacingAfter: number;
  numbering?: string;
  keepWithNext: boolean;
  pageBreakBefore: boolean;
  allowSplit: boolean;
  locked: boolean;
}

export interface EquationBlock {
  id: string;
  type: "equation";
  source: string;
  settings: EquationBlockSettings;
}

export type TableCellContentType = "text" | "image" | "mixed";

export interface TableCell {
  id: string;
  text: string;
  contentType: TableCellContentType;
  image?: ImageAsset & {
    width: number;
    height: number;
    lockAspectRatio?: boolean;
    horizontalAlignment?: Alignment;
    verticalAlignment?: VerticalAlignment;
  };
  rowSpan: number;
  colSpan: number;
  hidden?: boolean;
  header?: boolean;
  bold?: boolean;
  italic?: boolean;
  borders?: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
  horizontalAlignment: Alignment;
  verticalAlignment: VerticalAlignment;
}

export interface TableBlockSettings {
  fontFamily: string;
  fontSize: number;
  widthMode: "auto" | "full" | "custom";
  customWidth: number;
  horizontalAlignment: Alignment;
  borderStyle: "none" | "light" | "standard" | "heavy";
  outerBorder: boolean;
  cellPadding: number;
  rowHeight: number;
  showHeaderRow: boolean;
  showHeaderColumn: boolean;
  spacingBefore: number;
  spacingAfter: number;
  keepWithNext: boolean;
  pageBreakBefore: boolean;
  allowSplit: boolean;
  locked: boolean;
}

export interface TableBlock {
  id: string;
  type: "table";
  rows: TableCell[][];
  columnWidths: number[];
  rowHeights: number[];
  selectedCellId: string;
  selectionAnchorCellId?: string;
  selectedCellIds?: string[];
  settings: TableBlockSettings;
}

export interface McqOption {
  id: string;
  letter: "A" | "B" | "C" | "D";
  contentType: "text" | "image" | "mixed";
  text: string;
  image?: ImageAsset & {
    width: number;
    height: number;
    lockAspectRatio?: boolean;
    rotation?: number;
    crop?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    horizontalAlignment?: Alignment;
    verticalAlignment?: VerticalAlignment;
    spacingBefore?: number;
    spacingAfter?: number;
    border?: boolean;
  };
}

export interface OptionTypographySettings {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  subscript: boolean;
  superscript: boolean;
  color: string;
}

export interface OptionsBlockSettings {
  layout: OptionLayout;
  boxedLabels: boolean;
  labelPosition: OptionLabelPosition;
  labelContentGap: number;
  labelWidth: number;
  optionGap: number;
  alignment: Alignment;
  verticalAlignment: VerticalAlignment;
  label: OptionTypographySettings;
  text: OptionTypographySettings;
  math: OptionTypographySettings;
  inheritMathFont: boolean;
  image: {
    width: number;
    height: number;
    lockAspectRatio: boolean;
    rotation: number;
    crop: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    horizontalAlignment: Alignment;
    verticalAlignment: VerticalAlignment;
    spacingBefore: number;
    spacingAfter: number;
    border: boolean;
  };
  allowShuffle: boolean;
  preserveCorrectAfterShuffle: boolean;
  keepTogether: boolean;
  allowSplit: boolean;
  locked: boolean;
}

export interface OptionsBlock {
  id: string;
  type: "options";
  mode: "standard" | "table";
  options: McqOption[];
  correctAnswer: "A" | "B" | "C" | "D";
  selectedOptionId: string;
  inlineLatexSource: string;
  table: TableBlock;
  settings: OptionsBlockSettings;
}

export type McqBlock = TextBlock | EquationBlock | ImageBlock | TableBlock | OptionsBlock;

export interface McqEditorMetadata {
  examCode: string;
  originalQuestionNumber: string;
  syllabus: string;
  session: string;
  year: string;
  paper: string;
  paperVersion: string;
  marks: number;
  difficulty: "Easy" | "Medium" | "Hard";
  reviewStatus: "Draft" | "Ready" | "Needs review";
  topics: string[];
  tags: string[];
  teacherNotes: string;
}
