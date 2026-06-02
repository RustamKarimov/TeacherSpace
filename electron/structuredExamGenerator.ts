import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { listStructuredQuestions } from "./database.js";
import type { StructuredExamGeneratorPayload, StructuredExamGeneratorResult, StructuredQuestionRecord } from "./shared.js";

const mmToPt = 72 / 25.4;
const defaultPaperMarks: Record<number, number> = { 2: 60, 3: 40, 4: 100, 5: 30 };
const ignoredBalanceTopics = new Set(["Physical quantities and units"]);
const paperTopicGroups: Record<number, Record<string, string[]>> = {
  2: {
    Motion: ["Kinematics"],
    "Forces and Matter": ["Dynamics", "Forces, density and pressure"],
    "Energy and Materials": ["Work, energy and power", "Deformation of solids"],
    Waves: ["Waves", "Superposition"],
    "Electric Circuits": ["Electricity", "D.C. circuits"],
    "Modern Physics": ["Particle physics"]
  },
  4: {
    "Further Mechanics and Fields": ["Motion in a circle", "Gravitational fields"],
    "Thermal Physics": ["Temperature", "Ideal gases", "Thermodynamics"],
    "Oscillations and Waves": ["Oscillations", "Waves", "Superposition"],
    "Electric Fields and Capacitance": ["Electric fields", "Capacitance"],
    "Magnetism and Alternating Currents": ["Magnetic fields", "Alternating currents"],
    "Quantum and Nuclear Physics": ["Quantum physics", "Nuclear physics"],
    "Applications and Options": ["Medical physics", "Astronomy and cosmology"]
  }
};

export async function previewStructuredExamPackage(databasePath: string, workspaceRoot: string, payload: StructuredExamGeneratorPayload): Promise<StructuredExamGeneratorResult> {
  const allQuestions = await listStructuredQuestions(databasePath);
  const selection = selectQuestions(allQuestions, payload);
  if (selection.questions.length === 0) throw new Error("No structured questions match the generator settings.");

  const qpBytes = await buildCombinedPdf(workspaceRoot, selection.questions, payload, "question");
  const msBytes = await buildCombinedPdf(workspaceRoot, selection.questions, payload, "mark scheme");
  return resultPayload("", [], selection, {
    qpPreview: {
      fileName: `${sanitizeFileName(payload.title)}_question_paper_preview.pdf`,
      dataUrl: `data:application/pdf;base64,${Buffer.from(qpBytes).toString("base64")}`
    },
    msPreview: {
      fileName: `${sanitizeFileName(payload.title)}_mark_scheme_preview.pdf`,
      dataUrl: `data:application/pdf;base64,${Buffer.from(msBytes).toString("base64")}`
    }
  });
}

export async function generateStructuredExamPackage(databasePath: string, workspaceRoot: string, payload: StructuredExamGeneratorPayload): Promise<StructuredExamGeneratorResult> {
  const allQuestions = await listStructuredQuestions(databasePath);
  const selection = selectQuestions(allQuestions, payload);
  if (selection.questions.length === 0) throw new Error("No structured questions match the generator settings.");

  const packageName = sanitizeFileName(payload.title);
  const folderPath = uniqueFolder(path.join(payload.outputFolder || path.join(workspaceRoot, "generated_exams"), packageName));
  fs.mkdirSync(folderPath, { recursive: true });

  const qpName = `${packageName}_question_paper.pdf`;
  const msName = `${packageName}_mark_scheme.pdf`;
  fs.writeFileSync(path.join(folderPath, qpName), await buildCombinedPdf(workspaceRoot, selection.questions, payload, "question"));
  fs.writeFileSync(path.join(folderPath, msName), await buildCombinedPdf(workspaceRoot, selection.questions, payload, "mark scheme"));

  const manifestName = "manifest.json";
  fs.writeFileSync(
    path.join(folderPath, manifestName),
    JSON.stringify(
      {
        title: payload.title,
        mode: payload.mode,
        createdAt: new Date().toISOString(),
        settings: payload,
        totalMarks: selection.totalMarks,
        targetMarks: selection.targetMarks,
        warnings: selection.warnings,
        questions: selection.questions.map((question, index) => ({
          order: index + 1,
          id: question.id,
          examCode: question.examCode,
          questionNumber: question.questionNumber,
          marks: question.marks,
          splitQpPath: question.splitQpPath,
          splitMsPath: question.splitMsPath
        }))
      },
      null,
      2
    )
  );

  return resultPayload(folderPath, [qpName, msName, manifestName], selection);
}

