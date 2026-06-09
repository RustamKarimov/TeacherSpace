import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  LineChart,
  Search,
  Tags,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AnalysisOverview, AnalysisStudentRecord } from "../../types";

type ReportProps = {
  overview: AnalysisOverview | null;
};

type StudentReportProps = ReportProps & {
  students: AnalysisStudentRecord[];
};

type Metric = {
  label: string;
  value: string | number;
  detail: string;
  tone?: "good" | "warning" | "danger";
};

type SelectorItem = {
  id: string;
  title: string;
  meta: string;
  detail: string;
  score: number;
};

type PerformanceRow = {
  name: string;
  detail: string;
  attempts: number;
  average: number;
  trend: string;
  tone?: "good" | "warning" | "danger";
};

const sampleStudents: SelectorItem[] = [
  { id: "student-one", title: "Student One", meta: "S001 · 13A", detail: "Last attempt 82%", score: 82 },
  { id: "student-two", title: "Student Two", meta: "S002 · 13A", detail: "Last attempt 61%", score: 61 },
  { id: "student-three", title: "Student Three", meta: "S003 · 12B", detail: "Last attempt 74%", score: 74 }
];

const sampleQuestions: SelectorItem[] = [
  { id: "9702-w25-12-15", title: "9702_w25_qp_12 #15", meta: "MCQ · Paper 1 v2", detail: "Density · 55% correct", score: 55 },
  { id: "9702-m22-22-1", title: "9702_m22_qp_22 #1", meta: "Structured · Paper 2 v2", detail: "Forces · 64% average", score: 64 },
  { id: "9702-w25-11-4", title: "9702_w25_qp_11 #4", meta: "MCQ · Paper 1 v1", detail: "Vectors · 72% correct", score: 72 }
];

const sampleExams: SelectorItem[] = [
  { id: "mcq-practice", title: "AS Physics MCQ Practice", meta: "MCQ · 40 questions", detail: "13A · 22 May", score: 68 },
  { id: "structured-paper-2", title: "Paper 2 Timed Practice", meta: "Structured · 7 questions", detail: "12A · 28 May", score: 61 },
  { id: "mixed-revision", title: "Forces Revision Check", meta: "MCQ · 18 questions", detail: "13B · 2 Jun", score: 76 }
];

const sampleTopics: SelectorItem[] = [
  { id: "forces-density-pressure", title: "Forces, density and pressure", meta: "35 structured · 18 MCQ", detail: "Average 58%", score: 58 },
  { id: "physical-quantities", title: "Physical quantities", meta: "22 structured · 41 MCQ", detail: "Average 74%", score: 74 },
  { id: "dynamics", title: "Dynamics", meta: "31 structured · 12 MCQ", detail: "Average 63%", score: 63 }
];

const sampleTags: SelectorItem[] = [
  { id: "uncertainty", title: "uncertainty", meta: "26 questions", detail: "Average 54%", score: 54 },
  { id: "vectors", title: "vectors", meta: "19 questions", detail: "Average 69%", score: 69 },
  { id: "graph-skills", title: "graph skills", meta: "14 questions", detail: "Average 72%", score: 72 }
];

const topicRows: PerformanceRow[] = [
  { name: "Forces, density and pressure", detail: "Most missed: pressure in liquids", attempts: 126, average: 58, trend: "Needs reteaching", tone: "warning" },
  { name: "Physical quantities", detail: "Strong SI units, weaker uncertainty", attempts: 148, average: 74, trend: "Stable", tone: "good" },
  { name: "Dynamics", detail: "Common issue: resultant force direction", attempts: 92, average: 63, trend: "Improving" },
  { name: "Electric fields", detail: "Low attempt count this term", attempts: 34, average: 51, trend: "Watch", tone: "danger" }
];

const tagRows: PerformanceRow[] = [
  { name: "uncertainty", detail: "Absolute and percentage uncertainty", attempts: 82, average: 54, trend: "Weak", tone: "danger" },
  { name: "graph skills", detail: "Gradient and area interpretation", attempts: 76, average: 72, trend: "Secure", tone: "good" },
  { name: "resultant vector", detail: "Scale diagrams and components", attempts: 44, average: 61, trend: "Mixed", tone: "warning" }
];

