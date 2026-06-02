import {
  Image,
  List,
  MoreVertical,
  Save,
  Sigma,
  Table2,
  Type
} from "lucide-react";

type McqToolbarProps = {
  onAddText: () => void;
  onAddEquation: () => void;
  onAddImage: () => void;
  onAddTable: () => void;
  onAddOptions: () => void;
  onSave: () => void;
  onSaveAndAddAnother: () => void;
};

export function McqToolbar({ onAddText, onAddEquation, onAddImage, onAddTable, onAddOptions, onSave, onSaveAndAddAnother }: McqToolbarProps) {
  return (
    <div className="mcq-toolbar">
      <div className="mcq-toolbar-group">
        <button type="button" onClick={onAddText}>
          <Type size={22} />
          Add text
        </button>
        <button type="button" onClick={onAddEquation}>
          <Sigma size={22} />
          Equation
        </button>
        <button type="button" onClick={onAddImage}>
          <Image size={22} />
          Image
        </button>
        <button type="button" onClick={onAddTable}>
          <Table2 size={22} />
          Table
        </button>
        <button type="button" onClick={onAddOptions}>
          <List size={22} />
          Options
        </button>
      </div>
      <div className="mcq-toolbar-group mcq-toolbar-save">
        <button className="mcq-primary-action" type="button" onClick={onSave}>
          <Save size={16} />
          Save
        </button>
        <button className="mcq-secondary-action" type="button" onClick={onSaveAndAddAnother}>
          Save & add another
        </button>
        <button className="mcq-icon-action" aria-label="More actions" type="button">
          <MoreVertical size={18} />
        </button>
      </div>
    </div>
  );
}
