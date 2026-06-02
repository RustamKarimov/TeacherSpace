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
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { teacherDeskApi } from "../../../lib/rendererApi";
import type { McqQuestionRecord } from "../../../types";

type MetadataTab = "topics" | "tags" | "difficulty" | "statuses";

type MetadataItem = {
  name: string;
  count: number;
  kind: MetadataTab;
  aliases: string[];
  questions: McqQuestionRecord[];
};

type SortKey = "name" | "count" | "aliases" | "state";
type SortDirection = "asc" | "desc";
type MatchMode = "all" | "any";

const tabLabels: Record<MetadataTab, string> = {
  topics: "Topics",
  tags: "Tags",
  difficulty: "Difficulty",
  statuses: "Statuses"
};

const singularLabels: Record<MetadataTab, string> = {
  topics: "Topic",
  tags: "Tag",
  difficulty: "Difficulty",
  statuses: "Status"
};

const basketStorageKey = "teacherdesk.mcqExamBasket";
const pageSizeOptions = [8, 12, 20];

export function MetadataPage() {
  const [questions, setQuestions] = useState<McqQuestionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<MetadataTab>("topics");
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [draftName, setDraftName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [matchMode, setMatchMode] = useState<MatchMode>("any");
  const [basketIds, setBasketIds] = useState<string[]>(() => readBasketIds());

  useEffect(() => {
    void loadQuestions();
  }, []);

  async function loadQuestions() {
    const records = await teacherDeskApi.listMcqQuestions();
    setQuestions(records);
    setSelectedName((current) => current ?? buildItems(records, activeTab)[0]?.name ?? null);
  }

  const items = useMemo(() => buildItems(questions, activeTab), [questions, activeTab]);
  const filteredItems = items.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()) || item.aliases.some((alias) => alias.toLowerCase().includes(search.trim().toLowerCase())));
  const sortedItems = useMemo(() => sortItems(filteredItems, sortKey, sortDirection), [filteredItems, sortDirection, sortKey]);
  const pageCount = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const pageItems = sortedItems.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);
  const selectedItems = sortedItems.filter((item) => selectedNames.has(item.name));
  const selected = selectedItems[0] ?? sortedItems.find((item) => item.name === selectedName) ?? sortedItems[0] ?? null;
  const linkedQuestions = selectedItems.length > 0 ? buildLinkedQuestions(questions, activeTab, selectedItems.map((item) => item.name), matchMode) : selected?.questions ?? [];
  const linkedQuestionPageSelectionCount = linkedQuestions.filter((question) => selectedQuestionIds.has(question.id)).length;

  useEffect(() => {
    setDraftName(selected?.name ?? "");
  }, [selected?.name]);

  useEffect(() => {
    localStorage.setItem(basketStorageKey, JSON.stringify(basketIds));
  }, [basketIds]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  function selectTab(tab: MetadataTab) {
    setActiveTab(tab);
    const nextItems = buildItems(questions, tab);
    setSelectedName(nextItems[0]?.name ?? null);
    setSelectedNames(new Set());
    setSelectedQuestionIds(new Set());
    setSearch("");
    setPage(1);
  }

  async function renameSelected() {
    if (!selected) return;
    const next = draftName.trim();
    if (!next || next === selected.name) return;
    if (!window.confirm(`Rename "${selected.name}" to "${next}" in ${selected.count} question(s)?`)) return;
    await updateQuestions(selected.questions, (question) => renameMetadataValue(question, activeTab, selected.name, next));
    setSelectedName(next);
    setMessage(`Renamed ${selected.name} to ${next}.`);
  }

  async function removeSelected() {
    if (!selected) return;
    if (!window.confirm(`Remove "${selected.name}" from ${selected.count} question(s)? This does not delete the questions.`)) return;
    await updateQuestions(selected.questions, (question) => removeMetadataValue(question, activeTab, selected.name));
    setSelectedName(null);
    setMessage(`Removed ${selected.name} from linked questions.`);
  }

  async function updateQuestions(targets: McqQuestionRecord[], transform: (question: McqQuestionRecord) => McqQuestionRecord) {
    for (const question of targets) {
      const next = transform(question);
      await teacherDeskApi.saveMcqQuestion({
        id: next.id,
        metadata: next.questionJson.metadata,
        blocks: next.questionJson.blocks,
        searchableText: buildSearchableText(next),
        rendererVersion: next.questionJson.rendererVersion
      });
    }
    await loadQuestions();
  }

  const emptyCount = activeTab === "topics" ? questions.filter((question) => question.topics.length === 0).length : activeTab === "tags" ? questions.filter((question) => question.tags.length === 0).length : 0;
  const duplicateCount = items.filter((item) => item.aliases.length > 0).length;
  const selectedOnPageCount = pageItems.filter((item) => selectedNames.has(item.name)).length;

  function toggleSort(key: SortKey) {
    setSortKey(key);
    setSortDirection((current) => (sortKey === key && current === "asc" ? "desc" : "asc"));
  }

  function toggleMetadataSelection(name: string) {
    setSelectedNames((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function setPageSelection(selected: boolean) {
    setSelectedNames((current) => {
      const next = new Set(current);
      pageItems.forEach((item) => selected ? next.add(item.name) : next.delete(item.name));
      return next;
    });
  }

  function setAllFilteredSelection(selected: boolean) {
    setSelectedNames((current) => {
      if (!selected) return new Set();
      const next = new Set(current);
      sortedItems.forEach((item) => next.add(item.name));
      return next;
    });
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
    setMessage(`Added ${ids.length} selected question${ids.length === 1 ? "" : "s"} to the exam basket.`);
  }

  function addAllLinkedQuestionsToBasket() {
    const ids = linkedQuestions.map((question) => question.id);
    setBasketIds((current) => Array.from(new Set([...current, ...ids])));
    setMessage(`Added ${ids.length} linked question${ids.length === 1 ? "" : "s"} to the exam basket.`);
  }

  return (
    <div className="mcq-metadata-page">
      <section className="mcq-metadata-toolbar">
        <label className="mcq-metadata-search">
          <Search size={16} />
          <input value={search} placeholder="Search metadata" onChange={(event) => setSearch(event.target.value)} />
        </label>
        <div className="mcq-metadata-tabs">
          {(Object.keys(tabLabels) as MetadataTab[]).map((tab) => (
            <button key={tab} className={activeTab === tab ? "is-active" : undefined} type="button" onClick={() => selectTab(tab)}>
              {tabLabels[tab]}
            </button>
          ))}
        </div>
        <button className="mcq-metadata-icon-action" title="Refresh metadata" type="button" onClick={() => void loadQuestions()}>
          <RefreshCw size={15} />
        </button>
      </section>

      <div className="mcq-metadata-content">
        <section className="mcq-metadata-list-card">
          <header>
            <div>
              <h2>{tabLabels[activeTab]}</h2>
              <span>{filteredItems.length} entries from {questions.length} saved questions</span>
            </div>
            <div className="mcq-metadata-health">
              <span className={emptyCount > 0 ? "is-warning" : "is-ok"}>{emptyCount} empty</span>
              <span className={duplicateCount > 0 ? "is-warning" : "is-ok"}>{duplicateCount} review</span>
            </div>
          </header>

          <div className="mcq-metadata-selection-toolbar">
            <strong>{selectedNames.size} selected</strong>
            <button title="Select all filtered rows" type="button" onClick={() => setAllFilteredSelection(true)}><ListChecks size={15} /></button>
            <button title="Deselect all selected rows" type="button" onClick={() => setAllFilteredSelection(false)}><ListX size={15} /></button>
            <button title="Select all rows on this page" type="button" onClick={() => setPageSelection(true)}><SquareCheckBig size={15} /></button>
            <button title="Deselect all rows on this page" type="button" onClick={() => setPageSelection(false)}><Square size={15} /></button>
            <span>{selectedOnPageCount} on this page</span>
          </div>

          <div className="mcq-metadata-table">
            <div className="mcq-metadata-table-head">
              <span></span>
              <button type="button" onClick={() => toggleSort("name")}>Name <SortIcon active={sortKey === "name"} direction={sortDirection} /></button>
              <button type="button" onClick={() => toggleSort("count")}>Questions <SortIcon active={sortKey === "count"} direction={sortDirection} /></button>
              <button type="button" onClick={() => toggleSort("aliases")}>Aliases <SortIcon active={sortKey === "aliases"} direction={sortDirection} /></button>
              <button type="button" onClick={() => toggleSort("state")}>State <SortIcon active={sortKey === "state"} direction={sortDirection} /></button>
            </div>
            {pageItems.map((item) => (
              <button key={item.name} className={clsx(item.name === selected?.name && "is-selected", selectedNames.has(item.name) && "is-checked")} type="button" onClick={() => setSelectedName(item.name)}>
                <span className="mcq-metadata-row-check" title={selectedNames.has(item.name) ? "Deselect row" : "Select row"} onClick={(event) => { event.stopPropagation(); toggleMetadataSelection(item.name); }}>
                  {selectedNames.has(item.name) ? <SquareCheckBig size={15} /> : <Square size={15} />}
                </span>
                <strong>{item.name}</strong>
                <span>{item.count}</span>
                <span>{item.aliases.length ? item.aliases.join(", ") : "None"}</span>
                <em className={item.aliases.length ? "is-warning" : "is-ok"}>{item.aliases.length ? "Review" : "Clean"}</em>
              </button>
            ))}
            {sortedItems.length === 0 ? <div className="mcq-metadata-empty">No metadata matches this search.</div> : null}
          </div>
          <footer className="mcq-metadata-pagination">
            <span>{sortedItems.length === 0 ? "0" : `${(Math.min(page, pageCount) - 1) * pageSize + 1}-${Math.min(Math.min(page, pageCount) * pageSize, sortedItems.length)}`} of {sortedItems.length}</span>
            <label>Rows <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{pageSizeOptions.map((size) => <option key={size}>{size}</option>)}</select></label>
            <button disabled={page <= 1} title="Previous page" type="button" onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={15} /></button>
            <strong>{Math.min(page, pageCount)} / {pageCount}</strong>
            <button disabled={page >= pageCount} title="Next page" type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRight size={15} /></button>
          </footer>
        </section>

        <aside className="mcq-metadata-detail-card">
          {selected ? (
            <>
              <header>
                <div>
                  <span>{singularLabels[activeTab]} details</span>
                  <strong>{selected.name}</strong>
                </div>
                <span className="mcq-metadata-count-pill">{selected.count} question{selected.count === 1 ? "" : "s"}</span>
              </header>

              <section>
                <label className="mcq-metadata-field">
                  <span>Name</span>
                  <input disabled={activeTab === "difficulty" || activeTab === "statuses"} value={draftName} onChange={(event) => setDraftName(event.target.value)} />
                </label>
                <div className="mcq-metadata-action-row">
                  <button disabled={activeTab === "difficulty" || activeTab === "statuses" || draftName.trim() === selected.name} type="button" onClick={() => void renameSelected()}>
                    <Pencil size={14} /> Rename / merge
                  </button>
                  <button className="is-danger" disabled={activeTab === "difficulty" || activeTab === "statuses"} type="button" onClick={() => void removeSelected()}>
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </section>

              <section className="mcq-metadata-logic-card">
                <div>
                  <strong>Linked questions</strong>
                  <span>{linkedQuestions.length} match{linkedQuestions.length === 1 ? "" : "es"} · {basketIds.length} in basket</span>
                </div>
                <div className="mcq-metadata-logic-toggle">
                  <button className={matchMode === "any" ? "is-active" : undefined} disabled={selectedItems.length < 2} type="button" onClick={() => setMatchMode("any")}>Any</button>
                  <button className={matchMode === "all" ? "is-active" : undefined} disabled={selectedItems.length < 2} type="button" onClick={() => setMatchMode("all")}>All</button>
                </div>
              </section>

              <section className="mcq-metadata-question-actions">
                <button disabled={selectedQuestionIds.size === 0} title="Add selected linked questions to basket" type="button" onClick={addSelectedQuestionsToBasket}>
                  <ShoppingBasket size={14} /> Add selected
                </button>
                <button disabled={linkedQuestions.length === 0} title="Add all linked questions to basket" type="button" onClick={addAllLinkedQuestionsToBasket}>
                  <ListChecks size={14} /> Add all
                </button>
              </section>

              <section className="mcq-metadata-linked-list">
                {linkedQuestions.slice(0, 12).map((question) => (
                  <button key={question.id} className={clsx(selectedQuestionIds.has(question.id) && "is-selected", basketIds.includes(question.id) && "is-basketed")} type="button" onClick={() => toggleQuestionSelection(question.id)}>
                    {selectedQuestionIds.has(question.id) ? <SquareCheckBig size={15} /> : <Square size={15} />}
                    <span>
                      <strong>{question.examCode} #{question.originalQuestionNumber}</strong>
                      <em>{question.topics.join(", ") || "No topics"}</em>
                    </span>
                    <ShoppingBasket size={14} />
                  </button>
                ))}
                {linkedQuestions.length > 12 ? <small>{linkedQuestions.length - 12} more linked questions match this selection.</small> : null}
              </section>

              <section className={clsx("mcq-metadata-warning-card", selected.aliases.length === 0 && "is-ok")}>
                {selected.aliases.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                <div>
                  <strong>{selected.aliases.length ? "Possible cleanup" : "Looks clean"}</strong>
                  <p>{selected.aliases.length ? `Similar entries: ${selected.aliases.join(", ")}` : "No close duplicates were detected for this value."}</p>
                </div>
              </section>
            </>
          ) : (
            <div className="mcq-metadata-detail-empty">
              <Tags size={28} />
              <strong>No metadata selected</strong>
              <span>Select an entry from the table to inspect or clean it.</span>
            </div>
          )}
        </aside>
      </div>
      {message ? <div className="td-app-notice">{message}</div> : null}
    </div>
  );
}

function buildItems(questions: McqQuestionRecord[], kind: MetadataTab): MetadataItem[] {
  const groups = new Map<string, McqQuestionRecord[]>();
  for (const question of questions) {
    const values =
      kind === "topics"
        ? question.topics
        : kind === "tags"
          ? question.tags
          : kind === "difficulty"
            ? [question.difficulty]
            : [question.reviewStatus];
    for (const raw of values) {
      const value = raw.trim();
      if (!value) continue;
      groups.set(value, [...(groups.get(value) ?? []), question]);
    }
  }

  const names = [...groups.keys()];
  return names
    .map((name) => ({
      name,
      count: groups.get(name)?.length ?? 0,
      kind,
      aliases: names.filter((other) => other !== name && normalizeName(other) === normalizeName(name)),
      questions: groups.get(name) ?? []
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function sortItems(items: MetadataItem[], sortKey: SortKey, direction: SortDirection) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    let result = 0;
    if (sortKey === "name") result = a.name.localeCompare(b.name);
    if (sortKey === "count") result = a.count - b.count;
    if (sortKey === "aliases") result = a.aliases.length - b.aliases.length;
    if (sortKey === "state") result = Number(a.aliases.length > 0) - Number(b.aliases.length > 0);
    return result * multiplier || a.name.localeCompare(b.name);
  });
}

function buildLinkedQuestions(questions: McqQuestionRecord[], kind: MetadataTab, names: string[], matchMode: MatchMode) {
  if (names.length === 0) return [];
  return questions.filter((question) => {
    const values = kind === "topics" ? question.topics : kind === "tags" ? question.tags : kind === "difficulty" ? [question.difficulty] : [question.reviewStatus];
    return matchMode === "all" ? names.every((name) => values.includes(name)) : names.some((name) => values.includes(name));
  });
}

function renameMetadataValue(question: McqQuestionRecord, kind: MetadataTab, previous: string, next: string): McqQuestionRecord {
  const metadata = { ...question.questionJson.metadata } as Record<string, unknown>;
  if (kind === "topics") metadata.topics = replaceInList(question.topics, previous, next);
  if (kind === "tags") metadata.tags = replaceInList(question.tags, previous, next);
  if (kind === "difficulty") metadata.difficulty = next;
  if (kind === "statuses") metadata.reviewStatus = next;
  return { ...question, questionJson: { ...question.questionJson, metadata } };
}

function removeMetadataValue(question: McqQuestionRecord, kind: MetadataTab, value: string): McqQuestionRecord {
  const metadata = { ...question.questionJson.metadata } as Record<string, unknown>;
  if (kind === "topics") metadata.topics = question.topics.filter((item) => item !== value);
  if (kind === "tags") metadata.tags = question.tags.filter((item) => item !== value);
  return { ...question, questionJson: { ...question.questionJson, metadata } };
}

function replaceInList(items: string[], previous: string, next: string) {
  return Array.from(new Set(items.map((item) => (item === previous ? next : item)).filter(Boolean)));
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildSearchableText(question: McqQuestionRecord) {
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
  ]
    .map(String)
    .join(" ");
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
