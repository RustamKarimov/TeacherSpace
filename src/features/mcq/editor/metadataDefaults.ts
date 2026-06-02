import type { McqEditorMetadata } from "./types";

export const defaultMetadata: McqEditorMetadata = {
  examCode: "9702_w25_qp_11",
  originalQuestionNumber: "",
  syllabus: "9702",
  session: "Oct/Nov",
  year: "2025",
  paper: "Paper 1",
  paperVersion: "1",
  marks: 1,
  difficulty: "Medium",
  reviewStatus: "Ready",
  topics: [],
  tags: [],
  teacherNotes: ""
};

const sessionMap: Record<string, string> = {
  s: "May/June",
  m: "Feb/March",
  w: "Oct/Nov"
};

export function parseExamCode(examCode: string): Partial<McqEditorMetadata> | null {
  const match = examCode.trim().toLowerCase().match(/^(\d{4})_([smw])(\d{2})_qp_(\d)(\d)$/);
  if (!match) return null;

  const [, syllabus, sessionCode, yearSuffix, paper, paperVersion] = match;
  return {
    syllabus,
    session: sessionMap[sessionCode] ?? "",
    year: `20${yearSuffix}`,
    paper: `Paper ${paper}`,
    paperVersion
  };
}

export function getMetadataIssues(metadata: McqEditorMetadata) {
  const issues: string[] = [];
  if (!metadata.examCode.trim()) issues.push("Exam code is required.");
  if (!metadata.originalQuestionNumber.trim()) issues.push("Original question number is required.");
  if (metadata.topics.length === 0) issues.push("At least one topic is required.");
  if (metadata.tags.length === 0) issues.push("At least one tag is required.");
  return issues;
}

export function hasDuplicatePlaceholder(metadata: McqEditorMetadata) {
  return metadata.examCode.trim().toLowerCase() === "9702_w25_qp_11" && metadata.originalQuestionNumber.trim() === "12";
}
