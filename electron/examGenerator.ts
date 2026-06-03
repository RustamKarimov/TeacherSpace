import { BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import katex from "katex";
import type { McqExamGeneratorPayload, McqExamPreviewResult, McqQuestionRecord } from "./shared.js";
import { loadSettings } from "./workspace.js";

type GeneratedQuestion = McqQuestionRecord & {
  generatedCorrectAnswer: string;
};

type VariantPlan = {
  label: string;
  questions: GeneratedQuestion[];
};

export async function previewMcqExamPackage(payload: McqExamGeneratorPayload): Promise<McqExamPreviewResult> {
  const { runQuestionSet, variantPlans } = buildVariantPlans(payload);
  const variants = [];

  for (const plan of variantPlans) {
    const studentPdf = await pdfBufferFromHtml(renderExamHtml(payload, plan, false));
    const teacherPdf = await pdfBufferFromHtml(renderExamHtml(payload, plan, true));
    const answerKeyPdf = await pdfBufferFromHtml(renderAnswerKeyHtml(payload, plan));
    variants.push({
      label: plan.label,
      studentDataUrl: `data:application/pdf;base64,${studentPdf.toString("base64")}`,
      teacherDataUrl: `data:application/pdf;base64,${teacherPdf.toString("base64")}`,
      answerKeyDataUrl: `data:application/pdf;base64,${answerKeyPdf.toString("base64")}`,
      answers: answerPayload(plan)
    });
  }

  return {
    seed: payload.seed,
    selectedQuestions: runQuestionSet,
    variants
  };
}

export async function generateMcqExamPackage(payload: McqExamGeneratorPayload) {
  const safeTitle = sanitizeFileName(payload.title || "Untitled MCQ Exam");
  const folderPath = path.join(payload.outputFolder, safeTitle);
  fs.mkdirSync(folderPath, { recursive: true });

  const files: string[] = [];
  const { variantPlans } = buildVariantPlans(payload);

  for (const plan of variantPlans) {
    const studentName = `${safeTitle}_student_${plan.label}.pdf`;
    const teacherName = `${safeTitle}_teacher_${plan.label}.pdf`;
    const answerKeyName = `${safeTitle}_answer_key_${plan.label}.pdf`;

    await writePdfFromHtml(path.join(folderPath, studentName), renderExamHtml(payload, plan, false));
    await writePdfFromHtml(path.join(folderPath, teacherName), renderExamHtml(payload, plan, true));
    await writePdfFromHtml(path.join(folderPath, answerKeyName), renderAnswerKeyHtml(payload, plan));
    files.push(studentName, teacherName, answerKeyName);
  }

  const manifestName = "manifest.json";
  fs.writeFileSync(
    path.join(folderPath, manifestName),
    JSON.stringify(
      {
        title: payload.title,
        mode: payload.mode,
        seed: payload.seed,
        createdAt: new Date().toISOString(),
        files,
        settings: payload.settings,
        variants: variantPlans.map((plan) => ({
          label: plan.label,
          questions: answerPayload(plan)
        }))
      },
      null,
      2
    )
  );
  files.push(manifestName);

  return { folderPath, files, seed: payload.seed };
}

function buildVariantPlans(payload: McqExamGeneratorPayload): { runQuestionSet: McqQuestionRecord[]; variantPlans: VariantPlan[] } {
  const variantLabels = Array.from({ length: Math.max(1, payload.variants) }, (_, index) => String.fromCharCode(65 + index));
  const runQuestionSet = selectQuestionsForVariant(payload);
  const variantPlans = variantLabels.map((label) => ({
    label,
    questions: prepareVariantQuestions({
      ...payload,
      questions: runQuestionSet
    })
  }));
  return { runQuestionSet, variantPlans };
}

function answerPayload(plan: VariantPlan) {
  return plan.questions.map((question, index) => ({
    number: index + 1,
    id: question.id,
    examCode: question.examCode,
    originalQuestionNumber: question.originalQuestionNumber,
    answer: question.generatedCorrectAnswer || question.correctAnswer || "-"
  }));
}

async function writePdfFromHtml(filePath: string, html: string) {
  const pdf = await pdfBufferFromHtml(html);
  fs.writeFileSync(filePath, pdf);
}

async function pdfBufferFromHtml(html: string) {
  const window = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await window.webContents.executeJavaScript(`
      Promise.all([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        Promise.all(Array.from(document.images).map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        })))
      ])
    `);
    const pdf = await window.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true
    });
    return pdf;
  } finally {
    window.destroy();
  }
}

