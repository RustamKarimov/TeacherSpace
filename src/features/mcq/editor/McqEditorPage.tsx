import { useEffect, useMemo, useState } from "react";
import type { AppSettings, McqQuestionRecord, WorkspaceInfo } from "../../../types";
import { teacherDeskApi } from "../../../lib/rendererApi";
import { createTextBlock } from "./textBlockDefaults";
import { createOptionsBlock } from "./optionsBlockDefaults";
import { createImageBlock } from "./imageBlockDefaults";
import { createEquationBlock } from "./equationBlockDefaults";
import { createTableBlock } from "./tableBlockDefaults";
import { defaultMetadata, getMetadataIssues, hasDuplicatePlaceholder, parseExamCode } from "./metadataDefaults";
import { normalizeMcqBlocks } from "./normalizeBlocks";
import type { EquationBlock, ImageBlock, InspectorTab, McqBlock, McqEditorMetadata, OptionsBlock, TableBlock, TextBlock } from "./types";
import { duplicateEquationBlock, duplicateImageBlock, duplicateOptionsBlock, duplicateTableBlock, duplicateTextBlock, moveBlock } from "./utils";
import { McqToolbar } from "./components/McqToolbar";
import { BlockEditor } from "./components/BlockEditor";
import { RightPanel } from "./components/RightPanel";
import { EditorStatusBar } from "./components/EditorStatusBar";

type McqEditorPageProps = {
  editingQuestion: McqQuestionRecord | null;
  settings: AppSettings | null;
  workspace: WorkspaceInfo | null;
  onSaved: (question: McqQuestionRecord, mode: "open-bank" | "add-another") => void;
};

