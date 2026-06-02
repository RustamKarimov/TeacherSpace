import {
  BookOpen,
  Database,
  FileQuestion,
  FileText,
  FolderOpen,
  Layers3,
  Plus,
  Scissors,
  Settings,
  ShoppingBasket,
  Shuffle,
  SlidersHorizontal
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { teacherDeskApi } from "../../lib/rendererApi";
import type { McqQuestionRecord, StructuredQuestionRecord, WorkspaceInfo } from "../../types";

type DashboardView =
  | "add-edit"
  | "question-bank"
  | "exam-generator"
  | "metadata"
  | "settings"
  | "structured-splitter"
  | "structured-bank"
  | "structured-generator";

type DashboardPageProps = {
  workspace: WorkspaceInfo | null;
  onNavigate: (view: DashboardView) => void;
};

const mcqBasketStorageKey = "teacherdesk.mcqExamBasket";
const structuredBasketStorageKey = "teacherdesk.structuredExamBasket";

export function DashboardPage({ workspace, onNavigate }: DashboardPageProps) {
  const [mcqQuestions, setMcqQuestions] = useState<McqQuestionRecord[]>([]);
  const [structuredQuestions, setStructuredQuestions] = useState<StructuredQuestionRecord[]>([]);
  const [mcqBasketCount, setMcqBasketCount] = useState(0);
  const [structuredBasketCount, setStructuredBasketCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [mcqRows, structuredRows] = await Promise.all([
        teacherDeskApi.listMcqQuestions().catch(() => []),
        teacherDeskApi.listStructuredQuestions().catch(() => [])
      ]);
      setMcqQuestions(mcqRows);
      setStructuredQuestions(structuredRows);
      setMcqBasketCount(readStoredIds(mcqBasketStorageKey).length);
      setStructuredBasketCount(readStoredIds(structuredBasketStorageKey).length);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load dashboard statistics.");
    }
  }

  const stats = useMemo(() => {
    const mcqReady = mcqQuestions.filter((question) => question.reviewStatus.toLowerCase() === "ready").length;
    const mcqNeedsReview = mcqQuestions.filter((question) => question.reviewStatus.toLowerCase() !== "ready").length;
    const structuredNeedsReview = structuredQuestions.filter((question) => question.reviewStatus.toLowerCase().includes("review")).length;
    const structuredMarks = structuredQuestions.reduce((total, question) => total + (question.marks ?? 0), 0);
    const structuredPapers = new Set(structuredQuestions.map((question) => `${question.paper} v${question.paperVersion}`)).size;

    return {
      mcqReady,
      mcqNeedsReview,
      structuredNeedsReview,
      structuredMarks,
      structuredPapers
    };
  }, [mcqQuestions, structuredQuestions]);

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span>Local workspace</span>
          <h2>TeacherDesk</h2>
          <p>{workspace?.workspaceRoot ?? "Workspace is loading..."}</p>
        </div>
        <button type="button" onClick={() => void loadDashboard()}>
          Refresh
        </button>
      </section>

      <section className="dashboard-stats" aria-label="Important statistics">
        <StatCard icon={<FileQuestion size={20} />} label="MCQ questions" value={mcqQuestions.length} detail={`${stats.mcqReady} ready, ${stats.mcqNeedsReview} need review`} onClick={() => onNavigate("question-bank")} />
        <StatCard icon={<FileText size={20} />} label="Structured questions" value={structuredQuestions.length} detail={`${stats.structuredPapers} papers, ${stats.structuredMarks} marks stored`} onClick={() => onNavigate("structured-bank")} />
        <StatCard icon={<ShoppingBasket size={20} />} label="Exam baskets" value={mcqBasketCount + structuredBasketCount} detail={`${mcqBasketCount} MCQ, ${structuredBasketCount} structured`} onClick={() => onNavigate(structuredBasketCount > 0 ? "structured-generator" : "exam-generator")} />
        <StatCard icon={<SlidersHorizontal size={20} />} label="Metadata terms" value={countUniqueTerms(mcqQuestions, structuredQuestions)} detail="Shared topics and tags" onClick={() => onNavigate("metadata")} />
      </section>

      <section className="dashboard-workflows" aria-label="Common workflows">
        <WorkflowCard
          icon={<Plus size={18} />}
          title="Author MCQ"
          description="Create or edit a structured MCQ with preview-ready metadata."
          action="Add question"
          onClick={() => onNavigate("add-edit")}
        />
        <WorkflowCard
          icon={<Scissors size={18} />}
          title="Split structured papers"
          description="Validate a manifest and split question papers and mark schemes into the local bank."
          action="Open splitter"
          onClick={() => onNavigate("structured-splitter")}
        />
        <WorkflowCard
          icon={<Shuffle size={18} />}
          title="Generate exams"
          description="Build MCQ or structured exam packages from saved questions."
          action="Structured generator"
          onClick={() => onNavigate("structured-generator")}
        />
        <WorkflowCard
          icon={<Settings size={18} />}
          title="Defaults"
          description="Set output folders, masks, margins, and generator defaults once."
          action="Open settings"
          onClick={() => onNavigate("settings")}
        />
      </section>

      <section className="dashboard-system">
        <InfoRow icon={<FolderOpen size={16} />} label="Workspace" value={workspace?.workspaceRoot ?? "Not loaded"} />
        <InfoRow icon={<Database size={16} />} label="Database" value={workspace?.databasePath ?? "Not loaded"} />
        <InfoRow icon={<BookOpen size={16} />} label="Current focus" value="MCQ Builder and Structured Exams are available from the sidebar." />
      </section>

      {message ? <div className="td-app-notice">{message}</div> : null}
    </main>
  );
}

function StatCard({ icon, label, value, detail, onClick }: { icon: ReactNode; label: string; value: number; detail: string; onClick: () => void }) {
  return (
    <button className="dashboard-stat-card" type="button" onClick={onClick}>
      <span className="dashboard-stat-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{detail}</em>
    </button>
  );
}

function WorkflowCard({ icon, title, description, action, onClick }: { icon: ReactNode; title: string; description: string; action: string; onClick: () => void }) {
  return (
    <article className="dashboard-workflow-card">
      <span>{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <button type="button" onClick={onClick}>{action}</button>
    </article>
  );
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="dashboard-info-row">
      {icon}
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function countUniqueTerms(mcqQuestions: McqQuestionRecord[], structuredQuestions: StructuredQuestionRecord[]) {
  const terms = new Set<string>();
  for (const question of mcqQuestions) {
    question.topics.forEach((topic) => terms.add(`topic:${topic}`));
    question.tags.forEach((tag) => terms.add(`tag:${tag}`));
  }
  for (const question of structuredQuestions) {
    question.topics.forEach((topic) => terms.add(`topic:${topic}`));
    question.tags.forEach((tag) => terms.add(`tag:${tag}`));
  }
  return terms.size;
}

function readStoredIds(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