function renderExamHtml(payload: McqExamGeneratorPayload, plan: VariantPlan, teacherCopy: boolean) {
  const copyLabel = teacherCopy ? "Teacher copy" : "Student copy";
  const questionsHtml = plan.questions
    .map((question, index) => renderQuestion(question, index + 1, teacherCopy, payload.settings.questionNumberGap, payload.settings.questionGap))
    .join("");

  return renderDocument(
    payload,
    plan.label,
    copyLabel,
    `${payload.settings.includeCover ? renderCoverPage(payload, plan.label, copyLabel) : ""}<main class="exam-paper">${questionsHtml}</main>`
  );
}

function renderAnswerKeyHtml(payload: McqExamGeneratorPayload, plan: VariantPlan) {
  const rows = plan.questions
    .map(
      (question, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(question.examCode)} #${escapeHtml(question.originalQuestionNumber)}</td>
          <td>${escapeHtml(question.generatedCorrectAnswer || question.correctAnswer || "-")}</td>
        </tr>`
    )
    .join("");

  return renderDocument(
    payload,
    plan.label,
    "Answer key",
    `<main class="answer-key">
      <h1>${escapeHtml(payload.title)} - Answer Key - Variant ${escapeHtml(plan.label)}</h1>
      <table>
        <thead><tr><th>No.</th><th>Source</th><th>Answer</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </main>`
  );
}

function renderDocument(payload: McqExamGeneratorPayload, variantLabel: string, copyLabel: string, body: string) {
  const katexCss = readKatexCss();
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(payload.title)} ${escapeHtml(copyLabel)}</title>
      <style>${katexCss}</style>
      <style>${renderPrintCss(payload)}</style>
    </head>
    <body>
      <header class="page-header">
        <span>${renderFieldHtml(payload.headerFooter.headerLeft, payload, variantLabel)}</span>
        <strong>${renderFieldHtml(payload.headerFooter.headerCenter || payload.title, payload, variantLabel)}</strong>
        <span>${renderFieldHtml(payload.headerFooter.headerRight, payload, variantLabel)}</span>
      </header>
      ${body}
      <footer class="page-footer">
        <span>${renderFieldHtml(payload.headerFooter.footerLeft, payload, variantLabel)}</span>
        <strong>${escapeHtml(copyLabel)}</strong>
        <span>${renderFieldHtml(payload.headerFooter.footerRight, payload, variantLabel)}</span>
      </footer>
    </body>
  </html>`;
}

function renderPrintCss(payload: McqExamGeneratorPayload) {
  const questionGap = Math.max(0, payload.settings.questionGap);
  const allowSplit = payload.settings.allowQuestionSplit;
  const avoidBreak = allowSplit ? "" : "break-inside: avoid-page; page-break-inside: avoid;";
  return `
    @page { size: A4; margin: 30mm 23mm 31mm 23mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      background: #fff;
      font-family: Calibri, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.25;
    }
    .page-header, .page-footer {
      position: fixed;
      left: 23mm;
      right: 23mm;
      height: 9mm;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 30px;
      color: #475569;
      font-size: 8.5pt;
      align-items: center;
      line-height: 1.2;
    }
    .page-header { top: 6mm; }
    .page-footer { bottom: 8mm; }
    .page-header strong, .page-footer strong { text-align: center; color: #0f172a; }
    .page-header span:last-child, .page-footer span:last-child { text-align: right; }
    .page-number::after { content: counter(page); }
    .page-count::after { content: counter(pages); }
    .cover-page {
      min-height: 250mm;
      display: grid;
      align-content: center;
      justify-items: center;
      page-break-after: always;
      text-align: center;
    }
    .cover-page h1 { margin: 0 0 8mm; font-size: 20pt; }
    .exam-paper {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .question {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      column-gap: ${Math.max(6, payload.settings.questionNumberGap * 2)}px;
      margin-bottom: ${Math.max(0, questionGap * 4)}px;
      ${avoidBreak}
    }
    .question-number { font-weight: 700; min-width: 34px; }
    .question-body { min-width: 0; ${avoidBreak} }
    .question-body > *:first-child { margin-top: 0; }
    .text-block { white-space: normal; margin: 0 0 6px; ${avoidBreak} }
    .text-block ul, .text-block ol { margin: 6px 0 6px 19px; padding-left: 15px; }
    .text-block p { margin: 0 0 6px; }
    .equation-block { margin: 8px 0 10px; text-align: center; ${avoidBreak} }
    .image-block { margin: 8px 0 10px; ${avoidBreak} }
    .image-block img, .option img, .cell-image { max-width: 100%; object-fit: contain; }
    .image-inner { display: inline-block; line-height: 0; }
    .image-inner.has-border img, .option-image.has-border img, .cell-image.has-border { border: 0.45pt solid #334155; }
    .table-block { border-collapse: collapse; color: #111827; line-height: 1.18; margin: 8px auto 10px; ${avoidBreak} }
    .table-block td, .table-block th { border: 1.2px solid #111827; padding: 4px 6px; min-width: 42px; text-align: center; vertical-align: middle; white-space: pre-wrap; }
    .table-block tr.is-correct-answer td, .table-block tr.is-correct-answer th { background: #eef8f4; }
    .options { margin-top: 8px; display: grid; gap: 6px; color: #111827; ${avoidBreak} }
    .options.is-two { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 18px; }
    .options.is-four { grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 12px; align-items: stretch; }
    .option { min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px; align-items: baseline; break-inside: avoid; }
    .option.valign-top { align-self: start; }
    .option.valign-middle { align-self: center; }
    .option.valign-bottom { align-self: end; }
    .option.labels-above, .option.labels-below { grid-template-columns: minmax(0, 1fr); align-items: start; }
    .option.labels-below .option-label { order: 2; }
    .option-label { width: auto; min-width: 0; height: auto; border: 0; border-radius: 0; background: transparent; font-weight: 700; display: inline-grid; place-items: center; }
    .option-label.is-boxed { width: 24px; height: 22px; border: 1px solid #cfd8e3; border-radius: 4px; background: #f8fafc; }
    .option-content { min-width: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
    .option-content.align-left { align-items: flex-start; text-align: left; }
    .option-content.align-center { align-items: center; text-align: center; }
    .option-content.align-right { align-items: flex-end; text-align: right; }
    .option-content.valign-top { justify-content: flex-start; }
    .option-content.valign-middle { justify-content: center; }
    .option-content.valign-bottom { justify-content: flex-end; }
    .option.is-correct { background: #eef8f4; box-shadow: inset 0 0 0 0.45pt #bde7d8; border-radius: 3px; padding: 1.5px 3px; }
    .option img { display: block; }
    .answer-key { padding-top: 14mm; }
    .answer-key h1 { font-size: 16pt; margin: 0 0 8mm; }
    .answer-key table { width: 100%; border-collapse: collapse; }
    .answer-key th, .answer-key td { border: 0.45pt solid #111; padding: 2mm; text-align: left; }
    .katex { font-size: 1em; }
    .equation-block .katex,
    .text-block .katex,
    .option .katex,
    .table-block .katex { font-size: inherit !important; }
    .katex-display { margin: 0; }
  `;
}

function renderCoverPage(payload: McqExamGeneratorPayload, variantLabel: string, copyLabel: string) {
  return `<section class="cover-page">
    <h1>${escapeHtml(payload.title)}</h1>
    <p>${escapeHtml(copyLabel)} - Variant ${escapeHtml(variantLabel)}</p>
    ${payload.settings.coverPageName ? `<p>Cover source: ${escapeHtml(payload.settings.coverPageName)}</p>` : ""}
  </section>`;
}

function renderQuestion(question: GeneratedQuestion, questionNumber: number, teacherCopy: boolean, _numberGap: number, _questionGap: number) {
  const blocks = question.questionJson.blocks
    .filter(isRecord)
    .map((block) => renderBlock(block, question, teacherCopy))
    .join("");

  return `<section class="question">
    <div class="question-number">${questionNumber}</div>
    <div class="question-body">${blocks}</div>
  </section>`;
}

function renderBlock(block: Record<string, unknown>, question: GeneratedQuestion, teacherCopy: boolean): string {
  if (block.type === "text") {
    const settings = isRecord(block.settings) ? block.settings : {};
    return `<div class="text-block" style="${styleFromTextSettings(settings)}">${renderRichText(String(block.text ?? ""), Number(settings.paragraphSpacing ?? 6))}</div>`;
  }

  if (block.type === "equation") {
    const source = String(block.source ?? "").trim();
    const settings = isRecord(block.settings) ? block.settings : {};
    return source ? `<div class="equation-block" style="${styleFromEquationSettings(settings)}">${renderLatex(source, true)}</div>` : "";
  }

  if (block.type === "image") {
    return renderImageBlock(block);
  }

  if (block.type === "table") {
    return renderTable(block);
  }

  if (block.type === "options") {
    return renderOptions(block, question.generatedCorrectAnswer || question.correctAnswer, teacherCopy);
  }

  return "";
}

function renderOptions(block: Record<string, unknown>, correctAnswer: string, teacherCopy: boolean) {
  if (block.mode === "table" && isRecord(block.table)) {
    return renderTable(block.table, teacherCopy ? correctAnswer : undefined);
  }

  const options = Array.isArray(block.options) ? block.options.filter(isRecord) : [];
  const settings = isRecord(block.settings) ? block.settings : {};
  const layout = settings.layout === "four" ? "is-four" : settings.layout === "two" ? "is-two" : "is-one";
  const label = isRecord(settings.label) ? settings.label : {};
  const text = isRecord(settings.text) ? settings.text : {};
  const imageDefaults = isRecord(settings.image) ? settings.image : {};
  const labelPosition = settings.labelPosition === "above" || settings.labelPosition === "below" ? String(settings.labelPosition) : "beside";
  const optionHtml = options
    .map((option) => {
      const letter = String(option.letter ?? "");
      const image = isRecord(option.image) ? option.image : null;
      const imageVertical = String(image?.verticalAlignment ?? imageDefaults.verticalAlignment ?? "middle");
      const imageHorizontal = String(image?.horizontalAlignment ?? imageDefaults.horizontalAlignment ?? settings.alignment ?? "left");
      const optionText = option.contentType === "image" ? "" : renderInlineMath(String(option.text ?? ""));
      const optionImage = image ? renderImageFromAsset(image, { className: "option-image", fallbackDefaults: imageDefaults }) : "";
      const optionVertical = String(settings.verticalAlignment ?? "middle");
      return `<div class="option labels-${labelPosition} valign-${escapeClass(optionVertical)} ${teacherCopy && letter === correctAnswer ? "is-correct" : ""}" style="gap:${Number(settings.labelContentGap ?? 4)}px;">
        <div class="option-label ${settings.boxedLabels ? "is-boxed" : ""}" style="${styleFromTypography(label)} width:${Number(settings.labelWidth ?? 24)}px;">${escapeHtml(letter)}</div>
        <div class="option-content align-${escapeClass(image ? imageHorizontal : String(settings.alignment ?? "left"))} valign-${escapeClass(imageVertical)}" style="${styleFromTypography(text)} min-height:${image ? Number(image.height ?? imageDefaults.height ?? 0) + Number(image.spacingBefore ?? imageDefaults.spacingBefore ?? 0) + Number(image.spacingAfter ?? imageDefaults.spacingAfter ?? 0) : 0}px;">
          <span class="option-text">${optionText}</span>${optionImage}
        </div>
      </div>`;
    })
    .join("");

  return `<div class="options ${layout}" style="gap:${Number(settings.optionGap ?? 6)}px;">${optionHtml}</div>`;
}

function renderImageBlock(block: Record<string, unknown>) {
  const asset = isRecord(block.asset) ? block.asset : null;
  const settings = isRecord(block.settings) ? block.settings : {};
  const alignment = String(settings.horizontalAlignment ?? "center");
  return `<div class="image-block" style="text-align:${escapeAttribute(alignment)}; margin-top:${Number(settings.spacingBefore ?? 6)}px; margin-bottom:${Number(settings.spacingAfter ?? 6)}px;">${renderImageFromAsset(asset, { className: "image-inner", fallbackDefaults: settings, sizeScale: 3.78 })}${settings.caption ? `<div class="image-caption">${escapeHtml(String(settings.caption))}</div>` : ""}</div>`;
}

function renderImageFromAsset(asset: Record<string, unknown> | null, options: { className?: string; fallbackDefaults?: Record<string, unknown>; sizeScale?: number } = {}) {
  const dataUrl = getImageDataUrl(asset);
  if (!dataUrl.startsWith("data:image/")) {
    return `<span class="missing-image">[image: ${escapeHtml(String(asset?.fileName ?? "missing image"))}]</span>`;
  }
  const defaults = options.fallbackDefaults ?? {};
  const scale = Number(options.sizeScale ?? 1);
  const width = Number(asset?.width ?? defaults.width ?? 120) * scale;
  const height = Number(asset?.height ?? defaults.height ?? 80) * scale;
  const rotation = Number(asset?.rotation ?? defaults.rotation ?? 0);
  const crop = isRecord(asset?.crop) ? asset.crop : isRecord(defaults.crop) ? defaults.crop : null;
  const border = Boolean(asset?.border ?? defaults.border);
  const spacingBefore = Number(asset?.spacingBefore ?? defaults.spacingBefore ?? 0);
  const spacingAfter = Number(asset?.spacingAfter ?? defaults.spacingAfter ?? 0);
  return `<span class="${escapeAttribute(options.className ?? "image-inner")} ${border ? "has-border" : ""}" style="margin-top:${spacingBefore}px; margin-bottom:${spacingAfter}px;">
    <img src="${escapeAttribute(dataUrl)}" alt="${escapeAttribute(String(asset?.altText ?? asset?.fileName ?? "question image"))}" style="width:${width}px;height:${height}px;object-position:${cropToObjectPosition(crop)};clip-path:${cropToClipPath(crop)};transform:rotate(${rotation}deg);" />
  </span>`;
}

function renderTable(block: Record<string, unknown>, highlightRowLetter?: string) {
  const rows = Array.isArray(block.rows) ? block.rows : [];
  const settings = isRecord(block.settings) ? block.settings : {};
  const columnWidths = Array.isArray(block.columnWidths) ? block.columnWidths.map(Number) : [];
  const body = rows
    .filter(Array.isArray)
    .map((row, rowIndex) => {
      const cells = row
        .filter(isRecord)
        .filter((cell) => !cell.hidden)
        .map((cell, cellIndex) => {
          const tag = cell.header ? "th" : "td";
          const colSpan = Number(cell.colSpan ?? 1);
          const rowSpan = Number(cell.rowSpan ?? 1);
          const text = renderInlineMath(String(cell.text ?? ""));
          const image = isRecord(cell.image) ? renderImageFromAsset(cell.image, { className: "cell-image" }) : "";
          return `<${tag} colspan="${colSpan}" rowspan="${rowSpan}" style="${styleFromTableCell(cell)} width:${columnWidths[cellIndex] ? `${columnWidths[cellIndex]}px` : "auto"};">${text}${image}</${tag}>`;
        })
        .join("");
      const firstCell = row.filter(isRecord)[0];
      const isCorrect = highlightRowLetter && String(firstCell?.text ?? "").trim() === highlightRowLetter;
      return `<tr class="${isCorrect ? "is-correct-answer" : ""}">${cells}</tr>`;
    })
    .join("");
  const width = settings.widthMode === "full" ? "100%" : settings.widthMode === "custom" ? `${Number(settings.customWidth ?? 420)}px` : "auto";
  const before = Number(settings.spacingBefore ?? 6);
  const after = Number(settings.spacingAfter ?? 6);
  const alignment = String(settings.horizontalAlignment ?? "center");
  const align =
    alignment === "left"
      ? `${before}px auto ${after}px 0`
      : alignment === "right"
        ? `${before}px 0 ${after}px auto`
        : `${before}px auto ${after}px auto`;
  return `<table class="table-block" style="width:${width}; margin:${align}; font-family:${escapeAttribute(String(settings.fontFamily ?? "Calibri"))}; font-size:${Number(settings.fontSize ?? 11)}pt;"><tbody>${body}</tbody></table>`;
}

function renderInlineMath(text: string) {
  const parts: string[] = [];
  let remaining = text;
  const pattern = /\$([^$]+)\$|\\(rightarrow|leftarrow|uparrow|downarrow|pm|rho|times|div|alpha|beta|gamma|theta|lambda|mu)\b/;
  while (remaining.length > 0) {
    const match = remaining.match(pattern);
    if (!match || match.index === undefined) {
      parts.push(renderInlineMarkup(remaining));
      break;
    }
    parts.push(renderInlineMarkup(remaining.slice(0, match.index)));
    parts.push(renderLatex(match[1] ?? `\\${match[2]}`, false));
    remaining = remaining.slice(match.index + match[0].length);
  }
  return parts.join("");
}

function renderInlineMarkup(value: string) {
  return escapeHtml(value)
    .replaceAll("&lt;b&gt;", "<strong>")
    .replaceAll("&lt;/b&gt;", "</strong>")
    .replaceAll("&lt;i&gt;", "<em>")
    .replaceAll("&lt;/i&gt;", "</em>")
    .replaceAll("&lt;u&gt;", "<u>")
    .replaceAll("&lt;/u&gt;", "</u>")
    .replaceAll("&lt;sub&gt;", "<sub>")
    .replaceAll("&lt;/sub&gt;", "</sub>")
    .replaceAll("&lt;sup&gt;", "<sup>")
    .replaceAll("&lt;/sup&gt;", "</sup>");
}

function renderLatex(source: string, displayMode: boolean) {
  try {
    return katex.renderToString(source, {
      throwOnError: false,
      output: "html",
      displayMode
    });
  } catch {
    return `<span class="latex-error">${escapeHtml(source)}</span>`;
  }
}

function renderRichText(text: string, paragraphSpacing = 6) {
  const paragraphs = text.split(/\r?\n\s*\r?\n/);
  if (paragraphs.length > 1) {
    return paragraphs.map((paragraph, index) => `<div class="text-paragraph" style="margin-bottom:${index === paragraphs.length - 1 ? 0 : paragraphSpacing}px;">${renderRichTextLines(paragraph)}</div>`).join("");
  }
  return renderRichTextLines(text);
}

function renderRichTextLines(text: string) {
  const lines = text.split(/\r?\n/);
  const html: string[] = [];
  let listMode: "ul" | "ol" | null = null;

  function closeList() {
    if (!listMode) return;
    html.push(`</${listMode}>`);
    listMode = null;
  }

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    const numbered = line.match(/^\s*(?:\d+|[a-zA-Z]|[ivxIVX]+)[.)]\s+(.+)$/);
    if (bullet || numbered) {
      const nextMode = bullet ? "ul" : "ol";
      if (listMode !== nextMode) {
        closeList();
        listMode = nextMode;
        html.push(`<${listMode}>`);
      }
      html.push(`<li>${renderInlineMath(bullet?.[1] ?? numbered?.[1] ?? "")}</li>`);
      continue;
    }
    closeList();
    html.push(line.trim() ? `<p>${renderInlineMath(line)}</p>` : "<p>&nbsp;</p>");
  }
  closeList();
  return html.join("");
}

