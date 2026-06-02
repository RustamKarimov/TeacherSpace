import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import * as XLSX from "xlsx";
import { getSharedMetadata, getStructuredQuestionKeys, saveStructuredBatch } from "./database.js";
import type {
  StructuredManifestRow,
  StructuredSplitPlan,
  StructuredSplitResult,
  StructuredSplitterInput,
  StructuredValidationIssue,
  StructuredValidationReport
} from "./shared.js";

type ParsedExamCode = {
  subjectCode: string;
  session: string;
  year: number | null;
  paper: string;
  paperVersion: string;
  component: string;
};

type RawManifestRow = Record<string, unknown> & { __rowNumber: number };

const requiredColumns = ["exam_code", "question_number", "qp_start_page", "ms_start_page", "Mark"];
const topicColumns = ["topic_1", "topic_2", "topic_3", "topic", "topics"];
const tagColumns = ["tag_1", "tag_2", "tag_3", "tag", "tags"];

export async function validateStructuredManifest(databasePath: string, input: StructuredSplitterInput): Promise<StructuredValidationReport> {
  const issues: StructuredValidationIssue[] = [];
  const rows: StructuredManifestRow[] = [];
  const pageCountCache = new Map<string, number>();

  if (!fs.existsSync(input.manifestPath)) {
    issues.push(issue("error", null, "manifestPath", null, null, `Manifest file was not found: ${input.manifestPath}`, "Choose an existing .xlsx or .csv manifest file."));
  }
  if (!fs.existsSync(input.sourceFolder)) {
    issues.push(issue("error", null, "sourceFolder", null, null, `Source PDF folder was not found: ${input.sourceFolder}`, "Choose the folder containing the full Cambridge PDF files listed in the manifest."));
  }
  if (!fs.existsSync(input.destinationFolder)) {
    issues.push(issue("warning", null, "destinationFolder", null, null, `Destination folder does not exist yet: ${input.destinationFolder}`, "TeacherDesk will create it during splitting."));
  }

  const rawRows = issues.some((item) => item.severity === "error") ? [] : readManifestRows(input.manifestPath, issues);
  const headers = rawRows.length ? Object.keys(rawRows[0]).filter((key) => key !== "__rowNumber") : [];
  for (const column of requiredColumns) {
    if (!headers.includes(column)) {
      issues.push(issue("error", 1, column, null, null, `Required manifest column "${column}" is missing.`, `Add a "${column}" column to the first row of the manifest.`));
    }
  }

  for (const raw of rawRows) {
    const rowIssues: StructuredValidationIssue[] = [];
    const rowNumber = raw.__rowNumber;
    const examCode = text(raw.exam_code);
    const questionNumber = integer(raw.question_number);
    const parsed = parseExamCode(examCode);
    const qpStart = parsePage(raw.qp_start_page);
    const msStart = parsePage(raw.ms_start_page);
    const marks = integer(raw.Mark);
    const msExamCode = examCode.includes("_qp_") ? examCode.replace("_qp_", "_ms_") : "";
    const qpFile = examCode ? path.join(input.sourceFolder, `${examCode}.pdf`) : "";
    const msFile = msExamCode ? path.join(input.sourceFolder, `${msExamCode}.pdf`) : "";

    if (!examCode) rowIssues.push(issue("error", rowNumber, "exam_code", examCode, questionNumber, "Exam code is blank.", "Enter a Cambridge code such as 9702_w25_qp_42."));
    if (examCode && !parsed) rowIssues.push(issue("error", rowNumber, "exam_code", examCode, questionNumber, `Exam code "${examCode}" does not match the expected Cambridge pattern.`, "Use a code like 9702_w25_qp_42."));
    if (examCode && parsed && !examCode.includes("_qp_")) rowIssues.push(issue("error", rowNumber, "exam_code", examCode, questionNumber, `Row uses "${examCode}", but the splitter expects question paper codes containing _qp_.`, "Use the QP code; the matching MS code is derived automatically."));
    if (!questionNumber || questionNumber < 1) rowIssues.push(issue("error", rowNumber, "question_number", examCode, questionNumber, `Invalid question number "${text(raw.question_number)}".`, "Question number must be a positive whole number."));
    if (!qpStart.value) rowIssues.push(issue("error", rowNumber, "qp_start_page", examCode, questionNumber, `Invalid QP start page "${text(raw.qp_start_page)}".`, "Use a page number, or add * for a shared boundary such as 4*."));
    if (!msStart.value) rowIssues.push(issue("error", rowNumber, "ms_start_page", examCode, questionNumber, `Invalid MS start page "${text(raw.ms_start_page)}".`, "Use a page number, or add * for a shared boundary such as 6*."));
    if (raw.Mark !== undefined && raw.Mark !== null && raw.Mark !== "" && (!marks || marks < 0)) {
      rowIssues.push(issue("warning", rowNumber, "Mark", examCode, questionNumber, `Marks value "${text(raw.Mark)}" is not a valid whole number.`, "Leave it blank or enter a whole number."));
    }

    const qpPages = qpFile ? await pdfPageCount(qpFile, pageCountCache, rowIssues, rowNumber, "qp_file", examCode, questionNumber) : null;
    const msPages = msFile ? await pdfPageCount(msFile, pageCountCache, rowIssues, rowNumber, "ms_file", examCode, questionNumber) : null;
    if (qpPages && qpStart.value && qpStart.value > qpPages) rowIssues.push(issue("error", rowNumber, "qp_start_page", examCode, questionNumber, `QP start page ${qpStart.value} is outside ${path.basename(qpFile)}, which has ${qpPages} pages.`, "Correct the QP page number in the manifest."));
    if (msPages && msStart.value && msStart.value > msPages) rowIssues.push(issue("error", rowNumber, "ms_start_page", examCode, questionNumber, `MS start page ${msStart.value} is outside ${path.basename(msFile)}, which has ${msPages} pages.`, "Correct the MS page number in the manifest."));

    if (qpStart.starred) rowIssues.push(issue("warning", rowNumber, "qp_start_page", examCode, questionNumber, "QP page start is starred, so this question will be marked for review after splitting.", "Review the split PDF after import."));
    if (msStart.starred) rowIssues.push(issue("warning", rowNumber, "ms_start_page", examCode, questionNumber, "MS page start is starred, so this mark scheme will be marked for review after splitting.", "Review the split PDF after import."));

    const topics = metadataValues(raw, topicColumns);
    const tags = metadataValues(raw, tagColumns);
    const status = rowIssues.some((item) => item.severity === "error") ? "error" : rowIssues.some((item) => item.severity === "warning") ? "warning" : "ready";
    const manifestRow: StructuredManifestRow = {
      row: rowNumber,
      examCode,
      msExamCode,
      questionNumber,
      qpStartRaw: text(raw.qp_start_page),
      msStartRaw: text(raw.ms_start_page),
      qpStartPage: qpStart.value,
      msStartPage: msStart.value,
      qpStarred: qpStart.starred,
      msStarred: msStart.starred,
      qpPageEnd: null,
      msPageEnd: null,
      marks: marks ?? null,
      subjectCode: parsed?.subjectCode ?? "",
      session: parsed?.session ?? "",
      year: parsed?.year ?? null,
      paper: parsed?.paper ?? "",
      paperVersion: parsed?.paperVersion ?? "",
      qpFile,
      msFile,
      qpPages,
      msPages,
      topics,
      tags,
      status,
      issues: rowIssues
    };
    rows.push(manifestRow);
    issues.push(...rowIssues);
  }

  applyRangesAndBoundaryIssues(rows, issues);
  for (const row of rows) {
    row.issues = issues.filter((item) => item.row === row.row);
    row.status = row.issues.some((item) => item.severity === "error") ? "error" : row.issues.some((item) => item.severity === "warning") ? "warning" : "ready";
  }

  const shared = await getSharedMetadata(databasePath);
  const similarMetadata = findSimilarMetadata(rows, shared);
  for (const match of similarMetadata) {
    issues.push(issue("warning", match.rows[0] ?? null, match.kind, null, null, `${label(match.kind)} "${match.incoming}" looks similar to existing ${match.kind} "${match.existing}".`, "After splitting, decide whether to keep both or merge them in Metadata."));
  }

  const counts = severityCounts(issues);
  const readyRows = rows.filter((row) => row.status === "ready").length;
  const missingFiles = issues.filter((item) => item.field === "qp_file" || item.field === "ms_file").length;
  const sourcePdfs = new Set(rows.flatMap((row) => [row.qpFile, row.msFile]).filter(Boolean)).size;
  return {
    ok: counts.error === 0,
    summary: {
      rows: rows.length,
      readyRows,
      errors: counts.error,
      warnings: counts.warning,
      missingFiles,
      sourcePdfs,
      topicsFound: new Set(rows.flatMap((row) => row.topics)).size,
      tagsFound: new Set(rows.flatMap((row) => row.tags)).size,
      starredBoundaries: rows.reduce((total, row) => total + Number(row.qpStarred) + Number(row.msStarred), 0),
      reviewRequiredItems: rows.filter((row) => row.qpStarred || row.msStarred || row.status === "warning").length
    },
    issues: issues.sort(sortIssues).slice(0, 500),
    rows: rows.slice(0, 500),
    similarMetadata
  };
}