async function buildCombinedPdf(workspaceRoot: string, questions: StructuredQuestionRecord[], payload: StructuredExamGeneratorPayload, kind: "question" | "mark scheme") {
  const output = await PDFDocument.create();
  const regular = await output.embedFont(StandardFonts.Helvetica);
  const bold = await output.embedFont(StandardFonts.HelveticaBold);

  for (const question of questions) {
    const sourcePath = resolveQuestionFile(workspaceRoot, question, kind);
    if (!sourcePath || !fs.existsSync(sourcePath)) continue;
    const source = await PDFDocument.load(fs.readFileSync(sourcePath));
    const copiedPages = await output.copyPages(source, source.getPageIndices());
    for (const copiedPage of copiedPages) {
      output.addPage(copiedPage);
      decoratePage(copiedPage, output.getPageCount(), payload, kind, regular, bold);
    }
  }

  return output.save();
}

function decoratePage(page: ReturnType<PDFDocument["addPage"]>, pageNumber: number, payload: StructuredExamGeneratorPayload, kind: string, regular: Awaited<ReturnType<PDFDocument["embedFont"]>>, bold: Awaited<ReturnType<PDFDocument["embedFont"]>>) {
  const pageBox = page.getCropBox();
  const x = pageBox.x;
  const y = pageBox.y;
  const width = pageBox.width;
  const height = pageBox.height;
  const pageMask = payload.pageMasks?.find((mask) => mask.pageNumber === pageNumber);
  const topMask = Math.max(0, pageMask?.topMaskMm ?? payload.topMaskMm) * mmToPt;
  const bottomMask = Math.max(0, pageMask?.bottomMaskMm ?? payload.bottomMaskMm) * mmToPt;
  const leftMask = Math.max(0, pageMask?.leftMaskMm ?? payload.leftMaskMm ?? 0) * mmToPt;
  const rightMask = Math.max(0, pageMask?.rightMaskMm ?? payload.rightMaskMm ?? 0) * mmToPt;

  if (payload.maskExisting) {
    if (topMask > 0) page.drawRectangle({ x, y: y + height - topMask, width, height: topMask, color: rgb(1, 1, 1) });
    if (bottomMask > 0) page.drawRectangle({ x, y, width, height: bottomMask, color: rgb(1, 1, 1) });
    if (leftMask > 0) page.drawRectangle({ x, y, width: leftMask, height, color: rgb(1, 1, 1) });
    if (rightMask > 0) page.drawRectangle({ x: x + width - rightMask, y, width: rightMask, height, color: rgb(1, 1, 1) });
  }

  drawHeaderFooterLine(page, payload.header, { x, y: y + height - Math.max(16, topMask / 2), width, pageNumber, title: payload.title, kind, regular, bold });
  drawHeaderFooterLine(page, payload.footer, { x, y: y + Math.max(12, bottomMask / 2), width, pageNumber, title: payload.title, kind, regular, bold });
}

function drawHeaderFooterLine(page: ReturnType<PDFDocument["addPage"]>, line: { left: string; center: string; right: string }, context: { x: number; y: number; width: number; pageNumber: number; title: string; kind: string; regular: Awaited<ReturnType<PDFDocument["embedFont"]>>; bold: Awaited<ReturnType<PDFDocument["embedFont"]>> }) {
  const size = 8;
  const left = renderSnippet(line.left, context);
  const center = renderSnippet(line.center, context);
  const right = renderSnippet(line.right, context);
  page.drawText(left, { x: context.x + 42, y: context.y, size, font: context.regular, color: rgb(0.08, 0.1, 0.14) });
  page.drawText(center, { x: context.x + context.width / 2 - context.regular.widthOfTextAtSize(center, size) / 2, y: context.y, size, font: context.bold, color: rgb(0.08, 0.1, 0.14) });
  page.drawText(right, { x: context.x + context.width - 42 - context.regular.widthOfTextAtSize(right, size), y: context.y, size, font: context.regular, color: rgb(0.08, 0.1, 0.14) });
}

function selectQuestions(questions: StructuredQuestionRecord[], payload: StructuredExamGeneratorPayload) {
  if (payload.selectedQuestionIds.length) {
    const byId = new Map(questions.map((question) => [question.id, question]));
    return selectionPayload(payload.selectedQuestionIds.map((id) => byId.get(id)).filter(Boolean) as StructuredQuestionRecord[], [], payload.targetMarks ?? null);
  }

  const ready = questions.filter((question) => getPaperNumber(question) === payload.paperNumber);
  if (payload.mode === "basket") return selectionPayload([], ["No basket questions were supplied."], null);
  if (payload.mode === "topical-total") return selectTopicalTotal(ready, payload);
  if (payload.mode === "topical-custom") return selectTopicalCustom(ready, payload);
  if (payload.mode === "question-numbers") return selectionPayload(selectByQuestionNumbers(ready, payload.questionNumbers ?? ""), [], null);
  return selectFullPaper(ready, payload.paperNumber ?? 2, payload.targetMarks ?? defaultPaperMarks[payload.paperNumber ?? 2] ?? 60, payload.allowanceMarks ?? 4);
}

