import {
  BookOpen,
  ChevronDown,
  Eye,
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
import type { AppSettings, McqExamGeneratorPayload, McqExamGeneratorResult, McqExamPreviewResult, McqQuestionRecord, StructuredQuestionRecord, WorkspaceInfo } from "../../../types";
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
  const [preview, setPreview] = useState<McqExamPreviewResult | null>(null);
  const [previewVariant, setPreviewVariant] = useState("A");
  const [previewCopy, setPreviewCopy] = useState<"student" | "teacher" | "answerKey">("student");
  const [isPreviewing, setIsPreviewing] = useState(false);

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
  const selectedPreviewVariant = preview?.variants.find((variant) => variant.label === previewVariant) ?? preview?.variants[0] ?? null;
  const previewDataUrl = selectedPreviewVariant
    ? previewCopy === "teacher"
      ? selectedPreviewVariant.teacherDataUrl
      : previewCopy === "answerKey"
        ? selectedPreviewVariant.answerKeyDataUrl
        : selectedPreviewVariant.studentDataUrl
    : "";

  useEffect(() => {
    setPreview(null);
    setPreviewVariant("A");
  }, [mode, questionCount, selectedTopics, topicRows, basketQuestions.length, variants, questionNumberGap, questionGap, allowQuestionSplit, shuffleQuestions, shuffleOptions, headerFooter, title]);

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

  function addTopicRow() {
    setTopicRows((current) => [...current, { id: crypto.randomUUID(), topics: [], count: 5, combination: false }]);
  }

  function updateTopicRow(id: string, patch: Partial<TopicRow>) {
    setTopicRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function buildPayload(seed: string = crypto.randomUUID(), exactQuestions?: McqQuestionRecord[]): McqExamGeneratorPayload {
    const selectedQuestions = exactQuestions ?? selectQuestionsForMode({ mode, questionCount, questions, selectedTopics, topicRows, basketQuestions });
    const questionPool = exactQuestions
      ? selectedQuestions
      : mode === "basket"
        ? selectedQuestions
        : questions;
    return {
      title,
      outputFolder,
      seed,
      mode,
      variants,
      selection: exactQuestions
        ? {
          mode: "basket",
          questionCount: selectedQuestions.length,
          selectedTopics: [],
          topicRows: [],
          basketIds: selectedQuestions.map((question) => question.id)
        }
        : {
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
    };
  }

  async function generatePreview() {
    setGenerationError("");
    setSummary(null);
    setIsPreviewing(true);
    const seed = crypto.randomUUID();
    try {
      if (!hasDesktopBridge) {
        throw new Error("MCQ preview requires the TeacherDesk desktop app. Start TeacherDesk with Start TeacherDesk.bat.");
      }
      const selectedQuestions = selectQuestionsForMode({ mode, questionCount, questions, selectedTopics, topicRows, basketQuestions });
      if (selectedQuestions.length === 0) {
        throw new Error("No questions match this preview setup. Add questions, select topics, or add questions to the basket first.");
      }
      setProcessLog([`Building preview from ${selectedQuestions.length} selected questions...`, "Rendering student, teacher, and answer key previews."]);
      const nextPreview = await teacherDeskApi.previewMcqExamPackage(buildPayload(seed));
      setPreview(nextPreview);
      setPreviewVariant(nextPreview.variants[0]?.label ?? "A");
      setProcessLog((current) => [`Preview ready: ${nextPreview.selectedQuestions.length} questions, ${nextPreview.variants.length} variant${nextPreview.variants.length === 1 ? "" : "s"}.`, ...current]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Preview failed.";
      setGenerationError(message);
      setProcessLog((current) => [`Preview error: ${message}`, ...current]);
    } finally {
      setIsPreviewing(false);
    }
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
      setProcessLog(["Preparing question selection...", preview ? "Using the current preview question set." : "Creating a new random seed for this run."]);
      const selectedQuestions = preview?.selectedQuestions.length ? preview.selectedQuestions : selectQuestionsForMode({ mode, questionCount, questions, selectedTopics, topicRows, basketQuestions });
      if (selectedQuestions.length === 0) {
        throw new Error("No questions match this generator setup. Add questions, select topics, or add questions to the basket first.");
      }
      setProcessLog((current) => [`Selected ${selectedQuestions.length} question${selectedQuestions.length === 1 ? "" : "s"}.`, ...current]);
      setProcessLog((current) => ["Sending package to local PDF writer...", ...current]);
      const result: McqExamGeneratorResult = await teacherDeskApi.generateMcqExamPackage(buildPayload(preview?.seed ?? seed, preview?.selectedQuestions));
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
          isPreviewing={isPreviewing}
          outputFolder={outputFolder}
          processLog={processLog}
          summary={summary}
          title={title}
          onChooseOutput={chooseOutputFolder}
          onGenerate={generatePackage}
          onPreview={generatePreview}
          onOpenFolder={openGeneratedFolder}
          onOutputFolderChange={setOutputFolder}
          onTitleChange={setTitle}
        />
        <AvailabilityPanel availability={availability} />
        <PreviewPanel
          copy={previewCopy}
          dataUrl={previewDataUrl}
          isPreviewing={isPreviewing}
          selectedVariant={selectedPreviewVariant?.label ?? previewVariant}
          title={title}
          variants={preview?.variants.map((variant) => variant.label) ?? Array.from({ length: Math.max(1, variants) }, (_, index) => String.fromCharCode(65 + index))}
          onCopyChange={setPreviewCopy}
          onGeneratePreview={generatePreview}
          onVariantChange={setPreviewVariant}
        />
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
  onQuestionCountChange,
  onRemoveTopic,
  onSelectedTopicsChange,
  onTopicInputChange
}: {
  allTopics: string[];
  questionCount: number;
  selectedTopics: string[];
  topicInput: string;
  onQuestionCountChange: (value: number) => void;
  onRemoveTopic: (topic: string) => void;
  onSelectedTopicsChange: (topics: string[]) => void;
  onTopicInputChange: (value: string) => void;
}) {
  const filtered = allTopics.filter((topic) => topic.toLowerCase().includes(topicInput.toLowerCase()) && !selectedTopics.includes(topic));
  const split = selectedTopics.length ? distributeTotal(questionCount, selectedTopics) : [];

  return (
    <Panel title="Topical Total Number" subtitle="Choose topics and a total count; TeacherDesk balances the paper approximately evenly.">
      <div className="mcq-generator-topical-total-row">
        <TopicDropdown
          allTopics={allTopics}
          input={topicInput}
          label="Topics"
          placeholder="Search topics"
          selectedTopics={selectedTopics}
          onInputChange={onTopicInputChange}
          onSelectTopic={(topic) => {
            onSelectedTopicsChange([...selectedTopics, topic]);
            onTopicInputChange("");
          }}
        />
        <NumberField className="is-narrow" label="Total questions" max={80} min={1} value={questionCount} onChange={onQuestionCountChange} />
        <TextField className="is-compact" label="Distribution" readonly value={selectedTopics.length ? "Approximately equal" : "Add topics first"} />
      </div>
      <div className="mcq-generator-topic-picker">
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
          <button key={topic} type="button" onClick={() => {
            onSelectedTopicsChange([...selectedTopics, topic]);
            onTopicInputChange("");
          }}>{topic}</button>
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
        <TopicDropdown
          allTopics={allTopics}
          input={input}
          label=""
          placeholder="Search topics"
          selectedTopics={row.topics}
          onInputChange={setInput}
          onSelectTopic={(topic) => {
            onUpdate({ topics: [...row.topics, topic] });
            setInput("");
          }}
        />
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

function TopicDropdown({
  allTopics,
  input,
  label,
  placeholder,
  selectedTopics,
  onInputChange,
  onSelectTopic
}: {
  allTopics: string[];
  input: string;
  label: string;
  placeholder: string;
  selectedTopics: string[];
  onInputChange: (value: string) => void;
  onSelectTopic: (topic: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const filtered = allTopics.filter((topic) => topic.toLowerCase().includes(input.toLowerCase()) && !selectedTopics.includes(topic));
  return (
    <label className="mcq-topic-dropdown">
      {label ? <span>{label}</span> : null}
      <div className="mcq-topic-dropdown-control">
        <input
          placeholder={placeholder}
          value={input}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            onInputChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && filtered[0]) {
              event.preventDefault();
              onSelectTopic(filtered[0]);
              setOpen(false);
            }
          }}
        />
        <button aria-label="Show topics" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen((value) => !value)}>
          <ChevronDown size={14} />
        </button>
      </div>
      {open ? (
        <div className="mcq-topic-dropdown-menu">
          {filtered.slice(0, 12).map((topic) => (
            <button key={topic} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => {
              onSelectTopic(topic);
              setOpen(false);
            }}>
              {topic}
            </button>
          ))}
          {filtered.length === 0 ? <span>No matching topics.</span> : null}
        </div>
      ) : null}
    </label>
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
  isPreviewing,
  outputFolder,
  processLog,
  summary,
  title,
  onChooseOutput,
  onGenerate,
  onPreview,
  onOpenFolder,
  onOutputFolderChange,
  onTitleChange
}: {
  canGenerate: boolean;
  error: string;
  isGenerating: boolean;
  isPickingFolder: boolean;
  isPreviewing: boolean;
  outputFolder: string;
  processLog: string[];
  summary: GenerationSummary | null;
  title: string;
  onChooseOutput: () => void;
  onGenerate: () => void;
  onPreview: () => void;
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
      <div className="mcq-generator-output-actions">
        <button className="mcq-generator-preview-action" disabled={isPreviewing || !canGenerate} type="button" onClick={onPreview}><Eye size={15} /> {isPreviewing ? "Previewing..." : "Generate preview"}</button>
        <button className="mcq-generator-generate" disabled={isGenerating || !canGenerate} type="button" onClick={onGenerate}><RotateCw size={15} /> {isGenerating ? "Generating..." : "Generate package"}</button>
      </div>
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

function PreviewPanel({
  copy,
  dataUrl,
  isPreviewing,
  selectedVariant,
  title,
  variants,
  onCopyChange,
  onGeneratePreview,
  onVariantChange
}: {
  copy: "student" | "teacher" | "answerKey";
  dataUrl: string;
  isPreviewing: boolean;
  selectedVariant: string;
  title: string;
  variants: string[];
  onCopyChange: (copy: "student" | "teacher" | "answerKey") => void;
  onGeneratePreview: () => void;
  onVariantChange: (variant: string) => void;
}) {
  return (
    <section className="mcq-generator-preview">
      <header className="mcq-generator-preview-header">
        <h2>Live PDF Preview</h2>
        <button type="button" onClick={onGeneratePreview} disabled={isPreviewing}><Eye size={14} /> {isPreviewing ? "Rendering..." : "Generate preview"}</button>
      </header>
      <div className="mcq-generator-preview-controls">
        <label>
          <span>Variant</span>
          <select value={selectedVariant} onChange={(event) => onVariantChange(event.target.value)}>
            {variants.map((variant) => <option key={variant}>{variant}</option>)}
          </select>
        </label>
        <div className="mcq-generator-copy-toggle">
          <button className={copy === "student" ? "is-active" : undefined} type="button" onClick={() => onCopyChange("student")}>Student</button>
          <button className={copy === "teacher" ? "is-active" : undefined} type="button" onClick={() => onCopyChange("teacher")}>Teacher</button>
          <button className={copy === "answerKey" ? "is-active" : undefined} type="button" onClick={() => onCopyChange("answerKey")}>Key</button>
        </div>
      </div>
      {dataUrl ? (
        <iframe title={`${title || "MCQ exam"} preview`} src={dataUrl} />
      ) : (
        <div className="mcq-generator-preview-empty">
          Generate preview to inspect the exact A4 PDF before creating files.
        </div>
      )}
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

function TextField({ className = "", label, readonly, value, onChange }: { className?: string; label: string; readonly?: boolean; value: string; onChange?: (value: string) => void }) {
  return <label className={`mcq-generator-field ${className}`}><span>{label}</span><input readOnly={readonly} value={value} onChange={(event) => onChange?.(event.target.value)} /></label>;
}

function NumberField({ className = "", label, max, min, value, onChange }: { className?: string; label: string; max: number; min: number; value: number; onChange: (value: number) => void }) {
  return <label className={`mcq-generator-field ${className}`}><span>{label}</span><input max={max} min={min} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
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
