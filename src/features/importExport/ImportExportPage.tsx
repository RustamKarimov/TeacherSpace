import { AlertTriangle, CheckCircle2, Download, FolderOpen, Import, PackageOpen, RefreshCw, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { teacherDeskApi } from "../../lib/rendererApi";
import type { ImportExportResult, WorkspaceInfo } from "../../types";

type ImportExportPageProps = {
  workspace: WorkspaceInfo | null;
};

export function ImportExportPage({ workspace }: ImportExportPageProps) {
  const defaultExportFolder = useMemo(() => `${workspace?.workspaceRoot ?? "TeacherDesk_Workspace"}\\backups`, [workspace]);
  const [exportFolder, setExportFolder] = useState(defaultExportFolder);
  const [importFolder, setImportFolder] = useState("");
  const [result, setResult] = useState<ImportExportResult | null>(null);
  const [message, setMessage] = useState("Ready.");
  const [isBusy, setIsBusy] = useState(false);

  async function chooseExportFolder() {
    const selected = await teacherDeskApi.pickOutputFolder(exportFolder || defaultExportFolder);
    if (selected) setExportFolder(selected);
  }

  async function chooseImportFolder() {
    const selected = await teacherDeskApi.pickOutputFolder(importFolder || defaultExportFolder);
    if (selected) setImportFolder(selected);
  }

  async function exportPackage() {
    setIsBusy(true);
    setMessage("Exporting TeacherDesk package...");
    try {
      const next = await teacherDeskApi.exportTeacherDeskPackage(exportFolder || defaultExportFolder);
      setResult(next);
      setMessage(next.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function importPackage() {
    if (!importFolder.trim()) {
      setMessage("Choose a TeacherDesk package folder first.");
      return;
    }
    setIsBusy(true);
    setMessage("Importing TeacherDesk package...");
    try {
      const next = await teacherDeskApi.importTeacherDeskPackage(importFolder);
      setResult(next);
      setMessage(next.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="import-export-page">
      <section className="import-export-intro">
        <div>
          <span>Portable packages</span>
          <h2>Import / Export</h2>
          <p>Move MCQs, structured questions, metadata, and linked PDF files without losing local ownership of the files.</p>
        </div>
        <PackageOpen size={36} />
      </section>

      <div className="import-export-grid">
        <section className="import-export-card">
          <header>
            <Download size={18} />
            <div>
              <h3>Export package</h3>
              <p>Creates a folder with a TeacherDesk manifest, MCQ records, structured records, and copied structured PDFs.</p>
            </div>
          </header>
          <label>
            <span>Destination folder</span>
            <input value={exportFolder} onChange={(event) => setExportFolder(event.target.value)} />
          </label>
          <div className="import-export-actions">
            <button type="button" onClick={chooseExportFolder}><FolderOpen size={15} /> Choose</button>
            <button className="is-primary" disabled={isBusy} type="button" onClick={exportPackage}>
              {isBusy ? <RefreshCw className="is-spinning" size={15} /> : <Upload size={15} />} Export
            </button>
          </div>
        </section>

        <section className="import-export-card">
          <header>
            <Import size={18} />
            <div>
              <h3>Import package</h3>
              <p>Uses exam code and question number as identity, so duplicate questions update the existing record instead of appearing twice.</p>
            </div>
          </header>
          <label>
            <span>Package folder</span>
            <input placeholder="Folder containing teacherdesk-package.json" value={importFolder} onChange={(event) => setImportFolder(event.target.value)} />
          </label>
          <div className="import-export-actions">
            <button type="button" onClick={chooseImportFolder}><FolderOpen size={15} /> Choose</button>
            <button className="is-primary" disabled={isBusy} type="button" onClick={importPackage}>
              {isBusy ? <RefreshCw className="is-spinning" size={15} /> : <Download size={15} />} Import
            </button>
          </div>
        </section>
      </div>

      <section className="import-export-result">
        <header>
          {result?.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <strong>{message}</strong>
          {result?.folderPath ? <button type="button" onClick={() => void teacherDeskApi.openFolder(result.folderPath)}>Open folder</button> : null}
        </header>
        {result ? (
          <div className="import-export-summary">
            <span>MCQ created <strong>{result.summary.mcqCreated}</strong></span>
            <span>MCQ updated <strong>{result.summary.mcqUpdated}</strong></span>
            <span>Structured created <strong>{result.summary.structuredCreated}</strong></span>
            <span>Structured updated <strong>{result.summary.structuredUpdated}</strong></span>
            <span>Files copied <strong>{result.summary.filesCopied}</strong></span>
            <span>Duplicates resolved <strong>{result.summary.duplicatesResolved}</strong></span>
          </div>
        ) : null}
        {result?.summary.warnings.length ? (
          <div className="import-export-warnings">
            {result.summary.warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        ) : null}
      </section>

      <section className="import-export-rules">
        <h3>How duplicate questions are handled</h3>
        <p>MCQ identity is exam code plus original question number. Structured identity is exam code plus question number. Importing the same question from another package updates the existing row and relinks its files, instead of creating a duplicate entry in the bank.</p>
      </section>
    </main>
  );
}
