import { FolderOpen, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { teacherDeskApi } from "../../lib/rendererApi";
import type { AppSettings, WorkspaceInfo } from "../../types";

type Props = {
  settings: AppSettings | null;
  workspace: WorkspaceInfo | null;
  onSettingsSaved: (settings: AppSettings) => void;
};

export function SettingsPage({ settings, workspace, onSettingsSaved }: Props) {
  const [draft, setDraft] = useState<AppSettings | null>(settings);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  if (!draft) {
    return <div className="settings-page"><section className="settings-card"><strong>Loading settings...</strong></section></div>;
  }

  function update(updater: (current: AppSettings) => AppSettings) {
    setDraft((current) => current ? updater(current) : current);
  }

  async function save() {
    if (!draft) return;
    setIsSaving(true);
    try {
      const saved = await teacherDeskApi.saveSettings(draft);
      onSettingsSaved(saved);
      setMessage("Settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function chooseFolder(currentFolder: string, apply: (folder: string) => void) {
    const selected = await teacherDeskApi.pickOutputFolder(currentFolder);
    if (selected) apply(selected);
  }

  return (
    <div className="settings-page">
      <section className="settings-hero">
        <div>
          <span>Local workspace</span>
          <strong>{workspace?.workspaceRoot ?? draft.workspaceRoot}</strong>
        </div>
        <button type="button" onClick={() => void save()} disabled={isSaving}><Save size={15} /> {isSaving ? "Saving..." : "Save settings"}</button>
      </section>

      <div className="settings-grid">
        <section className="settings-card">
          <header>
            <strong>MCQ generator defaults</strong>
            <span>Used when opening MCQ Exam Generator.</span>
          </header>
          <div className="settings-form-grid two">
            <TextField label="Default exam title" value={draft.defaults.mcqGenerator.title} onChange={(title) => update((current) => ({ ...current, defaults: { ...current.defaults, mcqGenerator: { ...current.defaults.mcqGenerator, title } } }))} />
            <FolderField
              label="Output folder"
              value={draft.defaults.mcqGenerator.outputFolder}
              onBrowse={() => chooseFolder(draft.defaults.mcqGenerator.outputFolder, (outputFolder) => update((current) => ({ ...current, defaults: { ...current.defaults, mcqGenerator: { ...current.defaults.mcqGenerator, outputFolder } } })))}
              onChange={(outputFolder) => update((current) => ({ ...current, defaults: { ...current.defaults, mcqGenerator: { ...current.defaults.mcqGenerator, outputFolder } } }))}
            />
            <NumberField label="Question count" value={draft.defaults.mcqGenerator.questionCount} onChange={(questionCount) => update((current) => ({ ...current, defaults: { ...current.defaults, mcqGenerator: { ...current.defaults.mcqGenerator, questionCount } } }))} />
            <NumberField label="Variants" value={draft.defaults.mcqGenerator.variants} onChange={(variants) => update((current) => ({ ...current, defaults: { ...current.defaults, mcqGenerator: { ...current.defaults.mcqGenerator, variants } } }))} />
            <NumberField label="Question number gap" value={draft.defaults.mcqGenerator.questionNumberGap} onChange={(questionNumberGap) => update((current) => ({ ...current, defaults: { ...current.defaults, mcqGenerator: { ...current.defaults.mcqGenerator, questionNumberGap } } }))} />
            <NumberField label="Question gap" value={draft.defaults.mcqGenerator.questionGap} onChange={(questionGap) => update((current) => ({ ...current, defaults: { ...current.defaults, mcqGenerator: { ...current.defaults.mcqGenerator, questionGap } } }))} />
          </div>
          <div className="settings-check-row">
            <CheckField label="Shuffle questions" checked={draft.defaults.mcqGenerator.shuffleQuestions} onChange={(shuffleQuestions) => update((current) => ({ ...current, defaults: { ...current.defaults, mcqGenerator: { ...current.defaults.mcqGenerator, shuffleQuestions } } }))} />
            <CheckField label="Shuffle options" checked={draft.defaults.mcqGenerator.shuffleOptions} onChange={(shuffleOptions) => update((current) => ({ ...current, defaults: { ...current.defaults, mcqGenerator: { ...current.defaults.mcqGenerator, shuffleOptions } } }))} />
            <CheckField label="Allow split questions" checked={draft.defaults.mcqGenerator.allowQuestionSplit} onChange={(allowQuestionSplit) => update((current) => ({ ...current, defaults: { ...current.defaults, mcqGenerator: { ...current.defaults.mcqGenerator, allowQuestionSplit } } }))} />
          </div>
        </section>

        <section className="settings-card">
          <header>
            <strong>Structured splitter defaults</strong>
            <span>Used when opening Batch Splitter.</span>
          </header>
          <div className="settings-form-grid">
            <FolderField
              label="Source PDF folder"
              value={draft.defaults.structuredSplitter.sourceFolder}
              onBrowse={() => chooseFolder(draft.defaults.structuredSplitter.sourceFolder, (sourceFolder) => update((current) => ({ ...current, defaults: { ...current.defaults, structuredSplitter: { ...current.defaults.structuredSplitter, sourceFolder } } })))}
              onChange={(sourceFolder) => update((current) => ({ ...current, defaults: { ...current.defaults, structuredSplitter: { ...current.defaults.structuredSplitter, sourceFolder } } }))}
            />
            <FolderField
              label="Destination folder"
              value={draft.defaults.structuredSplitter.destinationFolder}
              onBrowse={() => chooseFolder(draft.defaults.structuredSplitter.destinationFolder, (destinationFolder) => update((current) => ({ ...current, defaults: { ...current.defaults, structuredSplitter: { ...current.defaults.structuredSplitter, destinationFolder } } })))}
              onChange={(destinationFolder) => update((current) => ({ ...current, defaults: { ...current.defaults, structuredSplitter: { ...current.defaults.structuredSplitter, destinationFolder } } }))}
            />
          </div>
          <div className="settings-check-row">
            <CheckField label="Overwrite existing split PDFs by default" checked={draft.defaults.structuredSplitter.overwriteExisting} onChange={(overwriteExisting) => update((current) => ({ ...current, defaults: { ...current.defaults, structuredSplitter: { ...current.defaults.structuredSplitter, overwriteExisting } } }))} />
          </div>
        </section>

        <section className="settings-card settings-wide">
          <header>
            <strong>Structured exam generator defaults</strong>
            <span>Used for full paper, topical, and basket generation.</span>
          </header>
          <div className="settings-form-grid three">
            <TextField label="Default exam title" value={draft.defaults.structuredGenerator.title} onChange={(title) => update((current) => ({ ...current, defaults: { ...current.defaults, structuredGenerator: { ...current.defaults.structuredGenerator, title } } }))} />
            <FolderField
              label="Output folder"
              value={draft.defaults.structuredGenerator.outputFolder}
              onBrowse={() => chooseFolder(draft.defaults.structuredGenerator.outputFolder, (outputFolder) => update((current) => ({ ...current, defaults: { ...current.defaults, structuredGenerator: { ...current.defaults.structuredGenerator, outputFolder } } })))}
              onChange={(outputFolder) => update((current) => ({ ...current, defaults: { ...current.defaults, structuredGenerator: { ...current.defaults.structuredGenerator, outputFolder } } }))}
            />
            <NumberField label="Allowed over target" value={draft.defaults.structuredGenerator.allowanceMarks} onChange={(allowanceMarks) => update((current) => ({ ...current, defaults: { ...current.defaults, structuredGenerator: { ...current.defaults.structuredGenerator, allowanceMarks } } }))} />
            {["2", "3", "4", "5"].map((paper) => (
              <NumberField
                key={paper}
                label={`Paper ${paper} marks`}
                value={draft.defaults.structuredGenerator.targetMarksByPaper[paper] ?? 0}
                onChange={(value) => update((current) => ({
                  ...current,
                  defaults: {
                    ...current.defaults,
                    structuredGenerator: {
                      ...current.defaults.structuredGenerator,
                      targetMarksByPaper: { ...current.defaults.structuredGenerator.targetMarksByPaper, [paper]: value }
                    }
                  }
                }))}
              />
            ))}
          </div>
          <div className="settings-form-grid four">
            <NumberField label="Top mask mm" value={draft.defaults.structuredGenerator.topMaskMm} onChange={(topMaskMm) => update((current) => ({ ...current, defaults: { ...current.defaults, structuredGenerator: { ...current.defaults.structuredGenerator, topMaskMm } } }))} />
            <NumberField label="Bottom mask mm" value={draft.defaults.structuredGenerator.bottomMaskMm} onChange={(bottomMaskMm) => update((current) => ({ ...current, defaults: { ...current.defaults, structuredGenerator: { ...current.defaults.structuredGenerator, bottomMaskMm } } }))} />
            <NumberField label="Left mask mm" value={draft.defaults.structuredGenerator.leftMaskMm} onChange={(leftMaskMm) => update((current) => ({ ...current, defaults: { ...current.defaults, structuredGenerator: { ...current.defaults.structuredGenerator, leftMaskMm } } }))} />
            <NumberField label="Right mask mm" value={draft.defaults.structuredGenerator.rightMaskMm} onChange={(rightMaskMm) => update((current) => ({ ...current, defaults: { ...current.defaults, structuredGenerator: { ...current.defaults.structuredGenerator, rightMaskMm } } }))} />
          </div>
        </section>
      </div>

      {message ? <div className="td-app-notice">{message}</div> : null}
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="settings-field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="settings-field"><span>{label}</span><input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function FolderField({ label, value, onBrowse, onChange }: { label: string; value: string; onBrowse: () => void; onChange: (value: string) => void }) {
  return (
    <label className="settings-field settings-folder-field">
      <span>{label}</span>
      <div>
        <input value={value} onChange={(event) => onChange(event.target.value)} />
        <button type="button" onClick={onBrowse}><FolderOpen size={14} /></button>
      </div>
    </label>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="settings-check"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}
