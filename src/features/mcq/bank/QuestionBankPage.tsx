import {
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Edit3,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShoppingBasket,
  Trash2,
  X
} from "lucide-react";
import clsx from "clsx";
import katex from "katex";
import { useEffect, useMemo, useRef, useState } from "react";
import type { McqQuestionRecord } from "../../../types";
import { teacherDeskApi } from "../../../lib/rendererApi";
import type { McqBlock, McqEditorMetadata, OptionsBlock } from "../editor/types";
import { normalizeMcqBlocks } from "../editor/normalizeBlocks";
import { TextWithInlineLatex } from "../editor/text/TextWithInlineLatex";
import { OptionsPreview } from "../editor/options/OptionsPreview";
import { ImageBlockPreview } from "../editor/image/ImageBlockCard";
import { TableWithLatex } from "../editor/table/TableWithLatex";

const basketStorageKey = "teacherdesk.mcqExamBasket";

type QuestionBankPageProps = {
  refreshKey: number;
  selectedQuestionId?: string | null;
  onAddQuestion: () => void;
  onEditQuestion: (question: McqQuestionRecord) => void;
};

type FilterState = {
  examCodes: string[];
  years: string[];
  sessions: string[];
  versions: string[];
  topics: string[];
  tags: string[];
  difficulties: string[];
  statuses: string[];
};

type FilterMode = "any" | "all";
type FilterModeState = Record<keyof FilterState, FilterMode>;
type McqMetadataDraft = {
  examCode: string;
  originalQuestionNumber: string;
  syllabus: string;
  session: string;
  year: string;
  paper: string;
  paperVersion: string;
  marks: string;
  difficulty: "Easy" | "Medium" | "Hard";
  reviewStatus: "Draft" | "Ready" | "Needs review";
  correctAnswer: "A" | "B" | "C" | "D";
  topicsText: string;
  tagsText: string;
  teacherNotes: string;
};

const emptyFilters: FilterState = {
  examCodes: [],
  years: [],
  sessions: [],
  versions: [],
  topics: [],
  tags: [],
  difficulties: [],
  statuses: []
};

const defaultFilterModes: FilterModeState = {
  examCodes: "any",
  years: "any",
  sessions: "any",
  versions: "any",
  topics: "any",
  tags: "any",
  difficulties: "any",
  statuses: "any"
};