export async function planStructuredSplit(databasePath: string, input: StructuredSplitterInput): Promise<StructuredSplitPlan> {
  const validation = await validateStructuredManifest(databasePath, input);
  const keys = await getStructuredQuestionKeys(databasePath);
  const validRows = validation.rows.filter((row) => row.status !== "error" && row.questionNumber);
  const items = validRows.map((row) => {
    const outputs = outputPaths(input.destinationFolder, row);
    const exists = keys.has(`${row.examCode.toLowerCase()}::${row.questionNumber}`);
    return {
      row: row.row,
      examCode: row.examCode,
      questionNumber: row.questionNumber!,
      paper: row.paper,
      qpOutput: outputs.qpOutput,
      msOutput: outputs.msOutput,
      action: exists ? "update" as const : "create" as const,
      reviewRequired: row.status === "warning" || row.qpStarred || row.msStarred
    };
  });

  return {
    ok: validation.ok,
    message: validation.ok ? "Batch is ready to split and save." : "Fix validation errors before splitting.",
    validation,
    summary: {
      records: validRows.length,
      filesTotal: validRows.length * 2,
      questionsToCreate: items.filter((item) => item.action === "create").length,
      questionsToUpdate: items.filter((item) => item.action === "update").length,
      qpFilesToWrite: validRows.length,
      msFilesToWrite: validRows.length,
      reviewRequiredItems: validation.summary.reviewRequiredItems,
      destinationFolder: input.destinationFolder
    },
    items: items.slice(0, 500)
  };
}

