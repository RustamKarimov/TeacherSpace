import { BarChart3, CheckCircle2, ClipboardCheck, Plus, Save, Search, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { teacherDeskApi } from "../../lib/rendererApi";
import type { AnalysisOverview, AnalysisStudentRecord, AnalysisStudentSavePayload, AppSettings } from "../../types";

type AnalysisMode = "overview" | "students" | "mcq-entry" | "structured-entry";
type ExamType = "mcq" | "structured";

type Props = {
  mode: AnalysisMode;
  settings: AppSettings | null;
};

type ExamCandidate = {
  id: string;
  type: ExamType;
  title: string;
  detail: string;
  questionCount: number;
  variants: string[];
};

const blankStudent: AnalysisStudentSavePayload = {
  schoolId: "",
  firstName: "",
  surname: "",
  academicYear: "2025-2026",
  grade: "",
  className: "",
  status: "Active",
  notes: ""
};

export function AnalysisPage({ mode, settings }: Props) {
  const [overview, setOverview] = useState<AnalysisOverview | null>(null);
  const [students, setStudents] = useState<AnalysisStudentRecord[]>([]);
  const [draft, setDraft] = useState<AnalysisStudentSavePayload>(blankStudent);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!settings) return;
    setDraft((current) => ({
      ...current,
      academicYear: current.academicYear || settings.defaults.analysis.defaultAcademicYear,
      grade: current.grade || settings.defaults.analysis.defaultGrade,
      className: current.className || settings.defaults.analysis.defaultClassName
    }));
  }, [settings]);

  const activeStudents = useMemo(() => students.filter((student) => student.status === "Active"), [students]);
  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? null;
  const gradeSuggestions = useMemo(() => unique(students.map((student) => student.grade).filter(Boolean)), [students]);
  const classSuggestions = useMemo(() => unique(students.map((student) => student.className).filter(Boolean)), [students]);

  async function load() {
    const [nextOverview, nextStudents] = await Promise.all([
      teacherDeskApi.getAnalysisOverview(),
      teacherDeskApi.listAnalysisStudents()
    ]);
    setOverview(nextOverview);
    setStudents(nextStudents);
  }

  async function saveStudent() {
    if (!draft.firstName.trim() || !draft.surname.trim()) {
      setMessage("Student name and surname are required.");
      return;
    }
    const saved = await teacherDeskApi.saveAnalysisStudent(draft);
    setSelectedStudentId(saved.id);
    setMessage(`Saved ${saved.firstName} ${saved.surname}.`);
    setDraft({ ...blankStudent, academicYear: draft.academicYear, grade: draft.grade, className: draft.className });
    await load();
  }

  async function removeStudent(id: string) {
    const student = students.find((item) => item.id === id);
    if (!student || !window.confirm(`Delete ${student.firstName} ${student.surname}? Existing analysis attempts will also be removed.`)) return;
    await teacherDeskApi.deleteAnalysisStudent(id);
    if (selectedStudentId === id) setSelectedStudentId(null);
    setMessage("Student deleted.");
    await load();
  }

  function editStudent(student: AnalysisStudentRecord) {
    setSelectedStudentId(student.id);
    setDraft({
      id: student.id,
      schoolId: student.schoolId,
      firstName: student.firstName,
      surname: student.surname,
      academicYear: student.academicYear,
      grade: student.grade,
      className: student.className,
      status: student.status,
      notes: student.notes
    });
  }

  return (
    <div className="analysis-page">
      <header className="analysis-header">
        <div>
          <h2>{modeTitle(mode)}</h2>
        </div>
        <div className="analysis-header-actions">
          <button type="button" onClick={() => void load()}><BarChart3 size={15} /> Refresh</button>
        </div>
      </header>

      {mode === "overview" ? <OverviewPanel overview={overview} /> : null}
      {mode === "students" ? (
        <StudentsPanel
          classSuggestions={classSuggestions}
          draft={draft}
          gradeSuggestions={gradeSuggestions}
          selectedStudent={selectedStudent}
          students={students}
          onDraftChange={setDraft}
          onEditStudent={editStudent}
          onRemoveStudent={(id) => void removeStudent(id)}
          onSaveStudent={() => void saveStudent()}
        />
      ) : null}
      {mode === "mcq-entry" ? <CapturePanel examType="mcq" settings={settings} students={activeStudents} /> : null}
      {mode === "structured-entry" ? <CapturePanel examType="structured" settings={settings} students={activeStudents} /> : null}

      {message ? <div className="analysis-toast">{message}</div> : null}
    </div>
  );
}

