import fs from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { migrations } from "./databaseMigrations.js";
import type { AnalysisOverview, AnalysisStudentRecord, AnalysisStudentSavePayload, McqQuestionRecord, McqQuestionSavePayload, StructuredManifestRow, StructuredMetadataUpdate, StructuredQuestionRecord, StructuredSplitterInput, StructuredValidationReport } from "./shared.js";

export interface MigrationResult {
  databasePath: string;
  appliedMigrations: string[];
  currentVersion: number;
}

async function openDatabase(databasePath: string): Promise<Database> {
  const SQL = await initSqlJs();
  if (fs.existsSync(databasePath)) {
    return new SQL.Database(fs.readFileSync(databasePath));
  }
  return new SQL.Database();
}

function persistDatabase(db: Database, databasePath: string) {
  const data = db.export();
  fs.writeFileSync(databasePath, Buffer.from(data));
}

function getVersion(db: Database) {
  const result = db.exec("PRAGMA user_version;");
  return Number(result[0]?.values[0]?.[0] ?? 0);
}

function rowToObject(columns: string[], values: unknown[]) {
  return Object.fromEntries(columns.map((column, index) => [column, values[index]]));
}

function rowToAnalysisStudent(columns: string[], values: unknown[]): AnalysisStudentRecord {
  const data = rowToObject(columns, values) as Record<string, string>;
  return {
    id: String(data.id ?? ""),
    schoolId: String(data.school_id ?? ""),
    firstName: String(data.first_name ?? ""),
    surname: String(data.surname ?? ""),
    academicYear: String(data.academic_year ?? ""),
    grade: String(data.grade ?? ""),
    className: String(data.class_name ?? ""),
    status: String(data.status ?? "Active") === "Archived" ? "Archived" : "Active",
    notes: String(data.notes ?? ""),
    createdAt: String(data.created_at ?? ""),
    updatedAt: String(data.updated_at ?? "")
  };
}

function readQuestion(db: Database, id: string): McqQuestionRecord | null {
  const result = db.exec(
    `SELECT id, exam_code, original_question_number, syllabus, session, year, paper, paper_version,
      marks, difficulty, review_status, correct_answer, searchable_text, question_json, created_at, updated_at
     FROM mcq_questions WHERE id = ?;`,
    [id]
  );
  const row = result[0]?.values[0];
  if (!row) return null;
  const data = rowToObject(result[0].columns, row) as Record<string, string | number>;

  return {
    id: String(data.id),
    examCode: String(data.exam_code ?? ""),
    originalQuestionNumber: String(data.original_question_number ?? ""),
    syllabus: String(data.syllabus ?? ""),
    session: String(data.session ?? ""),
    year: String(data.year ?? ""),
    paper: String(data.paper ?? ""),
    paperVersion: String(data.paper_version ?? ""),
    marks: Number(data.marks ?? 1),
    difficulty: String(data.difficulty ?? "Medium"),
    reviewStatus: String(data.review_status ?? "Ready"),
    correctAnswer: String(data.correct_answer ?? ""),
    searchableText: String(data.searchable_text ?? ""),
    questionJson: JSON.parse(String(data.question_json)),
    topics: readNames(db, "mcq_topics", "mcq_question_topics", id),
    tags: readNames(db, "mcq_tags", "mcq_question_tags", id),
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at)
  };
}

function readNames(db: Database, table: "mcq_topics" | "mcq_tags", linkTable: "mcq_question_topics" | "mcq_question_tags", questionId: string) {
  const result = db.exec(
    `SELECT item.name FROM ${table} item
     JOIN ${linkTable} link ON link.${table === "mcq_topics" ? "topic_id" : "tag_id"} = item.id
     WHERE link.question_id = ?
     ORDER BY item.name;`,
    [questionId]
  );
  return result[0]?.values.map((row) => String(row[0])) ?? [];
}

