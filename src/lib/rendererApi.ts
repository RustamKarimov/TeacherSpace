import type { AnalysisStudentRecord, AppSettings, McqExamGeneratorPayload, McqQuestionRecord, McqQuestionSavePayload, StructuredSplitterInput, TeacherDeskApi, WorkspaceInfo } from "../types";

const fallbackSettings: AppSettings = {
  theme: "light",
  workspaceRoot: "TeacherDesk_Workspace",
  lastMcqDefaults: {
    examCode: "",
    session: "",
    paper: "",
    paperVersion: ""
  },
  defaults: {
    mcqGenerator: {
      title: "AS Physics MCQ Practice",
      outputFolder: "TeacherDesk_Workspace\\mcq\\generated_exams",
      questionCount: 40,
      variants: 1,
      questionNumberGap: 7,
      questionGap: 8,
      shuffleQuestions: true,
      shuffleOptions: true,
      allowQuestionSplit: false,
      headerFooter: {
        headerLeft: "{title}",
        headerCenter: "{variant}",
        headerRight: "{date}",
        footerLeft: "TeacherDesk",
        footerCenter: "Page {page} of {pages}",
        footerRight: "{paper}"
      }
    },
    structuredSplitter: {
      sourceFolder: "TeacherDesk_Workspace\\source_papers",
      destinationFolder: "TeacherDesk_Workspace\\question_bank\\structured",
      overwriteExisting: true
    },
    structuredGenerator: {
      title: "Structured Physics Practice",
      outputFolder: "TeacherDesk_Workspace\\generated_exams",
      paperNumber: 2,
      targetMarksByPaper: { "2": 60, "3": 40, "4": 100, "5": 30 },
      allowanceMarks: 4,
      topMaskMm: 14,
      bottomMaskMm: 12,
      leftMaskMm: 0,
      rightMaskMm: 0,
      header: { left: "{title}", center: "", right: "{date}" },
      footer: { left: "TeacherDesk", center: "{copy}", right: "Page {page}" }
    },
    analysis: {
      defaultAcademicYear: "2025-2026",
      defaultGrade: "13",
      defaultClassName: "A",
      questionsPerAnswerRow: 15,
      difficultyThresholds: {
        veryEasy: 85,
        easy: 70,
        medium: 45,
        difficult: 25
      }
    }
  }
};

