import { useId, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Path, Pulse, Sparkle } from '@phosphor-icons/react'
import { landingAssets } from './landingAssets'
import styles from './BriefingIntro.module.css'

const DM_VISION_URL = 'https://www.dm.gov.ae/mission-vision-values/'

const CAPABILITIES = [
  {
    icon: <Pulse size={20} weight="regular" aria-hidden />,
    title: 'Spot problems early',
    body: 'Daily briefings flag what changed across Dubai, from odor complaints around Al Barsha’s parks to strained networks in JVC.',
  },
  {
    icon: <Path size={20} weight="regular" aria-hidden />,
    title: 'See the cause',
    body: 'Each finding links CRM complaints, social posts, sensor readings and planning records to explain why it is happening.',
  },
  {
    icon: <Sparkle size={20} weight="regular" aria-hidden />,
    title: 'Act with confidence',
    body: 'Simulate the recommended actions on the map and see their effect before committing crews or budget.',
  },
] as const

/**
 * The Briefing's introduction: a liquid-glass modal centred over the zoomed-out map. Know more turns it
 * to what the platform does; Experience the platform hands over to the findings (`onEnter`).
 */
export function BriefingIntro({ shown, delay, onEnter }: { shown: boolean; delay: number; onEnter: () => void }) {
  const [more, setMore] = useState(false)
  /** Turned to Know more and back at least once: the copy no longer waits for the glass to arrive. */
  const [turned, setTurned] = useState(false)
  const turn = (next: boolean) => {
    setMore(next)
    setTurned(true)
  }
  const titleId = useId()
  const moreId = useId()
  return (
    <div className={styles.layer} data-shown={shown} inert={!shown}>
      <div className={styles.vignette} aria-hidden />
      <section
        className={styles.modal}
        data-turned={turned}
        role="dialog"
        aria-labelledby={more ? moreId : titleId}
        style={{ ['--intro-delay' as string]: `${delay}ms` } as CSSProperties}
      >
        <div className={styles.pane} data-active={!more} inert={more}>
          <img className={styles.logo} src={landingAssets.dmMindLogo} alt="DM Mind" />
          <h1 id={titleId} className={styles.title}>
            Welcome to DM Mind, where Dubai’s city signals become decisions.
          </h1>
          <p className={styles.lede}>
            Built for Dubai Municipality’s vision of a pioneering municipality for a global city, DM Mind reads
            complaints, social posts, sensors and planning data across the emirate. It surfaces what is changing,
            traces each problem to its cause, and lets you test the response before you act.
          </p>
          <div className={`${styles.actions} ${styles.actionsStacked}`}>
            <button type="button" className={styles.primary} onClick={onEnter}>
              Experience the platform
              <ArrowRight size={18} weight="regular" aria-hidden />
            </button>
            <button type="button" className={styles.textButton} onClick={() => turn(true)}>
              Know more
            </button>
          </div>
        </div>
        <div className={`${styles.pane} ${styles.morePane}`} data-active={more} inert={!more}>
          <h2 id={moreId} className={styles.moreTitle}>
            What DM Mind does
          </h2>
          <ul className={styles.capabilities}>
            {CAPABILITIES.map((item) => (
              <li key={item.title}>
                <span className={styles.capabilityIcon}>{item.icon}</span>
                <span>
                  <span className={styles.capabilityTitle}>{item.title}</span>
                  <span className={styles.capabilityBody}>{item.body}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.source}>
            Aligned with Dubai Municipality’s Strategic Plan and its data-driven city services.{' '}
            <a href={DM_VISION_URL} target="_blank" rel="noreferrer">
              dm.gov.ae
              <ArrowUpRight size={14} weight="regular" aria-hidden />
            </a>
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => turn(false)}>
              <ArrowLeft size={18} weight="regular" aria-hidden />
              Back
            </button>
            <button type="button" className={styles.primary} onClick={onEnter}>
              Experience the platform
              <ArrowRight size={18} weight="regular" aria-hidden />
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