function upsertNames(db: Database, questionId: string, names: string[], table: "mcq_topics" | "mcq_tags", linkTable: "mcq_question_topics" | "mcq_question_tags") {
  const itemColumn = table === "mcq_topics" ? "topic_id" : "tag_id";
  db.run(`DELETE FROM ${linkTable} WHERE question_id = ?;`, [questionId]);

  for (const name of names.map((value) => value.trim()).filter(Boolean)) {
    const existing = db.exec(`SELECT id FROM ${table} WHERE lower(name) = lower(?);`, [name]);
    const id = existing[0]?.values[0]?.[0] ? String(existing[0].values[0][0]) : randomUUID();
    if (!existing[0]?.values[0]?.[0]) {
      db.run(`INSERT INTO ${table} (id, name, created_at) VALUES (?, ?, ?);`, [id, name, new Date().toISOString()]);
    }
    db.run(`INSERT OR IGNORE INTO ${linkTable} (question_id, ${itemColumn}) VALUES (?, ?);`, [questionId, id]);
  }
}

function upsertSharedNames(db: Database, names: string[], table: "mcq_topics" | "mcq_tags") {
  const ids: string[] = [];
  for (const name of names.map((value) => value.trim()).filter(Boolean)) {
    const existing = db.exec(`SELECT id FROM ${table} WHERE lower(name) = lower(?);`, [name]);
    const id = existing[0]?.values[0]?.[0] ? String(existing[0].values[0][0]) : randomUUID();
    if (!existing[0]?.values[0]?.[0]) {
      db.run(`INSERT INTO ${table} (id, name, created_at) VALUES (?, ?, ?);`, [id, name, new Date().toISOString()]);
    }
    ids.push(id);
  }
  return ids;
}

function readSharedMetadata(db: Database, table: "mcq_topics" | "mcq_tags") {
  const result = db.exec(`SELECT name FROM ${table} ORDER BY name;`);
  return result[0]?.values.map((row) => String(row[0])) ?? [];
}

export async function runMigrations(databasePath: string): Promise<MigrationResult> {
  const db = await openDatabase(databasePath);
  const appliedMigrations: string[] = [];

  try {
    db.run("PRAGMA foreign_keys = ON;");
    let currentVersion = getVersion(db);

    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        db.run("BEGIN;");
        db.run(migration.sql);
        db.run(`PRAGMA user_version = ${migration.version};`);
        db.run("COMMIT;");
        appliedMigrations.push(migration.name);
        currentVersion = migration.version;
      }
    }

    persistDatabase(db, databasePath);
    return {
      databasePath,
      appliedMigrations,
      currentVersion: getVersion(db)
    };
  } catch (error) {
    try {
      db.run("ROLLBACK;");
    } catch {
      // Ignore rollback errors from transactions that never opened.
    }
    throw error;
  } finally {
    db.close();
  }
}

export async function saveMcqQuestion(databasePath: string, payload: McqQuestionSavePayload): Promise<McqQuestionRecord> {
  const db = await openDatabase(databasePath);
  const now = new Date().toISOString();
  const id = payload.id ?? randomUUID();
  const metadata = payload.metadata as Record<string, unknown>;
  const blocks = payload.blocks as Array<Record<string, unknown>>;
  const correctAnswer = blocks.find((block) => block.type === "options")?.correctAnswer ?? "";
  const existing = readQuestion(db, id);

  try {
    db.run("PRAGMA foreign_keys = ON;");
    db.run("BEGIN;");
    db.run(
      `INSERT INTO mcq_questions (
        id, exam_code, original_question_number, syllabus, session, year, paper, paper_version,
        marks, difficulty, review_status, correct_answer, searchable_text, question_json,
        renderer_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        exam_code = excluded.exam_code,
        original_question_number = excluded.original_question_number,
        syllabus = excluded.syllabus,
        session = excluded.session,
        year = excluded.year,
        paper = excluded.paper,
        paper_version = excluded.paper_version,
        marks = excluded.marks,
        difficulty = excluded.difficulty,
        review_status = excluded.review_status,
        correct_answer = excluded.correct_answer,
        searchable_text = excluded.searchable_text,
        question_json = excluded.question_json,
        renderer_version = excluded.renderer_version,
        updated_at = excluded.updated_at;`,
      [
        id,
        String(metadata.examCode ?? ""),
        String(metadata.originalQuestionNumber ?? ""),
        String(metadata.syllabus ?? ""),
        String(metadata.session ?? ""),
        Number(metadata.year || 0),
        String(metadata.paper ?? ""),
        String(metadata.paperVersion ?? ""),
        Number(metadata.marks ?? 1),
        String(metadata.difficulty ?? "Medium"),
        String(metadata.reviewStatus ?? "Ready"),
        String(correctAnswer),
        payload.searchableText,
        JSON.stringify({
          metadata,
          blocks: payload.blocks,
          rendererVersion: payload.rendererVersion
        }),
        payload.rendererVersion,
        existing?.createdAt ?? now,
        now
      ]
    );
    upsertNames(db, id, Array.isArray(metadata.topics) ? metadata.topics.map(String) : [], "mcq_topics", "mcq_question_topics");
    upsertNames(db, id, Array.isArray(metadata.tags) ? metadata.tags.map(String) : [], "mcq_tags", "mcq_question_tags");
    db.run("COMMIT;");
    persistDatabase(db, databasePath);
    return readQuestion(db, id)!;
  } catch (error) {
    try {
      db.run("ROLLBACK;");
    } catch {
      // Ignore rollback errors.
    }
    throw error;
  } finally {
    db.close();
  }
}

