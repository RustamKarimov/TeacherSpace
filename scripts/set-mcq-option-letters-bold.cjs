const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const dbPath = process.argv[2];

if (!dbPath) {
  console.error("Usage: node scripts/set-mcq-option-letters-bold.cjs <path-to-teacherdesk.sqlite>");
  process.exit(1);
}

function markOptionsBlock(block) {
  if (!block || block.type !== "options") return false;

  let changed = false;
  block.settings = block.settings && typeof block.settings === "object" ? block.settings : {};
  block.settings.label = block.settings.label && typeof block.settings.label === "object" ? block.settings.label : {};
  if (block.settings.label.bold !== true) {
    block.settings.label.bold = true;
    changed = true;
  }

  const rows = Array.isArray(block.table?.rows) ? block.table.rows : [];
  for (const row of rows) {
    const firstCell = Array.isArray(row) ? row[0] : null;
    const text = String(firstCell?.text ?? "").trim();
    if (/^[ABCD]$/.test(text)) {
      if (firstCell.bold !== true) {
        firstCell.bold = true;
        changed = true;
      }
      if (firstCell.header !== true) {
        firstCell.header = true;
        changed = true;
      }
    }
  }

  return changed;
}

(async () => {
  const absoluteDbPath = path.resolve(dbPath);
  if (!fs.existsSync(absoluteDbPath)) {
    throw new Error(`Database not found: ${absoluteDbPath}`);
  }

  const backupPath = `${absoluteDbPath}.backup-before-option-label-bold-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  fs.copyFileSync(absoluteDbPath, backupPath);

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(absoluteDbPath));
  const rows = db.exec("SELECT id, question_json FROM mcq_questions;");
  const values = rows[0]?.values ?? [];
  let changedQuestions = 0;
  let scannedQuestions = 0;

  db.run("BEGIN;");
  try {
    for (const [id, rawJson] of values) {
      scannedQuestions += 1;
      let parsed;
      try {
        parsed = JSON.parse(String(rawJson ?? "{}"));
      } catch (error) {
        console.warn(`Skipped invalid question_json for ${id}: ${error.message}`);
        continue;
      }

      const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
      const changed = blocks.some(markOptionsBlock);
      if (!changed) continue;

      db.run("UPDATE mcq_questions SET question_json = ? WHERE id = ?;", [JSON.stringify(parsed), id]);
      changedQuestions += 1;
    }

    db.run("COMMIT;");
  } catch (error) {
    db.run("ROLLBACK;");
    throw error;
  }

  fs.writeFileSync(absoluteDbPath, Buffer.from(db.export()));
  db.close();

  console.log(JSON.stringify({ scannedQuestions, changedQuestions, backupPath }, null, 2));
})();
