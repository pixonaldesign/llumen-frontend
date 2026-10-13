import { useState } from "react";
import { CloseIcon } from "./icons";

const UNTITLED_ASSET_LABEL = "Untitled Asset";

type Props = {
  onClose: () => void;
  onEditComponent: (name: string) => void;
};

export default function CreateComponentPopup({ onClose, onEditComponent }: Props) {
  const [name, setName] = useState(UNTITLED_ASSET_LABEL);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onEditComponent(name.trim() || UNTITLED_ASSET_LABEL);
  };

  return (
    <div className="create-popup-overlay" role="dialog" aria-modal="true" aria-labelledby="create-popup-title">
      <div className="create-popup">
        <header className="create-popup__header">
          <h2 id="create-popup-title" className="create-popup__title">
            Create Asset
          </h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <form className="create-popup__body" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="component-name">
              Name
            </label>
            <input
              id="component-name"
              className="input"
              type="text"
              placeholder={UNTITLED_ASSET_LABEL}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.target.select()}
              autoFocus
            />
          </div>

          <div className="create-popup__footer">
            <button type="submit" className="btn btn--primary">
              Create Asset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