export async function resolveMcqQuestionIdByKey(databasePath: string, examCode: string, originalQuestionNumber: string): Promise<string | null> {
  const db = await openDatabase(databasePath);
  try {
    const result = db.exec("SELECT id FROM mcq_questions WHERE lower(exam_code) = lower(?) AND lower(original_question_number) = lower(?);", [examCode, originalQuestionNumber]);
    return result[0]?.values[0]?.[0] ? String(result[0].values[0][0]) : null;
  } finally {
    db.close();
  }
}

export async function listMcqQuestions(databasePath: string): Promise<McqQuestionRecord[]> {
  const db = await openDatabase(databasePath);
  try {
    const result = db.exec(
      `SELECT id FROM mcq_questions ORDER BY updated_at DESC;`
    );
    const ids = result[0]?.values.map((row) => String(row[0])) ?? [];
    return ids.map((id) => readQuestion(db, id)).filter((question): question is McqQuestionRecord => Boolean(question));
  } finally {
    db.close();
  }
}

export async function getMcqQuestion(databasePath: string, id: string): Promise<McqQuestionRecord | null> {
  const db = await openDatabase(databasePath);
  try {
    return readQuestion(db, id);
  } finally {
    db.close();
  }
}

export async function deleteMcqQuestion(databasePath: string, id: string): Promise<void> {
  const db = await openDatabase(databasePath);
  try {
    db.run("PRAGMA foreign_keys = ON;");
    db.run("DELETE FROM mcq_questions WHERE id = ?;", [id]);
    persistDatabase(db, databasePath);
  } finally {
    db.close();
  }
}

export async function getAnalysisOverview(databasePath: string): Promise<AnalysisOverview> {
  const db = await openDatabase(databasePath);
  try {
    const scalar = (sql: string) => Number(db.exec(sql)[0]?.values[0]?.[0] ?? 0);
    return {
      students: {
        active: scalar("SELECT COUNT(*) FROM analysis_students WHERE status = 'Active';"),
        archived: scalar("SELECT COUNT(*) FROM analysis_students WHERE status = 'Archived';"),
        classes: scalar("SELECT COUNT(*) FROM (SELECT DISTINCT academic_year, grade, class_name FROM analysis_students WHERE status = 'Active');")
      },
      questions: {
        mcq: scalar("SELECT COUNT(*) FROM mcq_questions;"),
        structured: scalar("SELECT COUNT(*) FROM structured_questions;")
      },
      results: {
        mcqAttempts: scalar("SELECT COUNT(*) FROM analysis_mcq_attempts;"),
        structuredAttempts: scalar("SELECT COUNT(*) FROM analysis_structured_attempts;")
      }
    };
  } finally {
    db.close();
  }
}

export async function listAnalysisStudents(databasePath: string): Promise<AnalysisStudentRecord[]> {
  const db = await openDatabase(databasePath);
  try {
    const result = db.exec(
      `SELECT id, school_id, first_name, surname, academic_year, grade, class_name, status, notes, created_at, updated_at
       FROM analysis_students
       ORDER BY academic_year DESC, grade, class_name, surname, first_name;`
    );
    return result[0]?.values.map((row) => rowToAnalysisStudent(result[0].columns, row)) ?? [];
  } finally {
    db.close();
  }
}

