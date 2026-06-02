import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  ListX,
  Pencil,
  RefreshCw,
  Search,
  ShoppingBasket,
  Square,
  SquareCheckBig,
  Tags,
  Trash2
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { teacherDeskApi } from "../../../lib/rendererApi";
import type { McqQuestionRecord, StructuredQuestionRecord } from "../../../types";

type MetadataTab = "topics" | "tags" | "papers" | "review";
type SortKey = "name" | "structured" | "mcq" | "state";
type SortDirection = "asc" | "desc";
type MatchMode = "any" | "all";

type MetadataItem = {
  name: string;
  structuredCount: number;
  mcqCount: number;
  aliases: string[];
  questions: StructuredQuestionRecord[];
  mcqQuestions: McqQuestionRecord[];
};

const tabLabels: Record<MetadataTab, string> = {
  topics: "Topics",
  tags: "Tags",
  papers: "Papers",
  review: "Review"
};

const singularLabels: Record<MetadataTab, string> = {
  topics: "Topic",
  tags: "Tag",
  papers: "Paper",
  review: "Review status"
};

const editableTabs = new Set<MetadataTab>(["topics", "tags"]);
const basketStorageKey = "teacherdesk.structuredExamBasket";
const pageSizeOptions = [10, 16, 24];

export function StructuredMetadataPage() {
  const [structuredQuestions, setStructuredQuestions] = useState<StructuredQuestionRecord[]>([]);
  const [mcqQuestions, setMcqQuestions] = useState<McqQuestionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<MetadataTab>("topics");
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [draftName, setDraftName] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("structured");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(16);
  const [matchMode, setMatchMode] = useState<MatchMode>("any");
  const [basketIds, setBasketIds] = useState<string[]>(() => readBasketIds());
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void loadMetadata();
  }, []);

  useEffect(() => {
    localStorage.setItem(basketStorageKey, JSON.stringify(basketIds));
  }, [basketIds]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const items = useMemo(() => buildItems(structuredQuestions, mcqQuestions, activeTab), [activeTab, mcqQuestions, structuredQuestions]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.name.toLowerCase().includes(query) || item.aliases.some((alias) => alias.toLowerCase().includes(query)));
  }, [items, search]);
  const sortedItems = useMemo(() => sortItems(filteredItems, sortKey, sortDirection), [filteredItems, sortDirection, sortKey]);
  const pageCount = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = sortedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedItems = sortedItems.filter((item) => selectedNames.has(item.name));
  const selected = selectedItems[0] ?? sortedItems.find((item) => item.name === selectedName) ?? sortedItems[0] ?? null;
  const linkedQuestions = selectedItems.length > 0 ? buildLinkedQuestions(structuredQuestions, activeTab, selectedItems.map((item) => item.name), matchMode) : selected?.questions ?? [];
  const selectedOnPageCount = pageItems.filter((item) => selectedNames.has(item.name)).length;
  const linkedSelectionCount = linkedQuestions.filter((question) => selectedQuestionIds.has(question.id)).length;
  const canEditName = editableTabs.has(activeTab);
  const renameSources = selectedItems.length > 0 ? selectedItems : selected ? [selected] : [];

  useEffect(() => {
    setDraftName(selected?.name ?? "");
    window.setTimeout(() => {
      if (selected && editableTabs.has(activeTab)) {
        nameInputRef.current?.focus();
      }
    }, 0);
  }, [selected?.name]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  async function loadMetadata() {
    setIsLoading(true);
    try {
      const [structuredRows, mcqRows] = await Promise.all([
        teacherDeskApi.listStructuredQuestions(),
        teacherDeskApi.listMcqQuestions().catch(() => [])
      ]);
      setStructuredQuestions(structuredRows);
      setMcqQuestions(mcqRows);
      setSelectedName((current) => current ?? buildItems(structuredRows, mcqRows, activeTab)[0]?.name ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load structured metadata.");
    } finally {
      setIsLoading(false);
    }
  }

  function selectTab(tab: MetadataTab) {
    setActiveTab(tab);
    const nextItems = buildItems(structuredQuestions, mcqQuestions, tab);
    setSelectedName(nextItems[0]?.name ?? null);
    setSelectedNames(new Set());
    setSelectedQuestionIds(new Set());
    setSearch("");
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    setSortKey(key);
    setSortDirection((current) => (sortKey === key && current === "asc" ? "desc" : "asc"));
  }

  function toggleMetadataSelection(name: string) {
    setSelectedName(name);
    setSelectedNames((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function setPageSelection(selectedState: boolean) {
    setSelectedNames((current) => {
      const next = new Set(current);
      pageItems.forEach((item) => selectedState ? next.add(item.name) : next.delete(item.name));
      return next;
    });
  }

  function setAllFilteredSelection(selectedState: boolean) {
    if (!selectedState) {
      setSelectedNames(new Set());
      return;
    }
    setSelectedNames(new Set(sortedItems.map((item) => item.name)));
  }

  function toggleQuestionSelection(id: string) {
    setSelectedQuestionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSelectedQuestionsToBasket() {
    const ids = linkedQuestions.filter((question) => selectedQuestionIds.has(question.id)).map((question) => question.id);
    if (ids.length === 0) return;
    setBasketIds((current) => Array.from(new Set([...current, ...ids])));
    setMessage(`Added ${ids.length} selected structured question${ids.length === 1 ? "" : "s"} to the basket.`);
  }

  function addAllLinkedQuestionsToBasket() {
    const ids = linkedQuestions.map((question) => question.id);
    if (ids.length === 0) return;
    setBasketIds((current) => Array.from(new Set([...current, ...ids])));
    setMessage(`Added ${ids.length} linked structured question${ids.length === 1 ? "" : "s"} to the basket.`);
  }

  async function renameSelected() {
    if (!selected || !editableTabs.has(activeTab)) return;
    const next = draftName.trim();
    const namesToMerge = selectedItems.length > 0 ? selectedItems.map((item) => item.name) : [selected.name];
    if (!next || (namesToMerge.length === 1 && next === selected.name)) return;
    const targets = uniqueQuestions(
      namesToMerge.length > 1
        ? buildLinkedQuestions(structuredQuestions, activeTab, namesToMerge, "any")
        : selected.questions
    );
    const mcqTargets = activeTab === "topics" || activeTab === "tags" ? uniqueMcqQuestions(buildLinkedMcqQuestions(mcqQuestions, activeTab, namesToMerge, "any")) : [];
    const action = namesToMerge.length > 1 ? `Merge ${namesToMerge.length} selected ${singularLabels[activeTab].toLowerCase()} entries into "${next}"` : `Rename "${selected.name}" to "${next}"`;
    if (!window.confirm(`${action} in ${targets.length} structured and ${mcqTargets.length} MCQ question(s)?`)) return;
    await Promise.all([
      updateStructuredQuestions(targets, (question) => renameValues(question, activeTab, namesToMerge, next)),
      updateMcqQuestions(mcqTargets, (question) => renameMcqValues(question, activeTab, namesToMerge, next))
    ]);
    setSelectedName(next);
    setSelectedNames(new Set());
    setMessage(namesToMerge.length > 1 ? `Merged ${namesToMerge.length} entries into ${next}.` : `Renamed ${selected.name} to ${next}.`);
  }

  async function removeSelected() {
    if (!selected || !editableTabs.has(activeTab)) return;
    const mcqTargets = activeTab === "topics" || activeTab === "tags" ? selected.mcqQuestions : [];
    if (!window.confirm(`Remove "${selected.name}" from ${selected.structuredCount} structured and ${mcqTargets.length} MCQ question(s)? This does not delete the questions.`)) return;
    await Promise.all([
      updateStructuredQuestions(selected.questions, (question) => removeValue(question, activeTab, selected.name)),
      updateMcqQuestions(mcqTargets, (question) => removeMcqValue(question, activeTab, selected.name))
    ]);
    setSelectedName(null);
    setMessage(`Removed ${selected.name} from linked structured questions.`);
  }

  async function updateStructuredQuestions(targets: StructuredQuestionRecord[], transform: (question: StructuredQuestionRecord) => StructuredQuestionRecord) {
    if (targets.length === 0) return;
    setIsSaving(true);
    try {
      for (const question of targets) {
        const next = transform(question);
        await teacherDeskApi.updateStructuredQuestionMetadata({
          id: next.id,
          session: next.session,
          year: next.year,
          paper: next.paper,
          paperVersion: next.paperVersion,
          marks: next.marks,
          reviewStatus: next.reviewStatus,
          reviewReason: next.reviewReason,
          topics: next.topics,
          tags: next.tags
        });
      }
      await loadMetadata();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update structured metadata.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateMcqQuestions(targets: McqQuestionRecord[], transform: (question: McqQuestionRecord) => McqQuestionRecord) {
    if (targets.length === 0) return;
    setIsSaving(true);
    try {
      for (const question of targets) {
        const next = transform(question);
        await teacherDeskApi.saveMcqQuestion({
          id: next.id,
          metadata: next.questionJson.metadata,
          blocks: next.questionJson.blocks,
          searchableText: buildMcqSearchableText(next),
          rendererVersion: next.questionJson.rendererVersion
        });
      }
      await loadMetadata();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update MCQ metadata.");
    } finally {
      setIsSaving(false);
    }
  }

  const emptyCount = activeTab === "topics" ? structuredQuestions.filter((question) => question.topics.length === 0).length : activeTab === "tags" ? structuredQuestions.filter((question) => question.tags.length === 0).length : 0;
  const duplicateCount = items.filter((item) => item.aliases.length > 0).length;

  return (
    <div className="structured-meta-page">
      <section className="structured-meta-toolbar">
        <label className="structured-meta-search">
          <Search size={16} />
          <input value={search} placeholder="Search structured metadata" onChange={(event) => setSearch(event.target.value)} />
        </label>
        <div className="structured-meta-tabs">
          {(Object.keys(tabLabels) as MetadataTab[]).map((tab) => (
            <button key={tab} className={activeTab === tab ? "is-active" : undefined} type="button" onClick={() => selectTab(tab)}>
              {tabLabels[tab]}
            </button>
          ))}
        </div>
        <button title="Refresh metadata" type="button" onClick={() => void loadMetadata()}>
          <RefreshCw className={isLoading ? "is-spinning" : undefined} size={15} />
        </button>
      </section>

      <div className="structured-meta-content">
        <section className="structured-meta-list-card">
          <header>
            <div>
              <h2>{tabLabels[activeTab]}</h2>
              <span>{filteredItems.length} entries from {structuredQuestions.length} structured questions</span>
            </div>
            <div className="structured-meta-health">
              <span className={emptyCount > 0 ? "is-warning" : "is-ok"}>{emptyCount} empty</span>
              <span className={duplicateCount > 0 ? "is-warning" : "is-ok"}>{duplicateCount} review</span>
            </div>
          </header>

          <div className="structured-meta-selection-toolbar">
            <strong>{selectedNames.size} selected</strong>
            <button title="Select all filtered rows" type="button" onClick={() => setAllFilteredSelection(true)}><ListChecks size={15} /></button>
            <button title="Deselect all selected rows" type="button" onClick={() => setAllFilteredSelection(false)}><ListX size={15} /></button>
            <button title="Select all rows on this page" type="button" onClick={() => setPageSelection(true)}><SquareCheckBig size={15} /></button>
            <button title="Deselect all rows on this page" type="button" onClick={() => setPageSelection(false)}><Square size={15} /></button>
            <span>{selectedOnPageCount} on this page</span>
          </div>

          <div className="structured-meta-table">
            <div className="structured-meta-table-head">
              <span></span>
              <button type="button" onClick={() => toggleSort("name")}>Name <SortIcon active={sortKey === "name"} direction={sortDirection} /></button>
              <button type="button" onClick={() => toggleSort("structured")}>Structured <SortIcon active={sortKey === "structured"} direction={sortDirection} /></button>
              <button type="button" onClick={() => toggleSort("mcq")}>MCQ <SortIcon active={sortKey === "mcq"} direction={sortDirection} /></button>
              <button type="button" onClick={() => toggleSort("state")}>State <SortIcon active={sortKey === "state"} direction={sortDirection} /></button>
            </div>
            {pageItems.map((item) => (
              <button key={item.name} className={clsx(item.name === selected?.name && "is-selected", selectedNames.has(item.name) && "is-checked")} type="button" onClick={() => setSelectedName(item.name)}>
                <span className="structured-meta-row-check" title={selectedNames.has(item.name) ? "Deselect row" : "Select row"} onClick={(event) => { event.stopPropagation(); toggleMetadataSelection(item.name); }}>
                  {selectedNames.has(item.name) ? <SquareCheckBig size={15} /> : <Square size={15} />}
                </span>
                <strong>{item.name}</strong>
                <span>{item.structuredCount}</span>
                <span>{item.mcqCount}</span>
                <em className={item.aliases.length ? "is-warning" : "is-ok"}>{item.aliases.length ? "Review" : "Clean"}</em>
              </button>
            ))}
            {pageItems.length === 0 ? <div className="structured-meta-empty">No metadata matches this search.</div> : null}
          </div>

          <footer className="structured-meta-pagination">
            <span>{sortedItems.length === 0 ? "0" : `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, sortedItems.length)}`} of {sortedItems.length}</span>
            <label>Rows <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{pageSizeOptions.map((size) => <option key={size}>{size}</option>)}</select></label>
            <button disabled={currentPage <= 1} title="Previous page" type="button" onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={15} /></button>
            <strong>{currentPage} / {pageCount}</strong>
            <button disabled={currentPage >= pageCount} title="Next page" type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRight size={15} /></button>
          </footer>
        </section>

        <aside className="structured-meta-detail-card">
          {selected ? (
            <>
              <header>
                <div>
                  <span>{singularLabels[activeTab]} details</span>
                  <strong>{selected.name}</strong>
                </div>
                <span className="structured-meta-count-pill">{selected.structuredCount} structured</span>
              </header>

              <section>
                <label className="structured-meta-field">
                  <span>Name</span>
                  <input
                    ref={nameInputRef}
                    autoComplete="off"
                    disabled={!canEditName}
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void renameSelected();
                    }}
                    placeholder={canEditName ? `Rename selected ${singularLabels[activeTab].toLowerCase()}` : `${singularLabels[activeTab]} names are read-only here`}
                  />
                </label>
                <div className="structured-meta-action-row">
                  <button disabled={!canEditName || isSaving || !draftName.trim() || renameSources.length === 0 || (renameSources.length === 1 && draftName.trim() === renameSources[0].name)} type="button" onClick={() => void renameSelected()}>
                    <Pencil size={14} /> {renameSources.length > 1 ? "Merge selected" : "Rename"}
                  </button>
                  <button className="is-danger" disabled={!canEditName || isSaving} type="button" onClick={() => void removeSelected()}>
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </section>

              <section className="structured-meta-logic-card">
                <div>
                  <strong>Linked structured questions</strong>
                  <span>{linkedQuestions.length} match{linkedQuestions.length === 1 ? "" : "es"} - {linkedSelectionCount} selected - {basketIds.length} in basket</span>
                </div>
                <div className="structured-meta-logic-toggle">
                  <button className={matchMode === "any" ? "is-active" : undefined} disabled={selectedItems.length < 2} type="button" onClick={() => setMatchMode("any")}>Any</button>
                  <button className={matchMode === "all" ? "is-active" : undefined} disabled={selectedItems.length < 2} type="button" onClick={() => setMatchMode("all")}>All</button>
                </div>
              </section>

              <section className="structured-meta-question-actions">
                <button disabled={linkedSelectionCount === 0} type="button" onClick={addSelectedQuestionsToBasket}><ShoppingBasket size={14} /> Add selected</button>
                <button disabled={linkedQuestions.length === 0} type="button" onClick={addAllLinkedQuestionsToBasket}><ListChecks size={14} /> Add all</button>
              </section>

              <section className="structured-meta-linked-list">
                {linkedQuestions.map((question) => (
                  <button key={question.id} className={clsx(selectedQuestionIds.has(question.id) && "is-selected", basketIds.includes(question.id) && "is-basketed")} type="button" onClick={() => toggleQuestionSelection(question.id)}>
                    {selectedQuestionIds.has(question.id) ? <SquareCheckBig size={15} /> : <Square size={15} />}
                    <span>
                      <strong>{question.examCode} #{question.questionNumber}</strong>
                      <em>{question.paper} v{question.paperVersion} - {question.marks ?? "-"} marks</em>
                    </span>
                    <ShoppingBasket size={14} />
                  </button>
                ))}
              </section>

              <section className={clsx("structured-meta-warning-card", selected.aliases.length === 0 && "is-ok")}>
                {selected.aliases.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                <div>
                  <strong>{selected.aliases.length ? "Possible duplicate naming" : "Looks clean"}</strong>
                  <p>{selected.aliases.length ? `Similar entries: ${selected.aliases.join(", ")}` : "No close duplicate names were detected for this value."}</p>
                </div>
              </section>
            </>
          ) : (
            <div className="structured-meta-detail-empty">
              <Tags size={28} />
              <strong>No metadata selected</strong>
              <span>Select an entry to inspect linked structured questions.</span>
            </div>
          )}
        </aside>
      </div>

      {message ? (
        <div className="td-app-notice">
          {message}
          <button type="button" onClick={() => setMessage(null)}>Dismiss</button>
        </div>
      ) : null}
    </div>
  );
}

function buildItems(structuredQuestions: StructuredQuestionRecord[], mcqQuestions: McqQuestionRecord[], tab: MetadataTab): MetadataItem[] {
  const groups = new Map<string, StructuredQuestionRecord[]>();
  for (const question of structuredQuestions) {
    for (const raw of getStructuredValues(question, tab)) {
      const value = raw.trim();
      if (!value) continue;
      groups.set(value, [...(groups.get(value) ?? []), question]);
    }
  }

  const mcqGroups = new Map<string, McqQuestionRecord[]>();
  if (tab === "topics" || tab === "tags") {
    for (const question of mcqQuestions) {
      const values = tab === "topics" ? question.topics : question.tags;
      for (const raw of values) {
        const value = raw.trim();
        if (!value) continue;
        mcqGroups.set(value, [...(mcqGroups.get(value) ?? []), question]);
      }
    }
  }

  const names = Array.from(new Set([...groups.keys(), ...mcqGroups.keys()]));
  return names.map((name) => ({
    name,
    structuredCount: groups.get(name)?.length ?? 0,
    mcqCount: mcqGroups.get(name)?.length ?? 0,
    aliases: names.filter((other) => other !== name && normalizeName(other) === normalizeName(name)),
    questions: groups.get(name) ?? [],
    mcqQuestions: mcqGroups.get(name) ?? []
  }));
}

function getStructuredValues(question: StructuredQuestionRecord, tab: MetadataTab) {
  if (tab === "topics") return question.topics;
  if (tab === "tags") return question.tags;
  if (tab === "papers") return [`${question.paper} v${question.paperVersion}`];
  return [question.reviewStatus];
}

function sortItems(items: MetadataItem[], sortKey: SortKey, direction: SortDirection) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    let result = 0;
    if (sortKey === "name") result = a.name.localeCompare(b.name);
    if (sortKey === "structured") result = a.structuredCount - b.structuredCount;
    if (sortKey === "mcq") result = a.mcqCount - b.mcqCount;
    if (sortKey === "state") result = Number(a.aliases.length > 0) - Number(b.aliases.length > 0);
    return result * multiplier || a.name.localeCompare(b.name);
  });
}

function buildLinkedQuestions(questions: StructuredQuestionRecord[], tab: MetadataTab, names: string[], matchMode: MatchMode) {
  if (names.length === 0) return [];
  return questions.filter((question) => {
    const values = getStructuredValues(question, tab);
    return matchMode === "all" ? names.every((name) => values.includes(name)) : names.some((name) => values.includes(name));
  });
}

function buildLinkedMcqQuestions(questions: McqQuestionRecord[], tab: MetadataTab, names: string[], matchMode: MatchMode) {
  if (names.length === 0 || (tab !== "topics" && tab !== "tags")) return [];
  return questions.filter((question) => {
    const values = tab === "topics" ? question.topics : question.tags;
    return matchMode === "all" ? names.every((name) => values.includes(name)) : names.some((name) => values.includes(name));
  });
}

function renameValue(question: StructuredQuestionRecord, tab: MetadataTab, previous: string, next: string): StructuredQuestionRecord {
  if (tab === "topics") return { ...question, topics: replaceInList(question.topics, previous, next) };
  if (tab === "tags") return { ...question, tags: replaceInList(question.tags, previous, next) };
  return question;
}

function renameValues(question: StructuredQuestionRecord, tab: MetadataTab, previousValues: string[], next: string): StructuredQuestionRecord {
  return previousValues.reduce((current, previous) => renameValue(current, tab, previous, next), question);
}

function renameMcqValues(question: McqQuestionRecord, tab: MetadataTab, previousValues: string[], next: string): McqQuestionRecord {
  return previousValues.reduce((current, previous) => renameMcqValue(current, tab, previous, next), question);
}

function renameMcqValue(question: McqQuestionRecord, tab: MetadataTab, previous: string, next: string): McqQuestionRecord {
  const metadata = { ...question.questionJson.metadata } as Record<string, unknown>;
  if (tab === "topics") metadata.topics = replaceInList(question.topics, previous, next);
  if (tab === "tags") metadata.tags = replaceInList(question.tags, previous, next);
  return { ...question, questionJson: { ...question.questionJson, metadata } };
}

function removeValue(question: StructuredQuestionRecord, tab: MetadataTab, value: string): StructuredQuestionRecord {
  if (tab === "topics") return { ...question, topics: question.topics.filter((item) => item !== value) };
  if (tab === "tags") return { ...question, tags: question.tags.filter((item) => item !== value) };
  return question;
}

function removeMcqValue(question: McqQuestionRecord, tab: MetadataTab, value: string): McqQuestionRecord {
  const metadata = { ...question.questionJson.metadata } as Record<string, unknown>;
  if (tab === "topics") metadata.topics = question.topics.filter((item) => item !== value);
  if (tab === "tags") metadata.tags = question.tags.filter((item) => item !== value);
  return { ...question, questionJson: { ...question.questionJson, metadata } };
}

function replaceInList(items: string[], previous: string, next: string) {
  return Array.from(new Set(items.map((item) => (item === previous ? next : item)).filter(Boolean)));
}

function uniqueQuestions(questions: StructuredQuestionRecord[]) {
  return Array.from(new Map(questions.map((question) => [question.id, question])).values());
}

function uniqueMcqQuestions(questions: McqQuestionRecord[]) {
  return Array.from(new Map(questions.map((question) => [question.id, question])).values());
}

function buildMcqSearchableText(question: McqQuestionRecord) {
  const metadata = question.questionJson.metadata as Record<string, unknown>;
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
    ...(Array.isArray(metadata.topics) ? metadata.topics : []),
    ...(Array.isArray(metadata.tags) ? metadata.tags : [])
  ].map(String).join(" ");
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function readBasketIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(basketStorageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ArrowUpDown size={12} />;
  return direction === "asc" ? <ArrowDownAZ size={12} /> : <ArrowDownAZ className="is-desc" size={12} />;
}
