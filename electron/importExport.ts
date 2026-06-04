import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  importStructuredQuestionRecords,
  listMcqQuestions,
  listStructuredQuestions,
  resolveMcqQuestionIdByKey,
  saveMcqQuestion
} from "./database.js";
import type { ImportExportResult, McqQuestionRecord, StructuredQuestionRecord } from "./shared.js";

type TeacherDeskPackage = {
  packageVersion: 1;
  packageId: string;
  createdAt: string;
  app: "TeacherDesk";
  mcqQuestions: McqQuestionRecord[];
  structuredQuestions: Array<StructuredQuestionRecord & { packageQpPath?: string; packageMsPath?: string; qpHash?: string; msHash?: string }>;
};

export async function exportTeacherDeskPackage(databasePath: string, workspaceRoot: string, outputFolder: string): Promise<ImportExportResult> {
  const packageId = randomUUID();
  const packageFolder = path.join(outputFolder, `TeacherDesk_export_${timestampForFolder()}`);
  const filesFolder = path.join(packageFolder, "files", "structured");
  fs.mkdirSync(filesFolder, { recursive: true });

  const mcqQuestions = await listMcqQuestions(databasePath);
  const structuredQuestions = await listStructuredQuestions(databasePath);
  const packagedStructuredQuestions: TeacherDeskPackage["structuredQuestions"] = [];
  const warnings: string[] = [];
  const files: string[] = [];

  for (const question of structuredQuestions) {
    const questionFolder = path.join(filesFolder, sanitizeFileName(`${question.examCode}_q${question.questionNumber}`));
    fs.mkdirSync(questionFolder, { recursive: true });
    const qpSource = resolvePath(workspaceRoot, question.splitQpPath);
    const msSource = resolvePath(workspaceRoot, question.splitMsPath);
    const packaged: TeacherDeskPackage["structuredQuestions"][number] = { ...question };

    if (fs.existsSync(qpSource)) {
      const target = path.join(questionFolder, "question.pdf");
      fs.copyFileSync(qpSource, target);
      packaged.packageQpPath = path.relative(packageFolder, target);
      packaged.qpHash = hashFile(target);
      files.push(target);
    } else {
      warnings.push(`Missing question paper PDF for ${question.examCode} #${question.questionNumber}: ${qpSource}`);
    }

    if (fs.existsSync(msSource)) {
      const target = path.join(questionFolder, "mark_scheme.pdf");
      fs.copyFileSync(msSource, target);
      packaged.packageMsPath = path.relative(packageFolder, target);
      packaged.msHash = hashFile(target);
      files.push(target);
    } else {
      warnings.push(`Missing mark scheme PDF for ${question.examCode} #${question.questionNumber}: ${msSource}`);
    }

    packagedStructuredQuestions.push(packaged);
  }

  const manifest: TeacherDeskPackage = {
    packageVersion: 1,
    packageId,
    createdAt: new Date().toISOString(),
    app: "TeacherDesk",
    mcqQuestions,
    structuredQuestions: packagedStructuredQuestions
  };
  const manifestPath = path.join(packageFolder, "teacherdesk-package.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  files.push(manifestPath);

  return {
    ok: true,
    folderPath: packageFolder,
    message: `Exported ${mcqQuestions.length} MCQ and ${structuredQuestions.length} structured questions.`,
    summary: {
      mcqCreated: 0,
      mcqUpdated: 0,
      structuredCreated: 0,
      structuredUpdated: 0,
      filesCopied: files.length,
      duplicatesResolved: 0,
      warnings
    },
    files
  };
}

export async function importTeacherDeskPackage(databasePath: string, workspaceRoot: string, packageFolder: string): Promise<ImportExportResult> {
  const manifestPath = path.join(packageFolder, "teacherdesk-package.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`TeacherDesk package manifest was not found: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as TeacherDeskPackage;
  if (manifest.app !== "TeacherDesk" || manifest.packageVersion !== 1) {
    throw new Error("This folder is not a supported TeacherDesk package.");
  }

  const importRoot = path.join(workspaceRoot, "question_bank", "imported", sanitizeFileName(manifest.packageId));
  fs.mkdirSync(importRoot, { recursive: true });

  let mcqCreated = 0;
  let mcqUpdated = 0;
  let duplicatesResolved = 0;
  const warnings: string[] = [];
  const copiedFiles: string[] = [];

  for (const question of manifest.mcqQuestions ?? []) {
    const existingId = await resolveMcqQuestionIdByKey(databasePath, question.examCode, question.originalQuestionNumber);
    await saveMcqQuestion(databasePath, {
      id: existingId ?? question.id,
      metadata: {
        ...question.questionJson.metadata,
        examCode: question.examCode,
        originalQuestionNumber: question.originalQuestionNumber,
        syllabus: question.syllabus,
        session: question.session,
        year: question.year,
        paper: question.paper,
        paperVersion: question.paperVersion,
        marks: question.marks,
        difficulty: question.difficulty,
        reviewStatus: question.reviewStatus,
        topics: question.topics,
        tags: question.tags
      },
      blocks: question.questionJson.blocks,
      searchableText: question.searchableText,
      rendererVersion: question.questionJson.rendererVersion
    });
    if (existingId) {
      mcqUpdated += 1;
      duplicatesResolved += 1;
    } else {
      mcqCreated += 1;
    }
  }

  const structuredRecords: StructuredQuestionRecord[] = [];
  for (const question of manifest.structuredQuestions ?? []) {
    const questionFolder = path.join(importRoot, sanitizeFileName(`${question.examCode}_q${question.questionNumber}`));
    fs.mkdirSync(questionFolder, { recursive: true });
    const nextQuestion = { ...question };

    if (question.packageQpPath) {
      const source = path.join(packageFolder, question.packageQpPath);
      const target = path.join(questionFolder, "question.pdf");
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, target);
        copiedFiles.push(target);
        nextQuestion.splitQpPath = toWorkspaceRelative(workspaceRoot, target);
      } else {
        warnings.push(`Package is missing question PDF for ${question.examCode} #${question.questionNumber}.`);
      }
    }

    if (question.packageMsPath) {
      const source = path.join(packageFolder, question.packageMsPath);
      const target = path.join(questionFolder, "mark_scheme.pdf");
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, target);
        copiedFiles.push(target);
        nextQuestion.splitMsPath = toWorkspaceRelative(workspaceRoot, target);
      } else {
        warnings.push(`Package is missing mark scheme PDF for ${question.examCode} #${question.questionNumber}.`);
      }
    }

    nextQuestion.sourceQpPath = nextQuestion.splitQpPath;
    nextQuestion.sourceMsPath = nextQuestion.splitMsPath;
    structuredRecords.push(nextQuestion);
  }

  const structuredResult = await importStructuredQuestionRecords(databasePath, structuredRecords);
  duplicatesResolved += structuredResult.updated;

  return {
    ok: true,
    folderPath: importRoot,
    message: `Imported package ${manifest.packageId}.`,
    summary: {
      mcqCreated,
      mcqUpdated,
      structuredCreated: structuredResult.created,
      structuredUpdated: structuredResult.updated,
      filesCopied: copiedFiles.length,
      duplicatesResolved,
      warnings
    },
    files: copiedFiles
  };
}

function resolvePath(workspaceRoot: string, candidate: string) {
  return path.isAbsolute(candidate) ? candidate : path.join(workspaceRoot, candidate);
}

function toWorkspaceRelative(workspaceRoot: string, absolutePath: string) {
  return path.relative(workspaceRoot, absolutePath).replaceAll(path.sep, "/");
}

function hashFile(filePath: string) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sanitizeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*]+/g, "-").trim() || "package";
}

function timestampForFolder() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}