export async function saveAnalysisStudent(databasePath: string, payload: AnalysisStudentSavePayload): Promise<AnalysisStudentRecord> {
  const db = await openDatabase(databasePath);
  const now = new Date().toISOString();
  const id = payload.id ?? randomUUID();
  const existing = payload.id
    ? db.exec("SELECT created_at FROM analysis_students WHERE id = ?;", [payload.id])[0]?.values[0]?.[0]
    : null;

  try {
    db.run("BEGIN;");
    db.run(
      `INSERT INTO analysis_students (
        id, school_id, first_name, surname, academic_year, grade, class_name, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        school_id = excluded.school_id,
        first_name = excluded.first_name,
        surname = excluded.surname,
        academic_year = excluded.academic_year,
        grade = excluded.grade,
        class_name = excluded.class_name,
        status = excluded.status,
        notes = excluded.notes,
        updated_at = excluded.updated_at;`,
      [
        id,
        payload.schoolId.trim(),
        payload.firstName.trim(),
        payload.surname.trim(),
        payload.academicYear.trim(),
        payload.grade.trim(),
        payload.className.trim(),
        payload.status,
        payload.notes.trim(),
        existing ? String(existing) : now,
        now
      ]
    );
    db.run("COMMIT;");
    persistDatabase(db, databasePath);

    const result = db.exec(
      `SELECT id, school_id, first_name, surname, academic_year, grade, class_name, status, notes, created_at, updated_at
       FROM analysis_students WHERE id = ?;`,
      [id]
    );
    return rowToAnalysisStudent(result[0].columns, result[0].values[0]);
  } catch (error) {
    try {
      db.run("ROLLBACK;");
    } catch {
      // Ignore rollback errors.
    }
    throw error;
  } finally {
    db.close();
  }
}

export async function deleteAnalysisStudent(databasePath: string, id: string): Promise<void> {
  const db = await openDatabase(databasePath);
  try {
    db.run("PRAGMA foreign_keys = ON;");
    db.run("DELETE FROM analysis_students WHERE id = ?;", [id]);
    persistDatabase(db, databasePath);
  } finally {
    db.close();
  }
}

export async function saveGeneratedExamRecord(
  databasePath: string,
  sourceType: "mcq" | "structured",
  folderPath: string,
  manifest: Record<string, unknown>
): Promise<string> {
  const db = await openDatabase(databasePath);
  const now = new Date().toISOString();
  const examId = randomUUID();
  const title = String(manifest.title ?? "Untitled Exam");
  const mode = String(manifest.mode ?? sourceType);

  try {
    db.run("PRAGMA foreign_keys = ON;");
    db.run("BEGIN;");
    db.run(
      `INSERT INTO generated_exams (id, title, mode, manifest_json, created_at, source_type, folder_path)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [examId, title, mode, JSON.stringify(manifest), String(manifest.createdAt ?? now), sourceType, folderPath]
    );

    for (const variant of generatedExamVariantsFromManifest(sourceType, folderPath, manifest)) {
      db.run(
        `INSERT INTO generated_exam_variants (
          id, generated_exam_id, variant_label, question_order_json, answer_key_json,
          student_file_path, teacher_file_path, answer_key_file_path, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          randomUUID(),
          examId,
          variant.label,
          JSON.stringify(variant.questionOrder),
          JSON.stringify(variant.answerKey),
          variant.studentFilePath,
          variant.teacherFilePath,
          variant.answerKeyFilePath,
          now
        ]
      );
    }

    db.run("COMMIT;");
    persistDatabase(db, databasePath);
    return examId;
  } catch (error) {
    try {
      db.run("ROLLBACK;");
    } catch {
      // Ignore rollback errors.
    }
    throw error;
  } finally {
    db.close();
  }
}

