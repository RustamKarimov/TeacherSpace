import {
  BookOpen,
  BarChart3,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  FileText,
  Home,
  Import,
  Info,
  Library,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Scissors,
  Settings,
  Shuffle,
  SlidersHorizontal,
  Users
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ThemeMode } from "../types";
import { ThemeToggle } from "../components/ui";

type AppShellProps = {
  activeItem: string;
  children: ReactNode;
  theme: ThemeMode;
  title?: string;
  onNavigate: (item: "dashboard" | "add-edit" | "question-bank" | "exam-generator" | "metadata" | "settings" | "component-gallery" | "help" | "about" | "import-export" | "structured-splitter" | "structured-bank" | "structured-generator" | "structured-metadata" | "analysis-overview" | "analysis-students" | "analysis-mcq-entry" | "analysis-structured-entry" | "analysis-student" | "analysis-question" | "analysis-exam" | "analysis-topic" | "analysis-tag") => void;
  onThemeChange: (theme: ThemeMode) => void;
};

export function AppShell({ activeItem, children, title = "Dashboard", theme, onNavigate, onThemeChange }: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMcqOpen, setIsMcqOpen] = useState(true);
  const [isStructuredOpen, setIsStructuredOpen] = useState(true);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const workspaceRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    workspace.scrollTop = 0;
    workspace.querySelectorAll<HTMLElement>("main, .mcq-panel-body, .structured-bank-preview, .metadata-table-card, .metadata-detail-panel").forEach((element) => {
      element.scrollTop = 0;
    });
  }, [activeItem]);

  return (
    <div className={clsx("td-workbench", isCollapsed && "is-nav-collapsed")}>
      <aside className="td-nav" aria-label="TeacherDesk sidebar">
        <div className="td-nav-brand">
          <span className="td-nav-brand-icon">
            <BookOpen size={16} />
          </span>
          <strong>TeacherDesk</strong>
        </div>

        <nav className="td-nav-scroll" aria-label="Main navigation">
          <button className={activeItem === "dashboard" ? "is-active" : undefined} type="button" onClick={() => onNavigate("dashboard")}>
            <Home size={18} />
            <span>Dashboard</span>
          </button>

          <div className={clsx("td-nav-section", isMcqOpen && "is-open")}>
            <button className="td-nav-section-trigger is-active" type="button" onClick={() => setIsMcqOpen((value) => !value)}>
              <FileText size={18} />
              <span>MCQ Builder</span>
              <ChevronDown size={16} />
            </button>
            {isMcqOpen ? (
              <div className="td-nav-children">
                <button className={activeItem === "add-edit" ? "is-active" : undefined} type="button" onClick={() => onNavigate("add-edit")}>
                  <Plus size={14} />
                  <span>Add / Edit Question</span>
                </button>
                <button className={activeItem === "question-bank" ? "is-active" : undefined} type="button" onClick={() => onNavigate("question-bank")}>
                  <BookOpen size={14} />
                  <span>Question Bank</span>
                </button>
                <button className={activeItem === "exam-generator" ? "is-active" : undefined} type="button" onClick={() => onNavigate("exam-generator")}>
                  <Shuffle size={14} />
                  <span>Exam Generator</span>
                </button>
              </div>
            ) : null}
          </div>

          <div className={clsx("td-nav-section", isStructuredOpen && "is-open")}>
            <button className={activeItem.startsWith("structured") ? "td-nav-section-trigger is-active" : "td-nav-section-trigger"} type="button" onClick={() => setIsStructuredOpen((value) => !value)}>
              <Library size={18} />
              <span>Structured Exams</span>
              <ChevronDown size={16} />
            </button>
            {isStructuredOpen ? (
              <div className="td-nav-children">
                <button className={activeItem === "structured-splitter" ? "is-active" : undefined} type="button" onClick={() => onNavigate("structured-splitter")}>
                  <Scissors size={14} />
                  <span>Batch Splitter</span>
                </button>
                <button className={activeItem === "structured-bank" ? "is-active" : undefined} type="button" onClick={() => onNavigate("structured-bank")}>
                  <BookOpen size={14} />
                  <span>Question Bank</span>
                </button>
                <button className={activeItem === "structured-generator" ? "is-active" : undefined} type="button" onClick={() => onNavigate("structured-generator")}>
                  <Shuffle size={14} />
                  <span>Exam Generator</span>
                </button>
              </div>
            ) : null}
          </div>

          <button className={activeItem === "import-export" ? "is-active" : undefined} type="button" onClick={() => onNavigate("import-export")}>
            <Import size={18} />
            <span>Import / Export</span>
          </button>

          <div className={clsx("td-nav-section", isAnalysisOpen && "is-open")}>
            <button className={activeItem.startsWith("analysis") ? "td-nav-section-trigger is-active" : "td-nav-section-trigger"} type="button" onClick={() => setIsAnalysisOpen((value) => !value)}>
              <BarChart3 size={18} />
              <span>Analysis</span>
              <ChevronDown size={16} />
            </button>
            {isAnalysisOpen ? (
              <div className="td-nav-children">
                <button className={activeItem === "analysis-overview" ? "is-active" : undefined} type="button" onClick={() => onNavigate("analysis-overview")}>
                  <BarChart3 size={14} />
                  <span>Overview</span>
                </button>
                <button className={activeItem === "analysis-students" ? "is-active" : undefined} type="button" onClick={() => onNavigate("analysis-students")}>
                  <Users size={14} />
                  <span>Students</span>
                </button>
                <button className={activeItem === "analysis-mcq-entry" ? "is-active" : undefined} type="button" onClick={() => onNavigate("analysis-mcq-entry")}>
                  <ClipboardCheck size={14} />
                  <span>MCQ Answers</span>
                </button>
                <button className={activeItem === "analysis-structured-entry" ? "is-active" : undefined} type="button" onClick={() => onNavigate("analysis-structured-entry")}>
                  <ClipboardCheck size={14} />
                  <span>Structured Marks</span>
                </button>
                <button className={activeItem === "analysis-student" ? "is-active" : undefined} type="button" onClick={() => onNavigate("analysis-student")}>
                  <Users size={14} />
                  <span>By Student</span>
                </button>
                <button className={activeItem === "analysis-question" ? "is-active" : undefined} type="button" onClick={() => onNavigate("analysis-question")}>
                  <ClipboardCheck size={14} />
                  <span>By Question</span>
                </button>
                <button className={activeItem === "analysis-exam" ? "is-active" : undefined} type="button" onClick={() => onNavigate("analysis-exam")}>
                  <BarChart3 size={14} />
                  <span>By Exam</span>
                </button>
                <button className={activeItem === "analysis-topic" ? "is-active" : undefined} type="button" onClick={() => onNavigate("analysis-topic")}>
                  <SlidersHorizontal size={14} />
                  <span>By Topic</span>
                </button>
                <button className={activeItem === "analysis-tag" ? "is-active" : undefined} type="button" onClick={() => onNavigate("analysis-tag")}>
                  <SlidersHorizontal size={14} />
                  <span>By Tag</span>
                </button>
              </div>
            ) : null}
          </div>

          <div className={clsx("td-nav-section", isSettingsOpen && "is-open")}>
            <button className={activeItem === "settings" || activeItem === "metadata" || activeItem === "structured-metadata" ? "td-nav-section-trigger is-active" : "td-nav-section-trigger"} type="button" onClick={() => setIsSettingsOpen((value) => !value)}>
              <Settings size={18} />
              <span>Settings</span>
              <ChevronDown size={16} />
            </button>
            {isSettingsOpen ? (
              <div className="td-nav-children">
                <button className={activeItem === "settings" ? "is-active" : undefined} type="button" onClick={() => onNavigate("settings")}>
                  <Settings size={14} />
                  <span>Defaults</span>
                </button>
                <button className={activeItem === "metadata" || activeItem === "structured-metadata" ? "is-active" : undefined} type="button" onClick={() => onNavigate("metadata")}>
                  <SlidersHorizontal size={14} />
                  <span>Metadata</span>
                </button>
                <button className={activeItem === "component-gallery" ? "is-active" : undefined} type="button" onClick={() => onNavigate("component-gallery")}>
                  <SlidersHorizontal size={14} />
                  <span>Component Gallery</span>
                </button>
              </div>
            ) : null}
          </div>
        </nav>

        <div className="td-nav-footer">
          <button className={activeItem === "help" ? "is-active" : undefined} type="button" onClick={() => onNavigate("help")}>
            <CircleHelp size={18} />
            <span>Help</span>
          </button>
          <button className={activeItem === "about" ? "is-active" : undefined} type="button" onClick={() => onNavigate("about")}>
            <Info size={18} />
            <span>About</span>
          </button>
          <button type="button" aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setIsCollapsed((value) => !value)}>
            {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            <span>{isCollapsed ? "Expand" : "Collapse"}</span>
          </button>
        </div>
      </aside>

      <section className="td-workspace" ref={workspaceRef}>
        <header className="td-windowbar">
          <h1>{title}</h1>
          <div className="td-windowbar-actions">
            <ThemeToggle value={theme} onChange={onThemeChange} />
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}