function selectFullPaper(candidates: StructuredQuestionRecord[], paperNumber: number, targetMarks: number, allowanceMarks: number) {
  const byNumber = groupBy(candidates, (question) => question.questionNumber);
  const selected: StructuredQuestionRecord[] = [];
  const warnings: string[] = [];
  const eligibleGroups = eligibleBalanceGroups(candidates, paperNumber);
  const groupCounts = new Map([...eligibleGroups].map((group) => [group, 0]));

  for (const questionNumber of [...byNumber.keys()].sort((a, b) => a - b)) {
    const currentTotal = totalMarks(selected);
    const options = shuffle(byNumber.get(questionNumber) ?? []);
    const acceptable = options.filter((question) => currentTotal + (question.marks ?? 0) <= targetMarks + allowanceMarks);
    const chosen = chooseBalanced(acceptable.length ? acceptable : options, paperNumber, groupCounts, targetMarks, currentTotal);
    if (!chosen) continue;
    const projected = currentTotal + (chosen.marks ?? 0);
    if (projected <= targetMarks + allowanceMarks || !selected.length || Math.abs(targetMarks - projected) < Math.abs(targetMarks - currentTotal)) {
      selected.push(chosen);
      for (const group of balanceGroupsForQuestion(chosen, paperNumber)) groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
    }
  }

  if (!selected.length) warnings.push(`No questions found for Paper ${paperNumber}.`);
  const missing = [...eligibleGroups].filter((group) => (groupCounts.get(group) ?? 0) === 0);
  if (missing.length) warnings.push(`Topic spread could not include: ${missing.join(", ")}.`);
  return selectionPayload(selected, warnings, targetMarks);
}

function selectTopicalTotal(candidates: StructuredQuestionRecord[], payload: StructuredExamGeneratorPayload) {
  const topics = payload.selectedTopics;
  if (!topics.length) return selectionPayload([], ["Select at least one topic."], null);
  const selected: StructuredQuestionRecord[] = [];
  for (const row of distribute(payload.questionCount, topics)) {
    selected.push(...takeRandom(candidates.filter((question) => question.topics.includes(row.topic) && !selected.some((item) => item.id === question.id)), row.count));
  }
  return selectionPayload(selected.slice(0, payload.questionCount), [], null);
}

function selectTopicalCustom(candidates: StructuredQuestionRecord[], payload: StructuredExamGeneratorPayload) {
  const selected: StructuredQuestionRecord[] = [];
  const warnings: string[] = [];
  payload.topicRows.forEach((row, index) => {
    if (!row.topics.length) {
      warnings.push(`Topic row ${index + 1} was skipped because no topics were selected.`);
      return;
    }
    const allowedTopics = row.allowedTopics ?? [];
    const matches = candidates.filter((question) => {
      if (selected.some((item) => item.id === question.id)) return false;
      const hasRequired = row.match === "all" ? row.topics.every((topic) => question.topics.includes(topic)) : row.topics.some((topic) => question.topics.includes(topic));
      if (!hasRequired) return false;
      return allowedTopics.length ? question.topics.every((topic) => allowedTopics.includes(topic)) : true;
    });
    const picked = diversePick(matches, row.count);
    if (picked.length < row.count) warnings.push(`Topic row ${index + 1} requested ${row.count}, but only ${picked.length} matched.`);
    selected.push(...picked);
  });
  return selectionPayload(selected, warnings, null);
}

function selectByQuestionNumbers(candidates: StructuredQuestionRecord[], questionNumbersText: string) {
  return parseQuestionNumbers(questionNumbersText).map((number) => randomItem(candidates.filter((question) => question.questionNumber === number))).filter(Boolean) as StructuredQuestionRecord[];
}

function chooseBalanced(options: StructuredQuestionRecord[], paperNumber: number, groupCounts: Map<string, number>, target: number, currentTotal: number) {
  if (!options.length) return null;
  const scored = options.map((question) => ({ question, score: selectionScore(question, paperNumber, groupCounts, target, currentTotal) }));
  scored.sort((a, b) => a.score[0] - b.score[0] || a.score[1] - b.score[1] || a.score[2] - b.score[2] || Math.random() - 0.5);
  const best = scored[0];
  const close = scored.filter((item) => item.score[0] === best.score[0] && item.score[1] <= best.score[1] + 0.5 && item.score[2] <= best.score[2] + 4);
  return randomItem(close).question;
}

function selectionScore(question: StructuredQuestionRecord, paperNumber: number, groupCounts: Map<string, number>, target: number, currentTotal: number): [number, number, number] {
  const groups = balanceGroupsForQuestion(question, paperNumber);
  const lowest = groups.length ? Math.min(...groups.map((group) => groupCounts.get(group) ?? 0)) : 99;
  const load = groups.length ? groups.reduce((sum, group) => sum + (groupCounts.get(group) ?? 0), 0) / groups.length : 99;
  return [lowest, load, Math.abs(target - (currentTotal + (question.marks ?? 0)))];
}