export function QuestionBankPage({ refreshKey, selectedQuestionId, onAddQuestion, onEditQuestion }: QuestionBankPageProps) {
  const [questions, setQuestions] = useState<McqQuestionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [filterModes, setFilterModes] = useState<FilterModeState>(defaultFilterModes);
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [previewMode, setPreviewMode] = useState<"student" | "teacher">("student");
  const [basketIds, setBasketIds] = useState<string[]>(() => readBasketIds());
  const [pendingDelete, setPendingDelete] = useState<McqQuestionRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [metadataDraft, setMetadataDraft] = useState<McqMetadataDraft | null>(null);
  const [metadataModalOpen, setMetadataModalOpen] = useState(false);

  useEffect(() => {
    void loadQuestions();
  }, [refreshKey]);

  useEffect(() => {
    if (selectedQuestionId) setSelectedId(selectedQuestionId);
  }, [selectedQuestionId]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    localStorage.setItem(basketStorageKey, JSON.stringify(basketIds));
  }, [basketIds]);

  const filterOptions = useMemo(() => buildFilterOptions(questions), [questions]);
  const activeFilterCount = countFilters(filters);

  const filteredQuestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return questions.filter((question) => {
      const textMatch =
        !query ||
        [
          question.examCode,
          question.originalQuestionNumber,
          question.syllabus,
          question.session,
          question.year,
          question.paper,
          question.paperVersion,
          question.difficulty,
          question.reviewStatus,
          question.correctAnswer,
          question.searchableText,
          ...question.topics,
          ...question.tags
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return (
        textMatch &&
        matchesScalarFilter(filters.examCodes, filterModes.examCodes, question.examCode) &&
        matchesScalarFilter(filters.years, filterModes.years, question.year) &&
        matchesScalarFilter(filters.sessions, filterModes.sessions, question.session) &&
        matchesScalarFilter(filters.versions, filterModes.versions, versionLabel(question.paperVersion)) &&
        matchesScalarFilter(filters.difficulties, filterModes.difficulties, question.difficulty) &&
        matchesScalarFilter(filters.statuses, filterModes.statuses, question.reviewStatus) &&
        matchesListFilter(filters.topics, filterModes.topics, question.topics) &&
        matchesListFilter(filters.tags, filterModes.tags, question.tags)
      );
    });
  }, [filterModes, filters, questions, search]);

  useEffect(() => {
    setPage(1);
  }, [filterModes, filters, pageSize, search]);

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedQuestions = filteredQuestions.slice(pageStart, pageStart + pageSize);
  const selectedQuestion = filteredQuestions.find((question) => question.id === selectedId) ?? filteredQuestions[0] ?? null;

  useEffect(() => {
    setMetadataDraft(selectedQuestion ? draftFromQuestion(selectedQuestion) : null);
  }, [selectedQuestion?.id]);

  async function loadQuestions() {
    const loaded = await teacherDeskApi.listMcqQuestions();
    setQuestions(loaded);
    setSelectedId((current) => selectedQuestionId ?? current ?? loaded[0]?.id ?? null);
  }

  async function deleteQuestion(question: McqQuestionRecord) {
    await teacherDeskApi.deleteMcqQuestion(question.id);
    setQuestions((current) => current.filter((candidate) => candidate.id !== question.id));
    setSelectedId((current) => (current === question.id ? null : current));
    setBasketIds((current) => current.filter((id) => id !== question.id));
    setPendingDelete(null);
    setNotice("Question deleted.");
  }

  async function duplicateQuestion(question: McqQuestionRecord) {
    const saved = await teacherDeskApi.saveMcqQuestion({
      metadata: {
        ...question.questionJson.metadata,
        originalQuestionNumber: `${question.originalQuestionNumber || "question"}-copy`
      },
      blocks: normalizeMcqBlocks(question.questionJson.blocks as McqBlock[]),
      searchableText: question.searchableText,
      rendererVersion: question.questionJson.rendererVersion
    });
    setQuestions((current) => [saved, ...current]);
    setSelectedId(saved.id);
    setNotice("Question duplicated.");
  }

  function toggleFilter(key: keyof FilterState, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value]
    }));
  }

  function toggleBasket(question: McqQuestionRecord) {
    setBasketIds((current) => (current.includes(question.id) ? current.filter((id) => id !== question.id) : [...current, question.id]));
    setNotice(basketIds.includes(question.id) ? "Removed from exam basket." : "Added to exam basket.");
  }

  async function saveSelectedMetadata() {
    if (!selectedQuestion || !metadataDraft) return;
    const blocks = normalizeMcqBlocks(selectedQuestion.questionJson.blocks as McqBlock[]).map((block) =>
      block.type === "options" ? ({ ...block, correctAnswer: metadataDraft.correctAnswer as OptionsBlock["correctAnswer"] } satisfies OptionsBlock) : block
    );
    const metadata: McqEditorMetadata = {
      ...(selectedQuestion.questionJson.metadata as unknown as McqEditorMetadata),
      examCode: metadataDraft.examCode.trim(),
      originalQuestionNumber: metadataDraft.originalQuestionNumber.trim(),
      syllabus: metadataDraft.syllabus.trim(),
      session: metadataDraft.session.trim(),
      year: metadataDraft.year.trim(),
      paper: metadataDraft.paper.trim(),
      paperVersion: metadataDraft.paperVersion.trim(),
      marks: Math.max(1, Number(metadataDraft.marks) || 1),
      difficulty: metadataDraft.difficulty,
      reviewStatus: metadataDraft.reviewStatus,
      topics: linesToValues(metadataDraft.topicsText),
      tags: linesToValues(metadataDraft.tagsText),
      teacherNotes: metadataDraft.teacherNotes
    };
    const saved = await teacherDeskApi.saveMcqQuestion({
      id: selectedQuestion.id,
      metadata: metadata as unknown as Record<string, unknown>,
      blocks,
      searchableText: buildSearchableText(metadata, blocks),
      rendererVersion: selectedQuestion.questionJson.rendererVersion
    });
    setQuestions((current) => current.map((question) => (question.id === saved.id ? saved : question)));
    setSelectedId(saved.id);
    setMetadataDraft(draftFromQuestion(saved));
    setMetadataModalOpen(false);
    setNotice("Metadata saved.");
  }

  return (
    <div className="mcq-bank-page">
      <section className="mcq-bank-main">
        <header className="mcq-bank-toolbar">
          <div className="mcq-bank-search">
            <Search size={15} />
            <input placeholder="Search question bank" value={search} onChange={(event) => setSearch(event.target.value)} />
            {search ? (
              <button aria-label="Clear search" type="button" onClick={() => setSearch("")}>
                <X size={13} />
              </button>
            ) : null}
          </div>
          <button type="button" onClick={() => setFilterPanelOpen((open) => !open)}>
            <Filter size={15} />
            Filters
            {activeFilterCount > 0 ? <span className="mcq-bank-filter-count">{activeFilterCount}</span> : null}
          </button>
          <button type="button" onClick={() => void loadQuestions()}>
            <RefreshCw size={15} />
            Refresh
          </button>
          <button className="mcq-bank-primary" type="button" onClick={onAddQuestion}>
            <Plus size={15} />
            Add question
          </button>
        </header>

        <div className="mcq-bank-content">
          {filterPanelOpen ? (
            <FilterPanel
              filters={filters}
              modes={filterModes}
              options={filterOptions}
              onClear={() => {
                setFilters(emptyFilters);
                setFilterModes(defaultFilterModes);
              }}
              onModeChange={(key, mode) => setFilterModes((current) => ({ ...current, [key]: mode }))}
              onToggle={toggleFilter}
            />
          ) : null}

          <div className="mcq-bank-list-header">
            <div>
              <strong>{filteredQuestions.length}</strong>
              <span>{filteredQuestions.length === 1 ? "question" : "questions"}</span>
            </div>
            <span>{basketIds.length} in basket - {activeFilterCount > 0 ? "Filtered view" : "All saved MCQ questions"}</span>
          </div>

          <div className="mcq-bank-table-wrap">
            <table className="mcq-bank-table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Year</th>
                  <th>Session</th>
                  <th>Version</th>
                  <th>Difficulty</th>
                  <th>Status</th>
                  <th>Answer</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedQuestions.map((question) => (
                  <tr
                    className={question.id === selectedQuestion?.id ? "is-selected" : undefined}
                    key={question.id}
                    onClick={() => setSelectedId(question.id)}
                    onDoubleClick={() => onEditQuestion(question)}
                  >
                    <td>
                      <div className="mcq-bank-question-cell">
                        <strong>{question.examCode || "Untitled"}</strong>
                        <span>Q {question.originalQuestionNumber || "-"} - {question.topics[0] || "No topic"}</span>
                      </div>
                    </td>
                    <td className="is-centered">{question.year || "-"}</td>
                    <td>{question.session || "-"}</td>
                    <td className="is-centered">{versionLabel(question.paperVersion)}</td>
                    <td className="is-centered">{question.difficulty || "-"}</td>
                    <td className="is-centered">
                      <StatusIcon status={question.reviewStatus} />
                    </td>
                    <td className="is-centered">{question.correctAnswer || "-"}</td>
                    <td className="is-centered">{formatShortDate(question.updatedAt)}</td>
                    <td>
                      <div className="mcq-bank-actions">
                        <button aria-label="Edit question" type="button" onClick={(event) => { event.stopPropagation(); onEditQuestion(question); }}>
                          <Edit3 size={14} />
                        </button>
                        <button aria-label="Duplicate question" type="button" onClick={(event) => { event.stopPropagation(); void duplicateQuestion(question); }}>
                          <Copy size={14} />
                        </button>
                        <button
                          aria-label={basketIds.includes(question.id) ? "Remove from exam basket" : "Add to exam basket"}
                          className={basketIds.includes(question.id) ? "is-basketed" : undefined}
                          type="button"
                          onClick={(event) => { event.stopPropagation(); toggleBasket(question); }}
                        >
                          <ShoppingBasket size={14} />
                        </button>
                        <button aria-label="Delete question" type="button" onClick={(event) => { event.stopPropagation(); setPendingDelete(question); }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="mcq-bank-empty">No questions match the current search and filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <footer className="mcq-bank-pagination">
            <span>
              Showing {filteredQuestions.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + pageSize, filteredQuestions.length)} of {filteredQuestions.length}
            </span>
            <label>
              Per page
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                {[8, 12, 20, 40].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <div>
              <button disabled={currentPage <= 1} type="button" onClick={() => setPage(1)}>First</button>
              <button disabled={currentPage <= 1} type="button" onClick={() => setPage((value) => Math.max(1, value - 1))}>Prev</button>
              <strong>{currentPage} / {totalPages}</strong>
              <button disabled={currentPage >= totalPages} type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
              <button disabled={currentPage >= totalPages} type="button" onClick={() => setPage(totalPages)}>Last</button>
            </div>
          </footer>
        </div>
      </section>

      <aside className="mcq-bank-preview">
        <header>
          <div>
            <span>Preview</span>
            <strong>{selectedQuestion ? `${selectedQuestion.examCode} #${selectedQuestion.originalQuestionNumber}` : "No question selected"}</strong>
          </div>
          <div className="mcq-bank-preview-actions">
            <button className={previewMode === "student" ? "is-active" : undefined} type="button" onClick={() => setPreviewMode("student")}>Student</button>
            <button className={previewMode === "teacher" ? "is-active" : undefined} type="button" onClick={() => setPreviewMode("teacher")}>Teacher</button>
          </div>
        </header>
        {selectedQuestion ? (
          <>
            <QuestionMetaSummary question={selectedQuestion} onEdit={() => setMetadataModalOpen(true)} />
            <QuestionPreview mode={previewMode} question={selectedQuestion} />
            <div className="mcq-bank-preview-footer">
              <button className={basketIds.includes(selectedQuestion.id) ? "is-basketed" : undefined} type="button" onClick={() => toggleBasket(selectedQuestion)}>
                <ShoppingBasket size={14} /> {basketIds.includes(selectedQuestion.id) ? "In basket" : "Add to basket"}
              </button>
              <button type="button" onClick={() => onEditQuestion(selectedQuestion)}><Edit3 size={14} /> Edit</button>
              <button type="button" onClick={() => void duplicateQuestion(selectedQuestion)}><Copy size={14} /> Duplicate</button>
            </div>
          </>
        ) : (
          <div className="mcq-bank-no-preview">Select a question to preview it.</div>
        )}
      </aside>

      {pendingDelete ? (
        <div className="mcq-bank-modal-backdrop" role="presentation">
          <div className="mcq-bank-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-question-title">
            <h2 id="delete-question-title">Delete question?</h2>
            <p>{pendingDelete.examCode} #{pendingDelete.originalQuestionNumber} will be removed from the local question bank.</p>
            <div>
              <button type="button" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="is-danger" type="button" onClick={() => void deleteQuestion(pendingDelete)}>Delete</button>
            </div>
          </div>
        </div>
      ) : null}

      {metadataModalOpen && metadataDraft && selectedQuestion ? (
        <div className="mcq-bank-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setMetadataModalOpen(false);
        }}>
          <QuestionMetadataEditor
            draft={metadataDraft}
            title={`${selectedQuestion.examCode} #${selectedQuestion.originalQuestionNumber}`}
            onCancel={() => {
              setMetadataDraft(draftFromQuestion(selectedQuestion));
              setMetadataModalOpen(false);
            }}
            onChange={setMetadataDraft}
            onSave={() => void saveSelectedMetadata()}
          />
        </div>
      ) : null}

      {notice ? <div className="td-app-notice">{notice}</div> : null}
    </div>
  );
}

