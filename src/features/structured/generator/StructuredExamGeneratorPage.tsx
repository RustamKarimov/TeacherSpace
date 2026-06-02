import { BookOpen, ChevronDown, FileText, FolderOpen, Layers3, ListChecks, Plus, RefreshCw, Shuffle, SlidersHorizontal, Trash2 } from "lucide-react";
import clsx from "clsx";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { teacherDeskApi } from "../../../lib/rendererApi";
import type { AppSettings, StructuredExamGeneratorPayload, StructuredExamGeneratorResult, StructuredQuestionRecord, WorkspaceInfo } from "../../../types";

type Mode = StructuredExamGeneratorPayload["mode"];
type CopyKind = "qp" | "ms";

const basketStorageKey = "teacherdesk.structuredExamBasket";
const paperMarks: Record<number, number> = { 2: 60, 3: 40, 4: 100, 5: 30 };

export function StructuredExamGeneratorPage({ settings, workspace }: { settings: AppSettings | null; workspace: WorkspaceInfo | null }) {
  const [questions, setQuestions] = useState<StructuredQuestionRecord[]>([]);
  const [mode, setMode] = useState<Mode>("full-paper");
  const [title, setTitle] = useState(settings?.defaults.structuredGenerator.title ?? "Structured Physics Practice");
  const [outputFolder, setOutputFolder] = useState(() => settings?.defaults.structuredGenerator.outputFolder || (workspace?.workspaceRoot ? `${workspace.workspaceRoot}\\generated_exams` : "TeacherDesk_Workspace\\generated_exams"));
  const [paperNumber, setPaperNumber] = useState(settings?.defaults.structuredGenerator.paperNumber ?? 2);
  const [targetMarks, setTargetMarks] = useState(settings?.defaults.structuredGenerator.targetMarksByPaper[String(settings?.defaults.structuredGenerator.paperNumber ?? 2)] ?? paperMarks[2]);
  const [allowanceMarks, setAllowanceMarks] = useState(settings?.defaults.structuredGenerator.allowanceMarks ?? 4);
  const [questionCount, setQuestionCount] = useState(12);
  const [questionNumbers, setQuestionNumbers] = useState("1-6");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicRows, setTopicRows] = useState<Array<{ topics: string[]; allowedTopics?: string[]; count: number; match: "any" | "all" }>>([{ topics: [], count: 3, match: "all" }]);
  const [header, setHeader] = useState(settings?.defaults.structuredGenerator.header ?? { left: "{title}", center: "", right: "{date}" });
  const [footer, setFooter] = useState(settings?.defaults.structuredGenerator.footer ?? { left: "TeacherDesk", center: "{copy}", right: "Page {page}" });
  const [maskExisting, setMaskExisting] = useState(true);
  const [topMaskMm, setTopMaskMm] = useState(settings?.defaults.structuredGenerator.topMaskMm ?? 14);
  const [bottomMaskMm, setBottomMaskMm] = useState(settings?.defaults.structuredGenerator.bottomMaskMm ?? 12);
  const [leftMaskMm, setLeftMaskMm] = useState(settings?.defaults.structuredGenerator.leftMaskMm ?? 0);
  const [rightMaskMm, setRightMaskMm] = useState(settings?.defaults.structuredGenerator.rightMaskMm ?? 0);
  const [pageMasks, setPageMasks] = useState<Array<{ pageNumber: number; topMaskMm: number; bottomMaskMm: number; leftMaskMm: number; rightMaskMm: number }>>([]);
  const [basketIds, setBasketIds] = useState<string[]>(() => readBasket());
  const [preview, setPreview] = useState<StructuredExamGeneratorResult | null>(null);
  const [previewKind, setPreviewKind] = useState<CopyKind>("qp");
  const [message, setMessage] = useState("Ready to generate a preview.");
  const [resultFolder, setResultFolder] = useState("");
  const [busy, setBusy] = useState<"preview" | "generate" | null>(null);
  const [openTopicPicker, setOpenTopicPicker] = useState<string | null>(null);

  useEffect(() => {
    void loadQuestions();
  }, []);

  useEffect(() => {
    if (settings?.defaults.structuredGenerator.outputFolder) setOutputFolder(settings.defaults.structuredGenerator.outputFolder);
    else if (workspace?.workspaceRoot) setOutputFolder(`${workspace.workspaceRoot}\\generated_exams`);
  }, [settings?.defaults.structuredGenerator.outputFolder, workspace?.workspaceRoot]);

  useEffect(() => {
    if (mode === "full-paper") setTargetMarks(settings?.defaults.structuredGenerator.targetMarksByPaper[String(paperNumber)] ?? paperMarks[paperNumber] ?? targetMarks);
    setPreview(null);
    setResultFolder("");
  }, [mode, paperNumber]);

  useEffect(() => {
    function closePickers(event: MouseEvent) {
      if (!(event.target as HTMLElement | null)?.closest(".structured-topic-picker")) setOpenTopicPicker(null);
    }
    document.addEventListener("mousedown", closePickers);
    return () => document.removeEventListener("mousedown", closePickers);
  }, []);

  async function loadQuestions() {
    const rows = await teacherDeskApi.listStructuredQuestions();
    setQuestions(rows);
    setBasketIds(readBasket());
  }

  const topics = useMemo(() => Array.from(new Set(questions.filter((question) => topicAllowedForPaper(question.paper, paperNumber)).flatMap((question) => question.topics))).sort((a, b) => a.localeCompare(b)), [paperNumber, questions]);
  const selectedPreview = preview?.selectedQuestions ?? [];
  const previewData = previewKind === "qp" ? preview?.qpPreview?.dataUrl : preview?.msPreview?.dataUrl;

  function buildPayload(selectedQuestionIds: string[] = []): StructuredExamGeneratorPayload {
    return {
      title,
      outputFolder,
      mode,
      paperNumber,
      targetMarks,
      allowanceMarks,
      questionNumbers,
      questionCount,
      selectedQuestionIds,
      selectedTopics,
      topicRows,
      header,
      footer,
      maskExisting,
      topMaskMm,
      bottomMaskMm,
      leftMaskMm,
      rightMaskMm,
      pageMasks,
      questionGapMm: 0,
      allowSplit: false
    };
  }

  async function chooseOutputFolder() {
    const folder = await teacherDeskApi.pickOutputFolder(outputFolder);
    if (folder) setOutputFolder(folder);
  }

  async function generatePreview() {
    setBusy("preview");
    setMessage("Selecting questions and building live preview...");
    try {
      const selectedIds = mode === "basket" ? basketIds : [];
      const nextPreview = await teacherDeskApi.previewStructuredExamPackage(buildPayload(selectedIds));
      setPreview(nextPreview);
      setResultFolder("");
      setMessage(`Preview ready: ${nextPreview.selectedQuestions.length} questions, ${nextPreview.totalMarks} marks.`);
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "Could not generate preview.");
    } finally {
      setBusy(null);
    }
  }

  async function refreshPreview() {
    if (!preview?.selectedQuestions.length) {
      await generatePreview();
      return;
    }
    setBusy("preview");
    setMessage("Refreshing preview with updated masks...");
    try {
      const nextPreview = await teacherDeskApi.previewStructuredExamPackage(buildPayload(preview.selectedQuestions.map((question) => question.id)));
      setPreview(nextPreview);
      setMessage(`Preview refreshed: ${nextPreview.selectedQuestions.length} questions, ${nextPreview.totalMarks} marks.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not refresh preview.");
    } finally {
      setBusy(null);
    }
  }

  async function generatePdfs() {
    if (!preview?.selectedQuestions.length) {
      setMessage("Generate a preview first. PDFs are created from the exact preview selection.");
      return;
    }
    setBusy("generate");
    setMessage("Writing question paper and mark scheme PDFs...");
    try {
      const result = await teacherDeskApi.generateStructuredExamPackage(buildPayload(preview.selectedQuestions.map((question) => question.id)));
      setResultFolder(result.folderPath);
      setMessage(`Generated ${result.files.join(", ")} in ${result.folderPath}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate structured exam.");
    } finally {
      setBusy(null);
    }
  }

  function removePreviewQuestion(id: string) {
    if (!preview) return;
    const selectedQuestions = preview.selectedQuestions.filter((question) => question.id !== id);
    setPreview({
      ...preview,
      selectedQuestions,
      totalMarks: selectedQuestions.reduce((sum, question) => sum + (question.marks ?? 0), 0),
      qpPreview: undefined,
      msPreview: undefined
    });
    setMessage("Selection changed. Generate preview again to refresh the PDF view.");
  }

  return (
    <div className="structured-generator-page">
      <section className="structured-generator-modes">
        <ModeButton icon={<FileText size={16} />} label="Full paper" active={mode === "full-paper"} onClick={() => setMode("full-paper")} />
        <ModeButton icon={<ListChecks size={16} />} label="Question numbers" active={mode === "question-numbers"} onClick={() => setMode("question-numbers")} />
        <ModeButton icon={<Layers3 size={16} />} label="Topical total" active={mode === "topical-total"} onClick={() => setMode("topical-total")} />
        <ModeButton icon={<SlidersHorizontal size={16} />} label="Topical custom" active={mode === "topical-custom"} onClick={() => setMode("topical-custom")} />
        <ModeButton icon={<BookOpen size={16} />} label="Basket" active={mode === "basket"} onClick={() => setMode("basket")} />
      </section>

      <div className="structured-generator-layout">
        <main className="structured-generator-main">
          <section className="structured-generator-card">
            <header>
              <strong>Selection rules</strong>
              <button type="button" onClick={() => void loadQuestions()}><RefreshCw size={14} /> Refresh</button>
            </header>
            {mode === "full-paper" ? (
              <div className="structured-generator-form-row compact-three">
                <label><span>Paper</span><select value={paperNumber} onChange={(event) => setPaperNumber(Number(event.target.value))}>{[2, 3, 4, 5].map((paper) => <option value={paper} key={paper}>Paper {paper}</option>)}</select></label>
                <label><span>Target marks</span><input type="number" value={targetMarks} onChange={(event) => setTargetMarks(Number(event.target.value))} /></label>
                <label><span>Allowed over target</span><input type="number" value={allowanceMarks} onChange={(event) => setAllowanceMarks(Number(event.target.value))} /></label>
              </div>
            ) : null}
            {mode === "question-numbers" ? (
              <div className="structured-generator-form-row compact-three">
                <label><span>Paper</span><select value={paperNumber} onChange={(event) => setPaperNumber(Number(event.target.value))}>{[2, 3, 4, 5].map((paper) => <option value={paper} key={paper}>Paper {paper}</option>)}</select></label>
                <label><span>Question numbers</span><input value={questionNumbers} onChange={(event) => setQuestionNumbers(event.target.value)} placeholder="1-4, 7, 9" /></label>
              </div>
            ) : null}
            {mode === "topical-total" ? (
              <div className="structured-topic-total">
                <div className="structured-generator-form-row compact-three">
                  <label><span>Paper</span><select value={paperNumber} onChange={(event) => setPaperNumber(Number(event.target.value))}>{[2, 3, 4, 5].map((paper) => <option value={paper} key={paper}>Paper {paper}</option>)}</select></label>
                  <label className="narrow-number"><span>Total questions</span><input type="number" value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} /></label>
                  <TopicPicker id="total-topics" label="Topics" topics={topics} selected={selectedTopics} openId={openTopicPicker} onOpen={setOpenTopicPicker} onChange={setSelectedTopics} />
                </div>
              </div>
            ) : null}
            {mode === "topical-custom" ? (
              <div className="structured-topic-rules">
                <div className="structured-generator-form-row compact-three">
                  <label><span>Paper</span><select value={paperNumber} onChange={(event) => setPaperNumber(Number(event.target.value))}>{[2, 3, 4, 5].map((paper) => <option value={paper} key={paper}>Paper {paper}</option>)}</select></label>
                </div>
                {topicRows.map((row, index) => (
                  <div className="structured-topic-rule" key={index}>
                    <div className="topic-row-head">
                      <strong>Topic row {index + 1}</strong>
                      <button type="button" onClick={() => setTopicRows((rows) => rows.filter((_row, rowIndex) => rowIndex !== index))} disabled={topicRows.length === 1}><Trash2 size={14} /> Remove</button>
                    </div>
                    <div className="structured-topic-custom-row">
                      <TopicPicker id={`required-${index}`} label="Required topics" topics={topics} selected={row.topics} openId={openTopicPicker} onOpen={setOpenTopicPicker} onChange={(next) => setTopicRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, topics: next } : item))} />
                      <TopicPicker id={`allowed-${index}`} label="Allowed topics" topics={topics} selected={row.allowedTopics ?? topics} openId={openTopicPicker} onOpen={setOpenTopicPicker} onChange={(next) => setTopicRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, allowedTopics: next } : item))} />
                      <label className="narrow-number"><span>Questions</span><input type="number" value={row.count} onChange={(event) => setTopicRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, count: Number(event.target.value) } : item))} /></label>
                      <label><span>Match</span><select value={row.match} onChange={(event) => setTopicRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, match: event.target.value as "any" | "all" } : item))}><option value="all">All required</option><option value="any">Any required</option></select></label>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setTopicRows([...topicRows, { topics: [], allowedTopics: topics, count: 3, match: "all" }])}><Plus size={14} /> Add topic row</button>
              </div>
            ) : null}
            {mode === "basket" ? <div className="structured-generator-basket-count">{basketIds.length} question(s) in basket</div> : null}
          </section>

          <section className="structured-generator-card">
            <header><strong>Output package</strong></header>
            <div className="structured-output-row">
              <label><span>Exam title</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
              <label><span>Output folder</span><input value={outputFolder} onChange={(event) => setOutputFolder(event.target.value)} /></label>
              <button type="button" onClick={() => void chooseOutputFolder()}><FolderOpen size={14} /> Choose</button>
            </div>
          </section>

          <section className="structured-generator-card structured-selection-card">
            <header>
              <div>
                <strong>Generated preview selection</strong>
                {selectedPreview.length ? <span>{`${selectedPreview.length} questions - ${preview?.totalMarks ?? 0} marks${preview?.targetMarks ? ` / ${preview.targetMarks} target` : ""}`}</span> : null}
              </div>
              <div className="structured-selection-actions">
                <button type="button" onClick={() => void generatePreview()} disabled={busy !== null}><Shuffle size={14} /> {busy === "preview" ? "Previewing..." : "Generate preview"}</button>
                <button type="button" onClick={() => void generatePdfs()} disabled={busy !== null || !selectedPreview.length}>{busy === "generate" ? "Generating..." : "Generate PDFs"}</button>
                {resultFolder ? <button type="button" onClick={() => void teacherDeskApi.openFolder(resultFolder)}><FolderOpen size={14} /> Open folder</button> : null}
              </div>
            </header>
            <table>
              <thead><tr><th>#</th><th>Source exam</th><th>Q</th><th>Paper</th><th>Marks</th><th>Topics</th><th></th></tr></thead>
              <tbody>
                {selectedPreview.map((question, index) => (
                  <tr key={question.id}>
                    <td>{index + 1}</td>
                    <td className="mono">{question.examCode}</td>
                    <td>{question.questionNumber}</td>
                    <td>{question.paper}</td>
                    <td>{question.marks ?? "-"}</td>
                    <td title={question.topics.join(", ")}>{question.topics.join(", ")}</td>
                    <td><button type="button" title="Remove from this preview" onClick={() => removePreviewQuestion(question.id)}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
                {selectedPreview.length === 0 ? <tr><td colSpan={7}>No preview yet.</td></tr> : null}
              </tbody>
            </table>
            {preview?.warnings.length ? <div className="structured-generator-warnings">{preview.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div> : null}
          </section>
        </main>

        <aside className="structured-generator-side">
          <section className="structured-generator-card structured-preview-card">
            <header>
              <strong>Live PDF preview</strong>
              <div className="copy-toggle">
                <button className={clsx(previewKind === "qp" && "is-active")} type="button" onClick={() => setPreviewKind("qp")}>QP</button>
                <button className={clsx(previewKind === "ms" && "is-active")} type="button" onClick={() => setPreviewKind("ms")}>MS</button>
              </div>
            </header>
            {previewData ? <iframe title="Structured exam preview" src={previewData} /> : <div className="structured-preview-empty">Generate preview to inspect the assembled PDF.</div>}
          </section>

          <section className="structured-generator-card">
            <header><strong>Header, footer and masking</strong><SlidersHorizontal size={15} /></header>
            <HeaderFooterEditor label="Header" value={header} onChange={setHeader} />
            <HeaderFooterEditor label="Footer" value={footer} onChange={setFooter} />
            <div className="structured-mask-row">
              <label className="structured-generator-check"><input type="checkbox" checked={maskExisting} onChange={(event) => setMaskExisting(event.target.checked)} /> Mask existing</label>
              <label><span>Top</span><input type="number" value={topMaskMm} onChange={(event) => setTopMaskMm(Number(event.target.value))} /></label>
              <label><span>Bottom</span><input type="number" value={bottomMaskMm} onChange={(event) => setBottomMaskMm(Number(event.target.value))} /></label>
              <label><span>Left</span><input type="number" value={leftMaskMm} onChange={(event) => setLeftMaskMm(Number(event.target.value))} /></label>
              <label><span>Right</span><input type="number" value={rightMaskMm} onChange={(event) => setRightMaskMm(Number(event.target.value))} /></label>
              <span className="structured-mask-unit">mm</span>
              <button className="structured-icon-only" type="button" title="Refresh preview" aria-label="Refresh preview" onClick={() => void refreshPreview()} disabled={busy !== null}><RefreshCw size={14} /></button>
            </div>
            <div className="structured-page-mask-list">
              <div className="page-mask-head">
                <strong>Per-page masks</strong>
                <button type="button" onClick={() => setPageMasks([...pageMasks, { pageNumber: pageMasks.length + 1, topMaskMm, bottomMaskMm, leftMaskMm, rightMaskMm }])}>Add page</button>
              </div>
              {pageMasks.map((mask, index) => (
                <div className="structured-page-mask-row" key={index}>
                  <label><span>Page</span><input type="number" value={mask.pageNumber} onChange={(event) => updatePageMask(index, { pageNumber: Number(event.target.value) })} /></label>
                  <label><span>Top</span><input type="number" value={mask.topMaskMm} onChange={(event) => updatePageMask(index, { topMaskMm: Number(event.target.value) })} /></label>
                  <label><span>Bottom</span><input type="number" value={mask.bottomMaskMm} onChange={(event) => updatePageMask(index, { bottomMaskMm: Number(event.target.value) })} /></label>
                  <label><span>Left</span><input type="number" value={mask.leftMaskMm} onChange={(event) => updatePageMask(index, { leftMaskMm: Number(event.target.value) })} /></label>
                  <label><span>Right</span><input type="number" value={mask.rightMaskMm} onChange={(event) => updatePageMask(index, { rightMaskMm: Number(event.target.value) })} /></label>
                  <button type="button" onClick={() => setPageMasks(pageMasks.filter((_item, itemIndex) => itemIndex !== index))}>Remove</button>
                </div>
              ))}
            </div>
            <div className="snippet-row"><span>{`{title}`}</span><span>{`{date}`}</span><span>{`{page}`}</span><span>{`{copy}`}</span></div>
          </section>

        </aside>
      </div>
    </div>
  );

  function updatePageMask(index: number, patch: Partial<{ pageNumber: number; topMaskMm: number; bottomMaskMm: number; leftMaskMm: number; rightMaskMm: number }>) {
    setPageMasks((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }
}

function ModeButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button className={clsx(active && "is-active")} type="button" onClick={onClick}>{icon}<span>{label}</span></button>;
}

function TopicPicker({ id, label, topics, selected, openId, onOpen, onChange }: { id: string; label: string; topics: string[]; selected: string[]; openId: string | null; onOpen: (id: string | null) => void; onChange: (topics: string[]) => void }) {
  const open = openId === id;
  return (
    <div className="structured-topic-picker">
      <span>{label}</span>
      <button type="button" onClick={(event) => { event.stopPropagation(); onOpen(open ? null : id); }}>
        <span>{selected.length === topics.length ? "All" : selected.length ? `${selected.length} selected` : "Any"}</span>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div onMouseDown={(event) => event.stopPropagation()}>
          <div className="topic-picker-actions">
            <button type="button" onClick={() => onChange(topics)}>Select all</button>
            <button type="button" onClick={() => onChange([])}>Deselect all</button>
          </div>
          {topics.map((topic) => (
            <label key={topic}><input type="checkbox" checked={selected.includes(topic)} onChange={() => onChange(selected.includes(topic) ? selected.filter((item) => item !== topic) : [...selected, topic])} />{topic}</label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HeaderFooterEditor({ label, value, onChange }: { label: string; value: { left: string; center: string; right: string }; onChange: (value: { left: string; center: string; right: string }) => void }) {
  return (
    <div className="structured-header-footer-editor">
      <span>{label}</span>
      <input placeholder="Left" value={value.left} onChange={(event) => onChange({ ...value, left: event.target.value })} />
      <input placeholder="Center" value={value.center} onChange={(event) => onChange({ ...value, center: event.target.value })} />
      <input placeholder="Right" value={value.right} onChange={(event) => onChange({ ...value, right: event.target.value })} />
    </div>
  );
}

function readBasket() {
  try {
    const parsed = JSON.parse(localStorage.getItem(basketStorageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function topicAllowedForPaper(paper: string, selectedPaperNumber: number) {
  const match = /(?:paper\s*)?(\d+)/i.exec(paper);
  const paperNumber = match ? Number(match[1]) : selectedPaperNumber;
  const selectedStage = selectedPaperNumber <= 3 ? "AS" : "A2";
  const questionStage = paperNumber <= 3 ? "AS" : "A2";
  return selectedStage === questionStage;
}
