import { app, dialog } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { AppSettings, WorkspaceInfo } from "./shared.js";

const workspaceTree = [
  "database",
  "mcq/assets/question_images",
  "mcq/assets/option_images",
  "mcq/assets/table_cell_images",
  "mcq/generated_exams",
  "mcq/exports",
  "mcq/imports",
  "source_papers",
  "question_bank",
  "question_bank/structured",
  "structured/generated_exams",
  "structured/imports",
  "structured/exports",
  "generated_exams",
  "backups",
  "logs"
];

export function defaultWorkspaceRoot() {
  return path.join(app.getPath("documents"), "TeacherDesk_Workspace");
}

export function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

export function ensureWorkspace(root = defaultWorkspaceRoot()): WorkspaceInfo {
  const createdDirectories: string[] = [];

  for (const relativePath of workspaceTree) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
      createdDirectories.push(relativePath);
    }
  }

  return {
    workspaceRoot: root,
    databasePath: path.join(root, "database", "teacherdesk.sqlite"),
    createdDirectories
  };
}

export function loadSettings(): AppSettings {
  const fallback = defaultSettings();

  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    return mergeSettings(fallback, JSON.parse(raw));
  } catch {
    return fallback;
  }
}

export function defaultSettings(): AppSettings {
  const workspaceRoot = defaultWorkspaceRoot();
  return {
    theme: "light",
    workspaceRoot,
    lastMcqDefaults: {
      examCode: "",
      session: "",
      paper: "",
      paperVersion: ""
    },
    defaults: {
      mcqGenerator: {
        title: "AS Physics MCQ Practice",
        outputFolder: path.join(workspaceRoot, "mcq", "generated_exams"),
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
        sourceFolder: path.join(workspaceRoot, "source_papers"),
        destinationFolder: path.join(workspaceRoot, "question_bank", "structured"),
        overwriteExisting: true
      },
      structuredGenerator: {
        title: "Structured Physics Practice",
        outputFolder: path.join(workspaceRoot, "generated_exams"),
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
        defaultGrade: "",
        defaultClassName: "",
        questionsPerAnswerRow: 20,
        difficultyThresholds: {
          veryEasy: 85,
          easy: 70,
          medium: 45,
          difficult: 25
        }
      }
    }
  };
}

function mergeSettings(fallback: AppSettings, stored: Partial<AppSettings>): AppSettings {
  return {
    ...fallback,
    ...stored,
    lastMcqDefaults: { ...fallback.lastMcqDefaults, ...stored.lastMcqDefaults },
    defaults: {
      mcqGenerator: { ...fallback.defaults.mcqGenerator, ...stored.defaults?.mcqGenerator, headerFooter: { ...fallback.defaults.mcqGenerator.headerFooter, ...stored.defaults?.mcqGenerator?.headerFooter } },
      structuredSplitter: { ...fallback.defaults.structuredSplitter, ...stored.defaults?.structuredSplitter },
      structuredGenerator: {
        ...fallback.defaults.structuredGenerator,
        ...stored.defaults?.structuredGenerator,
        targetMarksByPaper: { ...fallback.defaults.structuredGenerator.targetMarksByPaper, ...stored.defaults?.structuredGenerator?.targetMarksByPaper },
        header: { ...fallback.defaults.structuredGenerator.header, ...stored.defaults?.structuredGenerator?.header },
        footer: { ...fallback.defaults.structuredGenerator.footer, ...stored.defaults?.structuredGenerator?.footer }
      },
      analysis: {
        ...fallback.defaults.analysis,
        ...stored.defaults?.analysis,
        difficultyThresholds: { ...fallback.defaults.analysis.difficultyThresholds, ...stored.defaults?.analysis?.difficultyThresholds }
      }
    }
  };
}

export function saveSettings(settings: AppSettings): AppSettings {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
  ensureWorkspace(settings.workspaceRoot);
  return settings;
}

export async function pickWorkspaceFolder(currentRoot: string) {
  const result = await dialog.showOpenDialog({
    title: "Choose TeacherDesk workspace folder",
    defaultPath: currentRoot,
    properties: ["openDirectory", "createDirectory"]
  });

  return result.canceled ? null : result.filePaths[0] ?? null;
}
