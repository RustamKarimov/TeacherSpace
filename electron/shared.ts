export type ThemeMode = "light" | "dark";

export interface WorkspaceInfo {
  workspaceRoot: string;
  databasePath: string;
  createdDirectories: string[];
}

export interface AppSettings {
  theme: ThemeMode;
  workspaceRoot: string;
  lastMcqDefaults: {
    examCode: string;
    session: string;
    paper: string;
    paperVersion: string;
  };
  defaults: {
    mcqGenerator: {
      title: string;
      outputFolder: string;
      questionCount: number;
      variants: number;
      questionNumberGap: number;
      questionGap: number;
      shuffleQuestions: boolean;
      shuffleOptions: boolean;
      allowQuestionSplit: boolean;
      headerFooter: Record<string, string>;
    };
    structuredSplitter: {
      sourceFolder: string;
      destinationFolder: string;
      overwriteExisting: boolean;
    };
    structuredGenerator: {
      title: string;
      outputFolder: string;
      paperNumber: number;
      targetMarksByPaper: Record<string, number>;
      allowanceMarks: number;
      topMaskMm: number;
      bottomMaskMm: number;
      leftMaskMm: number;
      rightMaskMm: number;
      header: { left: string; center: string; right: string };
      footer: { left: string; center: string; right: string };
    };
    analysis: {
      defaultAcademicYear: string;
      defaultGrade: string;
      defaultClassName: string;
      questionsPerAnswerRow: number;
      difficultyThresholds: {
        veryEasy: number;
        easy: number;
        medium: number;
        difficult: number;
      };
    };
  };
}

export interface MigrationResult {
  databasePath: string;
  appliedMigrations: string[];
  currentVersion: number;
}

export interface McqQuestionSavePayload {
  id?: string;
  metadata: Record<string, unknown>;
  blocks: unknown[];
  searchableText: string;
  rendererVersion: number;
}