function OverviewPanel({ overview }: { overview: AnalysisOverview | null }) {
  const cards = [
    { label: "Active students", value: overview?.students.active ?? 0, detail: `${overview?.students.classes ?? 0} classes`, icon: <Users size={17} /> },
    { label: "MCQ questions", value: overview?.questions.mcq ?? 0, detail: `${overview?.results.mcqAttempts ?? 0} marked attempts`, icon: <ClipboardCheck size={17} /> },
    { label: "Structured questions", value: overview?.questions.structured ?? 0, detail: `${overview?.results.structuredAttempts ?? 0} marked attempts`, icon: <CheckCircle2 size={17} /> },
    { label: "Archived students", value: overview?.students.archived ?? 0, detail: "Kept for history", icon: <Users size={17} /> }
  ];

  return (
    <div className="analysis-overview-grid">
      {cards.map((card) => (
        <section className="analysis-stat-card" key={card.label}>
          <span>{card.icon}</span>
          <div>
            <strong>{card.value}</strong>
            <p>{card.label}</p>
            <small>{card.detail}</small>
          </div>
        </section>
      ))}
      <section className="analysis-wide-card">
        <h3>Next workflow</h3>
        <div className="analysis-workflow">
          <span>1. Add students</span>
          <span>2. Select generated exam</span>
          <span>3. Capture answers or marks</span>
          <span>4. Recalculate difficulty and topic performance</span>
        </div>
      </section>
    </div>
  );
}

