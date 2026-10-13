import VisualArtwork from "./VisualArtwork";
import type { VisualCategoryId } from "./visualCatalog";

type Props = {
  label: string;
  visualId: string;
  category: VisualCategoryId;
  onChange: () => void;
};

export default function SelectedVisualBar({ label, visualId, category, onChange }: Props) {
  return (
    <div className="selected-visual">
      <p className="selected-visual__label">Selected Visualization Type</p>
      <div className="selected-visual__row">
        <div className="selected-visual__info">
          <VisualArtwork visualId={visualId} category={category} size="bar" />
          <span className="selected-visual__name">{label}</span>
        </div>
        <button type="button" className="pg-btn pg-btn--secondary" onClick={onChange}>
          Change
        </button>
      </div>
    </div>
  );
}