export async function splitStructuredBatch(databasePath: string, workspaceRoot: string, input: StructuredSplitterInput): Promise<StructuredSplitResult> {
  const validation = await validateStructuredManifest(databasePath, input);
  if (!validation.ok) {
    return {
      ok: false,
      message: "The manifest has validation errors. Fix the listed rows before splitting.",
      validation,
      summary: {
        createdQuestions: 0,
        updatedQuestions: 0,
        splitQuestionPdfs: 0,
        splitMarkSchemePdfs: 0,
        reviewRequiredItems: validation.summary.reviewRequiredItems,
        destinationFolder: input.destinationFolder
      },
      outputs: []
    };
  }

  fs.mkdirSync(input.destinationFolder, { recursive: true });
  const splitRows: Array<StructuredManifestRow & { splitQpPath: string; splitMsPath: string; sourceQpPath: string; sourceMsPath: string }> = [];
  const outputs: StructuredSplitResult["outputs"] = [];
  let splitQuestionPdfs = 0;
  let splitMarkSchemePdfs = 0;

  for (const row of validation.rows.filter((item) => item.status !== "error" && item.questionNumber)) {
    const paths = outputPaths(input.destinationFolder, row);
    fs.mkdirSync(path.dirname(paths.qpOutput), { recursive: true });
    fs.mkdirSync(path.dirname(paths.msOutput), { recursive: true });
    if (input.overwriteExisting || !fs.existsSync(paths.qpOutput)) {
      await writePdfRange(row.qpFile, paths.qpOutput, row.qpStartPage!, row.qpPageEnd!);
      splitQuestionPdfs += 1;
    }
    if (input.overwriteExisting || !fs.existsSync(paths.msOutput)) {
      await writePdfRange(row.msFile, paths.msOutput, row.msStartPage!, row.msPageEnd!);
      splitMarkSchemePdfs += 1;
    }
    splitRows.push({
      ...row,
      splitQpPath: relativeToWorkspace(workspaceRoot, paths.qpOutput),
      splitMsPath: relativeToWorkspace(workspaceRoot, paths.msOutput),
      sourceQpPath: relativeToWorkspace(workspaceRoot, row.qpFile),
      sourceMsPath: relativeToWorkspace(workspaceRoot, row.msFile)
    });
    outputs.push({ examCode: row.examCode, questionNumber: row.questionNumber!, qpOutput: paths.qpOutput, msOutput: paths.msOutput });
  }

  const saved = await saveStructuredBatch(databasePath, input, validation, splitRows);
  return {
    ok: true,
    message: `Split ${splitRows.length} structured question${splitRows.length === 1 ? "" : "s"} and saved them to the question bank.`,
    validation,
    summary: {
      createdQuestions: saved.createdQuestions,
      updatedQuestions: saved.updatedQuestions,
      splitQuestionPdfs,
      splitMarkSchemePdfs,
      reviewRequiredItems: validation.summary.reviewRequiredItems,
      destinationFolder: input.destinationFolder
    },
    outputs
  };
}