const questionRows: PerformanceRow[] = [
  { name: "9702_w25_qp_12 #15", detail: "Mass and volume table · correct C", attempts: 38, average: 47, trend: "Very difficult", tone: "danger" },
  { name: "9702_m22_qp_22 #1", detail: "Forces structured · 8 marks", attempts: 24, average: 58, trend: "Difficult", tone: "warning" },
  { name: "9702_w25_qp_11 #4", detail: "Vector resultant · correct B", attempts: 41, average: 71, trend: "Medium", tone: "good" }
];

const studentExamRows = [
  { exam: "AS Physics MCQ Practice", type: "MCQ", date: "22 May", score: "33 / 40", percent: 83, rank: "4 / 23" },
  { exam: "Paper 2 Timed Practice", type: "Structured", date: "28 May", score: "39 / 60", percent: 65, rank: "11 / 21" },
  { exam: "Forces Revision Check", type: "MCQ", date: "2 Jun", score: "13 / 18", percent: 72, rank: "7 / 19" }
];

export function StudentAnalysisPage({ overview, students }: StudentReportProps) {
  const selectorItems = useMemo(() => {
    if (!students.length) return sampleStudents;
    return students.map((student, index) => ({
      id: student.id,
      title: `${student.firstName} ${student.surname}`,
      meta: `${student.schoolId || "No ID"} · ${student.grade}${student.className}`,
      detail: student.status === "Active" ? "Ready for captured results" : "Archived",
      score: [82, 61, 74, 68][index % 4]
    }));
  }, [students]);
  const [selectedId, setSelectedId] = useState(selectorItems[0]?.id ?? "");
  const selected = selectorItems.find((item) => item.id === selectedId) ?? selectorItems[0];

  return (
    <AnalysisReportShell
      aside={<SelectorPanel items={selectorItems} label="Student" placeholder="Search student, ID, class..." selectedId={selected?.id} onSelect={setSelectedId} />}
      title="Student analysis"
    >
      <SummaryHeader
        icon={<UserRound size={22} />}
        kicker="Student profile"
        title={selected?.title ?? "No student selected"}
        subtitle={selected?.meta ?? "Add students to begin personalised analysis."}
        actions={<Pill tone="good">{overview?.students.active ?? 0} active students</Pill>}
      />
      <MetricGrid metrics={[
        { label: "Current average", value: `${selected?.score ?? 0}%`, detail: "Across captured exams", tone: scoreTone(selected?.score ?? 0) },
        { label: "Completed exams", value: 12, detail: "MCQ and structured" },
        { label: "Best topic", value: "Graphs", detail: "84% average", tone: "good" },
        { label: "Weakest tag", value: "uncertainty", detail: "54% average", tone: "danger" }
      ]} />
      <ReportSection title="Exam history" icon={<ClipboardList size={16} />}>
        <CompactTable
          columns={["Exam", "Type", "Date", "Score", "%", "Rank"]}
          rows={studentExamRows.map((row) => [row.exam, row.type, row.date, row.score, <BarValue key={row.exam} value={row.percent} />, row.rank])}
        />
      </ReportSection>
      <SplitSections
        left={<PerformanceList rows={topicRows.slice(0, 3)} title="Topic performance" />}
        right={<PerformanceList rows={tagRows} title="Tag performance" />}
      />
      <SplitSections
        left={<PerformanceList rows={questionRows} title="Question-level weaknesses" />}
        right={<TrendPanel />}
      />
      <ReportSection title="Teacher notes" icon={<FileText size={16} />}>
        <textarea className="analysis-report-notes" placeholder="Record intervention notes, revision targets, parent meeting notes, or next lesson actions." />
      </ReportSection>
    </AnalysisReportShell>
  );
}