function styleFromTextSettings(settings: Record<string, unknown>) {
  return [
    `font-family:${escapeAttribute(String(settings.fontFamily ?? "Calibri"))}`,
    `font-size:${Number(settings.fontSize ?? 11)}pt`,
    `font-weight:${settings.bold ? 700 : 400}`,
    `font-style:${settings.italic ? "italic" : "normal"}`,
    `text-decoration:${settings.underline ? "underline" : "none"}`,
    `text-align:${escapeAttribute(String(settings.alignment ?? "left"))}`,
    `line-height:${Number(settings.lineHeight ?? 1.25)}`,
    `margin-top:${Number(settings.spacingBefore ?? 0)}px`,
    `margin-bottom:${Number(settings.spacingAfter ?? 6)}px`,
    `padding-left:${Number(settings.indent ?? 0)}mm`
  ].join(";");
}

function styleFromEquationSettings(settings: Record<string, unknown>) {
  return [
    `font-family:${escapeAttribute(String(settings.fontFamily ?? "Calibri"))}`,
    `font-size:${Number(settings.fontSize ?? 11)}pt`,
    `font-weight:${settings.bold ? 700 : 400}`,
    `font-style:${settings.italic ? "italic" : "normal"}`,
    `text-align:${escapeAttribute(String(settings.alignment ?? "center"))}`,
    `margin-top:${Number(settings.spacingBefore ?? 6)}px`,
    `margin-bottom:${Number(settings.spacingAfter ?? 6)}px`
  ].join(";");
}