function readManifestRows(manifestPath: string, issues: StructuredValidationIssue[]): RawManifestRow[] {
  try {
    const workbook = XLSX.read(fs.readFileSync(manifestPath), { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }).map((row, index) => ({ ...normalizeKeys(row), __rowNumber: index + 2 }));
  } catch (error) {
    issues.push(issue("error", null, "manifestPath", null, null, `Could not read manifest: ${error instanceof Error ? error.message : String(error)}`, "Close the spreadsheet if it is open, then try again."));
    return [];
  }
}

function normalizeKeys(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[canonicalManifestKey(key)] = value;
  }
  return normalized;
}

function canonicalManifestKey(key: string) {
  const compact = key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const aliases: Record<string, string> = {
    exam_code: "exam_code",
    examcode: "exam_code",
    question_number: "question_number",
    question_no: "question_number",
    q_no: "question_number",
    q_number: "question_number",
    question: "question_number",
    qp_start_page: "qp_start_page",
    qp_start: "qp_start_page",
    question_paper_start_page: "qp_start_page",
    question_start_page: "qp_start_page",
    ms_start_page: "ms_start_page",
    ms_start: "ms_start_page",
    mark_scheme_start_page: "ms_start_page",
    markscheme_start_page: "ms_start_page",
    mark: "Mark",
    marks: "Mark",
    topic_1: "topic_1",
    topic_2: "topic_2",
    topic_3: "topic_3",
    topic: "topic",
    topics: "topics",
    tag_1: "tag_1",
    tag_2: "tag_2",
    tag_3: "tag_3",
    tag: "tag",
    tags: "tags"
  };
  return aliases[compact] ?? key.trim();
}

