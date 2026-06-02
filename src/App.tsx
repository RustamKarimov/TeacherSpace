import { lazy, Suspense, useEffect, useState } from "react";
import { AppShell } from "./app/AppShell";
import { teacherDeskApi } from "./lib/rendererApi";
import type { AppSettings, McqQuestionRecord, ThemeMode, WorkspaceInfo } from "./types";

type AppView = "dashboard" | "add-edit" | "question-bank" | "exam-generator" | "metadata" | "settings" | "import-export" | "structured-splitter" | "structured-bank" | "structured-generator" | "structured-metadata" | "analysis-overview" | "analysis-students" | "analysis-mcq-entry" | "analysis-structured-entry" | "analysis-student" | "analysis-question" | "analysis-exam" | "analysis-topic" | "analysis-tag";

const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const AnalysisPage = lazy(() => import("./features/analysis/AnalysisPage").then((module) => ({ default: module.AnalysisPage })));
const ImportExportPage = lazy(() => import("./features/importExport/ImportExportPage").then((module) => ({ default: module.ImportExportPage })));
const QuestionBankPage = lazy(() => import("./features/mcq/bank/QuestionBankPage").then((module) => ({ default: module.QuestionBankPage })));
const McqEditorPage = lazy(() => import("./features/mcq/editor/McqEditorPage").then((module) => ({ default: module.McqEditorPage })));
const ExamGeneratorPage = lazy(() => import("./features/mcq/generator/ExamGeneratorPage").then((module) => ({ default: module.ExamGeneratorPage })));
const SettingsPage = lazy(() => import("./features/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const StructuredQuestionBankPage = lazy(() => import("./features/structured/bank/StructuredQuestionBankPage").then((module) => ({ default: module.StructuredQuestionBankPage })));
const StructuredExamGeneratorPage = lazy(() => import("./features/structured/generator/StructuredExamGeneratorPage").then((module) => ({ default: module.StructuredExamGeneratorPage })));
const StructuredMetadataPage = lazy(() => import("./features/structured/metadata/StructuredMetadataPage").then((module) => ({ default: module.StructuredMetadataPage })));
const StructuredSplitterPage = lazy(() => import("./features/structured/splitter/StructuredSplitterPage").then((module) => ({ default: module.StructuredSplitterPage })));

export function App() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [editingQuestion, setEditingQuestion] = useState<McqQuestionRecord | null>(null);
  const [bankRefreshKey, setBankRefreshKey] = useState(0);
  const [selectedBankQuestionId, setSelectedBankQuestionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    async function boot() {
      const [loadedSettings, workspaceInfo] = await Promise.all([
        teacherDeskApi.getSettings(),
        teacherDeskApi.getWorkspaceInfo().then(async (info) => {
          await teacherDeskApi.runMigrations();
          return info;
        })
      ]);
      await migrateFallbackQuestionsToSqlite();

      setSettings(loadedSettings);
      setTheme(loadedSettings.theme);
      setWorkspace(workspaceInfo);
    }

    void boot();
  }, []);

  async function updateTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    if (settings) {
      const nextSettings = { ...settings, theme: nextTheme };
      setSettings(await teacherDeskApi.saveSettings(nextSettings));
    }
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 5000);
  }

  const title =
    activeView === "dashboard"
      ? "Dashboard"
      : activeView === "analysis-overview"
      ? "Analysis"
      : activeView === "analysis-students"
      ? "Students"
      : activeView === "analysis-mcq-entry"
      ? "MCQ Answer Capture"
      : activeView === "analysis-structured-entry"
      ? "Structured Mark Capture"
      : activeView === "analysis-student"
      ? "Student Analysis"
      : activeView === "analysis-question"
      ? "Question Analysis"
      : activeView === "analysis-exam"
      ? "Exam Analysis"
      : activeView === "analysis-topic"
      ? "Topic Analysis"
      : activeView === "analysis-tag"
      ? "Tag Analysis"
      : activeView === "question-bank"
      ? "MCQ Question Bank"
      : activeView === "exam-generator"
        ? "MCQ Exam Generator"
        : activeView === "metadata"
          ? "Metadata"
        : activeView === "settings"
          ? "Settings"
          : activeView === "import-export"
            ? "Import / Export"
            : activeView === "structured-splitter"
            ? "Structured Exams Batch Splitter"
            : activeView === "structured-bank"
              ? "Structured Question Bank"
              : activeView === "structured-generator"
                ? "Structured Exam Generator"
                : activeView === "structured-metadata"
                  ? "Metadata"
                  : "MCQ Add/Edit";

  return (
    <div data-theme={theme}>
      <AppShell
        activeItem={activeView}
        title={title}
        theme={theme}
        onNavigate={(item) => {
          if (item === "add-edit") {
            setEditingQuestion(null);
          }
          setActiveView(item);
        }}
        onThemeChange={updateTheme}
      >
        <Suspense fallback={<div className="td-page-loading">Loading TeacherDesk module...</div>}>
          {activeView === "dashboard" ? (
            <DashboardPage workspace={workspace} onNavigate={setActiveView} />
          ) : activeView === "analysis-overview" ? (
            <AnalysisPage mode="overview" settings={settings} />
          ) : activeView === "analysis-students" ? (
            <AnalysisPage mode="students" settings={settings} />
          ) : activeView === "analysis-mcq-entry" ? (
            <AnalysisPage mode="mcq-entry" settings={settings} />
          ) : activeView === "analysis-structured-entry" ? (
            <AnalysisPage mode="structured-entry" settings={settings} />
          ) : activeView === "analysis-student" ? (
            <AnalysisPage mode="student-analysis" settings={settings} />
          ) : activeView === "analysis-question" ? (
            <AnalysisPage mode="question-analysis" settings={settings} />
          ) : activeView === "analysis-exam" ? (
            <AnalysisPage mode="exam-analysis" settings={settings} />
          ) : activeView === "analysis-topic" ? (
            <AnalysisPage mode="topic-analysis" settings={settings} />
          ) : activeView === "analysis-tag" ? (
            <AnalysisPage mode="tag-analysis" settings={settings} />
          ) : activeView === "add-edit" ? (
            <McqEditorPage
              editingQuestion={editingQuestion}
              settings={settings}
              workspace={workspace}
              onSaved={(question, mode) => {
                void rememberMcqDefaults(question).then(setSettings);
                setBankRefreshKey((value) => value + 1);
                setSelectedBankQuestionId(question.id);
                if (mode === "open-bank") {
                  setEditingQuestion(question);
                  setActiveView("question-bank");
                  showNotice(`Saved ${question.examCode || "question"} #${question.originalQuestionNumber || "new"}.`);
                } else {
                  setEditingQuestion(null);
                  showNotice("Saved. Ready for another question.");
                }
              }}
            />
          ) : activeView === "question-bank" ? (
            <QuestionBankPage
              refreshKey={bankRefreshKey}
              selectedQuestionId={selectedBankQuestionId}
              onAddQuestion={() => {
                setEditingQuestion(null);
                setActiveView("add-edit");
              }}
              onEditQuestion={(question) => {
                setEditingQuestion(question);
                setActiveView("add-edit");
              }}
            />
          ) : activeView === "exam-generator" ? (
            <ExamGeneratorPage settings={settings} workspace={workspace} />
          ) : activeView === "metadata" ? (
            <StructuredMetadataPage />
          ) : activeView === "settings" ? (
            <SettingsPage settings={settings} workspace={workspace} onSettingsSaved={setSettings} />
          ) : activeView === "import-export" ? (
            <ImportExportPage workspace={workspace} />
          ) : activeView === "structured-splitter" ? (
            <StructuredSplitterPage settings={settings} workspace={workspace} />
          ) : activeView === "structured-bank" ? (
            <StructuredQuestionBankPage workspace={workspace} />
          ) : activeView === "structured-generator" ? (
            <StructuredExamGeneratorPage settings={settings} workspace={workspace} />
          ) : (
            <StructuredMetadataPage />
          )}
        </Suspense>
      </AppShell>
      {notice ? <div className="td-app-notice">{notice}</div> : null}
    </div>
  );
}