function styleFromTypography(settings: Record<string, unknown>) {
  return [
    `font-family:${escapeAttribute(String(settings.fontFamily ?? "Calibri"))}`,
    `font-size:${Number(settings.fontSize ?? 11)}pt`,
    `font-weight:${settings.bold ? 700 : 400}`,
    `font-style:${settings.italic ? "italic" : "normal"}`,
    `text-decoration:${settings.underline ? "underline" : "none"}`,
    `color:${cssColor(String(settings.color ?? "Default"))}`
  ].join(";");
}

function styleFromTableCell(cell: Record<string, unknown>) {
  const borders = isRecord(cell.borders) ? cell.borders : {};
  return [
    `text-align:${escapeAttribute(String(cell.horizontalAlignment ?? "center"))}`,
    `vertical-align:${escapeAttribute(String(cell.verticalAlignment ?? "middle"))}`,
    `font-weight:${cell.bold || cell.header ? 700 : 400}`,
    `font-style:${cell.italic ? "italic" : "normal"}`,
    `border-top:${borders.top === false ? "0" : undefined}`,
    `border-right:${borders.right === false ? "0" : undefined}`,
    `border-bottom:${borders.bottom === false ? "0" : undefined}`,
    `border-left:${borders.left === false ? "0" : undefined}`
  ].filter((item) => !item.endsWith("undefined")).join(";");
}