function parseExamCode(examCode: string): ParsedExamCode | null {
  const match = /^(?<subject>\d+)_(?<session>[mws])(?<year>\d{2})_qp_(?<component>\d+)$/i.exec(examCode);
  if (!match?.groups) return null;
  const component = match.groups.component;
  const sessionCode = match.groups.session.toLowerCase();
  return {
    subjectCode: match.groups.subject,
    session: sessionCode === "w" ? "Oct/Nov" : sessionCode === "s" ? "May/June" : "Feb/March",
    year: 2000 + Number(match.groups.year),
    paper: `Paper ${component[0]}`,
    paperVersion: component.slice(1) || "1",
    component
  };
}

function parsePage(value: unknown) {
  const raw = text(value);
  const starred = raw.endsWith("*");
  const numberText = starred ? raw.slice(0, -1) : raw;
  const numeric = Number(numberText);
  return { value: Number.isInteger(numeric) && numeric > 0 ? numeric : null, starred };
}

async function pdfPageCount(filePath: string, cache: Map<string, number>, issues: StructuredValidationIssue[], row: number, field: string, examCode: string, questionNumber: number | null) {
  if (!fs.existsSync(filePath)) {
    issues.push(issue("error", row, field, examCode, questionNumber, `${field === "qp_file" ? "Question paper" : "Mark scheme"} file was not found: ${path.basename(filePath)}`, `Place ${path.basename(filePath)} in the selected source folder.`));
    return null;
  }
  if (cache.has(filePath)) return cache.get(filePath)!;
  try {
    const pdf = await PDFDocument.load(fs.readFileSync(filePath), { ignoreEncryption: true });
    const count = pdf.getPageCount();
    cache.set(filePath, count);
    return count;
  } catch (error) {
    issues.push(issue("error", row, field, examCode, questionNumber, `Could not read PDF ${path.basename(filePath)}: ${error instanceof Error ? error.message : String(error)}`, "Check that the PDF is not corrupted or password protected."));
    return null;
  }
}

function applyRangesAndBoundaryIssues(rows: StructuredManifestRow[], issues: StructuredValidationIssue[]) {
  const groups = new Map<string, StructuredManifestRow[]>();
  for (const row of rows) {
    if (!row.examCode) continue;
    groups.set(row.examCode, [...(groups.get(row.examCode) ?? []), row]);
  }
  for (const [examCode, group] of groups) {
    const sorted = group.sort((a, b) => Number(a.questionNumber ?? 0) - Number(b.questionNumber ?? 0));
    const seen = new Map<number, number>();
    for (const row of sorted) {
      if (!row.questionNumber) continue;
      const previousRow = seen.get(row.questionNumber);
      if (previousRow) {
        issues.push(issue("error", row.row, "question_number", examCode, row.questionNumber, `Duplicate question number Q${row.questionNumber}. Row ${previousRow} already uses this exam code and question number.`, "Each exam_code + question_number pair must appear once."));
      }
      seen.set(row.questionNumber, row.row);
    }
    for (let index = 0; index < sorted.length; index += 1) {
      const row = sorted[index];
      const next = sorted[index + 1];
      row.qpPageEnd = next?.qpStartPage ? (row.qpStarred ? next.qpStartPage : next.qpStartPage - 1) : row.qpPages;
      row.msPageEnd = next?.msStartPage ? (row.msStarred ? next.msStartPage : next.msStartPage - 1) : row.msPages;
      for (const [kind, startKey, nextStart, starred, field] of [
        ["QP", row.qpStartPage, next?.qpStartPage, row.qpStarred, "qp_start_page"],
        ["MS", row.msStartPage, next?.msStartPage, row.msStarred, "ms_start_page"]
      ] as const) {
        if (!next || !startKey || !nextStart) continue;
        if (nextStart < startKey) {
          issues.push(issue("error", next.row, field, examCode, next.questionNumber, `${kind} page starts go backwards: row ${next.row} starts at page ${nextStart}, after row ${row.row} starts at page ${startKey}.`, "Correct the page order in the manifest."));
        }
        if (nextStart === startKey && !starred) {
          issues.push(issue("error", next.row, field, examCode, next.questionNumber, `${kind} page boundary is shared between row ${row.row} and row ${next.row}, but row ${row.row} is not starred.`, `Use ${startKey}* on row ${row.row} if this shared page is intentional.`));
        }
      }
    }
  }
}

