import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import { getAnalysisOverview, runMigrations, saveGeneratedExamRecord } from "../electron/database";
import { parseExamCode } from "../src/lib/examCode";
import { toWorkspaceRelative } from "../src/lib/workspacePaths";
import { selectQuestionsForMode } from "../src/features/mcq/generator/generatorLogic";
import type { McqQuestionRecord } from "../src/types";

describe("exam code parsing", () => {
  it("parses Cambridge Physics paper codes", () => {
    expect(parseExamCode("9702_w25_qp_11")).toEqual({
      syllabus: "9702",
      session: "Oct/Nov",
      year: 2025,
      paper: "Paper 1",
      paperVersion: "1"
    });
  });

  it("rejects malformed exam codes", () => {
    expect(parseExamCode("9702_w25_ms_11")).toBeNull();
  });
});

describe("workspace path handling", () => {
  it("stores workspace-local paths as relative paths", () => {
    expect(
      toWorkspaceRelative(
        "D:\\TeacherDesk_Workspace",
        "D:\\TeacherDesk_Workspace\\mcq\\assets\\question_images\\figure.png"
      )
    ).toBe("mcq/assets/question_images/figure.png");
  });

  it("keeps external paths absolute", () => {
    expect(toWorkspaceRelative("D:\\TeacherDesk_Workspace", "C:\\Downloads\\figure.png")).toBe("C:\\Downloads\\figure.png");
  });
});

describe("MCQ full-paper selection", () => {
  it("selects each generated question from the matching original question-number bucket", () => {
    const questions = [
      mcqQuestion("q1-a", "1"),
      mcqQuestion("q1-b", "1"),
      mcqQuestion("q2-a", "2"),
      mcqQuestion("q3-a", "3"),
      mcqQuestion("q9-a", "9")
    ];

    const selected = selectQuestionsForMode({
      mode: "full-paper",
      questionCount: 3,
      questions,
      selectedTopics: [],
      topicRows: [],
      basketQuestions: []
    });

    expect(selected).toHaveLength(3);
    expect(selected.map((question) => Number(question.originalQuestionNumber))).toEqual([1, 2, 3]);
    expect(selected.every((question, index) => Number(question.originalQuestionNumber) === index + 1)).toBe(true);
  });
});

