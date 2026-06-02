import { CheckCircle2, Database, FolderOpen, ShieldCheck, MoreVertical } from "lucide-react";
import type { WorkspaceInfo } from "../../../../types";

export function EditorStatusBar({ workspace, savedAt }: { workspace: WorkspaceInfo | null; savedAt: string | null }) {
  return (
    <footer className="mcq-statusbar">
      <div>
        <FolderOpen size={18} />
        <span>Workspace:</span>
        <strong>{workspace?.workspaceRoot ?? "C:\\TeacherDesk_Workspace"}</strong>
      </div>
      <div>
        <Database size={18} />
        <span>Database:</span>
        <strong>teacherdesk.sqlite</strong>
      </div>
      <div>
        <CheckCircle2 size={18} />
        <span>Saved:</span>
        <strong>{savedAt ?? "Draft"}</strong>
      </div>
      <div>
        <span>Renderer:</span>
        <strong>v1.0.0</strong>
      </div>
      <div>
        <ShieldCheck size={18} />
        <span>Duplicate check:</span>
        <strong>Checked on save</strong>
      </div>
      <button aria-label="Status actions" type="button">
        <MoreVertical size={18} />
      </button>
    </footer>
  );
}
