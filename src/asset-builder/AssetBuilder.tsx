import { useState } from "react";
import { createPortal } from "react-dom";
import CreateComponentPopup from "./CreateComponentPopup";
import EditComponentModal from "./EditComponentModal";
import { SCOPE_CLASS } from "./host";
import "./llumen-design-system.css";
import "./styles.css";

/** Create → Asset: name the asset, then open the builder. */
export default function AssetBuilder({ onClose }: { onClose: () => void }) {
  const [draftName, setDraftName] = useState<string | null>(null);

  return createPortal(
    <div className={SCOPE_CLASS} data-theme="dark" style={{ display: "contents" }}>
      {draftName === null ? (
        <CreateComponentPopup onClose={onClose} onEditComponent={setDraftName} />
      ) : (
        <EditComponentModal componentName={draftName} startAtVisualPicker creating onClose={onClose} />
      )}
    </div>,
    document.body,
  );
}
