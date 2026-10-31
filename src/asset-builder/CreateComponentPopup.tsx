import { useState } from "react";
import { CloseIcon } from "./icons";

type Props = {
  onClose: () => void;
  onEditComponent: (name: string) => void;
  /** What is being created, e.g. "Asset" or "Agent". Drives the title, placeholder, and submit label. */
  entity?: string;
};

export default function CreateComponentPopup({ onClose, onEditComponent, entity = "Asset" }: Props) {
  const untitledLabel = `Untitled ${entity}`;
  const [name, setName] = useState(untitledLabel);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onEditComponent(name.trim() || untitledLabel);
  };

  return (
    <div className="create-popup-overlay" role="dialog" aria-modal="true" aria-labelledby="create-popup-title">
      <div className="create-popup">
        <header className="create-popup__header">
          <h2 id="create-popup-title" className="create-popup__title">
            Create {entity}
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
              placeholder={untitledLabel}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.target.select()}
              autoFocus
            />
          </div>

          <div className="create-popup__footer">
            <button type="submit" className="btn btn--primary">
              Create {entity}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