function FilterPanel({
  filters,
  modes,
  options,
  onClear,
  onModeChange,
  onToggle
}: {
  filters: FilterState;
  modes: FilterModeState;
  options: Record<keyof FilterState, string[]>;
  onClear: () => void;
  onModeChange: (key: keyof FilterState, mode: FilterMode) => void;
  onToggle: (key: keyof FilterState, value: string) => void;
}) {
  const [openKey, setOpenKey] = useState<keyof FilterState | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpenKey(null);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <section className="mcq-bank-filter-panel" ref={panelRef}>
      <div className="mcq-bank-filter-title">
        <span><Filter size={14} /> Filters</span>
        <button type="button" onClick={onClear}>Clear all</button>
      </div>
      <div className="mcq-bank-filter-grid">
        <FilterGroup filterKey="examCodes" label="Exam code" mode={modes.examCodes} openKey={openKey} values={options.examCodes} selected={filters.examCodes} onModeChange={onModeChange} onOpenChange={setOpenKey} onToggle={(value) => onToggle("examCodes", value)} />
        <FilterGroup filterKey="years" label="Year" mode={modes.years} openKey={openKey} values={options.years} selected={filters.years} onModeChange={onModeChange} onOpenChange={setOpenKey} onToggle={(value) => onToggle("years", value)} />
        <FilterGroup filterKey="sessions" label="Session" mode={modes.sessions} openKey={openKey} values={options.sessions} selected={filters.sessions} onModeChange={onModeChange} onOpenChange={setOpenKey} onToggle={(value) => onToggle("sessions", value)} />
        <FilterGroup filterKey="versions" label="Version" mode={modes.versions} openKey={openKey} values={options.versions} selected={filters.versions} onModeChange={onModeChange} onOpenChange={setOpenKey} onToggle={(value) => onToggle("versions", value)} />
        <FilterGroup filterKey="topics" label="Topics" mode={modes.topics} openKey={openKey} values={options.topics} selected={filters.topics} onModeChange={onModeChange} onOpenChange={setOpenKey} onToggle={(value) => onToggle("topics", value)} />
        <FilterGroup filterKey="tags" label="Tags" mode={modes.tags} openKey={openKey} values={options.tags} selected={filters.tags} onModeChange={onModeChange} onOpenChange={setOpenKey} onToggle={(value) => onToggle("tags", value)} />
        <FilterGroup filterKey="difficulties" label="Difficulty" mode={modes.difficulties} openKey={openKey} values={options.difficulties} selected={filters.difficulties} onModeChange={onModeChange} onOpenChange={setOpenKey} onToggle={(value) => onToggle("difficulties", value)} />
        <FilterGroup filterKey="statuses" label="Review status" mode={modes.statuses} openKey={openKey} values={options.statuses} selected={filters.statuses} onModeChange={onModeChange} onOpenChange={setOpenKey} onToggle={(value) => onToggle("statuses", value)} />
      </div>
    </section>
  );
}