async function rememberMcqDefaults(question: McqQuestionRecord) {
  const current = await teacherDeskApi.getSettings();
  const next = {
    ...current,
    lastMcqDefaults: {
      examCode: question.examCode,
      session: question.session,
      paper: question.paper,
      paperVersion: question.paperVersion
    }
  };
  return teacherDeskApi.saveSettings(next);
}

async function migrateFallbackQuestionsToSqlite() {
  if (!window.teacherDesk) return;

  const rawQuestions = localStorage.getItem("teacherdesk.mcqQuestions");
  if (!rawQuestions) return;

  let fallbackQuestions: McqQuestionRecord[];
  try {
    const parsed = JSON.parse(rawQuestions);
    if (!Array.isArray(parsed)) return;
    fallbackQuestions = parsed as McqQuestionRecord[];
  } catch {
    return;
  }

  if (fallbackQuestions.length === 0) return;

  const sqliteQuestions = await teacherDeskApi.listMcqQuestions();
  const existingIds = new Set(sqliteQuestions.map((question) => question.id));
  const existingExamNumbers = new Set(
    sqliteQuestions.map((question) => `${question.examCode.trim().toLowerCase()}::${question.originalQuestionNumber.trim().toLowerCase()}`)
  );

  let imported = 0;
  for (const question of fallbackQuestions) {
    const examKey = `${question.examCode.trim().toLowerCase()}::${question.originalQuestionNumber.trim().toLowerCase()}`;
    if (existingIds.has(question.id) || existingExamNumbers.has(examKey)) continue;

    const metadata = {
      ...question.questionJson.metadata,
      examCode: question.examCode,
      originalQuestionNumber: question.originalQuestionNumber,
      syllabus: question.syllabus,
      session: question.session,
      year: question.year,
      paper: question.paper,
      paperVersion: question.paperVersion,
      marks: question.marks,
      difficulty: question.difficulty,
      reviewStatus: question.reviewStatus,
      topics: question.topics,
      tags: question.tags
    };

    await teacherDeskApi.saveMcqQuestion({
      id: question.id,
      metadata,
      blocks: question.questionJson.blocks,
      searchableText: question.searchableText,
      rendererVersion: question.questionJson.rendererVersion
    });
    imported += 1;
  }

  if (imported > 0) {
    localStorage.setItem("teacherdesk.mcqQuestions.migratedAt", new Date().toISOString());
  }
}