const fallbackApi: TeacherDeskApi = {
  async getWorkspaceInfo(): Promise<WorkspaceInfo> {
    return {
      workspaceRoot: "TeacherDesk_Workspace",
      databasePath: "TeacherDesk_Workspace/database/teacherdesk.sqlite",
      createdDirectories: []
    };
  },
  async getSettings() {
    return fallbackSettings;
  },
  async saveSettings(settings) {
    return settings;
  },
  async runMigrations() {
    return {
      databasePath: "TeacherDesk_Workspace/database/teacherdesk.sqlite",
      appliedMigrations: [],
      currentVersion: 1
    };
  },
  async pickWorkspaceFolder() {
    return null;
  },
  async pickOutputFolder() {
    return null;
  },
  async saveMcqQuestion(payload: McqQuestionSavePayload) {
    const questions = readFallbackQuestions();
    const now = new Date().toISOString();
    const id = payload.id ?? crypto.randomUUID();
    const metadata = payload.metadata as Record<string, unknown>;
    const blocks = payload.blocks as Array<Record<string, unknown>>;
    const existing = questions.find((question) => question.id === id);
    const record: McqQuestionRecord = {
      id,
      examCode: String(metadata.examCode ?? ""),
      originalQuestionNumber: String(metadata.originalQuestionNumber ?? ""),
      syllabus: String(metadata.syllabus ?? ""),
      session: String(metadata.session ?? ""),
      year: String(metadata.year ?? ""),
      paper: String(metadata.paper ?? ""),
      paperVersion: String(metadata.paperVersion ?? ""),
      marks: Number(metadata.marks ?? 1),
      difficulty: String(metadata.difficulty ?? "Medium"),
      reviewStatus: String(metadata.reviewStatus ?? "Ready"),
      correctAnswer: String(blocks.find((block) => block.type === "options")?.correctAnswer ?? ""),
      searchableText: payload.searchableText,
      questionJson: {
        metadata,
        blocks: payload.blocks,
        rendererVersion: payload.rendererVersion
      },
      topics: Array.isArray(metadata.topics) ? metadata.topics.map(String) : [],
      tags: Array.isArray(metadata.tags) ? metadata.tags.map(String) : [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    writeFallbackQuestions([record, ...questions.filter((question) => question.id !== id)]);
    return record;
  },
  async listMcqQuestions() {
    return readFallbackQuestions();
  },
  async getMcqQuestion(id: string) {
    return readFallbackQuestions().find((question) => question.id === id) ?? null;
  },
  async deleteMcqQuestion(id: string) {
    writeFallbackQuestions(readFallbackQuestions().filter((question) => question.id !== id));
  },
  async generateMcqExamPackage(payload) {
    void payload;
    throw new Error("PDF generation requires the TeacherDesk desktop app. Start TeacherDesk with Start TeacherDesk.bat so the Electron renderer can write A4 PDFs with images, tables, and LaTeX.");
  },
  async suggestOutputExamTitle(_outputFolder, title) {
    return { requestedTitle: title, suggestedTitle: title, exists: false };
  },
  async previewMcqExamPackage(payload) {
    void payload;
    throw new Error("MCQ preview requires the TeacherDesk desktop app. Start TeacherDesk with Start TeacherDesk.bat so the Electron renderer can show the exact A4 PDF preview.");
  },
  async pickManifestFile() {
    return null;
  },
  async validateStructuredManifest(input: StructuredSplitterInput) {
    void input;
    throw new Error("Structured splitting requires the TeacherDesk desktop app. Start TeacherDesk with Start TeacherDesk.bat.");
  },
  async planStructuredSplit(input: StructuredSplitterInput) {
    void input;
    throw new Error("Structured splitting requires the TeacherDesk desktop app. Start TeacherDesk with Start TeacherDesk.bat.");
  },
  async splitStructuredBatch(input: StructuredSplitterInput) {
    void input;
    throw new Error("Structured splitting requires the TeacherDesk desktop app. Start TeacherDesk with Start TeacherDesk.bat.");
  },
  async listStructuredQuestions() {
    return [];
  },
  async openStructuredQuestionFile() {
    throw new Error("Opening structured question PDFs requires the TeacherDesk desktop app.");
  },
  async deleteStructuredQuestions(ids: string[]) {
    void ids;
    throw new Error("Deleting structured questions requires the TeacherDesk desktop app.");
  },
  async getStructuredQuestionPreview() {
    throw new Error("Structured PDF preview requires the TeacherDesk desktop app.");
  },
  async updateStructuredQuestionMetadata(payload) {
    void payload;
    throw new Error("Structured metadata editing requires the TeacherDesk desktop app.");
  },
  async previewStructuredExamPackage(payload) {
    void payload;
    throw new Error("Structured exam preview requires the TeacherDesk desktop app.");
  },
  async generateStructuredExamPackage(payload) {
    void payload;
    throw new Error("Structured exam generation requires the TeacherDesk desktop app.");
  },
  async getAnalysisOverview() {
    const students = readFallbackStudents();
    return {
      students: {
        active: students.filter((student) => student.status === "Active").length,
        archived: students.filter((student) => student.status === "Archived").length,
        classes: new Set(students.filter((student) => student.status === "Active").map((student) => `${student.academicYear}:${student.grade}:${student.className}`)).size
      },
      questions: { mcq: readFallbackQuestions().length, structured: 0 },
      results: { mcqAttempts: 0, structuredAttempts: 0 }
    };
  },
  async listAnalysisStudents() {
    return readFallbackStudents();
  },
  async saveAnalysisStudent(payload) {
    const students = readFallbackStudents();
    const now = new Date().toISOString();
    const id = payload.id ?? crypto.randomUUID();
    const existing = students.find((student) => student.id === id);
    const record = {
      id,
      schoolId: payload.schoolId,
      firstName: payload.firstName,
      surname: payload.surname,
      academicYear: payload.academicYear,
      grade: payload.grade,
      className: payload.className,
      status: payload.status,
      notes: payload.notes,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    localStorage.setItem("teacherdesk.analysisStudents", JSON.stringify([record, ...students.filter((student) => student.id !== id)]));
    return record;
  },
  async deleteAnalysisStudent(id) {
    localStorage.setItem("teacherdesk.analysisStudents", JSON.stringify(readFallbackStudents().filter((student) => student.id !== id)));
  },
  async exportTeacherDeskPackage() {
    throw new Error("Import and export require the TeacherDesk desktop app.");
  },
  async importTeacherDeskPackage() {
    throw new Error("Import and export require the TeacherDesk desktop app.");
  },
  async openFolder() {
    throw new Error("Opening folders requires the TeacherDesk desktop app. Start TeacherDesk with Start TeacherDesk.bat and generate the exam there.");
  }
};

export const teacherDeskApi: TeacherDeskApi = {
  ...fallbackApi,
  ...(window.teacherDesk ?? {})
};

async function writeBrowserExamPackage(payload: McqExamGeneratorPayload, rootDirectory: BrowserDirectoryHandle) {
  const safeTitle = sanitizeFileName(payload.title);
  const packageDirectory = await rootDirectory.getDirectoryHandle(safeTitle, { create: true });
  const files: string[] = [];
  const variantLabels = Array.from({ length: Math.max(1, payload.variants) }, (_, index) => String.fromCharCode(65 + index));
  const runQuestionSet = selectQuestionsForBrowserVariant(payload);

  for (const label of variantLabels) {
    const questions = prepareVariantQuestions({
      ...payload,
      questions: runQuestionSet
    });
    const studentName = `${safeTitle}_student_${label}.pdf`;
    const teacherName = `${safeTitle}_teacher_${label}.pdf`;
    await writeBrowserPdf(packageDirectory, studentName, payload, questions, label, false);
    await writeBrowserPdf(packageDirectory, teacherName, payload, questions, label, true);
    files.push(studentName, teacherName);
    const answerKeyName = `${safeTitle}_answer_key_${label}.pdf`;
    await writeBrowserAnswerKey(packageDirectory, answerKeyName, payload, questions, label);
    files.push(answerKeyName);
  }

  const manifestName = "manifest.json";
  await writeBrowserFile(
    packageDirectory,
    manifestName,
    new Blob([
      JSON.stringify(
        {
          title: payload.title,
          mode: payload.mode,
          seed: payload.seed,
          createdAt: new Date().toISOString(),
          files,
          settings: payload.settings,
          questions: payload.questions.map((question) => ({
            id: question.id,
            examCode: question.examCode,
            originalQuestionNumber: question.originalQuestionNumber,
            correctAnswer: question.correctAnswer
          }))
        },
        null,
        2
      )
    ], { type: "application/json" })
  );
  files.push(manifestName);

  return {
    folderPath: `${rootDirectory.name}\\${safeTitle}`,
    files,
    seed: payload.seed
  };
}

async function writeBrowserPdf(directory: BrowserDirectoryHandle, fileName: string, payload: McqExamGeneratorPayload, questions: GeneratedBrowserQuestion[], variant: string, teacherCopy: boolean) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;

  page.drawText(`${payload.title} - Variant ${variant}`, { x: 54, y, size: 10, font: bold });
  y -= 32;

  questions.forEach((question, index) => {
    const lines = questionToLines(question, teacherCopy);
    if (y - lines.length * 14 < 54) {
      page = pdf.addPage([595.28, 841.89]);
      y = 790;
    }
    page.drawText(String(index + 1), { x: 54, y, size: 10, font: bold });
    for (const line of lines) {
      page.drawText(line, { x: 78, y, size: 10, font: line.startsWith("Answer:") ? bold : regular, color: rgb(0.08, 0.1, 0.14) });
      y -= 14;
    }
    y -= Math.max(6, payload.settings.questionGap * 2.83465);
  });

  await writeBrowserFile(directory, fileName, pdfBytesToBlob(await pdf.save()));
}

async function writeBrowserAnswerKey(directory: BrowserDirectoryHandle, fileName: string, payload: McqExamGeneratorPayload, questions: GeneratedBrowserQuestion[], variant: string) {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  page.drawText(`${payload.title} - Answer Key - Variant ${variant}`, { x: 54, y, size: 16, font: bold });
  y -= 28;
  questions.forEach((question, index) => {
    page.drawText(`${index + 1}. ${question.examCode} #${question.originalQuestionNumber}: ${question.generatedCorrectAnswer || question.correctAnswer || "-"}`, { x: 54, y, size: 11, font: regular });
    y -= 16;
  });
  await writeBrowserFile(directory, fileName, pdfBytesToBlob(await pdf.save()));
}

async function writeBrowserFile(directory: BrowserDirectoryHandle, fileName: string, content: Blob) {
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

function readFallbackQuestions(): McqQuestionRecord[] {
  try {
    return JSON.parse(localStorage.getItem("teacherdesk.mcqQuestions") ?? "[]") as McqQuestionRecord[];
  } catch {
    return [];
  }
}

function readFallbackStudents(): AnalysisStudentRecord[] {
  try {
    return JSON.parse(localStorage.getItem("teacherdesk.analysisStudents") ?? "[]") as AnalysisStudentRecord[];
  } catch {
    return [];
  }
}

function writeFallbackQuestions(questions: McqQuestionRecord[]) {
  localStorage.setItem("teacherdesk.mcqQuestions", JSON.stringify(questions));
}

function questionToLines(question: McqQuestionRecord, teacherCopy: boolean) {
  const lines: string[] = [];
  for (const block of question.questionJson.blocks) {
    if (!isRecord(block)) continue;
    if (block.type === "text") lines.push(...wrapText(normalizeLatexText(String(block.text ?? "")), 80));
    if (block.type === "equation") lines.push(normalizeLatexText(String(block.source ?? "")));
    if (block.type === "image") lines.push(`[image: ${String(isRecord(block.asset) ? block.asset.fileName ?? "image" : "image")}]`);
    if (block.type === "table") lines.push("[table]");
  }
  const optionBlock = question.questionJson.blocks.find((block) => isRecord(block) && block.type === "options");
  if (isRecord(optionBlock) && Array.isArray(optionBlock.options)) {
    for (const option of optionBlock.options.filter(isRecord)) {
      lines.push(`${String(option.letter ?? "")}. ${normalizeLatexText(String(option.text ?? "[option]"))}`);
    }
  }
  if (teacherCopy) lines.push(`Answer: ${"generatedCorrectAnswer" in question ? String(question.generatedCorrectAnswer) : question.correctAnswer || "-"}`);
  return lines.length ? lines : [`${question.examCode} #${question.originalQuestionNumber}`];
}

function prepareVariantQuestions(payload: McqExamGeneratorPayload): GeneratedBrowserQuestion[] {
  const questions = payload.settings.shuffleQuestions ? shuffle(payload.questions) : [...payload.questions];
  return questions.map((question) => prepareVariantQuestion(question, payload.settings.shuffleOptions));
}

function prepareVariantQuestion(question: McqQuestionRecord, shuffleOptionsEnabled: boolean): GeneratedBrowserQuestion {
  const clone = JSON.parse(JSON.stringify(question)) as GeneratedBrowserQuestion;
  clone.generatedCorrectAnswer = clone.correctAnswer;
  const optionsBlock = clone.questionJson.blocks.find((block) => isRecord(block) && block.type === "options");
  if (!shuffleOptionsEnabled || !isRecord(optionsBlock) || optionsBlock.mode !== "standard" || !Array.isArray(optionsBlock.options)) return clone;
  const settings = isRecord(optionsBlock.settings) ? optionsBlock.settings : {};
  if (settings.allowShuffle === false) return clone;
  const originalOptions = optionsBlock.options.filter(isRecord);
  const shuffled = shuffle(originalOptions);
  const letters = ["A", "B", "C", "D"];
  const correctOriginal = originalOptions.find((option) => String(option.letter) === clone.correctAnswer);
  optionsBlock.options = shuffled.map((option, index) => ({ ...option, letter: letters[index] }));
  const correctIndex = shuffled.findIndex((option) => correctOriginal && option.id === correctOriginal.id);
  clone.generatedCorrectAnswer = correctIndex >= 0 ? letters[correctIndex] : clone.correctAnswer;
  return clone;
}

function selectQuestionsForBrowserVariant(payload: McqExamGeneratorPayload) {
  const selection = payload.selection;
  if (!selection) return payload.questions;
  const readyQuestions = payload.questions.filter((question) => question.reviewStatus === "Ready");

  if (selection.mode === "basket") {
    return selection.basketIds.length
      ? payload.questions.filter((question) => selection.basketIds.includes(question.id))
      : payload.questions;
  }

  if (selection.mode === "full-paper") {
    const selected: McqQuestionRecord[] = [];
    const slots = shuffle(Array.from({ length: selection.questionCount }, (_, index) => index + 1));
    for (let slot = 1; slot <= selection.questionCount; slot += 1) {
      const slotNumber = slots[slot - 1] ?? slot;
      const candidates = shuffle(readyQuestions.filter((question) => Number(question.originalQuestionNumber) === slotNumber && !selected.some((item) => item.id === question.id)));
      const fallbackCandidates = readyQuestions.filter((question) => !selected.some((item) => item.id === question.id));
      const picked = randomItem(candidates.length ? candidates : fallbackCandidates);
      if (picked) selected.push(picked);
    }
    return selected;
  }

  if (selection.mode === "topical-total") {
    if (selection.selectedTopics.length === 0) return [];
    const selected: McqQuestionRecord[] = [];
    for (const item of distributeBrowserTotal(selection.questionCount, selection.selectedTopics)) {
      const candidates = readyQuestions.filter((question) => question.topics.includes(item.topic));
      selected.push(...takeRandom(candidates.filter((question) => !selected.some((picked) => picked.id === question.id)), item.count));
    }
    return selected.slice(0, selection.questionCount);
  }

  const selected: McqQuestionRecord[] = [];
  for (const row of selection.topicRows) {
    if (row.topics.length === 0) continue;
    const candidates = readyQuestions.filter((question) =>
      row.combination ? row.topics.every((topic) => question.topics.includes(topic)) : row.topics.some((topic) => question.topics.includes(topic))
    );
    selected.push(...takeRandom(candidates.filter((question) => !selected.some((picked) => picked.id === question.id)), row.count));
  }
  return selected;
}

function distributeBrowserTotal(total: number, topics: string[]) {
  const base = Math.floor(total / topics.length);
  let remainder = total % topics.length;
  return topics.map((topic) => {
    const count = base + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return { topic, count };
  });
}

function takeRandom<T>(items: T[], count: number) {
  return shuffle(items).slice(0, count);
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function normalizeLatexText(text: string): string {
  return text
    .replace(/\$([^$]+)\$/g, (_match, source: string) => latexToPlain(source))
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)")
    .replace(/\^\{([^{}]+)\}/g, "^$1")
    .replace(/_\{([^{}]+)\}/g, "_$1")
    .replace(/\\,/g, " ")
    .replace(/\\pm/g, "±")
    .replace(/\\times/g, "×")
    .replace(/\\rightarrow/g, "→")
    .replace(/\\leftarrow/g, "←")
    .replace(/\\uparrow/g, "↑")
    .replace(/\\downarrow/g, "↓")
    .replace(/\\/g, "")
    .replace(/[{}]/g, "");
}

function latexToPlain(source: string): string {
  return source
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)")
    .replace(/\^\{([^{}]+)\}/g, "^$1")
    .replace(/_\{([^{}]+)\}/g, "_$1")
    .replace(/\\,/g, " ")
    .replace(/\\pm/g, "±")
    .replace(/\\times/g, "×")
    .replace(/\\rightarrow/g, "→")
    .replace(/\\leftarrow/g, "←")
    .replace(/\\uparrow/g, "↑")
    .replace(/\\downarrow/g, "↓")
    .replace(/\\/g, "")
    .replace(/[{}]/g, "");
}

function wrapText(text: string, width: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function sanitizeFileName(value: string) {
  return value.trim().replace(/[<>:"/\\|?*]+/g, "-") || "Untitled MCQ Exam";
}

function pdfBytesToBlob(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: "application/pdf" });
}

function getBrowserDirectoryPicker() {
  return (window as unknown as { showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<BrowserDirectoryHandle> }).showDirectoryPicker;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type BrowserWritableFileStream = {
  write: (content: Blob) => Promise<void>;
  close: () => Promise<void>;
};

type BrowserFileHandle = {
  createWritable: () => Promise<BrowserWritableFileStream>;
};

type BrowserDirectoryHandle = {
  name: string;
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<BrowserDirectoryHandle>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<BrowserFileHandle>;
};

type GeneratedBrowserQuestion = McqQuestionRecord & {
  generatedCorrectAnswer: string;
};
