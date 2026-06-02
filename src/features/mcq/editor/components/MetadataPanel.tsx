import { AlertTriangle, CheckCircle2, RotateCcw, Search, Tags, Wand2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { McqEditorMetadata } from "../types";
import { defaultMetadata, getMetadataIssues, hasDuplicatePlaceholder, parseExamCode } from "../metadataDefaults";
import { teacherDeskApi } from "../../../../lib/rendererApi";

type MetadataPanelProps = {
  metadata: McqEditorMetadata;
  onChange: (updater: (metadata: McqEditorMetadata) => McqEditorMetadata) => void;
};

export function MetadataPanel({ metadata, onChange }: MetadataPanelProps) {
  const [topicQuery, setTopicQuery] = useState("");
  const [tagQuery, setTagQuery] = useState("");
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const issues = getMetadataIssues(metadata);
  const parsed = parseExamCode(metadata.examCode);
  const duplicateWarning = hasDuplicatePlaceholder(metadata);

  useEffect(() => {
    let cancelled = false;
    void refreshSuggestions(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [metadata.paper]);

  async function refreshSuggestions(isCancelled = () => false) {
    const [questions, structuredQuestions] = await Promise.all([
      teacherDeskApi.listMcqQuestions(),
      teacherDeskApi.listStructuredQuestions().catch(() => [])
    ]);
    if (isCancelled()) return;
    const stage = paperStage(metadata.paper);
    setTopicSuggestions(uniqueSorted([
      ...questions.filter((question) => paperStage(question.paper) === stage).flatMap((question) => question.topics),
      ...structuredQuestions.filter((question) => paperStage(question.paper) === stage).flatMap((question) => question.topics)
    ]));
    setTagSuggestions(uniqueSorted([
      ...questions.flatMap((question) => question.tags),
      ...structuredQuestions.flatMap((question) => question.tags)
    ]));
  }

  function update<K extends keyof McqEditorMetadata>(key: K, value: McqEditorMetadata[K]) {
    onChange((current) => ({ ...current, [key]: value }));
  }

  function applyParsedCode() {
    const nextParsed = parseExamCode(metadata.examCode);
    if (!nextParsed) return;
    onChange((current) => ({ ...current, ...nextParsed }));
  }

  function applyLastDefaults() {
    onChange((current) => ({
      ...current,
      examCode: defaultMetadata.examCode,
      syllabus: defaultMetadata.syllabus,
      session: defaultMetadata.session,
      year: defaultMetadata.year,
      paper: defaultMetadata.paper,
      paperVersion: defaultMetadata.paperVersion
    }));
  }

  return (
    <div className="mcq-metadata-panel">
      <header className="mcq-metadata-header">
        <div>
          <span>Question metadata</span>
          <strong>{issues.length > 0 || duplicateWarning ? "Needs attention" : "Ready"}</strong>
        </div>
        <span className={clsx("mcq-metadata-status", issues.length > 0 || duplicateWarning ? "is-warning" : "is-ready")}>
          {issues.length > 0 ? `${issues.length} required fields missing` : duplicateWarning ? "Duplicate warning" : "Valid"}
        </span>
      </header>

      <MetadataSection title="Identity">
        <div className="mcq-metadata-identity-row">
          <label className="mcq-control">
            <span>Exam code</span>
            <div className="mcq-inline-input-action">
              <input value={metadata.examCode} onChange={(event) => update("examCode", event.target.value)} />
              <button aria-label="Parse exam code" type="button" onClick={applyParsedCode}>
                <Wand2 size={14} />
              </button>
            </div>
          </label>
          <label className="mcq-control">
            <span>Original question number</span>
            <input
              className={!metadata.originalQuestionNumber.trim() ? "has-warning" : undefined}
              value={metadata.originalQuestionNumber}
              onChange={(event) => update("originalQuestionNumber", event.target.value)}
            />
          </label>
        </div>
        <div className={clsx("mcq-metadata-parse-line", parsed ? "is-ok" : "is-warning")}>
          {parsed ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {parsed ? "Exam code parsed successfully." : "Exam code format should look like 9702_w25_qp_11."}
        </div>
        <div className={clsx("mcq-metadata-parse-line", duplicateWarning && "is-warning")}>
          <AlertTriangle size={14} />
          {duplicateWarning ? "A question with this exam code and number may already exist." : "Duplicate check will run before save."}
        </div>
      </MetadataSection>

      <MetadataSection title="Parsed paper">
        <div className="mcq-metadata-paper-grid">
          <TextField label="Syllabus" value={metadata.syllabus} onChange={(value) => update("syllabus", value)} />
          <SelectField label="Session" value={metadata.session} options={["Feb/March", "May/June", "Oct/Nov"]} onChange={(value) => update("session", value)} />
          <TextField label="Year" value={metadata.year} onChange={(value) => update("year", value)} />
          <SelectField label="Paper" value={metadata.paper} options={["Paper 1", "Paper 2", "Paper 3", "Paper 4", "Paper 5"]} onChange={(value) => update("paper", value)} />
          <TextField label="Version" value={metadata.paperVersion} onChange={(value) => update("paperVersion", value)} />
        </div>
      </MetadataSection>

      <MetadataSection title="Classification">
        <div className="mcq-metadata-classification-row">
          <label className="mcq-control">
            <span>Marks</span>
            <input min={1} max={40} type="number" value={metadata.marks} onChange={(event) => update("marks", Number(event.target.value))} />
          </label>
          <SelectField label="Difficulty" value={metadata.difficulty} options={["Easy", "Medium", "Hard"]} onChange={(value) => update("difficulty", value as McqEditorMetadata["difficulty"])} />
          <SelectField label="Review status" value={metadata.reviewStatus} options={["Draft", "Ready", "Needs review"]} onChange={(value) => update("reviewStatus", value as McqEditorMetadata["reviewStatus"])} />
        </div>
      </MetadataSection>

      <MetadataSection title="Topics">
        <TokenSelect
          ariaLabel="Topic search"
          emptyWarning={metadata.topics.length === 0}
          options={topicSuggestions}
          placeholder="Search or create topic"
          query={topicQuery}
          selected={metadata.topics}
          onQueryChange={setTopicQuery}
          onFocus={() => void refreshSuggestions()}
          onSelectedChange={(topics) => update("topics", topics)}
        />
      </MetadataSection>

      <MetadataSection title="Tags">
        <TokenSelect
          ariaLabel="Tag search"
          emptyWarning={metadata.tags.length === 0}
          options={tagSuggestions}
          placeholder="Search or create tag"
          query={tagQuery}
          selected={metadata.tags}
          onQueryChange={setTagQuery}
          onFocus={() => void refreshSuggestions()}
          onSelectedChange={(tags) => update("tags", tags)}
        />
      </MetadataSection>

      <MetadataSection title="Teacher notes">
        <label className="mcq-control mcq-control-full">
          <span>Private notes</span>
          <textarea
            placeholder="Private notes for review or teaching use"
            value={metadata.teacherNotes}
            onChange={(event) => update("teacherNotes", event.target.value)}
          />
        </label>
      </MetadataSection>

      <MetadataSection title="Validation">
        <div className="mcq-metadata-validation-list">
          {parsed ? <ValidationLine ok text="Exam code parsed successfully." /> : <ValidationLine text="Exam code could not be parsed." />}
          {duplicateWarning ? <ValidationLine text="Possible duplicate exam code and original question number." /> : null}
          {issues.map((issue) => (
            <ValidationLine key={issue} text={issue} />
          ))}
          {issues.length === 0 && !duplicateWarning ? <ValidationLine ok text="Metadata is valid." /> : null}
        </div>
      </MetadataSection>

      <div className="mcq-metadata-footer-actions">
        <button type="button" onClick={() => onChange(() => ({ ...defaultMetadata, examCode: "", syllabus: "", session: "", year: "", paper: "", paperVersion: "" }))}>
          <X size={14} />
          Clear metadata
        </button>
        <button type="button" onClick={applyLastDefaults}>
          <RotateCcw size={14} />
          Apply last paper defaults
        </button>
        <button type="button">
          <Search size={14} />
          Re-check duplicate
        </button>
      </div>
    </div>
  );
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function paperStage(paper: string) {
  const match = /(?:paper\s*)?(\d+)/i.exec(paper);
  const paperNumber = match ? Number(match[1]) : 1;
  return paperNumber <= 3 ? "AS" : "A2";
}

function MetadataSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mcq-inspector-section">
      <h3>
        <Tags size={15} />
        {title}
      </h3>
      {children}
    </section>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mcq-control">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="mcq-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function TokenSelect({
  ariaLabel,
  emptyWarning,
  options,
  placeholder,
  query,
  selected,
  onQueryChange,
  onFocus,
  onSelectedChange
}: {
  ariaLabel: string;
  emptyWarning: boolean;
  options: string[];
  placeholder: string;
  query: string;
  selected: string[];
  onQueryChange: (query: string) => void;
  onFocus?: () => void;
  onSelectedChange: (selected: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedSelected = useMemo(() => selected.map((item) => item.toLowerCase()), [selected]);
  const trimmedQuery = query.trim();
  const filtered = useMemo(
    () =>
      trimmedQuery.length === 0
        ? []
        : options.filter((option) => !normalizedSelected.includes(option.toLowerCase()) && option.toLowerCase().includes(trimmedQuery.toLowerCase())),
    [normalizedSelected, options, trimmedQuery]
  );
  const canCreate =
    trimmedQuery.length > 0 &&
    !options.some((option) => option.toLowerCase() === trimmedQuery.toLowerCase()) &&
    !normalizedSelected.includes(trimmedQuery.toLowerCase());

  function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSelectedChange([...selected, trimmed]);
    onQueryChange("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className={clsx("mcq-token-select", emptyWarning && "has-warning")}>
      <div className="mcq-token-row">
        {selected.map((item) => (
          <span key={item}>
            {item}
            <button
              aria-label={`Remove ${item}`}
              type="button"
              onClick={() => {
                onSelectedChange(selected.filter((value) => value !== item));
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="mcq-token-search">
        <Search size={14} />
        <input
          ref={inputRef}
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={onFocus}
          onKeyDown={(event) => {
            if (event.key === "Enter" && trimmedQuery) {
              event.preventDefault();
              add(filtered[0] ?? trimmedQuery);
            }
          }}
        />
      </div>
      {trimmedQuery ? (
        <div className="mcq-token-suggestions">
          {filtered.slice(0, 6).map((option) => (
            <button key={option} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => add(option)}>
              {option}
            </button>
          ))}
          {canCreate ? (
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => add(query)}>
              Create "{trimmedQuery}"
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ValidationLine({ ok, text }: { ok?: boolean; text: string }) {
  return (
    <div className={clsx("mcq-metadata-validation-line", ok && "is-ok")}>
      {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
      {text}
    </div>
  );
}
