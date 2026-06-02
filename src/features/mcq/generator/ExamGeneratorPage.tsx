import {
  BookOpen,
  FileCheck2,
  FileText,
  FolderOpen,
  Layers,
  Plus,
  RotateCw,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AppSettings, McqExamGeneratorResult, McqQuestionRecord, StructuredQuestionRecord, WorkspaceInfo } from "../../../types";
import { teacherDeskApi } from "../../../lib/rendererApi";

type GeneratorMode = "full-paper" | "topical-total" | "topical-custom" | "basket";
type HeaderFooterField = "headerLeft" | "headerCenter" | "headerRight" | "footerLeft" | "footerCenter" | "footerRight";

type TopicRow = {
  id: string;
  topics: string[];
  count: number;
  combination: boolean;
};

type GenerationSummary = {
  seed: string;
  titleFolder: string;
  files: string[];
};

const basketStorageKey = "teacherdesk.mcqExamBasket";
const snippets = ["{title}", "{variant}", "{date}", "{page}", "{pages}", "{syllabus}", "{paper}", "{teacher}"];
const hasDesktopBridge = Boolean(window.teacherDesk);
const hasBrowserFolderPicker = "showDirectoryPicker" in window;

export function ExamGeneratorPage({ settings, workspace }: { settings: AppSettings | null; workspace: WorkspaceInfo | null }) {
  const [questions, setQuestions] = useState<McqQuestionRecord[]>([]);
  const [structuredQuestions, setStructuredQuestions] = useState<StructuredQuestionRecord[]>([]);
  const [mode, setMode] = useState<GeneratorMode>("full-paper");
  const [title, setTitle] = useState(settings?.defaults.mcqGenerator.title ?? "AS Physics MCQ Practice");
  const [outputFolder, setOutputFolder] = useState(settings?.defaults.mcqGenerator.outputFolder || (workspace?.workspaceRoot ? `${workspace.workspaceRoot}\\mcq\\generated_exams` : "TeacherDesk_Workspace\\mcq\\generated_exams"));
  const [coverPageName, setCoverPageName] = useState("");
  const [questionCount, setQuestionCount] = useState(settings?.defaults.mcqGenerator.questionCount ?? 40);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [topicRows, setTopicRows] = useState<TopicRow[]>([
    { id: crypto.randomUUID(), topics: [], count: 10, combination: false }
  ]);
  const [variants, setVariants] = useState(settings?.defaults.mcqGenerator.variants ?? 1);
  const [questionNumberGap, setQuestionNumberGap] = useState(settings?.defaults.mcqGenerator.questionNumberGap ?? 7);
  const [questionGap, setQuestionGap] = useState(settings?.defaults.mcqGenerator.questionGap ?? 8);
  const [allowQuestionSplit, setAllowQuestionSplit] = useState(settings?.defaults.mcqGenerator.allowQuestionSplit ?? false);
  const [shuffleQuestions, setShuffleQuestions] = useState(settings?.defaults.mcqGenerator.shuffleQuestions ?? true);
  const [shuffleOptions, setShuffleOptions] = useState(settings?.defaults.mcqGenerator.shuffleOptions ?? true);
  const [includeCover, setIncludeCover] = useState(false);
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [processLog, setProcessLog] = useState<string[]>(["Ready to generate."]);
  const [generationError, setGenerationError] = useState("");
  const [headerFooter, setHeaderFooter] = useState<Record<HeaderFooterField, string>>((settings?.defaults.mcqGenerator.headerFooter as Record<HeaderFooterField, string>) ?? {
    headerLeft: "{title}",
    headerCenter: "{variant}",
    headerRight: "{date}",
    footerLeft: "TeacherDesk",
    footerCenter: "Page {page} of {pages}",
    footerRight: "{paper}"
  });
  const [summary, setSummary] = useState<GenerationSummary | null>(null);

  useEffect(() => {
    void teacherDeskApi.listMcqQuestions().then(setQuestions);
    void teacherDeskApi.listStructuredQuestions().then(setStructuredQuestions).catch(() => setStructuredQuestions([]));
  }, []);

  useEffect(() => {
    if (settings?.defaults.mcqGenerator.outputFolder) setOutputFolder(settings.defaults.mcqGenerator.outputFolder);
    else if (workspace?.workspaceRoot) setOutputFolder(`${workspace.workspaceRoot}\\mcq\\generated_exams`);
  }, [settings?.defaults.mcqGenerator.outputFolder, workspace?.workspaceRoot]);

  const allTopics = useMemo(() => unique([
    ...questions.filter((question) => paperStage(question.paper) === "AS").flatMap((question) => question.topics),
    ...structuredQuestions.filter((question) => paperStage(question.paper) === "AS").flatMap((question) => question.topics)
  ]), [questions, structuredQuestions]);
  const basketIds = useMemo(readBasketIds, []);
  const basketQuestions = useMemo(() => questions.filter((question) => basketIds.includes(question.id)), [basketIds, questions]);
  const availability = useMemo(
    () => buildAvailability({ mode, questionCount, questions, selectedTopics, topicRows, basketQuestions }),
    [basketQuestions, mode, questionCount, questions, selectedTopics, topicRows]
  );

  async function chooseOutputFolder() {
    setGenerationError("");
    setIsPickingFolder(true);
    setProcessLog((current) => ["Opening output folder picker...", ...current.slice(0, 5)]);
    try {
      const folder = await teacherDeskApi.pickOutputFolder(outputFolder);
      if (folder) {
        setOutputFolder(folder);
        setProcessLog((current) => [`Output folder selected: ${folder}`, ...current.slice(0, 5)]);
      } else {
        setProcessLog((current) => [
          hasDesktopBridge
            ? "Folder selection was cancelled. You can type the path directly in the output folder box."
            : "Native folder picker is only available in the TeacherDesk desktop window. Type the path directly here, or restart with Start TeacherDesk.bat.",
          ...current.slice(0, 5)
        ]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Folder picker failed.";
      setGenerationError(message);
      setProcessLog((current) => [`Folder picker failed: ${message}`, "Type the output path directly if needed.", ...current.slice(0, 4)]);
    } finally {
      setIsPickingFolder(false);
    }
  }

  function addTopicFromInput() {
    const topic = topicInput.trim();
    if (!topic || selectedTopics.includes(topic)) return;
    setSelectedTopics((current) => [...current, topic]);
    setTopicInput("");
  }

  function addTopicRow() {
    setTopicRows((current) => [...current, { id: crypto.randomUUID(), topics: [], count: 5, combination: false }]);
  }

  function updateTopicRow(id: string, patch: Partial<TopicRow>) {
    setTopicRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function generatePackage() {
    setGenerationError("");
    setSummary(null);
    setIsGenerating(true);
    const seed = crypto.randomUUID();
    try {
      if (!hasDesktopBridge) {
        throw new Error("PDF generation requires the TeacherDesk desktop app. Start TeacherDesk with Start TeacherDesk.bat so images, tables, and LaTeX are rendered correctly.");
      }
      setProcessLog(["Preparing question selection...", "Creating a new random seed for this run."]);
      const selectedQuestions = selectQuestionsForMode({ mode, questionCount, questions, selectedTopics, topicRows, basketQuestions });
      if (selectedQuestions.length === 0) {
        throw new Error("No questions match this generator setup. Add questions, select topics, or add questions to the basket first.");
      }
      setProcessLog((current) => [`Selected ${selectedQuestions.length} question${selectedQuestions.length === 1 ? "" : "s"}.`, ...current]);
      setProcessLog((current) => ["Sending package to local PDF writer...", ...current]);
      const questionPool = mode === "basket" ? selectedQuestions : questions;
      const result: McqExamGeneratorResult = await teacherDeskApi.generateMcqExamPackage({
        title,
        outputFolder,
        seed,
        mode,
        variants,
        selection: {
          mode,
          questionCount,
          selectedTopics,
          topicRows: topicRows.map((row) => ({ topics: row.topics, count: row.count, combination: row.combination })),
          basketIds
        },
        headerFooter,
        settings: {
          includeCover,
          coverPageName,
          questionNumberGap,
          questionGap,
          allowQuestionSplit,
          shuffleQuestions,
          shuffleOptions
        },
        questions: questionPool
      });
      setSummary({
        seed: result.seed,
        titleFolder: result.folderPath,
        files: result.files
      });
      setProcessLog((current) => [`Generated ${result.files.length} files.`, `Package folder: ${result.folderPath}`, ...current]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed.";
      setGenerationError(message);
      setProcessLog((current) => [`Error: ${message}`, ...current]);
    } finally {
      setIsGenerating(false);
    }
  }

  async function openGeneratedFolder() {
    if (!summary) return;
    setGenerationError("");
    setProcessLog((current) => [`Opening generated folder: ${summary.titleFolder}`, ...current.slice(0, 5)]);
    try {
      await teacherDeskApi.openFolder(summary.titleFolder);
      setProcessLog((current) => ["Generated folder opened.", ...current.slice(0, 5)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not open generated folder.";
      setGenerationError(message);
      setProcessLog((current) => [`Open folder failed: ${message}`, ...current.slice(0, 5)]);
    }
  }

  return (
    <div className="mcq-generator-page">
      <main className="mcq-generator-main">
        <section className="mcq-generator-mode-tabs" aria-label="Exam generator modes">
          <ModeButton active={mode === "full-paper"} icon={<FileText size={15} />} label="Full paper" onClick={() => setMode("full-paper")} />
          <ModeButton active={mode === "topical-total"} icon={<Layers size={15} />} label="Topical total number" onClick={() => setMode("topical-total")} />
          <ModeButton active={mode === "topical-custom"} icon={<BookOpen size={15} />} label="Topical" onClick={() => setMode("topical-custom")} />
          <ModeButton active={mode === "basket"} icon={<FileCheck2 size={15} />} label="From basket" onClick={() => setMode("basket")} />
        </section>

        <section className="mcq-generator-workarea">
          {mode === "full-paper" ? (
            <FullPaperMode questionCount={questionCount} onQuestionCountChange={setQuestionCount} />
          ) : null}
          {mode === "topical-total" ? (
            <TopicalTotalMode
              allTopics={allTopics}
              questionCount={questionCount}
              selectedTopics={selectedTopics}
              topicInput={topicInput}
              onAddTopic={addTopicFromInput}
              onQuestionCountChange={setQuestionCount}
              onRemoveTopic={(topic) => setSelectedTopics((current) => current.filter((item) => item !== topic))}
              onSelectedTopicsChange={setSelectedTopics}
              onTopicInputChange={setTopicInput}
            />
          ) : null}
          {mode === "topical-custom" ? (
            <TopicalCustomMode allTopics={allTopics} rows={topicRows} onAddRow={addTopicRow} onRemoveRow={(id) => setTopicRows((current) => current.filter((row) => row.id !== id))} onUpdateRow={updateTopicRow} />
          ) : null}
          {mode === "basket" ? <BasketMode questions={basketQuestions} /> : null}

          <SharedGenerationOptions
            coverPageName={coverPageName}
            headerFooter={headerFooter}
            includeCover={includeCover}
            questionGap={questionGap}
            questionNumberGap={questionNumberGap}
            shuffleOptions={shuffleOptions}
            shuffleQuestions={shuffleQuestions}
            variants={variants}
            allowQuestionSplit={allowQuestionSplit}
            onCoverNameChange={setCoverPageName}
            onHeaderFooterChange={(field, value) => setHeaderFooter((current) => ({ ...current, [field]: value }))}
            onIncludeCoverChange={setIncludeCover}
            onQuestionGapChange={setQuestionGap}
            onQuestionNumberGapChange={setQuestionNumberGap}
            onShuffleOptionsChange={setShuffleOptions}
            onShuffleQuestionsChange={setShuffleQuestions}
            onVariantsChange={setVariants}
            onAllowQuestionSplitChange={setAllowQuestionSplit}
          />
        </section>
      </main>

      <aside className="mcq-generator-side">
        <OutputPanel
          canGenerate={hasDesktopBridge}
          error={generationError}
          isGenerating={isGenerating}
          isPickingFolder={isPickingFolder}
          outputFolder={outputFolder}
          processLog={processLog}
          summary={summary}
          title={title}
          onChooseOutput={chooseOutputFolder}
          onGenerate={generatePackage}
          onOpenFolder={openGeneratedFolder}
          onOutputFolderChange={setOutputFolder}
          onTitleChange={setTitle}
        />
        <AvailabilityPanel availability={availability} />
        <PreviewPanel title={title} variants={variants} />
        {summary ? <GenerationSummaryPanel summary={summary} /> : null}
      </aside>
    </div>
  );
}

function FullPaperMode({ questionCount, onQuestionCountChange }: { questionCount: number; onQuestionCountChange: (value: number) => void }) {
  return (
    <Panel title="Full Paper Mode" subtitle="Randomly chooses by original question number slot across saved Paper 1 questions.">
      <div className="mcq-generator-grid-3">
        <NumberField label="Number of questions" max={80} min={1} value={questionCount} onChange={onQuestionCountChange} />
        <TextField label="Question slots" readonly value={`Q1 to Q${questionCount}`} />
        <TextField label="Source papers" readonly value="All saved Paper 1 questions" />
      </div>
      <div className="mcq-generator-callout">
        Q1 can come from `9702_w21_qp_11`, Q2 from `9702_m25_qp_13`, and so on. Multiple selected questions may still come from the same source paper.
      </div>
      <div className="mcq-generator-check-grid">
        <CheckField checked label="Ready questions only" />
        <CheckField checked label="Avoid duplicate question IDs in one paper" />
        <CheckField checked label="Warn when a slot has no candidates" />
      </div>
    </Panel>
  );
}

function TopicalTotalMode({
  allTopics,
  questionCount,
  selectedTopics,
  topicInput,
  onAddTopic,
  onQuestionCountChange,
  onRemoveTopic,
  onSelectedTopicsChange,
  onTopicInputChange
}: {
  allTopics: string[];
  questionCount: number;
  selectedTopics: string[];
  topicInput: string;
  onAddTopic: () => void;
  onQuestionCountChange: (value: number) => void;
  onRemoveTopic: (topic: string) => void;
  onSelectedTopicsChange: (topics: string[]) => void;
  onTopicInputChange: (value: string) => void;
}) {
  const filtered = allTopics.filter((topic) => topic.toLowerCase().includes(topicInput.toLowerCase()) && !selectedTopics.includes(topic));
  const split = selectedTopics.length ? distributeTotal(questionCount, selectedTopics) : [];

  return (
    <Panel title="Topical Total Number" subtitle="Choose topics and a total count; TeacherDesk balances the paper approximately evenly.">
      <div className="mcq-generator-grid-3">
        <NumberField label="Total questions" max={80} min={1} value={questionCount} onChange={onQuestionCountChange} />
        <TextField label="Distribution" readonly value={selectedTopics.length ? "Approximately equal" : "Add topics first"} />
        <TextField label="Topic logic" readonly value="Any selected topic" />
      </div>
      <div className="mcq-generator-topic-picker">
        <label>
          <span>Add topic</span>
          <div>
            <input list="mcq-generator-topic-suggestions" placeholder="Type or choose topic" value={topicInput} onChange={(event) => onTopicInputChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onAddTopic(); }} />
            <button type="button" onClick={onAddTopic}><Plus size={14} /> Add topic</button>
          </div>
        </label>
        <datalist id="mcq-generator-topic-suggestions">
          {filtered.map((topic) => <option key={topic} value={topic} />)}
        </datalist>
        <div className="mcq-generator-token-row">
          {selectedTopics.map((topic) => (
            <button key={topic} type="button" onClick={() => onRemoveTopic(topic)}>{topic}<Trash2 size={12} /></button>
          ))}
          {selectedTopics.length === 0 ? <span>No topics selected.</span> : null}
        </div>
      </div>
      <div className="mcq-generator-distribution-table">
        {split.map(({ topic, count }) => (
          <div key={topic}>
            <strong>{topic}</strong>
            <span>{count} questions</span>
          </div>
        ))}
      </div>
      <div className="mcq-generator-quick-topics">
        {filtered.slice(0, 8).map((topic) => (
          <button key={topic} type="button" onClick={() => onSelectedTopicsChange([...selectedTopics, topic])}>{topic}</button>
        ))}
      </div>
    </Panel>
  );
}

function TopicalCustomMode({ allTopics, rows, onAddRow, onRemoveRow, onUpdateRow }: { allTopics: string[]; rows: TopicRow[]; onAddRow: () => void; onRemoveRow: (id: string) => void; onUpdateRow: (id: string, patch: Partial<TopicRow>) => void }) {
  return (
    <Panel title="Topical Mode" subtitle="Add exact topic rows. Combination rows require questions containing all selected topics.">
      <div className="mcq-generator-topic-row-header">
        <span>Topic request</span>
        <span>Count</span>
        <span>Logic</span>
        <span />
      </div>
      <div className="mcq-generator-topic-rows">
        {rows.map((row) => (
          <TopicRequestRow
            allTopics={allTopics}
            key={row.id}
            row={row}
            onRemove={() => onRemoveRow(row.id)}
            onUpdate={(patch) => onUpdateRow(row.id, patch)}
          />
        ))}
      </div>
      <button className="mcq-generator-add-row" type="button" onClick={onAddRow}><Plus size={14} /> Add topic row</button>
    </Panel>
  );
}

function TopicRequestRow({ allTopics, row, onRemove, onUpdate }: { allTopics: string[]; row: TopicRow; onRemove: () => void; onUpdate: (patch: Partial<TopicRow>) => void }) {
  const [input, setInput] = useState("");
  const filtered = allTopics.filter((topic) => topic.toLowerCase().includes(input.toLowerCase()) && !row.topics.includes(topic));
  const suggestionsId = `mcq-generator-topic-row-${row.id}`;

  function addTopic() {
    const topic = input.trim();
    if (!topic || row.topics.includes(topic)) return;
    onUpdate({ topics: [...row.topics, topic] });
    setInput("");
  }

  return (
    <div className="mcq-generator-topic-row">
      <div className="mcq-generator-row-topic-editor">
        <div className="mcq-generator-token-row">
          {row.topics.map((topic) => (
            <button key={topic} type="button" onClick={() => onUpdate({ topics: row.topics.filter((item) => item !== topic) })}>
              {topic}
              <Trash2 size={12} />
            </button>
          ))}
          {row.topics.length === 0 ? <span>No topic selected for this row.</span> : null}
        </div>
        <div className="mcq-generator-row-topic-add">
          <input
            list={suggestionsId}
            placeholder="Search or create topic"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addTopic();
            }}
          />
          <button type="button" onClick={addTopic}><Plus size={14} /> Add</button>
        </div>
        <datalist id={suggestionsId}>
          {filtered.map((topic) => <option key={topic} value={topic} />)}
        </datalist>
      </div>
      <input min={1} max={80} type="number" value={row.count} onChange={(event) => onUpdate({ count: Number(event.target.value) })} />
      <div className="mcq-generator-row-logic" role="group" aria-label="Topic row logic">
        <button className={!row.combination ? "is-active" : undefined} type="button" onClick={() => onUpdate({ combination: false })}>Any</button>
        <button className={row.combination ? "is-active" : undefined} type="button" onClick={() => onUpdate({ combination: true })}>All</button>
      </div>
      <button className="mcq-generator-row-remove" type="button" onClick={onRemove}><Trash2 size={14} /></button>
    </div>
  );
}

function BasketMode({ questions }: { questions: McqQuestionRecord[] }) {
  return (
    <Panel title="From Basket" subtitle="Uses questions manually selected in Question Bank.">
      <div className="mcq-generator-basket-summary">
        <strong>{questions.length}</strong>
        <span>question{questions.length === 1 ? "" : "s"} ready for a manual paper</span>
      </div>
      <div className="mcq-generator-basket-list" role="table" aria-label="Basket questions">
        <div className="mcq-generator-basket-head" role="row">
          <span>No.</span>
          <span>Question</span>
          <span>Topic</span>
          <span>Answer</span>
          <span>Status</span>
        </div>
        {questions.map((question, index) => (
          <div className="mcq-generator-basket-row" key={question.id} role="row">
            <span>{index + 1}</span>
            <strong>{question.examCode} #{question.originalQuestionNumber}</strong>
            <em>{question.topics.join(", ") || "No topic"}</em>
            <span>{question.correctAnswer}</span>
            <span>{question.reviewStatus}</span>
          </div>
        ))}
        {questions.length === 0 ? <p>No basket questions yet. Add questions from Question Bank using the basket icon.</p> : null}
      </div>
    </Panel>
  );
}

function SharedGenerationOptions(props: {
  coverPageName: string;
  headerFooter: Record<HeaderFooterField, string>;
  includeCover: boolean;
  questionGap: number;
  questionNumberGap: number;
  shuffleOptions: boolean;
  shuffleQuestions: boolean;
  variants: number;
  allowQuestionSplit: boolean;
  onCoverNameChange: (value: string) => void;
  onHeaderFooterChange: (field: HeaderFooterField, value: string) => void;
  onIncludeCoverChange: (value: boolean) => void;
  onQuestionGapChange: (value: number) => void;
  onQuestionNumberGapChange: (value: number) => void;
  onShuffleOptionsChange: (value: boolean) => void;
  onShuffleQuestionsChange: (value: boolean) => void;
  onVariantsChange: (value: number) => void;
  onAllowQuestionSplitChange: (value: boolean) => void;
}) {
  return (
    <Panel title="Shared Paper Settings" subtitle="Applied to student copy, teacher copy, and answer key generation.">
      <div className="mcq-generator-shared-grid">
        <label className="mcq-generator-check">
          <input checked={props.includeCover} type="checkbox" onChange={(event) => props.onIncludeCoverChange(event.target.checked)} />
          Add cover page
        </label>
        <label className="mcq-generator-file">
          <span>Cover file</span>
          <input type="file" onChange={(event) => props.onCoverNameChange(event.target.files?.[0]?.name ?? "")} />
          <strong>{props.coverPageName || "No cover selected"}</strong>
        </label>
      </div>
      <div className="mcq-generator-header-footer">
        {(["headerLeft", "headerCenter", "headerRight", "footerLeft", "footerCenter", "footerRight"] as HeaderFooterField[]).map((field) => (
          <TextField key={field} label={labelForField(field)} value={props.headerFooter[field]} onChange={(value) => props.onHeaderFooterChange(field, value)} />
        ))}
      </div>
      <div className="mcq-generator-snippets">
        {snippets.map((snippet) => <span key={snippet}>{snippet}</span>)}
      </div>
      <div className="mcq-generator-grid-3">
        <NumberField label="Question no. to body gap (mm)" max={25} min={0} value={props.questionNumberGap} onChange={props.onQuestionNumberGapChange} />
        <NumberField label="Gap between questions (mm)" max={40} min={0} value={props.questionGap} onChange={props.onQuestionGapChange} />
        <NumberField label="Variants" max={12} min={1} value={props.variants} onChange={props.onVariantsChange} />
      </div>
      <div className="mcq-generator-check-grid">
        <CheckField checked={props.shuffleQuestions} label="Shuffle questions per variant" onChange={props.onShuffleQuestionsChange} />
        <CheckField checked={props.shuffleOptions} label="Shuffle options where allowed" onChange={props.onShuffleOptionsChange} />
        <CheckField checked={props.allowQuestionSplit} label="Allow questions to split across pages" onChange={props.onAllowQuestionSplitChange} />
      </div>
    </Panel>
  );
}

function OutputPanel({
  canGenerate,
  error,
  isGenerating,
  isPickingFolder,
  outputFolder,
  processLog,
  summary,
  title,
  onChooseOutput,
  onGenerate,
  onOpenFolder,
  onOutputFolderChange,
  onTitleChange
}: {
  canGenerate: boolean;
  error: string;
  isGenerating: boolean;
  isPickingFolder: boolean;
  outputFolder: string;
  processLog: string[];
  summary: GenerationSummary | null;
  title: string;
  onChooseOutput: () => void;
  onGenerate: () => void;
  onOpenFolder: () => void;
  onOutputFolderChange: (value: string) => void;
  onTitleChange: (value: string) => void;
}) {
  return (
    <section className="mcq-generator-output">
      <h2>Output Package</h2>
      <TextField label="Exam title" value={title} onChange={onTitleChange} />
      <div className="mcq-generator-folder">
        <span>Output folder</span>
        <input value={outputFolder} onChange={(event) => onOutputFolderChange(event.target.value)} />
        {!hasDesktopBridge ? (
          <small>
            {hasBrowserFolderPicker
              ? "Desktop bridge not detected. Folder selection may appear in a browser, but PDF generation is disabled here to prevent broken output. Restart with Start TeacherDesk.bat."
              : "Desktop bridge not detected. Restart with Start TeacherDesk.bat for folder selection and file generation."}
          </small>
        ) : null}
        <div className="mcq-generator-folder-actions">
          <button disabled={isPickingFolder} type="button" onClick={onChooseOutput}><FolderOpen size={14} /> {isPickingFolder ? "Opening..." : "Choose"}</button>
          <button disabled={!summary} type="button" onClick={onOpenFolder}><FolderOpen size={14} /> Open folder</button>
        </div>
      </div>
      <button className="mcq-generator-generate" disabled={isGenerating || !canGenerate} type="button" onClick={onGenerate}><RotateCw size={15} /> {isGenerating ? "Generating..." : "Generate package"}</button>
      {!canGenerate ? <div className="mcq-generator-error">Start TeacherDesk with Start TeacherDesk.bat to generate PDFs.</div> : null}
      {error ? <div className="mcq-generator-error">{error}</div> : null}
      <div className="mcq-generator-process">
        <strong>Process updates</strong>
        {processLog.slice(0, 6).map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}
      </div>
    </section>
  );
}

function AvailabilityPanel({ availability }: { availability: string[] }) {
  return (
    <section className="mcq-generator-side-panel">
      <h2>Availability Check</h2>
      {availability.map((line) => <p key={line}>{line}</p>)}
    </section>
  );
}

function PreviewPanel({ title, variants }: { title: string; variants: number }) {
  return (
    <section className="mcq-generator-preview">
      <h2>Live Structure Preview</h2>
      <div className="mcq-generator-a4-mini">
        <header>{title || "Untitled Exam"} - Variant A</header>
        <main>
          <strong>1</strong>
          <p>The first generated question appears here using the shared MCQ renderer.</p>
          <ol type="A">
            <li>Option text</li>
            <li>Option text</li>
            <li>Option text</li>
            <li>Option text</li>
          </ol>
        </main>
        <footer>Page 1 of 1 - {variants} variant{variants === 1 ? "" : "s"}</footer>
      </div>
    </section>
  );
}

function GenerationSummaryPanel({ summary }: { summary: GenerationSummary }) {
  return (
    <section className="mcq-generator-side-panel">
      <h2>Generated Package</h2>
      <p>Run seed: {summary.seed.slice(0, 8)}</p>
      <p>Folder: {summary.titleFolder}</p>
      <ul>
        {summary.files.map((file) => <li key={file}>{file}</li>)}
      </ul>
    </section>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="mcq-generator-panel">
      <header>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      {children}
    </section>
  );
}

function ModeButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={active ? "is-active" : undefined} type="button" onClick={onClick}>{icon}{label}</button>;
}

function TextField({ label, readonly, value, onChange }: { label: string; readonly?: boolean; value: string; onChange?: (value: string) => void }) {
  return <label className="mcq-generator-field"><span>{label}</span><input readOnly={readonly} value={value} onChange={(event) => onChange?.(event.target.value)} /></label>;
}

function NumberField({ label, max, min, value, onChange }: { label: string; max: number; min: number; value: number; onChange: (value: number) => void }) {
  return <label className="mcq-generator-field"><span>{label}</span><input max={max} min={min} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function CheckField({ checked, label, onChange }: { checked: boolean; label: string; onChange?: (value: boolean) => void }) {
  return <label className="mcq-generator-check"><input checked={checked} readOnly={!onChange} type="checkbox" onChange={(event) => onChange?.(event.target.checked)} />{label}</label>;
}

function buildAvailability({ mode, questionCount, questions, selectedTopics, topicRows, basketQuestions }: { mode: GeneratorMode; questionCount: number; questions: McqQuestionRecord[]; selectedTopics: string[]; topicRows: TopicRow[]; basketQuestions: McqQuestionRecord[] }) {
  if (mode === "basket") return [`${basketQuestions.length} questions in basket.`, `${basketQuestions.filter((q) => q.reviewStatus === "Ready").length} are marked Ready.`, "Generation will use the manual basket order first."];
  if (mode === "topical-total") {
    const matches = questions.filter((question) => selectedTopics.length === 0 || selectedTopics.some((topic) => question.topics.includes(topic)));
    return [`${questionCount} questions requested.`, `${selectedTopics.length} selected topic${selectedTopics.length === 1 ? "" : "s"}.`, `${matches.length} candidate questions found.`];
  }
  if (mode === "topical-custom") {
    const requested = topicRows.reduce((sum, row) => sum + row.count, 0);
    const warnings = topicRows.filter((row) => row.combination && row.topics.length > 1 && questions.filter((question) => row.topics.every((topic) => question.topics.includes(topic))).length < row.count).length;
    return [`${requested} questions requested across ${topicRows.length} rows.`, "Combination rows require every selected topic.", warnings ? `${warnings} row may not have enough candidates.` : "All rows can be checked from the local bank."];
  }
  const slots = Array.from({ length: questionCount }, (_, index) => String(index + 1));
  const missing = slots.filter((slot) => !questions.some((question) => question.originalQuestionNumber === slot));
  return [`${questionCount} original question-number slots requested.`, `${Math.max(0, questionCount - missing.length)} slots have at least one candidate.`, missing.length ? `${missing.length} slots currently have no candidate.` : "All slots have candidates."];
}

function selectQuestionsForMode({
  mode,
  questionCount,
  questions,
  selectedTopics,
  topicRows,
  basketQuestions
}: {
  mode: GeneratorMode;
  questionCount: number;
  questions: McqQuestionRecord[];
  selectedTopics: string[];
  topicRows: TopicRow[];
  basketQuestions: McqQuestionRecord[];
}) {
  const readyQuestions = questions.filter((question) => question.reviewStatus === "Ready");
  if (mode === "basket") return basketQuestions;

  if (mode === "full-paper") {
    const selected: McqQuestionRecord[] = [];
    for (let slot = 1; slot <= questionCount; slot += 1) {
      const candidates = readyQuestions.filter((question) => Number(question.originalQuestionNumber) === slot && !selected.some((item) => item.id === question.id));
      const fallbackCandidates = readyQuestions.filter((question) => !selected.some((item) => item.id === question.id));
      const picked = randomItem(candidates.length ? candidates : fallbackCandidates);
      if (picked) selected.push(picked);
    }
    return selected;
  }

  if (mode === "topical-total") {
    if (selectedTopics.length === 0) return [];
    const selected: McqQuestionRecord[] = [];
    for (const item of distributeTotal(questionCount, selectedTopics)) {
      const candidates = readyQuestions.filter((question) => question.topics.includes(item.topic));
      selected.push(...takeRandom(candidates.filter((question) => !selected.some((picked) => picked.id === question.id)), item.count));
    }
    return selected.slice(0, questionCount);
  }

  const selected: McqQuestionRecord[] = [];
  for (const row of topicRows) {
    if (row.topics.length === 0) continue;
    const candidates = readyQuestions.filter((question) => (
      row.combination
        ? row.topics.every((topic) => question.topics.includes(topic))
        : row.topics.some((topic) => question.topics.includes(topic))
    ));
    selected.push(...takeRandom(candidates.filter((question) => !selected.some((picked) => picked.id === question.id)), row.count));
  }
  return selected;
}

function distributeTotal(total: number, topics: string[]) {
  const base = Math.floor(total / topics.length);
  let remainder = total % topics.length;
  return topics.map((topic) => {
    const count = base + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return { topic, count };
  });
}

function takeRandom<T>(items: T[], count: number) {
  return shuffle(items).slice(0, count);
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function paperStage(paper: string) {
  const match = /(?:paper\s*)?(\d+)/i.exec(paper);
  const paperNumber = match ? Number(match[1]) : 1;
  return paperNumber <= 3 ? "AS" : "A2";
}

function readBasketIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(basketStorageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function labelForField(field: HeaderFooterField) {
  return field.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