function generatedExamVariantsFromManifest(sourceType: "mcq" | "structured", folderPath: string, manifest: Record<string, unknown>) {
  const files = Array.isArray(manifest.files) ? manifest.files.map(String) : [];
  if (sourceType === "mcq" && Array.isArray(manifest.variants)) {
    return manifest.variants.filter(isRecordLike).map((variant) => {
      const label = String(variant.label ?? "A");
      const answers = Array.isArray(variant.questions) ? variant.questions.filter(isRecordLike) : [];
      return {
        label,
        questionOrder: answers.map((answer) => ({
          id: String(answer.id ?? ""),
          number: Number(answer.number ?? 0),
          examCode: String(answer.examCode ?? ""),
          originalQuestionNumber: String(answer.originalQuestionNumber ?? "")
        })),
        answerKey: Object.fromEntries(answers.map((answer) => [String(answer.number ?? ""), String(answer.answer ?? "")])),
        studentFilePath: findGeneratedFile(folderPath, files, `_student_${label}.pdf`),
        teacherFilePath: findGeneratedFile(folderPath, files, `_teacher_${label}.pdf`),
        answerKeyFilePath: findGeneratedFile(folderPath, files, `_answer_key_${label}.pdf`)
      };
    });
  }

  const questions = Array.isArray(manifest.questions) ? manifest.questions.filter(isRecordLike) : [];
  return [{
    label: "A",
    questionOrder: questions.map((question) => ({
      id: String(question.id ?? ""),
      number: Number(question.order ?? 0),
      examCode: String(question.examCode ?? ""),
      questionNumber: Number(question.questionNumber ?? 0),
      marks: Number(question.marks ?? 0)
    })),
    answerKey: {},
    studentFilePath: findGeneratedFile(folderPath, files, "_question_paper.pdf"),
    teacherFilePath: findGeneratedFile(folderPath, files, "_mark_scheme.pdf"),
    answerKeyFilePath: ""
  }];
}

