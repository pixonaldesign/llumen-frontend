import { useState } from 'react'
import { nodeDataViews } from './cardSections'
import { NodeDataPanel } from './NodeDataPanel'
import type { DataRecord, NodeRun } from './nodeCatalog'
import styles from './NodeCardMinimal.module.css'

type DataTab = 'input' | 'output'

type NodeDataCardProps = {
  name: string
  isTrigger: boolean
  hasInputs: boolean
  run: NodeRun
  input: readonly DataRecord[] | null
  output: readonly DataRecord[] | null
}

/** A node's input and output in a card hanging under it; opens on the output once the node has run. */
export function NodeDataCard({ name, isTrigger, hasInputs, run, input, output }: NodeDataCardProps) {
  const [tab, setTab] = useState<DataTab | null>(null)
  const activeTab: DataTab = tab ?? (run.status === 'success' || run.status === 'error' || run.status === 'skipped' ? 'output' : 'input')
  const views = nodeDataViews(run, input, output, isTrigger, hasInputs)

  return (
    <div className={styles.panel}>
      <div className={styles.panelTabs} role="tablist" aria-label={`${name} data`}>
        {(['input', 'output'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={activeTab === value}
            className={activeTab === value ? `${styles.segment} ${styles.segmentActive}` : styles.segment}
            onClick={() => setTab(value)}
          >
            {value === 'output' ? 'Output' : isTrigger ? 'Test' : 'Input'}
          </button>
        ))}
      </div>
      <NodeDataPanel key={activeTab} {...views[activeTab]} />
    </div>
  )
}