export function QuestionAnalysisPage({ overview }: ReportProps) {
  const [selectedId, setSelectedId] = useState(sampleQuestions[0].id);
  const selected = sampleQuestions.find((item) => item.id === selectedId) ?? sampleQuestions[0];

  return (
    <AnalysisReportShell
      aside={<SelectorPanel items={sampleQuestions} label="Question" placeholder="Search exam code, topic, tag..." selectedId={selected.id} onSelect={setSelectedId} />}
      title="Question analysis"
    >
      <SummaryHeader
        icon={<Target size={22} />}
        kicker="Question profile"
        title={selected.title}
        subtitle={`${selected.meta} · ${selected.detail}`}
        actions={<Pill tone={scoreTone(selected.score)}>{overview?.questions.mcq ?? 0} MCQ saved</Pill>}
      />
      <QuestionPreviewCard />
      <MetricGrid metrics={[
        { label: "Solved correctly", value: `${selected.score}%`, detail: "All recorded attempts", tone: scoreTone(selected.score) },
        { label: "Attempts", value: 38, detail: "9 exams used this question" },
        { label: "Current difficulty", value: selected.score < 55 ? "Difficult" : "Medium", detail: "Auto-updated from results", tone: selected.score < 55 ? "danger" : "warning" },
        { label: "Common distractor", value: "B", detail: "32% of wrong answers" }
      ]} />
      <SplitSections
        left={<DistributionPanel title="MCQ answer distribution" values={[18, 32, 41, 9]} labels={["A", "B", "C", "D"]} />}
        right={<DistributionPanel title="Structured mark distribution" values={[8, 15, 28, 31, 18]} labels={["0-1", "2-3", "4-5", "6-7", "8+"]} />}
      />
      <ReportSection title="Student attempts" icon={<Users size={16} />}>
        <CompactTable
          columns={["Student", "Exam", "Answer / mark", "Result", "Date"]}
          rows={[
            ["Student One", "AS Physics MCQ Practice", "C", "Correct", "22 May"],
            ["Student Two", "AS Physics MCQ Practice", "B", "Incorrect", "22 May"],
            ["Student Three", "Forces Revision Check", "6 / 8", "75%", "2 Jun"]
          ]}
        />
      </ReportSection>
      <SplitSections
        left={<PerformanceList rows={topicRows.slice(0, 2)} title="Topic/tag impact" />}
        right={<UsagePanel />}
      />
    </AnalysisReportShell>
  );
}

export function ExamAnalysisPage({ overview }: ReportProps) {
  const [selectedId, setSelectedId] = useState(sampleExams[0].id);
  const selected = sampleExams.find((item) => item.id === selectedId) ?? sampleExams[0];

  return (
    <AnalysisReportShell
      aside={<SelectorPanel items={sampleExams} label="Exam" placeholder="Search title, paper, class, date..." selectedId={selected.id} onSelect={setSelectedId} />}
      title="Exam analysis"
    >
      <SummaryHeader
        icon={<BarChart3 size={22} />}
        kicker="Exam summary"
        title={selected.title}
        subtitle={`${selected.meta} · ${selected.detail}`}
        actions={<Pill>{overview?.results.mcqAttempts ?? 0} MCQ attempts saved</Pill>}
      />
      <MetricGrid metrics={[
        { label: "Class average", value: `${selected.score}%`, detail: "All submitted students", tone: scoreTone(selected.score) },
        { label: "Highest score", value: "92%", detail: "Student One", tone: "good" },
        { label: "Lowest score", value: "38%", detail: "Needs intervention", tone: "danger" },
        { label: "Completion", value: "21 / 23", detail: "Students captured" }
      ]} />
      <SplitSections
        left={<DistributionPanel title="Score distribution" values={[2, 4, 7, 6, 2]} labels={["0-39", "40-54", "55-69", "70-84", "85+"]} />}
        right={<PerformanceList rows={questionRows} title="Question performance" />}
      />
      <ReportSection title="Student results" icon={<GraduationCap size={16} />}>
        <CompactTable
          columns={["Student", "Class", "Variant", "Score", "Grade band", "Concern"]}
          rows={[
            ["Student One", "13A", "A", "33 / 40", "A", "None"],
            ["Student Two", "13A", "B", "23 / 40", "C", "Uncertainty"],
            ["Student Three", "12B", "A", "29 / 40", "B", "Vectors"]
          ]}
        />
      </ReportSection>
      <SplitSections
        left={<PerformanceList rows={topicRows} title="Topic performance in exam" />}
        right={<PerformanceList rows={tagRows} title="Tag performance in exam" />}
      />
      <SplitSections
        left={<DistributionPanel title="Variant / copy comparison" values={[68, 71]} labels={["A", "B"]} />}
        right={<FilesPanel />}
      />
    </AnalysisReportShell>
  );
}

