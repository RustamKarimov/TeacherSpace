import { CheckCircle2, Download, FolderOpen, MoreHorizontal, Search, Trash2 } from "lucide-react";
import {
  A4Preview,
  Button,
  Callout,
  DataTable,
  IconButton,
  InlineEditableCell,
  ProgressBar,
  SearchableMultiSelect,
  SearchableSelect,
  SegmentedControl,
  StatusBadge,
  StatusIcon,
  TextField,
  Tooltip,
  galleryOptions
} from "../../components/ui";

export function ComponentGalleryPage() {
  return (
    <main className="td-gallery">
      <section className="td-gallery-hero">
        <div>
          <span>Design system</span>
          <h2>Component Gallery</h2>
          <p>Reusable TeacherDesk interface patterns for forms, tables, previews, files, and metadata.</p>
        </div>
        <div className="td-gallery-actions">
          <Button icon={<Download size={15} />} variant="secondary">Export guide</Button>
          <IconButton label="Gallery actions" icon={<MoreHorizontal size={16} />} />
        </div>
      </section>

      <section className="td-component-stage">
        <div className="td-component-panel">
          <h3>Controls</h3>
          <div className="td-component-grid">
            <Button icon={<CheckCircle2 size={15} />}>Primary action</Button>
            <Button variant="secondary" icon={<FolderOpen size={15} />}>Secondary</Button>
            <Button variant="danger" icon={<Trash2 size={15} />}>Danger</Button>
            <Tooltip label="Search the current bank">
              <button className="td-icon-button" type="button"><Search size={16} /></button>
            </Tooltip>
          </div>
          <SegmentedControl
            label="Preview mode"
            value="student"
            onChange={() => undefined}
            options={[
              { label: "Student", value: "student" },
              { label: "Teacher", value: "teacher" }
            ]}
          />
        </div>

        <div className="td-component-panel">
          <h3>Forms</h3>
          <TextField label="Exam code" value="9702_w25_qp_12" onChange={() => undefined} />
          <SearchableSelect label="Topic" value="mechanics" options={galleryOptions} onChange={() => undefined} />
          <SearchableMultiSelect label="Tags" values={["mechanics", "waves"]} options={galleryOptions} onChange={() => undefined} />
        </div>

        <div className="td-component-panel">
          <h3>Status</h3>
          <div className="td-component-grid">
            <StatusIcon status="ready" />
            <StatusIcon status="review" />
            <StatusIcon status="issue" />
            <StatusBadge tone="success">Ready</StatusBadge>
            <StatusBadge tone="warning">Needs review</StatusBadge>
          </div>
          <ProgressBar value={64} />
          <Callout title="Validation" tone="info">Exact messages should tell the teacher what to fix and where.</Callout>
        </div>

        <div className="td-component-panel td-component-wide">
          <h3>Table and Preview</h3>
          <div className="td-component-split">
            <div>
              <DataTable />
              <InlineEditableCell />
            </div>
            <A4Preview />
          </div>
        </div>
      </section>
    </main>
  );
}
