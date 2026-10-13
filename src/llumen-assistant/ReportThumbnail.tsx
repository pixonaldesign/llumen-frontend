import type { ReportPayload } from './assistantReplyTypes'
import styles from './ReportThumbnail.module.css'

export type ReportThumbnailProps = {
  report: ReportPayload
  onOpen: () => void
}

export function ReportThumbnail({ report, onOpen }: ReportThumbnailProps) {
  return (
    <div className={styles.root} data-report-id={report.id}>
      <div className={styles.badge}>{report.badge}</div>
      <h3 className={styles.title}>{report.title}</h3>
      <p className={styles.subtitle}>{report.subtitle}</p>
      {report.meta?.length ? (
        <ul className={styles.meta}>
          {report.meta.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.metaLine}>{report.slideCount} slides · Generated from this conversation</p>
      )}
      <button type="button" className={styles.openBtn} onClick={onOpen}>
        Open report
      </button>
    </div>
  )
}