function cropToObjectPosition(crop: Record<string, unknown> | null) {
  if (!crop) return "50% 50%";
  const x = Number(crop.x ?? 0) + Number(crop.width ?? 100) / 2;
  const y = Number(crop.y ?? 0) + Number(crop.height ?? 100) / 2;
  return `${Math.max(0, Math.min(100, x))}% ${Math.max(0, Math.min(100, y))}%`;
}

function cropToClipPath(crop: Record<string, unknown> | null) {
  if (!crop) return "none";
  const x = Number(crop.x ?? 0);
  const y = Number(crop.y ?? 0);
  const width = Number(crop.width ?? 100);
  const height = Number(crop.height ?? 100);
  if (x === 0 && y === 0 && width === 100 && height === 100) return "none";
  const top = Math.max(0, Math.min(100, y));
  const left = Math.max(0, Math.min(100, x));
  const right = Math.max(0, Math.min(100, 100 - x - width));
  const bottom = Math.max(0, Math.min(100, 100 - y - height));
  return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
}

function cssColor(value: string) {
  if (value === "Black") return "#111827";
  if (value === "Blue") return "#0d5ed8";
  if (value === "Red") return "#b42318";
  return "inherit";
}

function readKatexCss() {
  const candidates = [
    path.join(process.cwd(), "node_modules", "katex", "dist", "katex.min.css"),
    path.join(process.cwd(), "..", "node_modules", "katex", "dist", "katex.min.css")
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate, "utf8");
  }
  return ".katex{font-size:1em}.katex-display{margin:0}";
}

