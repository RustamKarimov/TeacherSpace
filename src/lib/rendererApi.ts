import type { AnalysisStudentRecord, AppSettings, McqQuestionRecord, McqQuestionSavePayload, StructuredSplitterInput, TeacherDeskApi, WorkspaceInfo } from "../types";

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
    const questions = readFallbackQuestions();
    const topicStats = buildFallbackTermStats(questions, "topics");
    const tagStats = buildFallbackTermStats(questions, "tags");
    return {
      students: {
        active: students.filter((student) => student.status === "Active").length,
        archived: students.filter((student) => student.status === "Archived").length,
        classes: new Set(students.filter((student) => student.status === "Active").map((student) => `${student.academicYear}:${student.grade}:${student.className}`)).size
      },
      questions: { mcq: questions.length, structured: 0 },
      results: { mcqAttempts: 0, structuredAttempts: 0 },
      generatedExams: { mcq: 0, structured: 0 },
      usage: { mcqUsed: 0, mcqUnused: questions.length, structuredUsed: 0, structuredUnused: 0 },
      difficultyDistribution: Object.entries(countBy(questions.map((question) => question.difficulty || "Medium"))).map(([difficulty, count]) => ({ difficulty, count })),
      reviewDistribution: Object.entries(countBy(questions.map((question) => question.reviewStatus || "Ready"))).map(([status, mcqCount]) => ({ status, mcqCount, structuredCount: 0 })),
      topicStats,
      tagStats
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

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function buildFallbackTermStats(questions: McqQuestionRecord[], key: "topics" | "tags") {
  const counts = new Map<string, number>();
  for (const question of questions) {
    for (const name of question[key] ?? []) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({
      id: name,
      name,
      mcqCount: count,
      structuredCount: 0,
      usedCount: 0,
      unusedCount: count,
      attemptsCount: 0,
      successPercent: null
    }))
    .sort((a, b) => b.mcqCount - a.mcqCount);
}
