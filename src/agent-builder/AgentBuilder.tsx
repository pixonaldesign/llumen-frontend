import { useState } from 'react'
import { createPortal } from 'react-dom'
import CreateComponentPopup from '../asset-builder/CreateComponentPopup'
import { SCOPE_CLASS } from '../asset-builder/host'
import '../asset-builder/llumen-design-system.css'
import '../asset-builder/styles.css'
import { AgentCanvas } from './AgentCanvas'

/** Create → Agent: name the agent, then open the workflow canvas. */
export default function AgentBuilder({ workspace, onClose }: { workspace?: string; onClose: () => void }) {
  const [name, setName] = useState<string | null>(null)

  return createPortal(
    name === null ? (
      <div className={SCOPE_CLASS} data-theme="dark" style={{ display: 'contents' }}>
        <CreateComponentPopup entity="Agent" onClose={onClose} onEditComponent={setName} />
      </div>
    ) : (
      <AgentCanvas name={name} workspace={workspace} onClose={onClose} />
    ),
    document.body,
  )
}