export interface McqQuestionRecord {
  id: string;
  examCode: string;
  originalQuestionNumber: string;
  syllabus: string;
  session: string;
  year: string;
  paper: string;
  paperVersion: string;
  marks: number;
  difficulty: string;
  reviewStatus: string;
  correctAnswer: string;
  searchableText: string;
  questionJson: {
    metadata: Record<string, unknown>;
    blocks: unknown[];
    rendererVersion: number;
  };
  topics: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface McqExamGeneratorPayload {
  title: string;
  outputFolder: string;
  seed: string;
  mode: string;
  variants: number;
  selection?: {
    mode: "full-paper" | "topical-total" | "topical-custom" | "basket";
    questionCount: number;
    selectedTopics: string[];
    topicRows: Array<{
      topics: string[];
      count: number;
      combination: boolean;
    }>;
    basketIds: string[];
  };
  headerFooter: Record<string, string>;
  settings: {
    includeCover: boolean;
    coverPageName: string;
    questionNumberGap: number;
    questionGap: number;
    allowQuestionSplit: boolean;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
  };
  questions: McqQuestionRecord[];
}

export interface McqExamGeneratorResult {
  folderPath: string;
  files: string[];
  seed: string;
}

export type StructuredValidationSeverity = "error" | "warning" | "info";

export interface StructuredValidationIssue {
  severity: StructuredValidationSeverity;
  row: number | null;
  field: string | null;
  examCode: string | null;
  questionNumber: number | null;
  message: string;
  suggestion?: string;
}

export interface StructuredManifestRow {
  row: number;
  examCode: string;
  msExamCode: string;
  questionNumber: number | null;
  qpStartRaw: string;
  msStartRaw: string;
  qpStartPage: number | null;
  msStartPage: number | null;
  qpStarred: boolean;
  msStarred: boolean;
  qpPageEnd: number | null;
  msPageEnd: number | null;
  marks: number | null;
  subjectCode: string;
  session: string;
  year: number | null;
  paper: string;
  paperVersion: string;
  qpFile: string;
  msFile: string;
  qpPages: number | null;
  msPages: number | null;
  topics: string[];
  tags: string[];
  status: "ready" | "warning" | "error";
  issues: StructuredValidationIssue[];
}

export interface StructuredValidationReport {
  ok: boolean;
  summary: {
    rows: number;
    readyRows: number;
    errors: number;
    warnings: number;
    missingFiles: number;
    sourcePdfs: number;
    topicsFound: number;
    tagsFound: number;
    starredBoundaries: number;
    reviewRequiredItems: number;
  };
  issues: StructuredValidationIssue[];
  rows: StructuredManifestRow[];
  similarMetadata: Array<{
    kind: "topic" | "tag";
    incoming: string;
    existing: string;
    score: number;
    rows: number[];
  }>;
}

export interface StructuredSplitPlan {
  ok: boolean;
  message: string;
  validation: StructuredValidationReport;
  summary: {
    records: number;
    filesTotal: number;
    questionsToCreate: number;
    questionsToUpdate: number;
    qpFilesToWrite: number;
    msFilesToWrite: number;
    reviewRequiredItems: number;
    destinationFolder: string;
  };
  items: Array<{
    row: number;
    examCode: string;
    questionNumber: number;
    paper: string;
    qpOutput: string;
    msOutput: string;
    action: "create" | "update";
    reviewRequired: boolean;
  }>;
}

export interface StructuredSplitterInput {
  manifestPath: string;
  sourceFolder: string;
  destinationFolder: string;
  overwriteExisting: boolean;
}

export interface StructuredSplitResult {
  ok: boolean;
  message: string;
  validation: StructuredValidationReport;
  summary: {
    createdQuestions: number;
    updatedQuestions: number;
    splitQuestionPdfs: number;
    splitMarkSchemePdfs: number;
    reviewRequiredItems: number;
    destinationFolder: string;
  };
  outputs: Array<{
    examCode: string;
    questionNumber: number;
    qpOutput: string;
    msOutput: string;
  }>;
}

export interface StructuredQuestionRecord {
  id: string;
  examCode: string;
  subjectCode: string;
  session: string;
  year: number | null;
  paper: string;
  paperVersion: string;
  questionNumber: number;
  marks: number | null;
  sourceQpPath: string;
  sourceMsPath: string;
  splitQpPath: string;
  splitMsPath: string;
  qpPageStart: number | null;
  qpPageEnd: number | null;
  msPageStart: number | null;
  msPageEnd: number | null;
  reviewStatus: string;
  reviewReason: string;
  topics: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StructuredDeleteResult {
  deletedCount: number;
  deletedFiles: string[];
  failedFiles: Array<{ path: string; error: string }>;
}

export interface StructuredPreviewData {
  fileName: string;
  dataUrl: string;
}

export interface StructuredMetadataUpdate {
  id: string;
  session: string;
  year: number | null;
  paper: string;
  paperVersion: string;
  marks: number | null;
  reviewStatus: string;
  reviewReason: string;
  topics: string[];
  tags: string[];
}

export interface StructuredExamGeneratorPayload {
  title: string;
  outputFolder: string;
  mode: "full-paper" | "question-numbers" | "topical-total" | "topical-custom" | "basket";
  paperNumber?: number;
  targetMarks?: number;
  allowanceMarks?: number;
  questionNumbers?: string;
  questionCount: number;
  selectedQuestionIds: string[];
  selectedTopics: string[];
  topicRows: Array<{ topics: string[]; allowedTopics?: string[]; count: number; match: "any" | "all" }>;
  header: { left: string; center: string; right: string };
  footer: { left: string; center: string; right: string };
  maskExisting: boolean;
  topMaskMm: number;
  bottomMaskMm: number;
  leftMaskMm?: number;
  rightMaskMm?: number;
  pageMasks?: Array<{ pageNumber: number; topMaskMm: number; bottomMaskMm: number; leftMaskMm: number; rightMaskMm: number }>;
  questionGapMm: number;
  allowSplit: boolean;
}

export interface StructuredExamGeneratorResult {
  folderPath: string;
  files: string[];
  selectedQuestions: Array<{ id: string; examCode: string; questionNumber: number; marks: number | null; paper: string; topics: string[] }>;
  totalMarks: number;
  targetMarks: number | null;
  warnings: string[];
  qpPreview?: StructuredPreviewData;
  msPreview?: StructuredPreviewData;
}

export interface AnalysisStudentRecord {
  id: string;
  schoolId: string;
  firstName: string;
  surname: string;
  academicYear: string;
  grade: string;
  className: string;
  status: "Active" | "Archived";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisStudentSavePayload {
  id?: string;
  schoolId: string;
  firstName: string;
  surname: string;
  academicYear: string;
  grade: string;
  className: string;
  status: "Active" | "Archived";
  notes: string;
}

export interface AnalysisOverview {
  students: {
    active: number;
    archived: number;
    classes: number;
  };
  questions: {
    mcq: number;
    structured: number;
  };
  results: {
    mcqAttempts: number;
    structuredAttempts: number;
  };
}

export interface ImportExportResult {
  ok: boolean;
  folderPath: string;
  message: string;
  summary: {
    mcqCreated: number;
    mcqUpdated: number;
    structuredCreated: number;
    structuredUpdated: number;
    filesCopied: number;
    duplicatesResolved: number;
    warnings: string[];
  };
  files: string[];
}

export interface TeacherDeskApi {
  getWorkspaceInfo: () => Promise<WorkspaceInfo>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<AppSettings>;
  runMigrations: () => Promise<MigrationResult>;
  pickWorkspaceFolder: () => Promise<string | null>;
  pickOutputFolder: (currentFolder: string) => Promise<string | null>;
  saveMcqQuestion: (payload: McqQuestionSavePayload) => Promise<McqQuestionRecord>;
  listMcqQuestions: () => Promise<McqQuestionRecord[]>;
  getMcqQuestion: (id: string) => Promise<McqQuestionRecord | null>;
  deleteMcqQuestion: (id: string) => Promise<void>;
  generateMcqExamPackage: (payload: McqExamGeneratorPayload) => Promise<McqExamGeneratorResult>;
  pickManifestFile: (currentPath: string) => Promise<string | null>;
  validateStructuredManifest: (input: StructuredSplitterInput) => Promise<StructuredValidationReport>;
  planStructuredSplit: (input: StructuredSplitterInput) => Promise<StructuredSplitPlan>;
  splitStructuredBatch: (input: StructuredSplitterInput) => Promise<StructuredSplitResult>;
  listStructuredQuestions: () => Promise<StructuredQuestionRecord[]>;
  openStructuredQuestionFile: (id: string, kind: "qp" | "ms") => Promise<void>;
  deleteStructuredQuestions: (ids: string[]) => Promise<StructuredDeleteResult>;
  getStructuredQuestionPreview: (id: string, kind: "qp" | "ms") => Promise<StructuredPreviewData>;
  updateStructuredQuestionMetadata: (payload: StructuredMetadataUpdate) => Promise<StructuredQuestionRecord>;
  previewStructuredExamPackage: (payload: StructuredExamGeneratorPayload) => Promise<StructuredExamGeneratorResult>;
  generateStructuredExamPackage: (payload: StructuredExamGeneratorPayload) => Promise<StructuredExamGeneratorResult>;
  getAnalysisOverview: () => Promise<AnalysisOverview>;
  listAnalysisStudents: () => Promise<AnalysisStudentRecord[]>;
  saveAnalysisStudent: (payload: AnalysisStudentSavePayload) => Promise<AnalysisStudentRecord>;
  deleteAnalysisStudent: (id: string) => Promise<void>;
  exportTeacherDeskPackage: (outputFolder: string) => Promise<ImportExportResult>;
  importTeacherDeskPackage: (packageFolder: string) => Promise<ImportExportResult>;
  openFolder: (folderPath: string) => Promise<void>;
}

declare global {
  interface Window {
    teacherDesk?: TeacherDeskApi;
  }
}
