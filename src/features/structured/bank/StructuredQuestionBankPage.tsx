import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileText,
  FolderOpen,
  Pencil,
  RefreshCw,
  Search,
  ShoppingBasket,
  Square,
  SquareCheckBig,
  Trash2,
  TriangleAlert
} from "lucide-react";
import clsx from "clsx";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { teacherDeskApi } from "../../../lib/rendererApi";
import type { StructuredQuestionRecord, WorkspaceInfo } from "../../../types";

type MatchMode = "any" | "all";
type MultiFilterKey = "sessions" | "years" | "papers" | "topics" | "tags" | "review";

type MultiFilterState = {
  values: string[];
  mode: MatchMode;
};

type Props = {
  workspace: WorkspaceInfo | null;
};

const basketStorageKey = "teacherdesk.structuredExamBasket";

type MetadataDraft = {
  session: string;
  year: string;
  paper: string;
  paperVersion: string;
  marks: string;
  reviewStatus: string;
  reviewReason: string;
  topicsText: string;
  tagsText: string;
};

export function StructuredQuestionBankPage({ workspace }: Props) {
  const [questions, setQuestions] = useState<StructuredQuestionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [basketIds, setBasketIds] = useState<string[]>(() => readBasket());
  const [search, setSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState<MultiFilterState>({ values: [], mode: "any" });
  const [yearFilter, setYearFilter] = useState<MultiFilterState>({ values: [], mode: "any" });
  const [paperFilter, setPaperFilter] = useState<MultiFilterState>({ values: [], mode: "any" });
  const [topicsFilter, setTopicsFilter] = useState<MultiFilterState>({ values: [], mode: "any" });
  const [tagsFilter, setTagsFilter] = useState<MultiFilterState>({ values: [], mode: "any" });
  const [reviewFilter, setReviewFilter] = useState<MultiFilterState>({ values: [], mode: "any" });
  const [openFilter, setOpenFilter] = useState<MultiFilterKey | null>(null);
  const [previewKind, setPreviewKind] = useState<"qp" | "ms">("qp");
  const [previewDataUrl, setPreviewDataUrl] = useState("");
  const [previewMessage, setPreviewMessage] = useState("");
  const [metadataDraft, setMetadataDraft] = useState<MetadataDraft | null>(null);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const filtersRef = useRef<HTMLElement | null>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    void loadQuestions();
  }, []);

  useEffect(() => {
    function closeOpenFilter(event: PointerEvent) {
      if (!openFilter) return;
      if (filtersRef.current?.contains(event.target as Node)) return;
      setOpenFilter(null);
    }

    document.addEventListener("pointerdown", closeOpenFilter);
    return () => document.removeEventListener("pointerdown", closeOpenFilter);
  }, [openFilter]);

  useEffect(() => {
    localStorage.setItem(basketStorageKey, JSON.stringify(basketIds));
  }, [basketIds]);

  const options = useMemo(() => buildOptions(questions), [questions]);
  const filteredQuestions = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return questions.filter((question) => {
      if (query && !`${question.examCode} ${question.questionNumber} ${question.topics.join(" ")} ${question.tags.join(" ")}`.toLowerCase().includes(query)) return false;
      if (!matchesMulti([question.session], sessionFilter)) return false;
      if (!matchesMulti([String(question.year ?? "")], yearFilter)) return false;
      if (!matchesMulti([question.paper], paperFilter)) return false;
      if (!matchesMulti(question.topics, topicsFilter)) return false;
      if (!matchesMulti(question.tags, tagsFilter)) return false;
      if (!matchesMulti([question.reviewStatus], reviewFilter)) return false;
      return true;
    });
  }, [deferredSearch, paperFilter, questions, reviewFilter, sessionFilter, tagsFilter, topicsFilter, yearFilter]);

  const selected = filteredQuestions.find((question) => question.id === selectedId) ?? filteredQuestions[0] ?? questions.find((question) => question.id === selectedId) ?? null;
  const selectedOnPage = filteredQuestions.filter((question) => selectedIds.has(question.id)).length;
  const previewPath = selected ? resolveWorkspacePath(workspace?.workspaceRoot, previewKind === "qp" ? selected.splitQpPath : selected.splitMsPath) : "";

  useEffect(() => {
    setMetadataDraft(selected ? draftFromQuestion(selected) : null);
  }, [selected?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      if (!selected) {
        setPreviewDataUrl("");
        setPreviewMessage("");
        return;
      }
      setPreviewDataUrl("");
      setPreviewMessage("Loading preview...");
      try {
        if (typeof teacherDeskApi.getStructuredQuestionPreview !== "function") {
          if (previewPath) {
            setPreviewDataUrl(toFileUrl(previewPath));
            setPreviewMessage("");
          } else {
            setPreviewMessage("Preview bridge is not available. Restart TeacherDesk to load the latest desktop bridge.");
          }
          return;
        }
        const data = await teacherDeskApi.getStructuredQuestionPreview(selected.id, previewKind);
        if (!cancelled) {
          setPreviewDataUrl(data.dataUrl);
          setPreviewMessage("");
        }
      } catch (error) {
        if (!cancelled) {
          setPreviewDataUrl("");
          setPreviewMessage(error instanceof Error ? error.message : "Could not load PDF preview.");
        }
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [previewKind, selected?.id]);

  async function loadQuestions() {
    setIsLoading(true);
    try {
      const rows = await teacherDeskApi.listStructuredQuestions();
      setQuestions(rows);
      setSelectedId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load structured questions.");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleQuestion(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filteredQuestions.map((question) => question.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function addToBasket(ids: string[]) {
    if (ids.length === 0) return;
    setBasketIds((current) => Array.from(new Set([...current, ...ids])));
    setMessage(`Added ${ids.length} structured question${ids.length === 1 ? "" : "s"} to the basket.`);
  }

  async function deleteQuestions(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) return;
    const confirmed = window.confirm(
      uniqueIds.length === 1
        ? "Delete this structured question and its split question paper and mark scheme PDF files?"
        : `Delete ${uniqueIds.length} structured questions and their split question paper and mark scheme PDF files?`
    );
    if (!confirmed) return;

    try {
      const result = await teacherDeskApi.deleteStructuredQuestions(uniqueIds);
      setSelectedIds((current) => {
        const next = new Set(current);
        uniqueIds.forEach((id) => next.delete(id));
        return next;
      });
      setBasketIds((current) => current.filter((id) => !uniqueIds.includes(id)));
      setSelectedId((current) => uniqueIds.includes(String(current)) ? null : current);
      await loadQuestions();
      const failed = result.failedFiles.length ? ` ${result.failedFiles.length} file${result.failedFiles.length === 1 ? "" : "s"} could not be deleted.` : "";
      setMessage(`Deleted ${result.deletedCount} structured question${result.deletedCount === 1 ? "" : "s"} and ${result.deletedFiles.length} split PDF file${result.deletedFiles.length === 1 ? "" : "s"}.${failed}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete structured questions.");
    }
  }

  async function openFile(kind: "qp" | "ms") {
    if (!selected) return;
    try {
      await teacherDeskApi.openStructuredQuestionFile(selected.id, kind);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open PDF.");
    }
  }

  async function openFolder() {
    if (!selected) return;
    const filePath = resolveWorkspacePath(workspace?.workspaceRoot, previewKind === "qp" ? selected.splitQpPath : selected.splitMsPath);
    const folder = filePath.replace(/[\\/][^\\/]+$/, "");
    try {
      await teacherDeskApi.openFolder(folder);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open folder.");
    }
  }

  async function saveMetadata() {
    if (!selected || !metadataDraft) return;
    if (typeof teacherDeskApi.updateStructuredQuestionMetadata !== "function") {
      setMessage("Metadata save bridge is not available. Restart TeacherDesk so the updated desktop bridge is loaded.");
      return;
    }
    setIsSavingMetadata(true);
    try {
      const updated = await teacherDeskApi.updateStructuredQuestionMetadata({
        id: selected.id,
        session: metadataDraft.session.trim(),
        year: metadataDraft.year.trim() ? Number(metadataDraft.year) : null,
        paper: metadataDraft.paper.trim(),
        paperVersion: metadataDraft.paperVersion.trim(),
        marks: metadataDraft.marks.trim() ? Number(metadataDraft.marks) : null,
        reviewStatus: metadataDraft.reviewStatus.trim() || "Not required",
        reviewReason: metadataDraft.reviewReason.trim(),
        topics: splitMetadataLines(metadataDraft.topicsText),
        tags: splitMetadataLines(metadataDraft.tagsText)
      });
      setQuestions((current) => current.map((question) => question.id === updated.id ? updated : question));
      setSelectedId(updated.id);
      setMessage("Structured question metadata saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save structured metadata.");
    } finally {
      setIsSavingMetadata(false);
    }
  }

  return (
    <div className="structured-bank-page">
      <section className="structured-bank-toolbar">
        <label className="structured-bank-search">
          <Search size={16} />
          <input value={search} placeholder="Search exam code, topic, tag, question..." onChange={(event) => setSearch(event.target.value)} />
        </label>
        <button type="button" onClick={() => void loadQuestions()}>
          <RefreshCw className={isLoading ? "is-spinning" : undefined} size={15} />
          Refresh
        </button>
        <button type="button" onClick={() => addToBasket(Array.from(selectedIds))} disabled={selectedIds.size === 0}>
          <ShoppingBasket size={15} />
          Add selected
        </button>
        <button className="structured-danger-button" type="button" onClick={() => void deleteQuestions(Array.from(selectedIds))} disabled={selectedIds.size === 0}>
          <Trash2 size={15} />
          Delete selected
        </button>
        <span className="structured-bank-basket">{basketIds.length} in basket</span>
      </section>

      <section className="structured-bank-filters" ref={filtersRef}>
        <MultiFilter
          label="Session"
          state={sessionFilter}
          options={options.sessions}
          isOpen={openFilter === "sessions"}
          onOpen={() => setOpenFilter(openFilter === "sessions" ? null : "sessions")}
          onChange={setSessionFilter}
        />
        <MultiFilter
          label="Year"
          state={yearFilter}
          options={options.years}
          isOpen={openFilter === "years"}
          onOpen={() => setOpenFilter(openFilter === "years" ? null : "years")}
          onChange={setYearFilter}
        />
        <MultiFilter
          label="Paper"
          state={paperFilter}
          options={options.papers}
          isOpen={openFilter === "papers"}
          onOpen={() => setOpenFilter(openFilter === "papers" ? null : "papers")}
          onChange={setPaperFilter}
        />
        <MultiFilter
          label="Topics"
          state={topicsFilter}
          options={options.topics}
          isOpen={openFilter === "topics"}
          onOpen={() => setOpenFilter(openFilter === "topics" ? null : "topics")}
          onChange={setTopicsFilter}
        />
        <MultiFilter
          label="Tags"
          state={tagsFilter}
          options={options.tags}
          isOpen={openFilter === "tags"}
          onOpen={() => setOpenFilter(openFilter === "tags" ? null : "tags")}
          onChange={setTagsFilter}
        />
        <MultiFilter
          label="Review"
          state={reviewFilter}
          options={options.reviewStatuses}
          isOpen={openFilter === "review"}
          onOpen={() => setOpenFilter(openFilter === "review" ? null : "review")}
          onChange={setReviewFilter}
        />
        <button className="structured-filter-clear" type="button" onClick={() => {
          setSessionFilter({ values: [], mode: "any" });
          setYearFilter({ values: [], mode: "any" });
          setPaperFilter({ values: [], mode: "any" });
          setTopicsFilter({ values: [], mode: "any" });
          setTagsFilter({ values: [], mode: "any" });
          setReviewFilter({ values: [], mode: "any" });
        }}>Clear</button>
      </section>

      <div className="structured-bank-layout">
        <main className="structured-bank-table-card">
          <header>
            <div>
              <strong>{filteredQuestions.length} questions</strong>
              <span>{selectedIds.size} selected - {selectedOnPage} visible - {questions.length} saved structured questions</span>
            </div>
            <div>
              <button title="Select all filtered" type="button" onClick={selectAllFiltered}><SquareCheckBig size={15} /></button>
              <button title="Clear selection" type="button" onClick={clearSelection}><Square size={15} /></button>
            </div>
          </header>

          <div className="structured-bank-table-wrap">
            <table className="structured-bank-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Exam code</th>
                  <th>Q</th>
                  <th>Paper</th>
                  <th>Marks</th>
                  <th>Topics</th>
                  <th>Review</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuestions.map((question) => (
                  <tr key={question.id} className={clsx(selected?.id === question.id && "is-selected")} onClick={() => setSelectedId(question.id)}>
                    <td>
                      <button className="structured-row-check" type="button" onClick={(event) => { event.stopPropagation(); toggleQuestion(question.id); }}>
                        {selectedIds.has(question.id) ? <SquareCheckBig size={15} /> : <Square size={15} />}
                      </button>
                    </td>
                    <td><strong>{question.examCode}</strong><span>{question.session} {question.year ?? ""}</span></td>
                    <td>{question.questionNumber}</td>
                    <td>{question.paper} v{question.paperVersion}</td>
                    <td>{question.marks ?? "-"}</td>
                    <td title={question.topics.join(", ") || "No topics"}>{question.topics.join(", ") || "None"}</td>
                    <td><ReviewStatus value={question.reviewStatus} /></td>
                    <td className="structured-bank-actions">
                      <button title="Edit metadata" type="button" onClick={(event) => { event.stopPropagation(); setSelectedId(question.id); setMessage("Metadata editing is the purpose of this action. Full metadata editing will live in the structured metadata workflow."); }}><Pencil size={15} /></button>
                      <button title="Add to basket" type="button" onClick={(event) => { event.stopPropagation(); addToBasket([question.id]); }}><ShoppingBasket size={15} /></button>
                      <button className="structured-icon-danger" title="Delete question and split QP/MS PDFs" type="button" onClick={(event) => { event.stopPropagation(); void deleteQuestions([question.id]); }}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
                {filteredQuestions.length === 0 ? (
                  <tr><td className="structured-bank-empty" colSpan={8}>No structured questions match the current filters.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </main>

        <aside className="structured-bank-preview">
          {selected ? (
            <>
              <header>
                <div>
                  <span>Preview</span>
                  <strong>{selected.examCode} #{selected.questionNumber}</strong>
                </div>
                <div className="structured-preview-toggle">
                  <button className={previewKind === "qp" ? "is-active" : undefined} type="button" onClick={() => setPreviewKind("qp")}>QP</button>
                  <button className={previewKind === "ms" ? "is-active" : undefined} type="button" onClick={() => setPreviewKind("ms")}>MS</button>
                </div>
              </header>
              {metadataDraft ? (
                <section className="structured-bank-metadata-editor">
                  <header>
                    <strong>Edit metadata</strong>
                    <button type="button" onClick={() => void saveMetadata()} disabled={isSavingMetadata}>{isSavingMetadata ? "Saving..." : "Save"}</button>
                  </header>
                  <div className="structured-metadata-grid">
                    <label><span>Session</span><input value={metadataDraft.session} onChange={(event) => setMetadataDraft({ ...metadataDraft, session: event.target.value })} /></label>
                    <label><span>Year</span><input value={metadataDraft.year} onChange={(event) => setMetadataDraft({ ...metadataDraft, year: event.target.value })} /></label>
                    <label><span>Paper</span><input value={metadataDraft.paper} onChange={(event) => setMetadataDraft({ ...metadataDraft, paper: event.target.value })} /></label>
                    <label><span>Version</span><input value={metadataDraft.paperVersion} onChange={(event) => setMetadataDraft({ ...metadataDraft, paperVersion: event.target.value })} /></label>
                    <label><span>Marks</span><input value={metadataDraft.marks} onChange={(event) => setMetadataDraft({ ...metadataDraft, marks: event.target.value })} /></label>
                    <label><span>Review</span><select value={metadataDraft.reviewStatus} onChange={(event) => setMetadataDraft({ ...metadataDraft, reviewStatus: event.target.value })}><option>Not required</option><option>Needs review</option><option>Ready</option></select></label>
                    <label><span>QP pages</span><input value={formatPages(selected.qpPageStart, selected.qpPageEnd)} readOnly /></label>
                    <label><span>MS pages</span><input value={formatPages(selected.msPageStart, selected.msPageEnd)} readOnly /></label>
                  </div>
                  <label className="structured-metadata-wide"><span>Topics, one per line</span><textarea value={metadataDraft.topicsText} onChange={(event) => setMetadataDraft({ ...metadataDraft, topicsText: event.target.value })} /></label>
                  <label className="structured-metadata-wide"><span>Tags, one per line</span><textarea value={metadataDraft.tagsText} onChange={(event) => setMetadataDraft({ ...metadataDraft, tagsText: event.target.value })} /></label>
                  <label className="structured-metadata-wide structured-review-note"><span>Review note</span><input value={metadataDraft.reviewReason} onChange={(event) => setMetadataDraft({ ...metadataDraft, reviewReason: event.target.value })} /></label>
                </section>
              ) : null}
              <div className="structured-pdf-frame">
                {previewDataUrl ? <iframe key={`${selected.id}-${previewKind}`} title="Structured question preview" src={previewDataUrl} /> : <div className="structured-preview-message">{previewMessage || "No preview available."}</div>}
              </div>
              <div className="structured-bank-paths">
                <span>{previewKind === "qp" ? selected.splitQpPath : selected.splitMsPath}</span>
                <div>
                  <button type="button" onClick={() => void openFile("qp")}><FileText size={14} /> Open QP</button>
                  <button type="button" onClick={() => void openFile("ms")}><FileText size={14} /> Open MS</button>
                  <button type="button" onClick={() => void openFolder()}><FolderOpen size={14} /> Folder</button>
                </div>
              </div>
            </>
          ) : (
            <div className="structured-bank-empty-panel">
              <BookOpen size={30} />
              <strong>No question selected</strong>
              <span>Select a row to preview the split question paper or mark scheme.</span>
            </div>
          )}
        </aside>
      </div>
      {message ? <div className="td-app-notice">{message}</div> : null}
    </div>
  );
}

function MultiFilter({ label, state, options, isOpen, onOpen, onChange }: { label: string; state: MultiFilterState; options: string[]; isOpen: boolean; onOpen: () => void; onChange: (state: MultiFilterState) => void }) {
  function toggle(value: string) {
    onChange({ ...state, values: state.values.includes(value) ? state.values.filter((item) => item !== value) : [...state.values, value] });
  }

  return (
    <div className={clsx("structured-multi-filter", isOpen && "is-open")}>
      <span>{label}</span>
      <button type="button" onClick={onOpen}>
        <strong>{state.values.length ? `${state.values.length} ${state.mode}` : "Any"}</strong>
        <ChevronDown size={14} />
      </button>
      {isOpen ? (
        <div className="structured-filter-menu">
          <div className="structured-filter-mode">
            <button className={state.mode === "any" ? "is-active" : undefined} type="button" onClick={() => onChange({ ...state, mode: "any" })}>Any</button>
            <button className={state.mode === "all" ? "is-active" : undefined} type="button" onClick={() => onChange({ ...state, mode: "all" })}>All</button>
          </div>
          <div className="structured-filter-options">
            {options.map((option) => (
              <label key={option}>
                <input type="checkbox" checked={state.values.includes(option)} onChange={() => toggle(option)} />
                <span>{option}</span>
              </label>
            ))}
            {options.length === 0 ? <em>No values recorded yet</em> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReviewStatus({ value }: { value: string }) {
  const needsReview = value.toLowerCase().includes("review") && !value.toLowerCase().includes("not");
  return (
    <span className={clsx("structured-review-status", needsReview && "is-warning")} title={value} aria-label={value}>
      {needsReview ? <TriangleAlert size={15} /> : <CheckCircle2 size={15} />}
    </span>
  );
}

function buildOptions(questions: StructuredQuestionRecord[]) {
  return {
    papers: unique(questions.map((question) => question.paper)),
    years: unique(questions.map((question) => String(question.year ?? "")).filter(Boolean)),
    sessions: unique(questions.map((question) => question.session)),
    topics: unique(questions.flatMap((question) => question.topics)),
    tags: unique(questions.flatMap((question) => question.tags)),
    reviewStatuses: unique(questions.map((question) => question.reviewStatus))
  };
}

function matchesMulti(values: string[], filter: MultiFilterState) {
  if (filter.values.length === 0) return true;
  return filter.mode === "all" ? filter.values.every((value) => values.includes(value)) : filter.values.some((value) => values.includes(value));
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function formatPages(start: number | null, end: number | null) {
  if (!start || !end) return "-";
  return `${start}-${end}`;
}

function resolveWorkspacePath(workspaceRoot: string | undefined, filePath: string) {
  if (!filePath) return "";
  if (/^[a-z]:[\\/]/i.test(filePath) || filePath.startsWith("\\\\")) return filePath;
  return workspaceRoot ? `${workspaceRoot}\\${filePath}` : filePath;
}

function toFileUrl(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `file://${encodeURI(prefixed)}`;
}

function draftFromQuestion(question: StructuredQuestionRecord): MetadataDraft {
  return {
    session: question.session,
    year: question.year === null ? "" : String(question.year),
    paper: question.paper,
    paperVersion: question.paperVersion,
    marks: question.marks === null ? "" : String(question.marks),
    reviewStatus: question.reviewStatus,
    reviewReason: question.reviewReason,
    topicsText: question.topics.join("\n"),
    tagsText: question.tags.join("\n")
  };
}

function splitMetadataLines(value: string) {
  return unique(value.split(/[;\n]/).map((item) => item.trim()).filter(Boolean));
}

function readBasket() {
  try {
    const parsed = JSON.parse(localStorage.getItem(basketStorageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
