import { llumenAssets } from './assets'
import styles from './compact-assistant.module.css'

export function AssistantHero() {
  return (
    <div className={styles.heroBlock}>
      <div className={styles.orbWrap}>
        <div className={styles.orbOuter}>
          <img src={llumenAssets.orbOuter} alt="" width={35} height={35} />
        </div>
        <div className={styles.orbInner}>
          <img src={llumenAssets.orbInner} alt="" width={26} height={26} />
        </div>
      </div>
      <div className={styles.greeting}>
        <p className={styles.greetingLead}>Hello! I&apos;m Llumen</p>
        <p className={styles.greetingSub}>How can I help you today?</p>
      </div>
    </div>
  )
}