export function TopicAnalysisPage({ overview }: ReportProps) {
  const topicStats = overview?.topicStats ?? [];
  const selectorItems = useMemo(() => termStatsToSelectorItems(topicStats, sampleTopics), [topicStats]);
  const [selectedId, setSelectedId] = useState(selectorItems[0]?.id ?? "");
  const selected = selectorItems.find((item) => item.id === selectedId) ?? selectorItems[0] ?? sampleTopics[0];
  const selectedStats = topicStats.find((item) => item.id === selected.id);
  const questionCount = (selectedStats?.mcqCount ?? 0) + (selectedStats?.structuredCount ?? 0);
  const average = selectedStats?.successPercent ?? selected.score;
  const hasResults = selectedStats?.successPercent !== null && selectedStats?.successPercent !== undefined;

  return (
    <AnalysisReportShell
      aside={<SelectorPanel items={selectorItems} label="Topic" placeholder="Search topic..." selectedId={selected.id} onSelect={setSelectedId} />}
      title="Topic analysis"
    >
      <SummaryHeader
        icon={<BookOpen size={22} />}
        kicker="Topic summary"
        title={selected.title}
        subtitle={`${selected.meta} · ${selected.detail}`}
        actions={<Pill>{overview?.questions.structured ?? 0} structured saved</Pill>}
      />
      <MetricGrid metrics={[
        { label: "Average", value: hasResults ? `${Math.round(average)}%` : "No results", detail: "All captured attempts", tone: hasResults ? scoreTone(average) : undefined },
        { label: "Questions", value: questionCount, detail: `${selectedStats?.mcqCount ?? 0} MCQ, ${selectedStats?.structuredCount ?? 0} structured` },
        { label: "Used in exams", value: selectedStats?.usedCount ?? 0, detail: `${selectedStats?.unusedCount ?? 0} not used yet` },
        { label: "Attempts", value: selectedStats?.attemptsCount ?? 0, detail: "Across MCQ and structured capture" }
      ]} />
      <SplitSections
        left={<TrendPanel title="Performance trend" />}
        right={<DistributionPanel title="Difficulty mix" values={[12, 20, 37, 24, 7]} labels={["V easy", "Easy", "Med", "Diff", "V diff"]} />}
      />
      <SplitSections
        left={<PerformanceList rows={questionRows} title="Weakest questions" />}
        right={<PerformanceList rows={tagRows} title="Related tags" />}
      />
      <ReportSection title="Student performance" icon={<Users size={16} />}>
        <CompactTable
          columns={["Student", "Class", "Attempts", "Average", "Action"]}
          rows={[
            ["Student Two", "13A", "8", <BarValue key="s2" value={49} />, "Assign revision"],
            ["Student Three", "12B", "5", <BarValue key="s3" value={62} />, "Monitor"],
            ["Student One", "13A", "9", <BarValue key="s1" value={81} />, "Extension"]
          ]}
        />
      </ReportSection>
      <SplitSections
        left={<PerformanceList rows={topicRows.slice(1)} title="Related or similar topics" />}
        right={<ActionPanel kind="topic" />}
      />
    </AnalysisReportShell>
  );
}

