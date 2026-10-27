import { ArrowClockwise, ShieldWarning, Timer } from '@phosphor-icons/react'
import { Card, Field, NumberInput, Select, SwitchRow, type SelectOption } from './ConfigControls'
import { switchClass } from './configStyles'
import type { NodeSettings, OnErrorMode } from './nodeCatalog'
import styles from './NodeConfigWindow.module.css'

const TIMEOUT_MAX_SECONDS = 86_400

const ON_ERROR: readonly SelectOption<OnErrorMode>[] = [
  { id: 'stop', label: 'Stop workflow', description: 'Mark this step failed and skip everything after it.' },
  { id: 'continue', label: 'Continue', description: 'Mark this step failed but let the next steps run.' },
  {
    id: 'errorOutput',
    label: 'Continue using error output',
    description: 'Let the next steps run and pass them the error as this step’s output.',
  },
]

type NodeSettingsPanelProps = {
  settings: NodeSettings
  /** Branching nodes skip empty branches; turning on Always output data runs all of them. */
  branching: boolean
  onChange: (patch: Partial<NodeSettings>) => void
}

/** The Settings tab: run policy shared by every node kind. */
export function NodeSettingsPanel({ settings, branching, onChange }: NodeSettingsPanelProps) {
  return (
    <div className={styles.stack}>
      <Card icon={<Timer size={16} aria-hidden />} title="Timeout" description="Stop the step if it runs longer than this.">
        <Field label="Timeout (seconds)" htmlFor="node-timeout" hint="Leave empty for no limit. Up to 86,400 (one day).">
          <NumberInput
            id="node-timeout"
            value={settings.timeoutSeconds}
            min={1}
            max={TIMEOUT_MAX_SECONDS}
            unit="seconds"
            placeholder="No limit"
            optional
            onChange={(timeoutSeconds) => onChange({ timeoutSeconds })}
          />
        </Field>
      </Card>

      <Card
        icon={<ArrowClockwise size={16} aria-hidden />}
        title="Retry on fail"
        description="Retries run first; On Error applies once they are used up."
        action={<SwitchToggle checked={settings.retryOnFail} label="Retry on fail" onChange={(retryOnFail) => onChange({ retryOnFail })} />}
      >
        {settings.retryOnFail ? (
          <div className={styles.fieldRow}>
            <Field label="Max attempts" htmlFor="node-retry-attempts" hint="Counts the first try.">
              <NumberInput
                id="node-retry-attempts"
                value={settings.retryMaxAttempts}
                min={1}
                max={10}
                unit="tries"
                onChange={(value) => onChange({ retryMaxAttempts: value })}
              />
            </Field>
            <Field label="Retry delay" htmlFor="node-retry-delay" hint="Between attempts, up to 300.">
              <NumberInput
                id="node-retry-delay"
                value={settings.retryDelaySeconds}
                min={0}
                max={300}
                unit="seconds"
                onChange={(value) => onChange({ retryDelaySeconds: value })}
              />
            </Field>
          </div>
        ) : null}
      </Card>

      <Card icon={<ShieldWarning size={16} aria-hidden />} title="When it fails">
        <Field label="On Error" htmlFor="node-on-error">
          <Select id="node-on-error" label="On Error" value={settings.onError} options={ON_ERROR} onChange={(onError) => onChange({ onError })} />
        </Field>
        <SwitchRow
          label="Always output data"
          description={
            branching
              ? 'Sends an empty output when no rows match, so every branch runs, not only the one that matched.'
              : 'Sends an empty output when there are no rows, so the next steps still run.'
          }
          checked={settings.alwaysOutputData}
          onChange={(alwaysOutputData) => onChange({ alwaysOutputData })}
        />
      </Card>
    </div>
  )
}

/** A bare switch for a card header, where the card title is its label. */
function SwitchToggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={switchClass} onClick={() => onChange(!checked)} />
}