function StudentsPanel({
  classSuggestions,
  draft,
  gradeSuggestions,
  selectedStudent,
  students,
  onDraftChange,
  onEditStudent,
  onRemoveStudent,
  onSaveStudent
}: {
  classSuggestions: string[];
  draft: AnalysisStudentSavePayload;
  gradeSuggestions: string[];
  selectedStudent: AnalysisStudentRecord | null;
  students: AnalysisStudentRecord[];
  onDraftChange: (draft: AnalysisStudentSavePayload) => void;
  onEditStudent: (student: AnalysisStudentRecord) => void;
  onRemoveStudent: (id: string) => void;
  onSaveStudent: () => void;
}) {
  return (
    <div className="analysis-two-column">
      <section className="analysis-panel">
        <header>
          <h3>{selectedStudent ? "Edit student" : "Add student"}</h3>
          <button type="button" onClick={() => onDraftChange(blankStudent)}><Plus size={14} /> New</button>
        </header>
        <div className="analysis-form-grid">
          <Field label="School ID" value={draft.schoolId} onChange={(schoolId) => onDraftChange({ ...draft, schoolId })} />
          <Field label="Academic year" value={draft.academicYear} onChange={(academicYear) => onDraftChange({ ...draft, academicYear })} />
          <Field label="Name" value={draft.firstName} onChange={(firstName) => onDraftChange({ ...draft, firstName })} />
          <Field label="Surname" value={draft.surname} onChange={(surname) => onDraftChange({ ...draft, surname })} />
          <SuggestField label="Grade" suggestions={gradeSuggestions} value={draft.grade} onChange={(grade) => onDraftChange({ ...draft, grade })} />
          <SuggestField label="Class" suggestions={classSuggestions} value={draft.className} onChange={(className) => onDraftChange({ ...draft, className })} />
          <label className="analysis-field">
            <span>Status</span>
            <select value={draft.status} onChange={(event) => onDraftChange({ ...draft, status: event.target.value === "Archived" ? "Archived" : "Active" })}>
              <option>Active</option>
              <option>Archived</option>
            </select>
          </label>
          <label className="analysis-field analysis-field-wide">
            <span>Notes</span>
            <textarea value={draft.notes} onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })} />
          </label>
        </div>
        <button className="analysis-primary-button" type="button" onClick={onSaveStudent}><Save size={15} /> Save student</button>
      </section>

      <section className="analysis-panel analysis-table-panel">
        <header>
          <h3>Students</h3>
          <span>{students.length} records</span>
        </header>
        <table className="analysis-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Year</th>
              <th>Class</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} onClick={() => onEditStudent(student)}>
                <td><strong>{student.firstName} {student.surname}</strong><small>{student.schoolId || "No school ID"}</small></td>
                <td>{student.academicYear}</td>
                <td>{student.grade} {student.className}</td>
                <td>{student.status}</td>
                <td><button aria-label="Delete student" type="button" onClick={(event) => { event.stopPropagation(); onRemoveStudent(student.id); }}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function CapturePanel({ examType, settings, students }: { examType: ExamType; settings: AppSettings | null; students: AnalysisStudentRecord[] }) {
  const candidates = useMemo(() => buildExamCandidates(settings), [settings]);
  const filteredCandidates = candidates.filter((exam) => exam.type === examType);
  const [selectedExamId, setSelectedExamId] = useState(filteredCandidates[0]?.id ?? "");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [examSearch, setExamSearch] = useState("");
  const selectedExam = filteredCandidates.find((exam) => exam.id === selectedExamId) ?? filteredCandidates[0] ?? candidates[0];
  const classOptions = useMemo(() => unique(students.map(classGroupLabel).filter(Boolean)), [students]);
  const roster = useMemo(() => {
    if (selectedClasses.length === 0) return students;
    return students.filter((student) => selectedClasses.includes(classGroupLabel(student)));
  }, [selectedClasses, students]);
  const questionCount = selectedExam?.questionCount ?? (examType === "mcq" ? settings?.defaults.mcqGenerator.questionCount ?? 40 : 5);
  const questions = Array.from({ length: questionCount }, (_, index) => `Q${index + 1}`);
  const questionsPerRow = Math.max(6, Math.min(30, settings?.defaults.analysis.questionsPerAnswerRow ?? 20));
  const copy = examType === "mcq"
    ? "Select each student's variant, then enter A/B/C/D answers. Cells advance automatically after typing."
    : "Select each student's copy/variant, then enter marks per structured question. Use arrow keys, Tab, or Enter to move through the sheet.";

  useEffect(() => {
    if (!filteredCandidates.some((exam) => exam.id === selectedExamId)) {
      setSelectedExamId(filteredCandidates[0]?.id ?? "");
    }
  }, [examType, filteredCandidates, selectedExamId]);

  return (
    <section className="analysis-panel analysis-entry-panel">
      <div className="analysis-capture-toolbar">
        <ExamPicker
          candidates={filteredCandidates}
          examType={examType}
          search={examSearch}
          selectedExamId={selectedExam?.id ?? ""}
          onSearchChange={setExamSearch}
          onSelectExam={setSelectedExamId}
        />
        <ClassMultiSelect options={classOptions} selected={selectedClasses} onChange={setSelectedClasses} />
      </div>
      <p className="analysis-entry-copy">{copy}</p>
      <ResultGrid
        columns={questions}
        exam={selectedExam}
        mode={examType}
        questionsPerRow={questionsPerRow}
        students={roster}
      />
    </section>
  );
}

function ExamPicker({ candidates, examType, search, selectedExamId, onSearchChange, onSelectExam }: {
  candidates: ExamCandidate[];
  examType: ExamType;
  search: string;
  selectedExamId: string;
  onSearchChange: (value: string) => void;
  onSelectExam: (id: string) => void;
}) {
  const filtered = candidates.filter((candidate) => `${candidate.title} ${candidate.detail}`.toLowerCase().includes(search.toLowerCase())).slice(0, 6);
  return (
    <div className="analysis-exam-picker">
      <label className="analysis-field">
        <span>{examType === "mcq" ? "MCQ exam" : "Structured exam"}</span>
        <div className="analysis-search-field">
          <Search size={14} />
          <input placeholder="Search title, paper, date..." value={search} onChange={(event) => onSearchChange(event.target.value)} />
        </div>
      </label>
      <div className="analysis-exam-card-list">
        {filtered.map((candidate) => (
          <button className={candidate.id === selectedExamId ? "is-active" : undefined} key={candidate.id} type="button" onClick={() => onSelectExam(candidate.id)}>
            <strong>{candidate.title}</strong>
            <span>{candidate.detail}</span>
            <em>{candidate.questionCount} questions</em>
          </button>
        ))}
      </div>
    </div>
  );
}

