export const migrations = [
  {
    version: 1,
    name: "foundation",
    sql: `
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mcq_questions (
        id TEXT PRIMARY KEY,
        exam_code TEXT NOT NULL,
        original_question_number TEXT NOT NULL,
        syllabus TEXT,
        session TEXT,
        year INTEGER,
        paper TEXT,
        paper_version TEXT,
        marks INTEGER NOT NULL DEFAULT 1,
        difficulty TEXT NOT NULL DEFAULT 'Medium',
        review_status TEXT NOT NULL DEFAULT 'Ready',
        correct_answer TEXT,
        searchable_text TEXT NOT NULL DEFAULT '',
        question_json TEXT NOT NULL,
        renderer_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_mcq_exam_question
        ON mcq_questions (exam_code, original_question_number);

      CREATE TABLE IF NOT EXISTS mcq_topics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mcq_tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mcq_question_topics (
        question_id TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        PRIMARY KEY (question_id, topic_id),
        FOREIGN KEY (question_id) REFERENCES mcq_questions(id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES mcq_topics(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS mcq_question_tags (
        question_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (question_id, tag_id),
        FOREIGN KEY (question_id) REFERENCES mcq_questions(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES mcq_tags(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        relative_path TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL,
        source_name TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS generated_exams (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        mode TEXT NOT NULL,
        manifest_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `
  },
  {
    version: 2,
    name: "structured_exams",
    sql: `
      CREATE TABLE IF NOT EXISTS structured_import_batches (
        id TEXT PRIMARY KEY,
        manifest_path TEXT NOT NULL,
        source_folder TEXT NOT NULL,
        destination_folder TEXT NOT NULL,
        status TEXT NOT NULL,
        row_count INTEGER NOT NULL DEFAULT 0,
        error_count INTEGER NOT NULL DEFAULT 0,
        warning_count INTEGER NOT NULL DEFAULT 0,
        report_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS structured_questions (
        id TEXT PRIMARY KEY,
        import_batch_id TEXT,
        exam_code TEXT NOT NULL,
        subject_code TEXT NOT NULL,
        session TEXT,
        year INTEGER,
        paper TEXT,
        paper_version TEXT,
        question_number INTEGER NOT NULL,
        marks INTEGER,
        source_qp_path TEXT NOT NULL,
        source_ms_path TEXT NOT NULL,
        split_qp_path TEXT NOT NULL,
        split_ms_path TEXT NOT NULL,
        qp_start_page_raw TEXT,
        ms_start_page_raw TEXT,
        qp_page_start INTEGER,
        qp_page_end INTEGER,
        ms_page_start INTEGER,
        ms_page_end INTEGER,
        review_status TEXT NOT NULL DEFAULT 'Not required',
        review_reason TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (import_batch_id) REFERENCES structured_import_batches(id) ON DELETE SET NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_structured_exam_question
        ON structured_questions (exam_code, question_number);

      CREATE TABLE IF NOT EXISTS structured_question_topics (
        question_id TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        PRIMARY KEY (question_id, topic_id),
        FOREIGN KEY (question_id) REFERENCES structured_questions(id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES mcq_topics(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS structured_question_tags (
        question_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (question_id, tag_id),
        FOREIGN KEY (question_id) REFERENCES structured_questions(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES mcq_tags(id) ON DELETE CASCADE
      );
    `
  },
  {
    version: 3,
    name: "analysis_foundation",
    sql: `
      CREATE TABLE IF NOT EXISTS analysis_students (
        id TEXT PRIMARY KEY,
        school_id TEXT,
        first_name TEXT NOT NULL,
        surname TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        grade TEXT NOT NULL,
        class_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_analysis_students_class
        ON analysis_students (academic_year, grade, class_name, surname, first_name);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_analysis_students_school_year
        ON analysis_students (school_id, academic_year)
        WHERE school_id IS NOT NULL AND school_id <> '';

      CREATE TABLE IF NOT EXISTS analysis_exam_sessions (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL CHECK (source_type IN ('mcq', 'structured')),
        generated_exam_id TEXT,
        title TEXT NOT NULL,
        exam_date TEXT,
        academic_year TEXT NOT NULL,
        grade TEXT NOT NULL DEFAULT '',
        class_name TEXT NOT NULL DEFAULT '',
        paper TEXT NOT NULL DEFAULT '',
        total_marks REAL NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_analysis_exam_sessions_lookup
        ON analysis_exam_sessions (source_type, academic_year, grade, class_name, exam_date);

      CREATE TABLE IF NOT EXISTS analysis_exam_variants (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        variant_label TEXT NOT NULL,
        question_order_json TEXT NOT NULL DEFAULT '[]',
        answer_key_json TEXT NOT NULL DEFAULT '{}',
        qp_file_path TEXT NOT NULL DEFAULT '',
        ms_file_path TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE (session_id, variant_label),
        FOREIGN KEY (session_id) REFERENCES analysis_exam_sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS analysis_mcq_attempts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        variant_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        total_questions INTEGER NOT NULL DEFAULT 0,
        correct_count INTEGER NOT NULL DEFAULT 0,
        mark REAL NOT NULL DEFAULT 0,
        percentage REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Complete',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (session_id, variant_id, student_id),
        FOREIGN KEY (session_id) REFERENCES analysis_exam_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (variant_id) REFERENCES analysis_exam_variants(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES analysis_students(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS analysis_mcq_responses (
        attempt_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        question_number INTEGER NOT NULL,
        selected_answer TEXT NOT NULL DEFAULT '',
        correct_answer TEXT NOT NULL DEFAULT '',
        is_correct INTEGER NOT NULL DEFAULT 0,
        question_snapshot_json TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (attempt_id, question_id),
        FOREIGN KEY (attempt_id) REFERENCES analysis_mcq_attempts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_analysis_mcq_responses_question
        ON analysis_mcq_responses (question_id, is_correct);

      CREATE TABLE IF NOT EXISTS analysis_structured_attempts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        total_awarded REAL NOT NULL DEFAULT 0,
        total_available REAL NOT NULL DEFAULT 0,
        percentage REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Complete',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (session_id, student_id),
        FOREIGN KEY (session_id) REFERENCES analysis_exam_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES analysis_students(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS analysis_structured_question_marks (
        attempt_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        question_number INTEGER NOT NULL,
        marks_awarded REAL NOT NULL DEFAULT 0,
        marks_available REAL NOT NULL DEFAULT 0,
        question_snapshot_json TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (attempt_id, question_id),
        FOREIGN KEY (attempt_id) REFERENCES analysis_structured_attempts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_analysis_structured_marks_question
        ON analysis_structured_question_marks (question_id);

      CREATE TABLE IF NOT EXISTS analysis_question_stats (
        source_type TEXT NOT NULL CHECK (source_type IN ('mcq', 'structured')),
        question_id TEXT NOT NULL,
        attempts_count INTEGER NOT NULL DEFAULT 0,
        success_percent REAL NOT NULL DEFAULT 0,
        difficulty TEXT NOT NULL DEFAULT 'Medium',
        last_calculated_at TEXT NOT NULL,
        PRIMARY KEY (source_type, question_id)
      );

      CREATE TABLE IF NOT EXISTS analysis_topic_stats (
        source_type TEXT NOT NULL CHECK (source_type IN ('mcq', 'structured', 'combined')),
        topic_id TEXT NOT NULL,
        attempts_count INTEGER NOT NULL DEFAULT 0,
        success_percent REAL NOT NULL DEFAULT 0,
        last_calculated_at TEXT NOT NULL,
        PRIMARY KEY (source_type, topic_id),
        FOREIGN KEY (topic_id) REFERENCES mcq_topics(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS analysis_tag_stats (
        source_type TEXT NOT NULL CHECK (source_type IN ('mcq', 'structured', 'combined')),
        tag_id TEXT NOT NULL,
        attempts_count INTEGER NOT NULL DEFAULT 0,
        success_percent REAL NOT NULL DEFAULT 0,
        last_calculated_at TEXT NOT NULL,
        PRIMARY KEY (source_type, tag_id),
        FOREIGN KEY (tag_id) REFERENCES mcq_tags(id) ON DELETE CASCADE
      );
    `
  },
  {
    version: 4,
    name: "generated_exam_registry",
    sql: `
      ALTER TABLE generated_exams ADD COLUMN source_type TEXT NOT NULL DEFAULT 'mcq';
      ALTER TABLE generated_exams ADD COLUMN folder_path TEXT NOT NULL DEFAULT '';

      CREATE INDEX IF NOT EXISTS idx_generated_exams_source_created
        ON generated_exams (source_type, created_at);

      CREATE TABLE IF NOT EXISTS generated_exam_variants (
        id TEXT PRIMARY KEY,
        generated_exam_id TEXT NOT NULL,
        variant_label TEXT NOT NULL,
        question_order_json TEXT NOT NULL DEFAULT '[]',
        answer_key_json TEXT NOT NULL DEFAULT '{}',
        student_file_path TEXT NOT NULL DEFAULT '',
        teacher_file_path TEXT NOT NULL DEFAULT '',
        answer_key_file_path TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE (generated_exam_id, variant_label),
        FOREIGN KEY (generated_exam_id) REFERENCES generated_exams(id) ON DELETE CASCADE
      );
    `
  },
  {
    version: 5,
    name: "read_performance_indexes",
    sql: `
      CREATE INDEX IF NOT EXISTS idx_mcq_questions_bank_filters
        ON mcq_questions (year, session, paper, paper_version, review_status);
      CREATE INDEX IF NOT EXISTS idx_mcq_questions_updated
        ON mcq_questions (updated_at);
      CREATE INDEX IF NOT EXISTS idx_mcq_question_topics_topic
        ON mcq_question_topics (topic_id, question_id);
      CREATE INDEX IF NOT EXISTS idx_mcq_question_tags_tag
        ON mcq_question_tags (tag_id, question_id);

      CREATE INDEX IF NOT EXISTS idx_structured_questions_bank_filters
        ON structured_questions (year, session, paper, paper_version, review_status);
      CREATE INDEX IF NOT EXISTS idx_structured_questions_marks
        ON structured_questions (paper, marks);
      CREATE INDEX IF NOT EXISTS idx_structured_question_topics_topic
        ON structured_question_topics (topic_id, question_id);
      CREATE INDEX IF NOT EXISTS idx_structured_question_tags_tag
        ON structured_question_tags (tag_id, question_id);

      CREATE INDEX IF NOT EXISTS idx_generated_exam_variants_exam
        ON generated_exam_variants (generated_exam_id, variant_label);
      CREATE INDEX IF NOT EXISTS idx_analysis_exam_sessions_generated
        ON analysis_exam_sessions (generated_exam_id, source_type);
    `
  }
];