export function TagAnalysisPage({ overview }: ReportProps) {
  const tagStats = overview?.tagStats ?? [];
  const selectorItems = useMemo(() => termStatsToSelectorItems(tagStats, sampleTags), [tagStats]);
  const [selectedId, setSelectedId] = useState(selectorItems[0]?.id ?? "");
  const selected = selectorItems.find((item) => item.id === selectedId) ?? selectorItems[0] ?? sampleTags[0];
  const selectedStats = tagStats.find((item) => item.id === selected.id);
  const questionCount = (selectedStats?.mcqCount ?? 0) + (selectedStats?.structuredCount ?? 0);
  const average = selectedStats?.successPercent ?? selected.score;
  const hasResults = selectedStats?.successPercent !== null && selectedStats?.successPercent !== undefined;
  const indexedQuestions = (overview?.questions.mcq ?? 0) + (overview?.questions.structured ?? 0);

  return (
    <AnalysisReportShell
      aside={<SelectorPanel items={selectorItems} label="Tag" placeholder="Search tag..." selectedId={selected.id} onSelect={setSelectedId} />}
      title="Tag analysis"
    >
      <SummaryHeader
        icon={<Tags size={22} />}
        kicker="Tag summary"
        title={selected.title}
        subtitle={`${selected.meta} · ${selected.detail}`}
        actions={<Pill>{indexedQuestions} questions indexed</Pill>}
      />
      <MetricGrid metrics={[
        { label: "Average", value: hasResults ? `${Math.round(average)}%` : "No results", detail: "Across linked questions", tone: hasResults ? scoreTone(average) : undefined },
        { label: "Questions", value: questionCount, detail: `${selectedStats?.mcqCount ?? 0} MCQ, ${selectedStats?.structuredCount ?? 0} structured` },
        { label: "Used in exams", value: selectedStats?.usedCount ?? 0, detail: `${selectedStats?.unusedCount ?? 0} not used yet` },
        { label: "Attempts", value: selectedStats?.attemptsCount ?? 0, detail: "Captured responses and marks" }
      ]} />
      <SplitSections
        left={<TrendPanel title="Performance trend" />}
        right={<DistributionPanel title="Class comparison" values={[49, 63, 72, 58]} labels={["13A", "13B", "12A", "12B"]} />}
      />
      <SplitSections
        left={<PerformanceList rows={questionRows} title="Weakest questions" />}
        right={<PerformanceList rows={topicRows.slice(0, 3)} title="Co-occurring topics" />}
      />
      <ReportSection title="Student performance" icon={<Users size={16} />}>
        <CompactTable
          columns={["Student", "Class", "Attempts", "Average", "Most recent"]}
          rows={[
            ["Student Two", "13A", "6", <BarValue key="tag-s2" value={43} />, "MCQ Practice"],
            ["Student Three", "12B", "4", <BarValue key="tag-s3" value={67} />, "Paper 2 Practice"],
            ["Student One", "13A", "7", <BarValue key="tag-s1" value={78} />, "Forces Check"]
          ]}
        />
      </ReportSection>
      <SplitSections
        left={<PerformanceList rows={tagRows.slice(1)} title="Co-occurring tags" />}
        right={<ActionPanel kind="tag" />}
      />
    </AnalysisReportShell>
  );
}

function AnalysisReportShell({ aside, children, title }: { aside: ReactNode; children: ReactNode; title: string }) {
  return (
    <div className="analysis-report-page">
      <aside className="analysis-report-sidebar">{aside}</aside>
      <main className="analysis-report-main">
        <div className="analysis-report-title-row">
          <h2>{title}</h2>
          <span>Live pages are ready; captured-result persistence will fill these sections with real marks and answers.</span>
        </div>
        {children}
      </main>
    </div>
  );
}

function SelectorPanel({ items, label, placeholder, selectedId, onSelect }: {
  items: SelectorItem[];
  label: string;
  placeholder: string;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = items.filter((item) => `${item.title} ${item.meta} ${item.detail}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="analysis-selector-panel">
      <label className="analysis-field">
        <span>{label} selection</span>
        <div className="analysis-search-field">
          <Search size={14} />
          <input placeholder={placeholder} value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </label>
      <div className="analysis-selector-list">
        {filtered.map((item) => (
          <button className={item.id === selectedId ? "is-active" : undefined} key={item.id} type="button" onClick={() => onSelect(item.id)}>
            <strong>{item.title}</strong>
            <span>{item.meta}</span>
            <small>{item.detail}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function SummaryHeader({ actions, icon, kicker, subtitle, title }: { actions?: ReactNode; icon: ReactNode; kicker: string; subtitle: string; title: string }) {
  return (
    <section className="analysis-report-summary">
      <span className="analysis-report-summary-icon">{icon}</span>
      <div>
        <small>{kicker}</small>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className="analysis-report-summary-actions">{actions}</div>
    </section>
  );
}

function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="analysis-report-metrics">
      {metrics.map((metric) => (
        <div className={`analysis-report-metric ${metric.tone ? `is-${metric.tone}` : ""}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <small>{metric.detail}</small>
        </div>
      ))}
    </div>
  );
}

function ReportSection({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <section className="analysis-report-section">
      <header>
        <h3>{icon}{title}</h3>
      </header>
      {children}
    </section>
  );
}

function SplitSections({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="analysis-report-split">
      {left}
      {right}
    </div>
  );
}

function CompactTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <table className="analysis-report-table">
      <thead>
        <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PerformanceList({ rows, title }: { rows: PerformanceRow[]; title: string }) {
  return (
    <ReportSection icon={<TrendingDown size={16} />} title={title}>
      <div className="analysis-performance-list">
        {rows.map((row) => (
          <div className="analysis-performance-row" key={row.name}>
            <div>
              <strong>{row.name}</strong>
              <small>{row.detail}</small>
            </div>
            <BarValue value={row.average} />
            <Pill tone={row.tone}>{row.trend}</Pill>
          </div>
        ))}
      </div>
    </ReportSection>
  );
}