function ClassMultiSelect({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (value: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const label = selected.length === 0 ? "All classes" : selected.join(", ");
  return (
    <div className="analysis-class-picker">
      <span>Classes</span>
      <button type="button" onClick={() => setOpen((value) => !value)}>{label}</button>
      {open ? (
        <div className="analysis-class-menu">
          <button type="button" onClick={() => onChange([])}>All</button>
          {options.map((option) => (
            <label key={option}>
              <input
                checked={selected.includes(option)}
                type="checkbox"
                onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))}
              />
              {option}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ResultGrid({ columns, exam, mode, questionsPerRow, students }: { columns: string[]; exam?: ExamCandidate; mode: ExamType; questionsPerRow: number; students: AnalysisStudentRecord[] }) {
  const tableRef = useRef<HTMLTableElement | null>(null);
  const visibleStudents = students.length ? students : [
    { id: "placeholder-1", firstName: "Student", surname: "One", schoolId: "S001", academicYear: "", grade: "12", className: "A", status: "Active", notes: "", createdAt: "", updatedAt: "" },
    { id: "placeholder-2", firstName: "Student", surname: "Two", schoolId: "S002", academicYear: "", grade: "12", className: "A", status: "Active", notes: "", createdAt: "", updatedAt: "" }
  ] satisfies AnalysisStudentRecord[];
  const columnBands = chunkBalanced(columns, questionsPerRow);
  const bandWidth = Math.max(...columnBands.map((band) => band.length), 1);

  function focusCell(studentIndex: number, questionIndex: number) {
    const input = tableRef.current?.querySelector<HTMLInputElement>(`[data-analysis-cell="${studentIndex}:${questionIndex}"]`);
    input?.focus();
    input?.select();
  }

  function handleCellKeyDown(event: KeyboardEvent<HTMLInputElement>, studentIndex: number, questionIndex: number) {
    if (event.key === "ArrowRight" || event.key === "Tab" || event.key === "Enter") {
      event.preventDefault();
      focusCell(studentIndex, Math.min(columns.length - 1, questionIndex + 1));
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusCell(studentIndex, Math.max(0, questionIndex - 1));
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusCell(Math.min(visibleStudents.length - 1, studentIndex + 1), questionIndex);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusCell(Math.max(0, studentIndex - 1), questionIndex);
    }
  }

  return (
    <div className="analysis-result-grid-wrap">
      <table className="analysis-result-grid is-banded" ref={tableRef}>
        <thead>
          <tr>
            <th>Student</th>
            <th>{mode === "mcq" ? "Variant" : "Copy"}</th>
            <th>Set</th>
            <th colSpan={bandWidth}>Questions</th>
            <th>Total</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {visibleStudents.map((student, studentIndex) => (
            columnBands.map((band, bandIndex) => (
              <tr key={`${student.id}-${bandIndex}`}>
                {bandIndex === 0 ? (
                  <td className="analysis-student-cell" rowSpan={columnBands.length}>
                    <strong>{student.firstName} {student.surname}</strong>
                    <small>{student.schoolId || `${student.grade} ${student.className}`}</small>
                  </td>
                ) : null}
                {bandIndex === 0 ? (
                  <td className="analysis-variant-cell" rowSpan={columnBands.length}>
                    <select defaultValue={exam?.variants[0] ?? (mode === "mcq" ? "A" : "QP")}>
                      {(exam?.variants.length ? exam.variants : [mode === "mcq" ? "A" : "QP"]).map((variant) => <option key={variant}>{variant}</option>)}
                    </select>
                  </td>
                ) : null}
                <td className="analysis-band-cell">{bandIndex + 1}</td>
                {Array.from({ length: bandWidth }, (_, cellIndex) => {
                  const column = band[cellIndex];
                  const questionIndex = columns.indexOf(column);
                  return (
                    <td key={`${student.id}-${column ?? cellIndex}`}>
                      {column ? (
                        <label className="analysis-answer-cell-wrap">
                          <span>{column}</span>
                          <input
                            aria-label={`${student.firstName} ${student.surname} ${column}`}
                            className={mode === "mcq" ? "analysis-mcq-answer-cell" : "analysis-mark-cell"}
                            data-analysis-cell={`${studentIndex}:${questionIndex}`}
                            inputMode={mode === "mcq" ? "text" : "decimal"}
                            maxLength={mode === "mcq" ? 1 : undefined}
                            min={mode === "structured" ? 0 : undefined}
                            type={mode === "structured" ? "number" : "text"}
                            onChange={(event) => {
                              if (mode === "mcq") {
                                const value = event.target.value.toUpperCase().replace(/[^ABCD]/g, "");
                                event.target.value = value;
                                if (value && questionIndex < columns.length - 1) focusCell(studentIndex, questionIndex + 1);
                              }
                            }}
                            onFocus={(event) => event.currentTarget.select()}
                            onKeyDown={(event) => handleCellKeyDown(event, studentIndex, questionIndex)}
                          />
                        </label>
                      ) : null}
                    </td>
                  );
                })}
                {bandIndex === 0 ? <td rowSpan={columnBands.length}>--</td> : null}
                {bandIndex === 0 ? <td rowSpan={columnBands.length}>--</td> : null}
              </tr>
            ))
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="analysis-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SuggestField({ label, suggestions, value, onChange }: { label: string; suggestions: string[]; value: string; onChange: (value: string) => void }) {
  const id = `analysis-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <label className="analysis-field">
      <span>{label}</span>
      <input list={id} value={value} onChange={(event) => onChange(event.target.value)} />
      <datalist id={id}>
        {suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
      </datalist>
    </label>
  );
}

function buildExamCandidates(settings: AppSettings | null): ExamCandidate[] {
  return [
    {
      id: "mcq-latest",
      type: "mcq",
      title: settings?.defaults.mcqGenerator.title || "AS Physics MCQ Practice",
      detail: "Latest generated MCQ package",
      questionCount: settings?.defaults.mcqGenerator.questionCount ?? 40,
      variants: Array.from({ length: Math.max(1, settings?.defaults.mcqGenerator.variants ?? 1) }, (_, index) => String.fromCharCode(65 + index))
    },
    {
      id: "mcq-paper-1",
      type: "mcq",
      title: "Paper 1 classroom practice",
      detail: "Generated from MCQ question bank",
      questionCount: 40,
      variants: ["A", "B"]
    },
    {
      id: "structured-latest",
      type: "structured",
      title: settings?.defaults.structuredGenerator.title || "Structured Physics Practice",
      detail: "Latest structured exam package",
      questionCount: 5,
      variants: ["A", "B"]
    },
    {
      id: "structured-paper-2",
      type: "structured",
      title: "Paper 2 timed practice",
      detail: "Structured question set",
      questionCount: 7,
      variants: ["A", "B"]
    }
  ];
}

function chunkBalanced<T>(items: T[], maxPerRow: number): T[][] {
  const rowCount = Math.max(1, Math.ceil(items.length / maxPerRow));
  const perRow = Math.ceil(items.length / rowCount);
  return Array.from({ length: rowCount }, (_, index) => items.slice(index * perRow, (index + 1) * perRow));
}

function classGroupLabel(student: Pick<AnalysisStudentRecord, "grade" | "className">) {
  return `${student.grade}${student.className}`.trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function modeTitle(mode: AnalysisMode) {
  if (mode === "students") return "Students";
  if (mode === "mcq-entry") return "MCQ answer capture";
  if (mode === "structured-entry") return "Structured mark capture";
  return "Overview";
}