export function McqEditorPage({ editingQuestion, settings, workspace, onSaved }: McqEditorPageProps) {
  const [blocks, setBlocks] = useState<McqBlock[]>(() => [createTextBlock()]);
  const [selectedBlockId, setSelectedBlockId] = useState(blocks[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<InspectorTab>("inspector");
  const [metadata, setMetadata] = useState<McqEditorMetadata>(defaultMetadata);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | undefined>();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [editorMessage, setEditorMessage] = useState<{ type: "error" | "info" | "success"; text: string } | null>(null);

  useEffect(() => {
    if (!editingQuestion) {
      resetForNewQuestion();
      return;
    }
    const loadedBlocks = normalizeMcqBlocks(editingQuestion.questionJson.blocks as McqBlock[]);
    const loadedMetadata = editingQuestion.questionJson.metadata as unknown as McqEditorMetadata;
    setBlocks(loadedBlocks.length > 0 ? loadedBlocks : [createTextBlock()]);
    setSelectedBlockId(loadedBlocks[0]?.id ?? "");
    setMetadata(loadedMetadata);
    setCurrentQuestionId(editingQuestion.id);
    setActiveTab("metadata");
    setSavedAt(new Date(editingQuestion.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, [editingQuestion]);

  function resetForNewQuestion(preserveMetadata?: McqEditorMetadata) {
    const nextBlock = createTextBlock();
    const lastDefaults = settings?.lastMcqDefaults;
    const defaultFromSettings: McqEditorMetadata = {
      ...defaultMetadata,
      examCode: lastDefaults?.examCode || defaultMetadata.examCode,
      session: lastDefaults?.session || defaultMetadata.session,
      paper: lastDefaults?.paper || defaultMetadata.paper,
      paperVersion: lastDefaults?.paperVersion || defaultMetadata.paperVersion
    };
    setBlocks([nextBlock]);
    setSelectedBlockId(nextBlock.id);
    setMetadata(
      preserveMetadata
        ? {
            ...defaultFromSettings,
            examCode: preserveMetadata.examCode,
            syllabus: preserveMetadata.syllabus,
            session: preserveMetadata.session,
            year: preserveMetadata.year,
            paper: preserveMetadata.paper,
            paperVersion: preserveMetadata.paperVersion
          }
        : defaultFromSettings
    );
    setCurrentQuestionId(undefined);
    setActiveTab("inspector");
    setSavedAt(null);
    setEditorMessage(null);
  }

  const selectedBlock = useMemo(
    () => blocks.find((block) => block.id === selectedBlockId) ?? blocks[0],
    [blocks, selectedBlockId]
  );
  const metadataIssues = useMemo(() => getMetadataIssues(metadata), [metadata]);
  const hasMetadataWarning = metadataIssues.length > 0 || hasDuplicatePlaceholder(metadata);

  function selectBlock(id: string) {
    setSelectedBlockId(id);
    setActiveTab("inspector");
  }

  function addTextBlock() {
    const nextBlock = createTextBlock();
    setBlocks((current) => [...current, nextBlock]);
    setSelectedBlockId(nextBlock.id);
    setActiveTab("inspector");
  }

  function addOptionsBlock() {
    const existing = blocks.find((block) => block.type === "options");
    if (existing) {
      setSelectedBlockId(existing.id);
      setActiveTab("inspector");
      setEditorMessage({ type: "info", text: "Each MCQ can have only one options block. The existing options block is selected." });
      return;
    }
    const nextBlock = createOptionsBlock();
    setBlocks((current) => [...current, nextBlock]);
    setSelectedBlockId(nextBlock.id);
    setActiveTab("inspector");
  }

  function addEquationBlock() {
    const nextBlock = createEquationBlock();
    setBlocks((current) => [...current, nextBlock]);
    setSelectedBlockId(nextBlock.id);
    setActiveTab("inspector");
  }

  function addImageBlock() {
    const nextBlock = createImageBlock();
    setBlocks((current) => [...current, nextBlock]);
    setSelectedBlockId(nextBlock.id);
    setActiveTab("inspector");
  }

  function addTableBlock() {
    const nextBlock = createTableBlock();
    setBlocks((current) => [...current, nextBlock]);
    setSelectedBlockId(nextBlock.id);
    setActiveTab("inspector");
  }

  function updateTextBlock(id: string, patch: Partial<TextBlock>) {
    setBlocks((current) =>
      current.map((block) => (block.id === id && block.type === "text" ? { ...block, ...patch } : block))
    );
  }

  function updateTextBlockDeep(id: string, updater: (block: TextBlock) => TextBlock) {
    setBlocks((current) => current.map((block) => (block.id === id && block.type === "text" ? updater(block) : block)));
  }

  function updateImageBlockDeep(id: string, updater: (block: ImageBlock) => ImageBlock) {
    setBlocks((current) => current.map((block) => (block.id === id && block.type === "image" ? updater(block) : block)));
  }

  function updateEquationBlockDeep(id: string, updater: (block: EquationBlock) => EquationBlock) {
    setBlocks((current) => current.map((block) => (block.id === id && block.type === "equation" ? updater(block) : block)));
  }

  function updateTableBlockDeep(id: string, updater: (block: TableBlock) => TableBlock) {
    setBlocks((current) => current.map((block) => (block.id === id && block.type === "table" ? updater(block) : block)));
  }

  function updateOptionsBlockDeep(id: string, updater: (block: OptionsBlock) => OptionsBlock) {
    setBlocks((current) => current.map((block) => (block.id === id && block.type === "options" ? updater(block) : block)));
  }

  function duplicateBlock(id: string) {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      const block = current[index];
      if (!block) {
        return current;
      }
      const duplicate =
        block.type === "text"
          ? duplicateTextBlock(block)
          : block.type === "equation"
            ? duplicateEquationBlock(block)
            : block.type === "image"
              ? duplicateImageBlock(block)
              : block.type === "table"
                ? duplicateTableBlock(block)
                : duplicateOptionsBlock(block);
      const nextBlocks = [...current];
      nextBlocks.splice(index + 1, 0, duplicate);
      setSelectedBlockId(duplicate.id);
      return nextBlocks;
    });
    setActiveTab("inspector");
  }

  function deleteBlock(id: string) {
    setBlocks((current) => {
      if (current.length === 1) {
        return current;
      }
      const nextBlocks = current.filter((block) => block.id !== id);
      if (selectedBlockId === id) {
        setSelectedBlockId(nextBlocks[0]?.id ?? "");
      }
      return nextBlocks;
    });
  }

  function reorderBlocks(draggedId: string, targetId: string) {
    setBlocks((current) => {
      const from = current.findIndex((block) => block.id === draggedId);
      const to = current.findIndex((block) => block.id === targetId);
      if (from < 0 || to < 0 || from === to) return current;
      const next = [...current];
      const [dragged] = next.splice(from, 1);
      next.splice(to, 0, dragged);
      return next;
    });
    setSelectedBlockId(draggedId);
  }

  async function save(mode: "open-bank" | "add-another") {
    setEditorMessage(null);
    const validationIssues = validateQuestionForSave(metadata, blocks);
    if (validationIssues.length > 0) {
      setActiveTab(validationIssues.some((issue) => issue.includes("metadata") || issue.includes("Exam code") || issue.includes("topic")) ? "metadata" : "inspector");
      setEditorMessage({ type: "error", text: validationIssues.join(" ") });
      return;
    }

    const parsedMetadataMismatches = getParsedMetadataMismatches(metadata);
    if (parsedMetadataMismatches.length > 0) {
      const confirmed = window.confirm(
        [
          `The exam code ${metadata.examCode} does not match some metadata fields.`,
          "",
          ...parsedMetadataMismatches.map((issue) => `- ${issue}`),
          "",
          "Save anyway?"
        ].join("\n")
      );
      if (!confirmed) {
        setActiveTab("metadata");
        setEditorMessage({ type: "error", text: "Save cancelled. Correct the metadata fields so they match the exam code." });
        return;
      }
    }

    const existingQuestions = await teacherDeskApi.listMcqQuestions();
    const duplicate = existingQuestions.find(
      (question) =>
        question.id !== currentQuestionId &&
        question.examCode.trim().toLowerCase() === metadata.examCode.trim().toLowerCase() &&
        question.originalQuestionNumber.trim().toLowerCase() === metadata.originalQuestionNumber.trim().toLowerCase()
    );
    if (duplicate && !window.confirm(`A question already exists for ${metadata.examCode} #${metadata.originalQuestionNumber}. Save this as a duplicate?`)) {
      setActiveTab("metadata");
      setEditorMessage({ type: "error", text: "Save cancelled. Change the exam code or original question number to avoid a duplicate." });
      return;
    }

    const saved = await teacherDeskApi.saveMcqQuestion({
      id: currentQuestionId,
      metadata: { ...metadata },
      blocks,
      searchableText: buildSearchableText(metadata, blocks),
      rendererVersion: 1
    });
    setCurrentQuestionId(saved.id);
    setSavedAt(new Date(saved.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    setEditorMessage({ type: "success", text: mode === "add-another" ? "Question saved. Ready for the next question." : "Question saved and opened in Question Bank." });
    if (mode === "add-another") {
      resetForNewQuestion(metadata);
    }
    onSaved(saved, mode);
  }

  return (
    <div className="mcq-editor-page">
      <McqToolbar onAddText={addTextBlock} onAddEquation={addEquationBlock} onAddImage={addImageBlock} onAddTable={addTableBlock} onAddOptions={addOptionsBlock} onSave={() => void save("open-bank")} onSaveAndAddAnother={() => void save("add-another")} />
      {editorMessage ? <div className={`mcq-editor-message is-${editorMessage.type}`}>{editorMessage.text}</div> : null}
      <div className="mcq-editor-grid">
        <BlockEditor
          blocks={blocks}
          selectedBlockId={selectedBlock?.id ?? ""}
          onSelect={selectBlock}
          onUpdateTextBlock={updateTextBlock}
          onUpdateEquationBlock={updateEquationBlockDeep}
          onUpdateImageBlock={updateImageBlockDeep}
          onUpdateTableBlock={updateTableBlockDeep}
          onUpdateOptionsBlock={updateOptionsBlockDeep}
          onMove={(id, direction) => setBlocks((current) => moveBlock(current, id, direction))}
          onReorder={reorderBlocks}
          onDuplicate={duplicateBlock}
          onDelete={deleteBlock}
          onToggleLock={(id) =>
            setBlocks((current) =>
              current.map((block) => {
                if (block.id !== id) return block;
                if (block.type === "text") {
                  return { ...block, settings: { ...block.settings, locked: !block.settings.locked } };
                }
                if (block.type === "image") {
                  return { ...block, settings: { ...block.settings, locked: !block.settings.locked } };
                }
                if (block.type === "equation") {
                  return { ...block, settings: { ...block.settings, locked: !block.settings.locked } };
                }
                if (block.type === "table") {
                  return { ...block, settings: { ...block.settings, locked: !block.settings.locked } };
                }
                return { ...block, settings: { ...block.settings, locked: !block.settings.locked } };
              })
            )
          }
        />
        <RightPanel
          activeTab={activeTab}
          blocks={blocks}
          hasMetadataWarning={hasMetadataWarning}
          metadata={metadata}
          metadataIssues={metadataIssues}
          selectedBlock={selectedBlock}
          onActiveTabChange={setActiveTab}
          onMetadataChange={setMetadata}
          onUpdateTextBlock={updateTextBlockDeep}
          onUpdateEquationBlock={updateEquationBlockDeep}
          onUpdateImageBlock={updateImageBlockDeep}
          onUpdateTableBlock={updateTableBlockDeep}
          onUpdateOptionsBlock={updateOptionsBlockDeep}
        />
      </div>
      <EditorStatusBar workspace={workspace} savedAt={savedAt} />
    </div>
  );
}

function getParsedMetadataMismatches(metadata: McqEditorMetadata) {
  const parsed = parseExamCode(metadata.examCode);
  if (!parsed) return [];

  const checks: Array<[keyof McqEditorMetadata, string, string | number | undefined]> = [
    ["syllabus", "Syllabus", parsed.syllabus],
    ["session", "Session", parsed.session],
    ["year", "Year", parsed.year],
    ["paper", "Paper", parsed.paper],
    ["paperVersion", "Paper version", parsed.paperVersion]
  ];

  return checks.flatMap(([key, label, expected]) => {
    if (expected === undefined || expected === "") return [];
    const actual = String(metadata[key] ?? "").trim();
    const expectedText = String(expected).trim();
    return actual.toLowerCase() === expectedText.toLowerCase()
      ? []
      : [`${label}: exam code expects "${expectedText}", but metadata is "${actual || "blank"}".`];
  });
}

function validateQuestionForSave(metadata: McqEditorMetadata, blocks: McqBlock[]) {
  const issues = [...getMetadataIssues(metadata)];
  const optionsBlocks = blocks.filter((block): block is OptionsBlock => block.type === "options");
  if (optionsBlocks.length === 0) issues.push("Add one options block before saving.");
  if (optionsBlocks.length > 1) issues.push("Only one options block is allowed.");
  const optionsBlock = optionsBlocks[0];
  if (optionsBlock) {
    const emptyOptions = optionsBlock.mode === "standard"
      ? optionsBlock.options.filter((option) => option.contentType === "text" && !option.text.trim() && !option.image).map((option) => option.letter)
      : [];
    if (emptyOptions.length > 0) issues.push(`Options ${emptyOptions.join(", ")} need content.`);
    if (!optionsBlock.correctAnswer) issues.push("Select the correct answer.");
  }
  const hasQuestionContent = blocks.some((block) => {
    if (block.type === "text") return block.text.trim().length > 0;
    if (block.type === "equation") return block.source.trim().length > 0;
    if (block.type === "image") return Boolean(block.asset.dataUrl || block.asset.relativePath);
    if (block.type === "table") return block.rows.some((row) => row.some((cell) => cell.text.trim() || cell.image));
    return false;
  });
  if (!hasQuestionContent) issues.push("Add question content before saving.");
  return issues;
}

function buildSearchableText(metadata: McqEditorMetadata, blocks: McqBlock[]) {
  const blockText = blocks
    .flatMap((block) => {
      if (block.type === "text") return [block.text];
      if (block.type === "equation") return [block.source];
      if (block.type === "image") return [block.asset.altText, block.asset.fileName, block.settings.caption];
      if (block.type === "table") return block.rows.flat().map((cell) => [cell.text, cell.image?.altText, cell.image?.fileName].filter(Boolean).join(" "));
      return block.options.map((option) => option.text);
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