function getImageDataUrl(asset: Record<string, unknown> | null) {
  if (typeof asset?.dataUrl === "string" && asset.dataUrl.startsWith("data:image/")) return asset.dataUrl;
  if (typeof asset?.relativePath !== "string" || !asset.relativePath) return "";
  const workspaceRoot = loadSettings().workspaceRoot;
  const candidates = [
    path.join(workspaceRoot, asset.relativePath),
    path.resolve(workspaceRoot, asset.relativePath)
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const extension = path.extname(candidate).toLowerCase();
    const mime = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : extension === ".webp" ? "image/webp" : "image/png";
    return `data:${mime};base64,${fs.readFileSync(candidate).toString("base64")}`;
  }
  return "";
}

function prepareVariantQuestions(payload: McqExamGeneratorPayload): GeneratedQuestion[] {
  const questions = payload.settings.shuffleQuestions ? shuffle(payload.questions) : [...payload.questions];
  return questions.map((question) => prepareVariantQuestion(question, payload.settings.shuffleOptions));
}

function prepareVariantQuestion(question: McqQuestionRecord, shuffleOptionsEnabled: boolean): GeneratedQuestion {
  const clone = JSON.parse(JSON.stringify(question)) as GeneratedQuestion;
  clone.generatedCorrectAnswer = clone.correctAnswer;
  const optionsBlock = clone.questionJson.blocks.find((block) => isRecord(block) && block.type === "options");
  if (!shuffleOptionsEnabled || !isRecord(optionsBlock) || optionsBlock.mode !== "standard" || !Array.isArray(optionsBlock.options)) return clone;
  const settings = isRecord(optionsBlock.settings) ? optionsBlock.settings : {};
  if (settings.allowShuffle === false) return clone;
  const originalOptions = optionsBlock.options.filter(isRecord);
  const shuffled = shuffle(originalOptions);
  const letters = ["A", "B", "C", "D"];
  const correctOriginal = originalOptions.find((option) => String(option.letter) === clone.correctAnswer);
  optionsBlock.options = shuffled.map((option, index) => ({ ...option, letter: letters[index] }));
  const correctIndex = shuffled.findIndex((option) => correctOriginal && option.id === correctOriginal.id);
  clone.generatedCorrectAnswer = correctIndex >= 0 ? letters[correctIndex] : clone.correctAnswer;
  return clone;
}