function findGeneratedFile(folderPath: string, files: string[], suffix: string) {
  const folderFiles = files.length > 0
    ? files
    : fs.existsSync(folderPath)
      ? fs.readdirSync(folderPath).filter((file) => fs.statSync(path.join(folderPath, file)).isFile())
      : [];
  const match = folderFiles.find((file) => file.endsWith(suffix));
  return match ? path.join(folderPath, match) : "";
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function getSharedMetadata(databasePath: string): Promise<{ topics: string[]; tags: string[] }> {
  const db = await openDatabase(databasePath);
  try {
    return {
      topics: readSharedMetadata(db, "mcq_topics"),
      tags: readSharedMetadata(db, "mcq_tags")
    };
  } finally {
    db.close();
  }
}

export async function getStructuredQuestionKeys(databasePath: string): Promise<Set<string>> {
  const db = await openDatabase(databasePath);
  try {
    const result = db.exec("SELECT exam_code, question_number FROM structured_questions;");
    return new Set((result[0]?.values ?? []).map((row) => `${String(row[0]).toLowerCase()}::${Number(row[1])}`));
  } finally {
    db.close();
  }
}

export async function saveStructuredBatch(
  databasePath: string,
  input: StructuredSplitterInput,
  validation: StructuredValidationReport,
  rows: Array<StructuredManifestRow & { splitQpPath: string; splitMsPath: string; sourceQpPath: string; sourceMsPath: string }>
): Promise<{ createdQuestions: number; updatedQuestions: number; batchId: string }> {
  const db = await openDatabase(databasePath);
  const now = new Date().toISOString();
  const batchId = randomUUID();
  let createdQuestions = 0;
  let updatedQuestions = 0;

  try {
    db.run("PRAGMA foreign_keys = ON;");
    db.run("BEGIN;");
    db.run(
      `INSERT INTO structured_import_batches (
        id, manifest_path, source_folder, destination_folder, status, row_count,
        error_count, warning_count, report_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        batchId,
        input.manifestPath,
        input.sourceFolder,
        input.destinationFolder,
        "imported",
        validation.summary.rows,
        validation.summary.errors,
        validation.summary.warnings,
        JSON.stringify(validation),
        now,
        now
      ]
    );

    for (const row of rows) {
      if (!row.questionNumber) continue;
      const existing = db.exec("SELECT id, created_at FROM structured_questions WHERE exam_code = ? AND question_number = ?;", [row.examCode, row.questionNumber]);
      const existingId = existing[0]?.values[0]?.[0] ? String(existing[0].values[0][0]) : null;
      const existingCreatedAt = existing[0]?.values[0]?.[1] ? String(existing[0].values[0][1]) : now;
      const questionId = existingId ?? randomUUID();
      const reviewRequired = row.qpStarred || row.msStarred || row.issues.some((issue) => issue.severity === "warning");
      const reviewReason = row.issues.filter((issue) => issue.severity === "warning").map((issue) => `Row ${issue.row}: ${issue.message}`).join(" ");

      db.run(
        `INSERT INTO structured_questions (
          id, import_batch_id, exam_code, subject_code, session, year, paper, paper_version,
          question_number, marks, source_qp_path, source_ms_path, split_qp_path, split_ms_path,
          qp_start_page_raw, ms_start_page_raw, qp_page_start, qp_page_end, ms_page_start, ms_page_end,
          review_status, review_reason, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(exam_code, question_number) DO UPDATE SET
          import_batch_id = excluded.import_batch_id,
          subject_code = excluded.subject_code,
          session = excluded.session,
          year = excluded.year,
          paper = excluded.paper,
          paper_version = excluded.paper_version,
          marks = excluded.marks,
          source_qp_path = excluded.source_qp_path,
          source_ms_path = excluded.source_ms_path,
          split_qp_path = excluded.split_qp_path,
          split_ms_path = excluded.split_ms_path,
          qp_start_page_raw = excluded.qp_start_page_raw,
          ms_start_page_raw = excluded.ms_start_page_raw,
          qp_page_start = excluded.qp_page_start,
          qp_page_end = excluded.qp_page_end,
          ms_page_start = excluded.ms_page_start,
          ms_page_end = excluded.ms_page_end,
          review_status = excluded.review_status,
          review_reason = excluded.review_reason,
          updated_at = excluded.updated_at;`,
        [
          questionId,
          batchId,
          row.examCode,
          row.subjectCode,
          row.session,
          row.year,
          row.paper,
          row.paperVersion,
          row.questionNumber,
          row.marks,
          row.sourceQpPath,
          row.sourceMsPath,
          row.splitQpPath,
          row.splitMsPath,
          row.qpStartRaw,
          row.msStartRaw,
          row.qpStartPage,
          row.qpPageEnd,
          row.msStartPage,
          row.msPageEnd,
          reviewRequired ? "Needs review" : "Not required",
          reviewReason,
          existingCreatedAt,
          now
        ]
      );

      db.run("DELETE FROM structured_question_topics WHERE question_id = ?;", [questionId]);
      db.run("DELETE FROM structured_question_tags WHERE question_id = ?;", [questionId]);
      for (const topicId of upsertSharedNames(db, row.topics, "mcq_topics")) {
        db.run("INSERT OR IGNORE INTO structured_question_topics (question_id, topic_id) VALUES (?, ?);", [questionId, topicId]);
      }
      for (const tagId of upsertSharedNames(db, row.tags, "mcq_tags")) {
        db.run("INSERT OR IGNORE INTO structured_question_tags (question_id, tag_id) VALUES (?, ?);", [questionId, tagId]);
      }

      if (existingId) updatedQuestions += 1;
      else createdQuestions += 1;
    }

    db.run("COMMIT;");
    persistDatabase(db, databasePath);
    return { createdQuestions, updatedQuestions, batchId };
  } catch (error) {
    try {
      db.run("ROLLBACK;");
    } catch {
      // Ignore rollback errors.
    }
    throw error;
  } finally {
    db.close();
  }
}

export async function listStructuredQuestions(databasePath: string): Promise<StructuredQuestionRecord[]> {
  const db = await openDatabase(databasePath);
  try {
    const result = db.exec(
      `SELECT id, exam_code, subject_code, session, year, paper, paper_version,
        question_number, marks, source_qp_path, source_ms_path, split_qp_path, split_ms_path,
        qp_page_start, qp_page_end, ms_page_start, ms_page_end, review_status, review_reason,
        created_at, updated_at
       FROM structured_questions
       ORDER BY updated_at DESC, exam_code ASC, question_number ASC;`
    );
    return (result[0]?.values ?? []).map((row) => {
      const data = rowToObject(result[0].columns, row) as Record<string, string | number | null>;
      const id = String(data.id);
      return {
        id,
        examCode: String(data.exam_code ?? ""),
        subjectCode: String(data.subject_code ?? ""),
        session: String(data.session ?? ""),
        year: data.year === null ? null : Number(data.year),
        paper: String(data.paper ?? ""),
        paperVersion: String(data.paper_version ?? ""),
        questionNumber: Number(data.question_number ?? 0),
        marks: data.marks === null ? null : Number(data.marks),
        sourceQpPath: String(data.source_qp_path ?? ""),
        sourceMsPath: String(data.source_ms_path ?? ""),
        splitQpPath: String(data.split_qp_path ?? ""),
        splitMsPath: String(data.split_ms_path ?? ""),
        qpPageStart: data.qp_page_start === null ? null : Number(data.qp_page_start),
        qpPageEnd: data.qp_page_end === null ? null : Number(data.qp_page_end),
        msPageStart: data.ms_page_start === null ? null : Number(data.ms_page_start),
        msPageEnd: data.ms_page_end === null ? null : Number(data.ms_page_end),
        reviewStatus: String(data.review_status ?? "Not required"),
        reviewReason: String(data.review_reason ?? ""),
        topics: readStructuredNames(db, "mcq_topics", "structured_question_topics", id),
        tags: readStructuredNames(db, "mcq_tags", "structured_question_tags", id),
        createdAt: String(data.created_at ?? ""),
        updatedAt: String(data.updated_at ?? "")
      };
    });
  } finally {
    db.close();
  }
}

export async function deleteStructuredQuestions(databasePath: string, ids: string[]): Promise<number> {
  const normalizedIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (normalizedIds.length === 0) return 0;

  const db = await openDatabase(databasePath);
  try {
    db.run("PRAGMA foreign_keys = ON;");
    db.run("BEGIN;");
    for (const id of normalizedIds) {
      db.run("DELETE FROM structured_questions WHERE id = ?;", [id]);
    }
    db.run("COMMIT;");
    persistDatabase(db, databasePath);
    return normalizedIds.length;
  } catch (error) {
    try {
      db.run("ROLLBACK;");
    } catch {
      // Ignore rollback errors.
    }
    throw error;
  } finally {
    db.close();
  }
}

export async function updateStructuredQuestionMetadata(databasePath: string, payload: StructuredMetadataUpdate): Promise<StructuredQuestionRecord> {
  const db = await openDatabase(databasePath);
  const now = new Date().toISOString();
  try {
    db.run("PRAGMA foreign_keys = ON;");
    db.run("BEGIN;");
    db.run(
      `UPDATE structured_questions
       SET session = ?,
           year = ?,
           paper = ?,
           paper_version = ?,
           marks = ?,
           review_status = ?,
           review_reason = ?,
           updated_at = ?
       WHERE id = ?;`,
      [
        payload.session,
        payload.year,
        payload.paper,
        payload.paperVersion,
        payload.marks,
        payload.reviewStatus,
        payload.reviewReason,
        now,
        payload.id
      ]
    );

    db.run("DELETE FROM structured_question_topics WHERE question_id = ?;", [payload.id]);
    db.run("DELETE FROM structured_question_tags WHERE question_id = ?;", [payload.id]);
    for (const topicId of upsertSharedNames(db, payload.topics, "mcq_topics")) {
      db.run("INSERT OR IGNORE INTO structured_question_topics (question_id, topic_id) VALUES (?, ?);", [payload.id, topicId]);
    }
    for (const tagId of upsertSharedNames(db, payload.tags, "mcq_tags")) {
      db.run("INSERT OR IGNORE INTO structured_question_tags (question_id, tag_id) VALUES (?, ?);", [payload.id, tagId]);
    }

    db.run("COMMIT;");
    persistDatabase(db, databasePath);
    const updated = await listStructuredQuestions(databasePath);
    const question = updated.find((item) => item.id === payload.id);
    if (!question) throw new Error("Structured question was not found after updating metadata.");
    return question;
  } catch (error) {
    try {
      db.run("ROLLBACK;");
    } catch {
      // Ignore rollback errors.
    }
    throw error;
  } finally {
    db.close();
  }
}

export async function importStructuredQuestionRecords(databasePath: string, records: StructuredQuestionRecord[]): Promise<{ created: number; updated: number }> {
  const db = await openDatabase(databasePath);
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;

  try {
    db.run("PRAGMA foreign_keys = ON;");
    db.run("BEGIN;");
    for (const record of records) {
      const existing = db.exec("SELECT id, created_at FROM structured_questions WHERE exam_code = ? AND question_number = ?;", [record.examCode, record.questionNumber]);
      const existingId = existing[0]?.values[0]?.[0] ? String(existing[0].values[0][0]) : null;
      const existingCreatedAt = existing[0]?.values[0]?.[1] ? String(existing[0].values[0][1]) : record.createdAt || now;
      const id = existingId ?? record.id;

      db.run(
        `INSERT INTO structured_questions (
          id, import_batch_id, exam_code, subject_code, session, year, paper, paper_version,
          question_number, marks, source_qp_path, source_ms_path, split_qp_path, split_ms_path,
          qp_start_page_raw, ms_start_page_raw, qp_page_start, qp_page_end, ms_page_start, ms_page_end,
          review_status, review_reason, created_at, updated_at
        ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(exam_code, question_number) DO UPDATE SET
          subject_code = excluded.subject_code,
          session = excluded.session,
          year = excluded.year,
          paper = excluded.paper,
          paper_version = excluded.paper_version,
          marks = excluded.marks,
          source_qp_path = excluded.source_qp_path,
          source_ms_path = excluded.source_ms_path,
          split_qp_path = excluded.split_qp_path,
          split_ms_path = excluded.split_ms_path,
          qp_page_start = excluded.qp_page_start,
          qp_page_end = excluded.qp_page_end,
          ms_page_start = excluded.ms_page_start,
          ms_page_end = excluded.ms_page_end,
          review_status = excluded.review_status,
          review_reason = excluded.review_reason,
          updated_at = excluded.updated_at;`,
        [
          id,
          record.examCode,
          record.subjectCode,
          record.session,
          record.year,
          record.paper,
          record.paperVersion,
          record.questionNumber,
          record.marks,
          record.sourceQpPath,
          record.sourceMsPath,
          record.splitQpPath,
          record.splitMsPath,
          String(record.qpPageStart ?? ""),
          String(record.msPageStart ?? ""),
          record.qpPageStart,
          record.qpPageEnd,
          record.msPageStart,
          record.msPageEnd,
          record.reviewStatus,
          record.reviewReason,
          existingCreatedAt,
          now
        ]
      );

      db.run("DELETE FROM structured_question_topics WHERE question_id = ?;", [id]);
      db.run("DELETE FROM structured_question_tags WHERE question_id = ?;", [id]);
      for (const topicId of upsertSharedNames(db, record.topics, "mcq_topics")) {
        db.run("INSERT OR IGNORE INTO structured_question_topics (question_id, topic_id) VALUES (?, ?);", [id, topicId]);
      }
      for (const tagId of upsertSharedNames(db, record.tags, "mcq_tags")) {
        db.run("INSERT OR IGNORE INTO structured_question_tags (question_id, tag_id) VALUES (?, ?);", [id, tagId]);
      }

      if (existingId) updated += 1;
      else created += 1;
    }
    db.run("COMMIT;");
    persistDatabase(db, databasePath);
    return { created, updated };
  } catch (error) {
    try {
      db.run("ROLLBACK;");
    } catch {
      // Ignore rollback errors.
    }
    throw error;
  } finally {
    db.close();
  }
}

function readStructuredNames(db: Database, table: "mcq_topics" | "mcq_tags", linkTable: "structured_question_topics" | "structured_question_tags", questionId: string) {
  const result = db.exec(
    `SELECT item.name FROM ${table} item
     JOIN ${linkTable} link ON link.${table === "mcq_topics" ? "topic_id" : "tag_id"} = item.id
     WHERE link.question_id = ?
     ORDER BY item.name;`,
    [questionId]
  );
  return result[0]?.values.map((row) => String(row[0])) ?? [];
}
