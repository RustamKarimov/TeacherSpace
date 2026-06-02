import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FolderOpen,
  Loader2,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { teacherDeskApi } from "../../../lib/rendererApi";
import type { AppSettings, StructuredSplitPlan, StructuredSplitResult, StructuredSplitterInput, StructuredValidationIssue, StructuredValidationReport, WorkspaceInfo } from "../../../types";

type Props = {
  settings: AppSettings | null;
  workspace: WorkspaceInfo | null;
};

type RightTab = "validation" | "save-plan" | "metadata";

export function StructuredSplitterPage({ settings, workspace }: Props) {
  const defaultDestination = settings?.defaults.structuredSplitter.destinationFolder || (workspace ? `${workspace.workspaceRoot}\\question_bank\\structured` : "TeacherDesk_Workspace\\question_bank\\structured");
  const defaultSource = settings?.defaults.structuredSplitter.sourceFolder || (workspace ? `${workspace.workspaceRoot}\\source_papers` : "TeacherDesk_Workspace\\source_papers");
  const [input, setInput] = useState<StructuredSplitterInput>({
    manifestPath: "",
    sourceFolder: defaultSource,
    destinationFolder: defaultDestination,
    overwriteExisting: settings?.defaults.structuredSplitter.overwriteExisting ?? true
  });
  const [plan, setPlan] = useState<StructuredSplitPlan | null>(null);
  const [report, setReport] = useState<StructuredValidationReport | null>(null);
  const [result, setResult] = useState<StructuredSplitResult | null>(null);
  const [activeTab, setActiveTab] = useState<RightTab>("validation");
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [progress, setProgress] = useState({ completed: 0, total: 4, label: "Ready" });

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (report?.rows ?? []).filter((row) =>
      !query || `${row.row} ${row.examCode} ${row.questionNumber} ${row.topics.join(" ")} ${row.tags.join(" ")} ${row.status}`.toLowerCase().includes(query)
    );
  }, [report?.rows, search]);

  const sortedIssues = useMemo(() => [...(report?.issues ?? [])].sort(sortIssues), [report?.issues]);
  const blocking = Boolean(report && !report.ok);
  const hasManifest = Boolean(input.manifestPath.trim());
  const canBuildPlan = Boolean(report?.ok && !isWorking);
  const canSplit = Boolean(plan?.ok && !isWorking);
  const progressPercent = Math.round((progress.completed / Math.max(progress.total, 1)) * 100);

  useEffect(() => {
    if (!settings) return;
    setInput((current) => ({
      ...current,
      sourceFolder: current.sourceFolder === "TeacherDesk_Workspace\\source_papers" ? settings.defaults.structuredSplitter.sourceFolder : current.sourceFolder,
      destinationFolder: current.destinationFolder === "TeacherDesk_Workspace\\question_bank\\structured" ? settings.defaults.structuredSplitter.destinationFolder : current.destinationFolder,
      overwriteExisting: settings.defaults.structuredSplitter.overwriteExisting
    }));
  }, [settings]);

  function updateInput(patch: Partial<StructuredSplitterInput>) {
    setInput((current) => ({ ...current, ...patch }));
    setPlan(null);
    setReport(null);
    setResult(null);
    setMessage(null);
  }

  async function chooseManifest() {
    setMessage(null);
    try {
      const selected = await teacherDeskApi.pickManifestFile(input.manifestPath);
      if (selected) {
        updateInput({ manifestPath: selected });
        setProgress({ completed: 1, total: 4, label: "Manifest selected" });
      }
    } catch (error) {
      setMessage(error instanceof Error ? `Manifest picker failed: ${error.message}` : "Manifest picker failed.");
    }
  }

  async function chooseFolder(kind: "sourceFolder" | "destinationFolder") {
    const selected = await teacherDeskApi.pickOutputFolder(input[kind]);
    if (selected) updateInput({ [kind]: selected });
  }

  async function validate() {
    setIsWorking(true);
    setMessage(null);
    setResult(null);
    setProgress({ completed: 1, total: 4, label: "Validating manifest" });
    try {
      const next = await teacherDeskApi.validateStructuredManifest(input);
      setReport(next);
      setActiveTab("validation");
      setProgress({ completed: next.ok ? 2 : 1, total: 4, label: next.ok ? "Validated" : "Validation errors" });
      setMessage(next.ok ? "Validation passed. Build the save plan or split all files." : "Validation found errors. Fix the listed rows before splitting.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Validation failed.");
    } finally {
      setIsWorking(false);
    }
  }

  async function buildPlan() {
    setIsWorking(true);
    setMessage(null);
    setResult(null);
    setProgress({ completed: 2, total: 4, label: "Building save plan" });
    try {
      const next = await teacherDeskApi.planStructuredSplit(input);
      setPlan(next);
      setReport(next.validation);
      setActiveTab("save-plan");
      setProgress({ completed: next.ok ? 3 : 2, total: 4, label: next.ok ? "Save plan ready" : "Plan blocked" });
      setMessage(next.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not build split plan.");
    } finally {
      setIsWorking(false);
    }
  }

  async function splitAll() {
    setIsWorking(true);
    setMessage("Splitting PDFs and saving records to SQLite...");
    setProgress({ completed: 3, total: 4, label: "Splitting and saving" });
    try {
      const next = await teacherDeskApi.splitStructuredBatch(input);
      setResult(next);
      setReport(next.validation);
      setMessage(next.message);
      setActiveTab(next.ok ? "metadata" : "validation");
      setProgress({ completed: next.ok ? 4 : 3, total: 4, label: next.ok ? "Completed" : "Split failed" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Split failed.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="structured-splitter-page">
      <section className="structured-splitter-toolbar">
        <button type="button" onClick={chooseManifest}>
          <FileSpreadsheet size={17} />
          <b>1</b> Select manifest
        </button>
        <button type="button" onClick={validate} disabled={isWorking || !hasManifest}>
          <RefreshCw size={16} />
          <b>2</b> Validate
        </button>
        <button type="button" onClick={buildPlan} disabled={!canBuildPlan}>
          <Database size={16} />
          <b>3</b> Save plan
        </button>
        <button className="is-primary" type="button" onClick={splitAll} disabled={!canSplit || blocking}>
          {isWorking ? <Loader2 className="is-spinning" size={16} /> : <Play size={16} />}
          <b>4</b> Split all and save
        </button>
      </section>

      <div className="structured-splitter-layout">
        <aside className="structured-card structured-inputs">
          <header>
            <strong>Batch inputs</strong>
            <span>Manifest + source folder + destination</span>
          </header>
          <PathField label="Manifest file" value={input.manifestPath} placeholder="Select .xlsx, .xls, or .csv manifest" icon={<FileSpreadsheet size={16} />} onChange={(value) => updateInput({ manifestPath: value })} onBrowse={chooseManifest} />
          <PathField label="Source PDF folder" value={input.sourceFolder} icon={<FolderOpen size={16} />} onChange={(value) => updateInput({ sourceFolder: value })} onBrowse={() => chooseFolder("sourceFolder")} />
          <PathField label="Destination folder" value={input.destinationFolder} icon={<FolderOpen size={16} />} onChange={(value) => updateInput({ destinationFolder: value })} onBrowse={() => chooseFolder("destinationFolder")} />
          <label className="structured-check-row">
            <input checked={input.overwriteExisting} type="checkbox" onChange={(event) => updateInput({ overwriteExisting: event.target.checked })} />
            <span>Replace existing split PDFs after validation</span>
          </label>
          <div className="structured-mini-plan">
            <strong>Required manifest columns</strong>
            <span>exam_code, question_number, qp_start_page, ms_start_page, Mark</span>
            <em>Topics and tags are optional. If present, they are saved into the shared MCQ/Structured metadata tables.</em>
          </div>
        </aside>

        <main className="structured-card structured-table-card">
          <header>
            <div>
              <strong>Manifest rows</strong>
              <span>{report ? `${filteredRows.length} shown from ${report.summary.rows} rows` : "Validate a manifest to see every parsed question"}</span>
            </div>
            <label className="structured-search">
              <Search size={15} />
              <input value={search} placeholder="Search rows, topics, tags..." onChange={(event) => setSearch(event.target.value)} />
            </label>
          </header>

          <div className="structured-summary-grid">
            <Metric label="Rows" value={report?.summary.rows ?? 0} />
            <Metric label="Ready" value={report?.summary.readyRows ?? 0} tone="good" />
            <Metric label="Errors" value={report?.summary.errors ?? 0} tone={report?.summary.errors ? "bad" : "good"} />
            <Metric label="Warnings" value={report?.summary.warnings ?? 0} tone={report?.summary.warnings ? "warn" : "neutral"} />
            <Metric label="Topics" value={report?.summary.topicsFound ?? 0} />
            <Metric label="Tags" value={report?.summary.tagsFound ?? 0} />
          </div>

          <div className="structured-manifest-table-wrap">
            <table className="structured-manifest-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Exam code</th>
                  <th>Q</th>
                  <th>QP pages</th>
                  <th>MS pages</th>
                  <th>Marks</th>
                  <th>Topics</th>
                  <th>Tags</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={`${row.row}-${row.examCode}-${row.questionNumber}`} className={`is-${row.status}`}>
                    <td>{row.row}</td>
                    <td>{row.examCode || "-"}</td>
                    <td>{row.questionNumber ?? "-"}</td>
                    <td>{formatRange(row.qpStartRaw, row.qpPageEnd)}</td>
                    <td>{formatRange(row.msStartRaw, row.msPageEnd)}</td>
                    <td>{row.marks ?? "-"}</td>
                    <td>{row.topics.length ? row.topics.join(", ") : "Optional"}</td>
                    <td>{row.tags.length ? row.tags.join(", ") : "Optional"}</td>
                    <td><RowStatus status={row.status} /></td>
                  </tr>
                ))}
                {!report ? (
                  <tr>
                    <td className="structured-empty" colSpan={9}>Select a manifest and validate the batch.</td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td className="structured-empty" colSpan={9}>No rows match the current search.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </main>

        <aside className="structured-card structured-side-panel">
          <div className="structured-tabs">
            <button className={activeTab === "validation" ? "is-active" : undefined} type="button" onClick={() => setActiveTab("validation")}>Validation</button>
            <button className={activeTab === "save-plan" ? "is-active" : undefined} type="button" onClick={() => setActiveTab("save-plan")}>Save plan</button>
            <button className={activeTab === "metadata" ? "is-active" : undefined} type="button" onClick={() => setActiveTab("metadata")}>Metadata</button>
          </div>

          {activeTab === "validation" ? (
            <ValidationPanel issues={sortedIssues} report={report} />
          ) : activeTab === "save-plan" ? (
            <SavePlanPanel plan={plan} input={input} />
          ) : (
            <MetadataPanel report={report} result={result} />
          )}
        </aside>
      </div>

      <footer className="structured-process-bar">
        <div className="structured-process-main">
          <span>
            {isWorking ? <Loader2 className="is-spinning" size={15} /> : result?.ok ? <CheckCircle2 size={15} /> : <ShieldCheck size={15} />}
            <span>{message ?? "Ready. Start with Step 1: select the manifest."}</span>
          </span>
          <div className="structured-progress-line" aria-label={`${progress.completed} of ${progress.total} steps complete`}>
            <i style={{ width: `${progressPercent}%` }} />
          </div>
          <em>{progress.label} - {progress.completed}/{progress.total} ({progressPercent}%)</em>
        </div>
        {result?.ok ? <button type="button" onClick={() => teacherDeskApi.openFolder(result.summary.destinationFolder)}>Open destination folder</button> : null}
      </footer>
    </div>
  );
}

function PathField({ label, value, placeholder, icon, onChange, onBrowse }: { label: string; value: string; placeholder?: string; icon: React.ReactNode; onChange: (value: string) => void; onBrowse: () => void }) {
  return (
    <label className="structured-path-field">
      <span>{label}</span>
      <div>
        {icon}
        <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        <button type="button" onClick={onBrowse}>Choose</button>
      </div>
    </label>
  );
}

function ValidationPanel({ report, issues }: { report: StructuredValidationReport | null; issues: StructuredValidationIssue[] }) {
  if (!report) return <EmptyPanel icon={<TriangleAlert size={28} />} title="No validation yet" text="Choose a manifest and source folder, then validate the batch." />;
  return (
    <div className="structured-panel-body">
      <div className={clsx("structured-callout", report.ok ? "is-success" : "is-error")}>
        {report.ok ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
        <div>
          <strong>{report.ok ? "Validation passed" : "Validation needs attention"}</strong>
          <p>{report.ok ? "All blocking checks passed. Warnings are saved as review flags." : "Fix error rows before splitting files or saving records."}</p>
        </div>
      </div>
      <div className="structured-issue-list">
        {issues.length ? issues.map((item, index) => (
          <article className={`structured-issue is-${item.severity}`} key={`${item.row}-${item.field}-${index}`}>
            <header>
              <strong>{item.severity}</strong>
              <span>Row {item.row ?? "-"} - {item.field ?? "batch"}</span>
            </header>
            <p>{item.message}</p>
            {item.suggestion ? <em>{item.suggestion}</em> : null}
          </article>
        )) : <EmptyPanel icon={<CheckCircle2 size={26} />} title="No issues found" text="The manifest has no errors or warnings." />}
      </div>
    </div>
  );
}

function SavePlanPanel({ plan, input }: { plan: StructuredSplitPlan | null; input: StructuredSplitterInput }) {
  if (!plan) return <EmptyPanel icon={<Database size={28} />} title="No save plan yet" text="Build the save plan to preview SQLite records and split output paths." />;
  return (
    <div className="structured-panel-body">
      <div className="structured-summary-grid is-side">
        <Metric label="Records" value={plan.summary.records} />
        <Metric label="Create" value={plan.summary.questionsToCreate} tone="good" />
        <Metric label="Update" value={plan.summary.questionsToUpdate} tone="warn" />
        <Metric label="PDF files" value={plan.summary.filesTotal} />
      </div>
      <div className="structured-mini-plan">
        <strong>SQLite transaction</strong>
        <span>TeacherDesk saves the import batch, structured questions, split paths, topics, and tags together.</span>
        <em>Destination: {input.destinationFolder}</em>
      </div>
      <div className="structured-plan-list">
        {plan.items.slice(0, 12).map((item) => (
          <article key={`${item.examCode}-${item.questionNumber}`}>
            <strong>{item.examCode} Q{item.questionNumber}</strong>
            <span>{item.action === "create" ? "Create record" : "Update record"} - {item.reviewRequired ? "review required" : "clean"}</span>
          </article>
        ))}
        {plan.items.length > 12 ? <small>{plan.items.length - 12} more planned records.</small> : null}
      </div>
    </div>
  );
}

function MetadataPanel({ report, result }: { report: StructuredValidationReport | null; result: StructuredSplitResult | null }) {
  return (
    <div className="structured-panel-body">
      <div className="structured-summary-grid is-side">
        <Metric label="Topics" value={report?.summary.topicsFound ?? 0} />
        <Metric label="Tags" value={report?.summary.tagsFound ?? 0} />
        <Metric label="Similar" value={report?.similarMetadata.length ?? 0} tone={report?.similarMetadata.length ? "warn" : "neutral"} />
        <Metric label="Review" value={report?.summary.reviewRequiredItems ?? 0} tone={report?.summary.reviewRequiredItems ? "warn" : "neutral"} />
      </div>
      {result ? (
        <div className="structured-callout is-success">
          <CheckCircle2 size={17} />
          <div>
            <strong>Saved to Question Bank</strong>
            <p>{result.summary.createdQuestions} created, {result.summary.updatedQuestions} updated.</p>
          </div>
        </div>
      ) : null}
      <div className="structured-plan-list">
        {(report?.similarMetadata ?? []).map((item) => (
          <article key={`${item.kind}-${item.incoming}-${item.existing}`}>
            <strong>{item.incoming}</strong>
            <span>{item.score}% similar to existing {item.kind}: {item.existing}. Rows {item.rows.join(", ")}.</span>
          </article>
        ))}
        {!report?.similarMetadata.length ? <EmptyPanel icon={<CheckCircle2 size={26} />} title="No similar metadata" text="No topic or tag names look close enough to require review." /> : null}
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "good" | "warn" | "bad" }) {
  return <div className={`structured-metric is-${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function RowStatus({ status }: { status: "ready" | "warning" | "error" }) {
  return <span className={`structured-row-status is-${status}`}>{status === "ready" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}{status}</span>;
}

function EmptyPanel({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="structured-empty-panel">{icon}<strong>{title}</strong><span>{text}</span></div>;
}

function formatRange(start: string, end: number | null) {
  return end ? `${start}-${end}` : start || "-";
}

function sortIssues(a: StructuredValidationIssue, b: StructuredValidationIssue) {
  const rank = { error: 0, warning: 1, info: 2 };
  return rank[a.severity] - rank[b.severity] || (a.row ?? 999999) - (b.row ?? 999999);
}