function selectQuestionsForVariant(payload: McqExamGeneratorPayload) {
  const selection = payload.selection;
  if (!selection) return payload.questions;
  const readyQuestions = payload.questions.filter((question) => question.reviewStatus === "Ready");

  if (selection.mode === "basket") {
    return selection.basketIds.length
      ? payload.questions.filter((question) => selection.basketIds.includes(question.id))
      : payload.questions;
  }

  if (selection.mode === "full-paper") {
    const selected: McqQuestionRecord[] = [];
    const slots = shuffle(Array.from({ length: selection.questionCount }, (_, index) => index + 1));
    for (let slot = 1; slot <= selection.questionCount; slot += 1) {
      const slotNumber = slots[slot - 1] ?? slot;
      const candidates = shuffle(readyQuestions.filter((question) => Number(question.originalQuestionNumber) === slotNumber && !selected.some((item) => item.id === question.id)));
      const fallbackCandidates = readyQuestions.filter((question) => !selected.some((item) => item.id === question.id));
      const picked = randomItem(candidates.length ? candidates : fallbackCandidates);
      if (picked) selected.push(picked);
    }
    return selected;
  }

  if (selection.mode === "topical-total") {
    if (selection.selectedTopics.length === 0) return [];
    const selected: McqQuestionRecord[] = [];
    for (const item of distributeTotal(selection.questionCount, selection.selectedTopics)) {
      const candidates = readyQuestions.filter((question) => question.topics.includes(item.topic));
      selected.push(...takeRandom(candidates.filter((question) => !selected.some((picked) => picked.id === question.id)), item.count));
    }
    return selected.slice(0, selection.questionCount);
  }

  const selected: McqQuestionRecord[] = [];
  for (const row of selection.topicRows) {
    if (row.topics.length === 0) continue;
    const candidates = readyQuestions.filter((question) =>
      row.combination ? row.topics.every((topic) => question.topics.includes(topic)) : row.topics.some((topic) => question.topics.includes(topic))
    );
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

function renderField(template: string | undefined, payload: McqExamGeneratorPayload, variantLabel: string) {
  return (template ?? "")
    .replaceAll("{title}", payload.title)
    .replaceAll("{variant}", `Variant ${variantLabel}`)
    .replaceAll("{date}", new Date().toLocaleDateString())
    .replaceAll("{paper}", "Paper 1")
    .replaceAll("{teacher}", "Teacher")
    .replaceAll("{syllabus}", payload.questions[0]?.syllabus || "");
}

function renderFieldHtml(template: string | undefined, payload: McqExamGeneratorPayload, variantLabel: string) {
  return escapeHtml(renderField(template, payload, variantLabel))
    .replaceAll("{page}", '<span class="page-number"></span>')
    .replaceAll("{pages}", '<span class="page-count"></span>');
}

function katexCssPatch() {
  return ".katex{font-size:1em}.katex-display{margin:0}";
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function sanitizeFileName(value: string) {
  return value.trim().replace(/[<>:"/\\|?*]+/g, "-") || "Untitled MCQ Exam";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll("\n", "");
}

function escapeClass(value: string) {
  return value.replace(/[^a-z0-9_-]/gi, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