function balanceGroupsForQuestion(question: StructuredQuestionRecord, paperNumber: number) {
  const topics = question.topics.filter((topic) => !ignoredBalanceTopics.has(topic));
  const groups = paperTopicGroups[paperNumber] ?? {};
  return Object.entries(groups).filter(([, groupTopics]) => topics.some((topic) => groupTopics.includes(topic))).map(([group]) => group);
}

function eligibleBalanceGroups(questions: StructuredQuestionRecord[], paperNumber: number) {
  return new Set(questions.flatMap((question) => balanceGroupsForQuestion(question, paperNumber)));
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K) {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function selectionPayload(questions: StructuredQuestionRecord[], warnings: string[], targetMarks: number | null) {
  return { questions, warnings, targetMarks, totalMarks: totalMarks(questions) };
}

function resultPayload(folderPath: string, files: string[], selection: ReturnType<typeof selectionPayload>, previews: Partial<StructuredExamGeneratorResult> = {}): StructuredExamGeneratorResult {
  return {
    folderPath,
    files,
    selectedQuestions: selection.questions.map((question) => ({
      id: question.id,
      examCode: question.examCode,
      questionNumber: question.questionNumber,
      marks: question.marks,
      paper: question.paper,
      topics: question.topics
    })),
    totalMarks: selection.totalMarks,
    targetMarks: selection.targetMarks,
    warnings: selection.warnings,
    ...previews
  };
}

function getPaperNumber(question: StructuredQuestionRecord) {
  const match = `${question.paper} ${question.paperVersion}`.match(/(?:paper\s*)?(\d+)/i);
  return match ? Number(match[1]) : null;
}

function resolveQuestionFile(workspaceRoot: string, question: StructuredQuestionRecord, kind: "question" | "mark scheme") {
  const stored = kind === "question" ? question.splitQpPath : question.splitMsPath;
  if (!stored) return "";
  return path.isAbsolute(stored) ? stored : path.join(workspaceRoot, stored);
}

function renderSnippet(value: string, context: { pageNumber: number; title: string; kind: string }) {
  return value
    .replaceAll("{title}", context.title)
    .replaceAll("{page}", String(context.pageNumber))
    .replaceAll("{date}", new Date().toLocaleDateString("en-GB"))
    .replaceAll("{copy}", context.kind);
}

function parseQuestionNumbers(text: string) {
  const numbers = new Set<number>();
  for (const part of text.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(trimmed);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      for (let number = Math.min(start, end); number <= Math.max(start, end); number += 1) numbers.add(number);
    } else if (/^\d+$/.test(trimmed)) {
      numbers.add(Number(trimmed));
    }
  }
  return [...numbers].sort((a, b) => a - b);
}

function distribute(total: number, topics: string[]) {
  const base = Math.floor(total / topics.length);
  let extra = total % topics.length;
  return topics.map((topic) => {
    const count = base + (extra > 0 ? 1 : 0);
    extra -= 1;
    return { topic, count };
  });
}

function diversePick(options: StructuredQuestionRecord[], count: number) {
  const pool = shuffle(options);
  const picked: StructuredQuestionRecord[] = [];
  const examCounts = new Map<string, number>();
  const numberCounts = new Map<number, number>();
  while (pool.length && picked.length < count) {
    pool.sort((a, b) => (examCounts.get(a.examCode) ?? 0) - (examCounts.get(b.examCode) ?? 0) || (numberCounts.get(a.questionNumber) ?? 0) - (numberCounts.get(b.questionNumber) ?? 0) || Math.random() - 0.5);
    const next = pool.shift();
    if (!next) break;
    picked.push(next);
    examCounts.set(next.examCode, (examCounts.get(next.examCode) ?? 0) + 1);
    numberCounts.set(next.questionNumber, (numberCounts.get(next.questionNumber) ?? 0) + 1);
  }
  return picked;
}

function takeRandom<T>(items: T[], count: number) {
  return shuffle(items).slice(0, Math.max(0, count));
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function totalMarks(questions: StructuredQuestionRecord[]) {
  return questions.reduce((sum, question) => sum + (question.marks ?? 0), 0);
}

function uniqueFolder(initialPath: string) {
  if (!fs.existsSync(initialPath)) return initialPath;
  let counter = 2;
  while (fs.existsSync(`${initialPath}_${counter}`)) counter += 1;
  return `${initialPath}_${counter}`;
}

function sanitizeFileName(value: string) {
  return value.trim().replace(/[<>:"/\\|?*]+/g, "-") || "Structured Exam";
}
