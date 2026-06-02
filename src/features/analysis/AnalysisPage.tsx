import { BarChart3, CheckCircle2, ClipboardCheck, Plus, Save, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { teacherDeskApi } from "../../lib/rendererApi";
import type { AnalysisOverview, AnalysisStudentRecord, AnalysisStudentSavePayload, AppSettings } from "../../types";

type AnalysisMode = "overview" | "students" | "mcq-entry" | "structured-entry";

type Props = {
  mode: AnalysisMode;
  settings: AppSettings | null;
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
          <span>Analysis</span>
          <h2>{modeTitle(mode)}</h2>
        </div>
        <div className="analysis-header-actions">
          <button type="button" onClick={() => void load()}><BarChart3 size={15} /> Refresh</button>
        </div>
      </header>

      {mode === "overview" ? <OverviewPanel overview={overview} /> : null}
      {mode === "students" ? (
        <StudentsPanel
          draft={draft}
          students={students}
          selectedStudent={selectedStudent}
          onDraftChange={setDraft}
          onEditStudent={editStudent}
          onRemoveStudent={(id) => void removeStudent(id)}
          onSaveStudent={() => void saveStudent()}
        />
      ) : null}
      {mode === "mcq-entry" ? <McqEntryPanel students={activeStudents} /> : null}
      {mode === "structured-entry" ? <StructuredEntryPanel students={activeStudents} /> : null}

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
  draft,
  students,
  selectedStudent,
  onDraftChange,
  onEditStudent,
  onRemoveStudent,
  onSaveStudent
}: {
  draft: AnalysisStudentSavePayload;
  students: AnalysisStudentRecord[];
  selectedStudent: AnalysisStudentRecord | null;
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
          <Field label="Grade" value={draft.grade} onChange={(grade) => onDraftChange({ ...draft, grade })} />
          <Field label="Class" value={draft.className} onChange={(className) => onDraftChange({ ...draft, className })} />
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

function McqEntryPanel({ students }: { students: AnalysisStudentRecord[] }) {
  const questions = Array.from({ length: 40 }, (_, index) => `Q${index + 1}`);
  return (
    <section className="analysis-panel analysis-entry-panel">
      <EntryHeader copy="Capture A/B/C/D answers against a generated MCQ variant. Auto-marking will use the saved variant answer key snapshot." />
      <ResultGrid students={students} columns={questions} mode="mcq" />
    </section>
  );
}

function StructuredEntryPanel({ students }: { students: AnalysisStudentRecord[] }) {
  const questions = ["Q1 /8", "Q2 /7", "Q3 /10", "Q4 /6", "Q5 /9"];
  return (
    <section className="analysis-panel analysis-entry-panel">
      <EntryHeader copy="Capture marks per structured question. Each cell validates against the question maximum before saving attempts." />
      <ResultGrid students={students} columns={questions} mode="structured" />
    </section>
  );
}

function EntryHeader({ copy }: { copy: string }) {
  return (
    <header className="analysis-entry-header">
      <div className="analysis-entry-controls">
        <Field label="Exam" value="Select generated exam" onChange={() => undefined} />
        <Field label="Variant / copy" value="A" onChange={() => undefined} />
        <Field label="Class" value="12A" onChange={() => undefined} />
      </div>
      <p>{copy}</p>
    </header>
  );
}

function ResultGrid({ students, columns, mode }: { students: AnalysisStudentRecord[]; columns: string[]; mode: "mcq" | "structured" }) {
  const visibleStudents = students.length ? students : [
    { id: "placeholder-1", firstName: "Student", surname: "One", schoolId: "S001", academicYear: "", grade: "12", className: "A", status: "Active", notes: "", createdAt: "", updatedAt: "" },
    { id: "placeholder-2", firstName: "Student", surname: "Two", schoolId: "S002", academicYear: "", grade: "12", className: "A", status: "Active", notes: "", createdAt: "", updatedAt: "" }
  ] satisfies AnalysisStudentRecord[];

  function focusCell(rowIndex: number, columnIndex: number) {
    const input = document.querySelector<HTMLInputElement>(`[data-analysis-cell="${rowIndex}:${columnIndex}"]`);
    input?.focus();
    input?.select();
  }

  function handleMcqCellKeyDown(event: KeyboardEvent<HTMLInputElement>, rowIndex: number, columnIndex: number) {
    if (event.key === "ArrowRight" || event.key === "Tab" || event.key === "Enter") {
      event.preventDefault();
      focusCell(rowIndex, Math.min(columns.length - 1, columnIndex + 1));
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusCell(rowIndex, Math.max(0, columnIndex - 1));
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusCell(Math.min(visibleStudents.length - 1, rowIndex + 1), columnIndex);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusCell(Math.max(0, rowIndex - 1), columnIndex);
    }
  }

  return (
    <div className="analysis-result-grid-wrap">
      <table className="analysis-result-grid">
        <thead>
          <tr>
            <th>Student</th>
            {columns.map((column) => <th key={column}>{column}</th>)}
            <th>Total</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {visibleStudents.map((student, rowIndex) => (
            <tr key={student.id}>
              <td><strong>{student.firstName} {student.surname}</strong><small>{student.schoolId}</small></td>
              {columns.map((column, index) => (
                <td key={column}>
                  {mode === "mcq" ? (
                    <input
                      aria-label={`${student.firstName} ${student.surname} ${column}`}
                      className="analysis-mcq-answer-cell"
                      data-analysis-cell={`${rowIndex}:${index}`}
                      inputMode="text"
                      maxLength={1}
                      onChange={(event) => {
                        const value = event.target.value.toUpperCase().replace(/[^ABCD]/g, "");
                        event.target.value = value;
                        if (value && index < columns.length - 1) focusCell(rowIndex, index + 1);
                      }}
                      onFocus={(event) => event.currentTarget.select()}
                      onKeyDown={(event) => handleMcqCellKeyDown(event, rowIndex, index)}
                    />
                  ) : <input type="number" min={0} defaultValue={index % 3 === 0 ? "" : Math.min(6, index + 1)} />}
                </td>
              ))}
              <td>--</td>
              <td>--</td>
            </tr>
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

function modeTitle(mode: AnalysisMode) {
  if (mode === "students") return "Students";
  if (mode === "mcq-entry") return "MCQ answer capture";
  if (mode === "structured-entry") return "Structured mark capture";
  return "Overview";
}