function DistributionPanel({ labels, title, values }: { labels: string[]; title: string; values: number[] }) {
  return (
    <ReportSection icon={<BarChart3 size={16} />} title={title}>
      <div className="analysis-distribution">
        {values.map((value, index) => (
          <div className="analysis-distribution-row" key={labels[index]}>
            <span>{labels[index]}</span>
            <div><i style={{ width: `${value}%` }} /></div>
            <strong>{value}%</strong>
          </div>
        ))}
      </div>
    </ReportSection>
  );
}

function TrendPanel({ title = "Progress over time" }: { title?: string }) {
  return (
    <ReportSection icon={<LineChart size={16} />} title={title}>
      <div className="analysis-trend-panel">
        <div className="analysis-trend-line">
          {[42, 52, 49, 64, 68, 74, 71].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
        </div>
        <div className="analysis-trend-caption">
          <TrendingUp size={15} />
          <span>Trend is calculated from chronological captured attempts once entries are saved.</span>
        </div>
      </div>
    </ReportSection>
  );
}

function QuestionPreviewCard() {
  return (
    <section className="analysis-question-preview-card">
      <div>
        <strong>Preview</strong>
        <span>Question rendering appears here using the same MCQ/structured renderer.</span>
      </div>
      <div className="analysis-question-paper-mini">
        <b>1</b>
        <p>The mass and volume of an object are varied. Which two changes increase the density?</p>
        <table>
          <tbody>
            <tr><th /><th>mass</th><th>volume</th></tr>
            <tr><th>A</th><td>decrease</td><td>decrease</td></tr>
            <tr><th>B</th><td>decrease</td><td>increase</td></tr>
            <tr><th>C</th><td>increase</td><td>decrease</td></tr>
            <tr><th>D</th><td>increase</td><td>increase</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UsagePanel() {
  return (
    <ReportSection icon={<FileText size={16} />} title="Exam usage">
      <CompactTable
        columns={["Exam", "Class", "Date", "Average"]}
        rows={[
          ["AS Physics MCQ Practice", "13A", "22 May", "58%"],
          ["Forces Revision Check", "12B", "2 Jun", "64%"],
          ["Paper 1 Homework", "13B", "5 Jun", "61%"]
        ]}
      />
    </ReportSection>
  );
}

function FilesPanel() {
  return (
    <ReportSection icon={<FileText size={16} />} title="Files and export">
      <div className="analysis-action-grid">
        <button type="button">Open exam folder</button>
        <button type="button">Export class results</button>
        <button type="button">Export weak questions</button>
      </div>
    </ReportSection>
  );
}

function ActionPanel({ kind }: { kind: "topic" | "tag" }) {
  return (
    <ReportSection icon={<AlertTriangle size={16} />} title="Actions">
      <div className="analysis-action-grid">
        <button type="button">Add selected questions to basket</button>
        <button type="button">Create revision set</button>
        <button type="button">Rename or merge {kind}</button>
      </div>
    </ReportSection>
  );
}

function termStatsToSelectorItems(
  rows: NonNullable<AnalysisOverview["topicStats"]>,
  fallback: SelectorItem[]
): SelectorItem[] {
  if (!rows.length) return fallback;
  return rows.map((row) => {
    const questionCount = row.mcqCount + row.structuredCount;
    return {
      id: row.id,
      title: row.name,
      meta: `${questionCount} questions - ${row.mcqCount} MCQ, ${row.structuredCount} structured`,
      detail: row.successPercent === null
        ? `${row.usedCount} used, ${row.unusedCount} unused`
        : `${Math.round(row.successPercent)}% success - ${row.attemptsCount} attempts`,
      score: row.successPercent ?? 0
    };
  });
}

function BarValue({ value }: { value: number }) {
  return (
    <span className="analysis-bar-value">
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      <b>{value}%</b>
    </span>
  );
}

function Pill({ children, tone }: { children: ReactNode; tone?: "good" | "warning" | "danger" }) {
  return <span className={`analysis-report-pill ${tone ? `is-${tone}` : ""}`}>{children}</span>;
}

function scoreTone(score: number): "good" | "warning" | "danger" {
  if (score >= 72) return "good";
  if (score >= 58) return "warning";
  return "danger";
}
