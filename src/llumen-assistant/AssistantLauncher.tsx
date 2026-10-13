import { llumenAssets } from './assets'
import styles from './compact-assistant.module.css'

export type AssistantLauncherProps = {
  onOpen: () => void
  label?: string
}

export function AssistantLauncher({ onOpen, label = 'Open Llumen assistant' }: AssistantLauncherProps) {
  return (
    <button type="button" className={styles.launcher} onClick={onOpen} aria-label={label}>
      <img className={styles.launcherIcon} src={llumenAssets.launcherOrb} alt="" width={24} height={24} />
    </button>
  )
}