function FilterGroup({
  filterKey,
  label,
  mode,
  openKey,
  values,
  selected,
  onModeChange,
  onOpenChange,
  onToggle
}: {
  filterKey: keyof FilterState;
  label: string;
  mode: FilterMode;
  openKey: keyof FilterState | null;
  values: string[];
  selected: string[];
  onModeChange: (key: keyof FilterState, mode: FilterMode) => void;
  onOpenChange: (key: keyof FilterState | null) => void;
  onToggle: (value: string) => void;
}) {
  const open = openKey === filterKey;
  return (
    <div className="mcq-bank-filter-group">
      <button type="button" onClick={() => onOpenChange(open ? null : filterKey)}>
        <span>{label}</span>
        <strong>{selected.length ? `${selected.length} ${mode.toUpperCase()}` : "Any"}</strong>
        <ChevronDown className={open ? "is-open" : undefined} size={14} />
      </button>
      {open ? (
        <div className="mcq-bank-filter-options">
          <div className="mcq-bank-filter-mode">
            <button className={mode === "any" ? "is-active" : undefined} type="button" onClick={() => onModeChange(filterKey, "any")}>Any</button>
            <button className={mode === "all" ? "is-active" : undefined} type="button" onClick={() => onModeChange(filterKey, "all")}>All</button>
          </div>
          {values.length === 0 ? <span className="mcq-bank-filter-empty">No values yet</span> : null}
          {values.map((value) => (
            <label key={value}>
              <input checked={selected.includes(value)} type="checkbox" onChange={() => onToggle(value)} />
              <span>{value}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function QuestionMetaSummary({ question, onEdit }: { question: McqQuestionRecord; onEdit: () => void }) {
  const metadata = [
    ["Q no.", question.originalQuestionNumber || "-"],
    ["Status", question.reviewStatus || "-"],
    ["Syllabus", question.syllabus || "-"],
    ["Session", question.session || "-"],
    ["Paper", `Paper 1 ${versionLabel(question.paperVersion)}`],
    ["Marks", String(question.marks || 1)],
    ["Difficulty", question.difficulty || "-"],
    ["Answer", question.correctAnswer || "-"]
  ];

  return (
    <div className="mcq-bank-meta-card">
      <div className="mcq-bank-meta-summary-header">
        <strong>Metadata</strong>
        <button aria-label="Edit metadata" title="Edit metadata" type="button" onClick={onEdit}><Edit3 size={14} /></button>
      </div>
      <div className="mcq-bank-meta-grid">
        {metadata.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <TokenLine label="Topics" values={question.topics} />
      <TokenLine label="Tags" values={question.tags} />
    </div>
  );
}

function QuestionMetadataEditor({
  draft,
  title,
  onCancel,
  onChange,
  onSave
}: {
  draft: McqMetadataDraft;
  title: string;
  onCancel: () => void;
  onChange: (draft: McqMetadataDraft) => void;
  onSave: () => void;
}) {
  function patch(next: Partial<McqMetadataDraft>) {
    onChange({ ...draft, ...next });
  }
  return (
    <div className="mcq-bank-metadata-dialog" role="dialog" aria-modal="true" aria-label="Edit MCQ metadata">
      <div className="mcq-bank-meta-editor-header">
        <div>
          <span>Edit metadata</span>
          <strong>{title}</strong>
        </div>
        <button aria-label="Close metadata editor" type="button" onClick={onCancel}><X size={17} /></button>
      </div>
      <div className="mcq-bank-meta-edit-grid">
        <label><span>Exam code</span><input value={draft.examCode} onChange={(event) => patch({ examCode: event.target.value })} /></label>
        <label><span>Q no.</span><input value={draft.originalQuestionNumber} onChange={(event) => patch({ originalQuestionNumber: event.target.value })} /></label>
        <label><span>Syllabus</span><input value={draft.syllabus} onChange={(event) => patch({ syllabus: event.target.value })} /></label>
        <label><span>Session</span><input value={draft.session} onChange={(event) => patch({ session: event.target.value })} /></label>
        <label><span>Year</span><input value={draft.year} onChange={(event) => patch({ year: event.target.value })} /></label>
        <label><span>Paper</span><input value={draft.paper} onChange={(event) => patch({ paper: event.target.value })} /></label>
        <label><span>Version</span><input value={draft.paperVersion} onChange={(event) => patch({ paperVersion: event.target.value })} /></label>
        <label><span>Marks</span><input min={1} type="number" value={draft.marks} onChange={(event) => patch({ marks: event.target.value })} /></label>
        <label>
          <span>Difficulty</span>
          <select value={draft.difficulty} onChange={(event) => patch({ difficulty: event.target.value as McqMetadataDraft["difficulty"] })}>
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </label>
        <label>
          <span>Review</span>
          <select value={draft.reviewStatus} onChange={(event) => patch({ reviewStatus: event.target.value as McqMetadataDraft["reviewStatus"] })}>
            <option>Draft</option>
            <option>Ready</option>
            <option>Needs review</option>
          </select>
        </label>
        <label>
          <span>Answer</span>
          <select value={draft.correctAnswer} onChange={(event) => patch({ correctAnswer: event.target.value as McqMetadataDraft["correctAnswer"] })}>
            <option>A</option>
            <option>B</option>
            <option>C</option>
            <option>D</option>
          </select>
        </label>
      </div>
      <label className="mcq-bank-meta-textarea">
        <span>Topics, one per line</span>
        <textarea value={draft.topicsText} onChange={(event) => patch({ topicsText: event.target.value })} />
      </label>
      <label className="mcq-bank-meta-textarea">
        <span>Tags, one per line</span>
        <textarea value={draft.tagsText} onChange={(event) => patch({ tagsText: event.target.value })} />
      </label>
      <label className="mcq-bank-meta-textarea">
        <span>Teacher notes</span>
        <textarea value={draft.teacherNotes} onChange={(event) => patch({ teacherNotes: event.target.value })} />
      </label>
      <div className="mcq-bank-metadata-dialog-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button className="is-primary" type="button" onClick={onSave}>Save metadata</button>
      </div>
    </div>
  );
}

function TokenLine({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="mcq-bank-token-line">
      <span>{label}</span>
      <div>
        {values.length ? values.map((value) => <strong key={value}>{value}</strong>) : <em>-</em>}
      </div>
    </div>
  );
}

function QuestionPreview({ question, mode }: { question: McqQuestionRecord; mode: "student" | "teacher" }) {
  const blocks = normalizeMcqBlocks(question.questionJson.blocks as McqBlock[]);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const element = frame;

    function updateScale() {
      const bounds = element.getBoundingClientRect();
      const availableWidth = Math.max(260, bounds.width - 16);
      const availableHeight = Math.max(360, bounds.height - 16);
      setScale(Math.min(availableWidth / 794, availableHeight / 1123, 0.55));
    }

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(element);
    window.addEventListener("resize", updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  return (
    <div className="mcq-bank-a4-frame" ref={frameRef}>
      <div className="mcq-bank-a4-shell" style={{ width: 794 * scale, height: 1123 * scale }}>
        <div className="mcq-bank-a4" style={{ transform: `scale(${scale})` }}>
          <div className="mcq-a4-question">
            <strong>1</strong>
            <div className="mcq-a4-body">
              {blocks.map((block) =>
                block.type === "text" ? (
                  <div
                    key={block.id}
                    style={{
                      fontFamily: block.settings.fontFamily,
                      fontSize: `${block.settings.fontSize}pt`,
                      lineHeight: block.settings.lineHeight,
                      textAlign: block.settings.alignment,
                      marginTop: block.settings.spacingBefore,
                      marginBottom: block.settings.spacingAfter
                    }}
                  >
                    <TextWithInlineLatex block={block} />
                  </div>
                ) : block.type === "equation" ? (
                  block.source.trim() ? (
                  <div
                    className="mcq-a4-equation"
                    key={block.id}
                    style={{
                      fontFamily: block.settings.fontFamily,
                      fontSize: `${block.settings.fontSize}pt`,
                      textAlign: block.settings.alignment,
                      marginTop: block.settings.spacingBefore,
                      marginBottom: block.settings.spacingAfter
                    }}
                    dangerouslySetInnerHTML={{ __html: katex.renderToString(block.source, { throwOnError: false, output: "html", displayMode: true }) }}
                  />
                  ) : null
                ) : block.type === "image" ? (
                  <ImageBlockPreview a4 block={block} key={block.id} />
                ) : block.type === "table" ? (
                  <TableWithLatex block={block} key={block.id} />
                ) : (
                  <OptionsPreview block={block} key={block.id} student={mode === "student"} showPlaceholders={false} />
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  const ready = status === "Ready";
  return (
    <span className={clsx("mcq-bank-status-icon", ready ? "is-ready" : status === "Draft" ? "is-draft" : "is-warning")} title={status || "No status"}>
      {ready ? <CheckCircle2 size={15} /> : status === "Draft" ? <Edit3 size={14} /> : <Check size={14} />}
    </span>
  );
}

function buildFilterOptions(questions: McqQuestionRecord[]): Record<keyof FilterState, string[]> {
  return {
    examCodes: unique(questions.map((question) => question.examCode)),
    years: unique(questions.map((question) => question.year)).sort((a, b) => b.localeCompare(a)),
    sessions: unique(questions.map((question) => question.session)),
    versions: unique(questions.map((question) => versionLabel(question.paperVersion))),
    topics: unique(questions.flatMap((question) => question.topics)),
    tags: unique(questions.flatMap((question) => question.tags)),
    difficulties: unique(questions.map((question) => question.difficulty)),
    statuses: unique(questions.map((question) => question.reviewStatus))
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function matchesScalarFilter(selected: string[], mode: FilterMode, value: string) {
  if (selected.length === 0) return true;
  if (mode === "all") return selected.every((item) => item === value);
  return selected.includes(value);
}

function matchesListFilter(selected: string[], mode: FilterMode, values: string[]) {
  if (selected.length === 0) return true;
  if (mode === "all") return selected.every((value) => values.includes(value));
  return selected.some((value) => values.includes(value));
}

function countFilters(filters: FilterState) {
  return Object.values(filters).reduce((sum, values) => sum + values.length, 0);
}

function versionLabel(version: string) {
  return `v${version || "1"}`;
}

function formatShortDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function readBasketIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(basketStorageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function draftFromQuestion(question: McqQuestionRecord): McqMetadataDraft {
  const metadata = question.questionJson.metadata as Record<string, unknown>;
  return {
    examCode: question.examCode,
    originalQuestionNumber: question.originalQuestionNumber,
    syllabus: question.syllabus,
    session: question.session,
    year: question.year,
    paper: question.paper,
    paperVersion: question.paperVersion,
    marks: String(question.marks || 1),
    difficulty: (question.difficulty === "Easy" || question.difficulty === "Hard" ? question.difficulty : "Medium"),
    reviewStatus: (question.reviewStatus === "Draft" || question.reviewStatus === "Needs review" ? question.reviewStatus : "Ready"),
    correctAnswer: (["A", "B", "C", "D"].includes(question.correctAnswer) ? question.correctAnswer : "A") as McqMetadataDraft["correctAnswer"],
    topicsText: question.topics.join("\n"),
    tagsText: question.tags.join("\n"),
    teacherNotes: String(metadata.teacherNotes ?? "")
  };
}

function linesToValues(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function buildSearchableText(metadata: McqEditorMetadata, blocks: McqBlock[]) {
  const blockText = blocks
    .flatMap((block) => {
      if (block.type === "text") return [block.text];
      if (block.type === "equation") return [block.source];
      if (block.type === "image") return [block.asset.altText, block.asset.fileName, block.settings.caption];
      if (block.type === "table") return block.rows.flat().map((cell) => [cell.text, cell.image?.altText, cell.image?.fileName].filter(Boolean).join(" "));
      return block.options.map((option) => [option.text, option.image?.altText, option.image?.fileName].filter(Boolean).join(" "));
    })
    .join(" ");
  return [
    metadata.examCode,
    metadata.originalQuestionNumber,
    metadata.syllabus,
    metadata.session,
    metadata.year,
    metadata.paper,
    metadata.paperVersion,
    metadata.difficulty,
    metadata.reviewStatus,
    ...metadata.topics,
    ...metadata.tags,
    blockText
  ].join(" ");
}