describe("database migrations", () => {
  it("creates the analysis foundation tables", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "teacherdesk-db-"));
    const databasePath = path.join(tempDir, "teacherdesk.sqlite");

    const result = await runMigrations(databasePath);
    expect(result.currentVersion).toBe(5);

    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(databasePath));
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table';")[0].values.map((row) => String(row[0]));
    const indexes = db.exec("SELECT name FROM sqlite_master WHERE type = 'index';")[0].values.map((row) => String(row[0]));
    db.close();

    expect(tables).toEqual(expect.arrayContaining([
      "analysis_students",
      "analysis_exam_sessions",
      "analysis_exam_variants",
      "analysis_mcq_attempts",
      "analysis_mcq_responses",
      "analysis_structured_attempts",
      "analysis_structured_question_marks",
      "analysis_question_stats",
      "analysis_topic_stats",
      "analysis_tag_stats",
      "generated_exam_variants"
    ]));
    expect(indexes).toEqual(expect.arrayContaining([
      "idx_mcq_questions_bank_filters",
      "idx_mcq_question_topics_topic",
      "idx_structured_questions_bank_filters",
      "idx_generated_exam_variants_exam"
    ]));
  });

  it("indexes generated exam packages for later analysis", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "teacherdesk-generated-exam-"));
    const databasePath = path.join(tempDir, "teacherdesk.sqlite");
    const outputFolder = path.join(tempDir, "AS Physics MCQ Practice");
    fs.mkdirSync(outputFolder, { recursive: true });
    fs.writeFileSync(path.join(outputFolder, "AS Physics MCQ Practice_student_A.pdf"), "");
    fs.writeFileSync(path.join(outputFolder, "AS Physics MCQ Practice_teacher_A.pdf"), "");
    fs.writeFileSync(path.join(outputFolder, "AS Physics MCQ Practice_answer_key_A.pdf"), "");

    await runMigrations(databasePath);
    await saveGeneratedExamRecord(databasePath, "mcq", outputFolder, {
      title: "AS Physics MCQ Practice",
      mode: "full-paper",
      createdAt: "2026-06-04T10:00:00.000Z",
      variants: [
        {
          label: "A",
          questions: [
            {
              id: "q1",
              number: 1,
              answer: "D",
              examCode: "9702_w25_qp_11",
              originalQuestionNumber: "1"
            }
          ]
        }
      ]
    });

    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(databasePath));
    const examRows = db.exec("SELECT title, mode, source_type, folder_path FROM generated_exams;")[0].values;
    const variantRows = db.exec("SELECT variant_label, answer_key_json, student_file_path FROM generated_exam_variants;")[0].values;
    db.close();

    expect(examRows).toEqual([["AS Physics MCQ Practice", "full-paper", "mcq", outputFolder]]);
    expect(JSON.parse(String(variantRows[0][1]))).toEqual({ "1": "D" });
    expect(String(variantRows[0][2])).toContain("student_A.pdf");
  });

  it("summarizes generated exam usage in the analysis overview", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "teacherdesk-analysis-overview-"));
    const databasePath = path.join(tempDir, "teacherdesk.sqlite");
    const outputFolder = path.join(tempDir, "AS Physics MCQ Practice");
    fs.mkdirSync(outputFolder, { recursive: true });

    await runMigrations(databasePath);

    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(databasePath));
    const now = "2026-06-04T10:00:00.000Z";
    db.run(
      `INSERT INTO mcq_questions (
        id, exam_code, original_question_number, syllabus, session, year, paper, paper_version,
        marks, difficulty, review_status, correct_answer, searchable_text, question_json, renderer_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      ["q1", "9702_w25_qp_11", "1", "9702", "Oct/Nov", 2025, "Paper 1", "1", 1, "Medium", "Ready", "A", "", "{\"blocks\":[]}", 1, now, now]
    );
    db.run(
      `INSERT INTO mcq_questions (
        id, exam_code, original_question_number, syllabus, session, year, paper, paper_version,
        marks, difficulty, review_status, correct_answer, searchable_text, question_json, renderer_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      ["q2", "9702_w25_qp_11", "2", "9702", "Oct/Nov", 2025, "Paper 1", "1", 1, "Difficult", "Needs review", "B", "", "{\"blocks\":[]}", 1, now, now]
    );
    fs.writeFileSync(databasePath, Buffer.from(db.export()));
    db.close();

    await saveGeneratedExamRecord(databasePath, "mcq", outputFolder, {
      title: "AS Physics MCQ Practice",
      mode: "full-paper",
      createdAt: now,
      variants: [{ label: "A", questions: [{ id: "q1", number: 1, answer: "A" }] }]
    });

    const overview = await getAnalysisOverview(databasePath);
    expect(overview.generatedExams?.mcq).toBe(1);
    expect(overview.usage).toMatchObject({ mcqUsed: 1, mcqUnused: 1 });
    expect(overview.difficultyDistribution).toEqual(expect.arrayContaining([
      { difficulty: "Medium", count: 1 },
      { difficulty: "Difficult", count: 1 }
    ]));
    expect(overview.reviewDistribution).toEqual(expect.arrayContaining([
      { status: "Ready", mcqCount: 1, structuredCount: 0 },
      { status: "Needs review", mcqCount: 1, structuredCount: 0 }
    ]));
  });
});

function mcqQuestion(id: string, originalQuestionNumber: string): McqQuestionRecord {
  return {
    id,
    examCode: "9702_w25_qp_11",
    originalQuestionNumber,
    syllabus: "9702",
    session: "Oct/Nov",
    year: "2025",
    paper: "Paper 1",
    paperVersion: "1",
    marks: 1,
    difficulty: "Medium",
    reviewStatus: "Ready",
    correctAnswer: "A",
    searchableText: "",
    questionJson: { metadata: {}, blocks: [], rendererVersion: 1 },
    topics: [],
    tags: [],
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:00.000Z"
  };
}
