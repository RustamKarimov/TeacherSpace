import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  Copy,
  Database,
  Download,
  FileImage,
  FileText,
  FolderOpen,
  Image,
  Info,
  Moon,
  MoreHorizontal,
  PanelRight,
  Plus,
  Printer,
  Search,
  Sun,
  Table2,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import katex from "katex";
import clsx from "clsx";
import {
  FloatingPortal,
  offset,
  shift,
  useFloating,
  useHover,
  useInteractions
} from "@floating-ui/react";
import type { ThemeMode } from "../types";

export type Option = { label: string; value: string };

export function Button({
  children,
  variant = "primary",
  icon,
  onClick,
  type = "button"
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} className={clsx("td-button", `td-button-${variant}`)} onClick={onClick}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function IconButton({
  label,
  icon,
  onClick,
  tone = "neutral"
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  tone?: "neutral" | "danger" | "accent";
}) {
  return (
    <Tooltip label={label}>
      <button aria-label={label} className={clsx("td-icon-button", `td-icon-${tone}`)} onClick={onClick} type="button">
        {icon}
      </button>
    </Tooltip>
  );
}

export function ThemeToggle({ value, onChange }: { value: ThemeMode; onChange: (value: ThemeMode) => void }) {
  return (
    <SegmentedControl
      label="Theme"
      value={value}
      onChange={(next) => onChange(next as ThemeMode)}
      options={[
        { label: "Light", value: "light", icon: <Sun size={15} /> },
        { label: "Dark", value: "dark", icon: <Moon size={15} /> }
      ]}
    />
  );
}

export function SegmentedControl({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<Option & { icon?: ReactNode }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="td-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={clsx("td-segment", value === option.value && "is-active")}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function TextField({
  label,
  value,
  placeholder,
  onChange,
  error,
  hint
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="td-field">
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      {hint ? <em>{hint}</em> : null}
      {error ? <small>{error}</small> : null}
    </label>
  );
}

export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Search..."
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())),
    [options, query]
  );

  return (
    <div className="td-field">
      <span>{label}</span>
      <div className="td-combobox">
        <Search size={15} />
        <input value={query} placeholder={placeholder} onChange={(event) => setQuery(event.target.value)} />
        <ChevronDown size={15} />
      </div>
      <div className="td-option-list">
        {filtered.map((option) => (
          <button key={option.value} className={clsx(value === option.value && "is-selected")} onClick={() => onChange(option.value)} type="button">
            <span>{option.label}</span>
            {value === option.value ? <Check size={14} /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SearchableMultiSelect({
  label,
  values,
  options,
  onChange
}: {
  label: string;
  values: string[];
  options: Option[];
  onChange: (value: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  function toggle(value: string) {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  return (
    <div className="td-field">
      <span>{label}</span>
      <div className="td-combobox">
        <Search size={15} />
        <input value={query} placeholder="Focus to browse or type to filter" onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="td-token-row">
        {values.length === 0 ? <em>No selections</em> : values.map((value) => <span key={value}>{options.find((item) => item.value === value)?.label ?? value}</span>)}
      </div>
      <div className="td-option-list">
        {filtered.map((option) => (
          <button key={option.value} onClick={() => toggle(option.value)} type="button">
            <span>{option.label}</span>
            {values.includes(option.value) ? <Check size={14} /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Dropdown({ label, options }: { label: string; options: Option[] }) {
  return (
    <div className="td-dropdown">
      <Button variant="secondary" icon={<ChevronDown size={15} />}>{label}</Button>
      <div className="td-dropdown-menu">
        {options.map((option) => (
          <button type="button" key={option.value}>{option.label}</button>
        ))}
      </div>
    </div>
  );
}

export function Modal({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="td-modal-demo">
      <div className="td-modal">
        <header>
          <strong>{title}</strong>
          <IconButton label="Close" icon={<X size={16} />} />
        </header>
        {children}
        <footer>
          <Button variant="secondary">Cancel</Button>
          <Button>Save</Button>
        </footer>
      </div>
    </div>
  );
}

export function ConfirmationDialog() {
  return (
    <Modal title="Save duplicate question?">
      <Callout tone="warning" title="Duplicate exam reference">
        A question with this exam code and original question number already exists.
      </Callout>
    </Modal>
  );
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="td-card">
      <h3>{title}</h3>
      {children}
    </article>
  );
}

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="td-panel">
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function DataTable() {
  const rows = [
    ["9702_w25_qp_11", "12", "Forces", "Medium", "B", "ready"],
    ["9702_s24_qp_12", "27", "Waves", "Hard", "D", "review"],
    ["9702_m23_qp_13", "4", "Electricity", "Easy", "A", "issue"]
  ];

  return (
    <table className="td-table">
      <thead>
        <tr>
          {["Exam Code", "Q", "Topic", "Difficulty", "Answer", "Status", "Actions"].map((heading) => <th key={heading}>{heading}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            <td>{row[0]}</td>
            <td>{row[1]}</td>
            <td>{row[2]}</td>
            <td>{row[3]}</td>
            <td>{row[4]}</td>
            <td><StatusIcon status={row[5] as "ready" | "review" | "issue"} /></td>
            <td className="td-actions">
              <IconButton label="Edit" icon={<FileText size={15} />} />
              <IconButton label="Duplicate" icon={<Copy size={15} />} />
              <IconButton label="Delete" tone="danger" icon={<Trash2 size={15} />} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function InlineEditableCell() {
  const [value, setValue] = useState("Medium");
  return <input className="td-inline-cell" value={value} onChange={(event) => setValue(event.target.value)} aria-label="Editable difficulty" />;
}

export function StatusIcon({ status }: { status: "ready" | "review" | "issue" }) {
  const icons = {
    ready: <Check size={16} />,
    review: <Circle size={16} />,
    issue: <AlertTriangle size={16} />
  };
  return <span className={clsx("td-status-icon", `td-status-${status}`)}>{icons[status]}</span>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" }) {
  return <span className={clsx("td-status-badge", `td-badge-${tone}`)}>{children}</span>;
}

export function ProgressBar({ value }: { value: number }) {
  return <div className="td-progress" aria-label={`${value}% complete`}><span style={{ width: `${value}%` }} /></div>;
}

export function Callout({ title, children, tone = "info" }: { title: string; children: ReactNode; tone?: "info" | "warning" }) {
  return (
    <div className={clsx("td-callout", `td-callout-${tone}`)}>
      {tone === "warning" ? <AlertTriangle size={17} /> : <Info size={17} />}
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

export function Tabs({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="td-tabs">
      {["Editor", "Preview", "Metadata"].map((tab) => (
        <button className={clsx(value === tab && "is-active")} key={tab} type="button" onClick={() => onChange(tab)}>{tab}</button>
      ))}
    </div>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({ open, onOpenChange: setOpen, middleware: [offset(8), shift()] });
  const hover = useHover(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

  return (
    <>
      <span ref={refs.setReference} {...getReferenceProps()}>{children}</span>
      {open ? (
        <FloatingPortal>
          <div className="td-tooltip" ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()}>{label}</div>
        </FloatingPortal>
      ) : null}
    </>
  );
}

export function Pagination() {
  return (
    <nav className="td-pagination" aria-label="Pagination">
      <IconButton label="Previous" icon={<ArrowLeft size={15} />} />
      <button className="is-active" type="button">1</button>
      <button type="button">2</button>
      <button type="button">3</button>
      <IconButton label="Next" icon={<ArrowRight size={15} />} />
    </nav>
  );
}

export function FilePickerControl({ kind }: { kind: "file" | "folder" }) {
  return (
    <div className="td-picker">
      {kind === "folder" ? <FolderOpen size={17} /> : <FileText size={17} />}
      <span>{kind === "folder" ? "Documents/TeacherDesk_Workspace" : "mcq/exports/9702_w25_qp_11.pdf"}</span>
      <Button variant="secondary">Choose</Button>
    </div>
  );
}

export function A4Preview({ teacherMode = false }: { teacherMode?: boolean }) {
  const equation = katex.renderToString("v = u + at", { throwOnError: false });
  return (
    <div className="td-a4-wrap">
      <div className="td-a4-page">
        <div className="td-question-row">
          <span className="td-question-number">1</span>
          <div>
            <p>A trolley moves down a straight track from rest. The equation used for its motion is <span dangerouslySetInnerHTML={{ __html: equation }} />.</p>
            <div className="td-preview-image">
              <span />
              <Image size={22} />
            </div>
            <ol className="td-options" type="A">
              {["0.50 m s^-2", "1.0 m s^-2", "2.0 m s^-2", "4.0 m s^-2"].map((option, index) => (
                <li className={teacherMode && index === 2 ? "is-correct" : undefined} key={option}>{option}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PdfPrintPreviewArea() {
  return (
    <div className="td-print-preview">
      <header>
        <span><Printer size={16} /> PDF / Print Preview</span>
        <Button variant="secondary" icon={<Download size={15} />}>Export</Button>
      </header>
      <A4Preview />
    </div>
  );
}

export function ImageControls() {
  return (
    <div className="td-control-strip">
      <IconButton label="Insert image" icon={<FileImage size={15} />} />
      <Button variant="secondary">Fit width</Button>
      <Button variant="secondary">Set caption</Button>
    </div>
  );
}

export function TableEditorControls() {
  return (
    <div className="td-control-strip">
      <IconButton label="Insert table" icon={<Table2 size={15} />} />
      <Button variant="secondary">Distribute rows</Button>
      <Button variant="secondary">Distribute columns</Button>
      <Dropdown label="Borders" options={[{ label: "All borders", value: "all" }, { label: "Outer only", value: "outer" }]} />
    </div>
  );
}

export function MetadataPanel() {
  return (
    <div className="td-metadata-grid">
      <TextField label="Exam code" value="9702_w25_qp_11" hint="Parsed into syllabus, session, year, paper, and version." onChange={() => undefined} />
      <TextField label="Original question" value="12" onChange={() => undefined} />
      <InlineEditableCell />
      <StatusBadge tone="success">Ready</StatusBadge>
    </div>
  );
}

export function ImportExportDialog() {
  return (
    <Modal title="Portable MCQ package">
      <div className="td-import-export">
        <Button icon={<Upload size={15} />}>Import package</Button>
        <Button variant="secondary" icon={<Download size={15} />}>Export selection</Button>
      </div>
    </Modal>
  );
}

export const galleryOptions: Option[] = [
  { label: "Mechanics", value: "mechanics" },
  { label: "Electricity", value: "electricity" },
  { label: "Waves", value: "waves" },
  { label: "Thermal Physics", value: "thermal" }
];