function findSimilarMetadata(rows: StructuredManifestRow[], shared: { topics: string[]; tags: string[] }) {
  const incoming = [
    ...unique(rows.flatMap((row) => row.topics)).map((value) => ({ kind: "topic" as const, value, existing: shared.topics })),
    ...unique(rows.flatMap((row) => row.tags)).map((value) => ({ kind: "tag" as const, value, existing: shared.tags }))
  ];
  return incoming.flatMap(({ kind, value, existing }) =>
    existing
      .filter((item) => item.toLowerCase() !== value.toLowerCase())
      .map((item) => ({ item, score: similarity(item, value) }))
      .filter((match) => match.score >= 0.84)
      .slice(0, 1)
      .map((match) => ({
        kind,
        incoming: value,
        existing: match.item,
        score: Math.round(match.score * 100),
        rows: rows.filter((row) => (kind === "topic" ? row.topics : row.tags).includes(value)).map((row) => row.row)
      }))
  );
}

function outputPaths(destinationFolder: string, row: StructuredManifestRow) {
  const questionNumber = row.questionNumber ?? 0;
  const base = path.join(destinationFolder, row.subjectCode || "9702", (row.paper || "Paper 1").replace(/\s+/g, ""), `Q${questionNumber}`);
  return {
    qpOutput: path.join(base, "Questions", `${row.examCode}_Q${questionNumber}.pdf`),
    msOutput: path.join(base, "MarkSchemes", `${row.msExamCode}_Q${questionNumber}.pdf`)
  };
}

async function writePdfRange(source: string, output: string, startPage: number, endPage: number) {
  const sourcePdf = await PDFDocument.load(fs.readFileSync(source), { ignoreEncryption: true });
  const targetPdf = await PDFDocument.create();
  const pageIndexes = Array.from({ length: Math.max(0, endPage - startPage + 1) }, (_, index) => startPage - 1 + index);
  const pages = await targetPdf.copyPages(sourcePdf, pageIndexes);
  pages.forEach((page) => targetPdf.addPage(page));
  fs.writeFileSync(output, await targetPdf.save());
}

function issue(severity: StructuredValidationIssue["severity"], row: number | null, field: string | null, examCode: string | null, questionNumber: number | null, message: string, suggestion?: string): StructuredValidationIssue {
  return { severity, row, field, examCode, questionNumber, message, suggestion };
}

function metadataValues(row: RawManifestRow, columns: string[]) {
  return unique(columns.flatMap((column) => splitValues(row[column])));
}

function splitValues(value: unknown) {
  return text(value).split(/[;|]/).map((item) => item.trim()).filter(Boolean);
}

function integer(value: unknown) {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : null;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function unique(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function severityCounts(issues: StructuredValidationIssue[]) {
  return {
    error: issues.filter((item) => item.severity === "error").length,
    warning: issues.filter((item) => item.severity === "warning").length,
    info: issues.filter((item) => item.severity === "info").length
  };
}

function sortIssues(a: StructuredValidationIssue, b: StructuredValidationIssue) {
  const rank = { error: 0, warning: 1, info: 2 };
  return rank[a.severity] - rank[b.severity] || (a.row ?? 999999) - (b.row ?? 999999);
}

function similarity(left: string, right: string) {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  const distance = matrix[a.length][b.length];
  return 1 - distance / Math.max(a.length, b.length, 1);
}

function label(kind: "topic" | "tag") {
  return kind === "topic" ? "Topic" : "Tag";
}

function relativeToWorkspace(workspaceRoot: string, filePath: string) {
  const relative = path.relative(workspaceRoot, filePath);
  return relative.startsWith("..") || path.isAbsolute(relative) ? filePath : relative;
}
