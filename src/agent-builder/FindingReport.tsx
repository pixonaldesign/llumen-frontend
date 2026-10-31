import { FINDING_KIND_LABEL, type Finding } from './findings'
import { NodeAssetPreview } from './NodeAssetPreview'
import styles from './FindingReport.module.css'

/** A finding as a reader of the published Flow would see it, marked as a preview since test runs don't write one. */
export function FindingReport({ finding, className }: { finding: Finding; className?: string }) {
  return (
    <article className={`${styles.report} ${className ?? ''}`}>
      <div className={styles.meta}>
        <span className={styles.kind} data-kind={finding.kind}>
          {FINDING_KIND_LABEL[finding.kind]}
        </span>
        <span className={styles.preview}>Preview of what a published run writes</span>
      </div>
      <header className={styles.head}>
        <h3 className={styles.headline}>{finding.headline}</h3>
        <p className={styles.lead}>{finding.lead}</p>
      </header>

      {finding.rules.length ? (
        <section className={styles.rules} data-kind={finding.kind}>
          <h4 className={styles.label}>Why it is an alert</h4>
          {finding.rules.map((rule) => (
            <div key={rule.label} className={styles.rule}>
              <p className={styles.ruleName}>
                {rule.label}
                <span className={styles.ruleLevel}>{FINDING_KIND_LABEL[rule.level]}</span>
              </p>
              {rule.conditions.length ? (
                <ul className={styles.conditions}>
                  {rule.conditions.map((condition) => (
                    <li key={condition.text}>
                      {condition.text}
                      {condition.observed ? <span className={styles.observed}> · {condition.observed}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {finding.sections.map((section) => (
        <section key={section.heading} className={styles.section}>
          <h4 className={styles.sectionHeading}>{section.heading}</h4>
          {section.asset ? (
            <figure className={styles.asset}>
              <div className={styles.assetFrame}>
                <NodeAssetPreview kind={section.asset.preview} interactive={false} bare hint={false} />
              </div>
              <figcaption className={styles.assetCaption}>{section.asset.name}</figcaption>
            </figure>
          ) : null}
          <p className={styles.text}>{section.text}</p>
        </section>
      ))}

      <section className={styles.section}>
        <h4 className={styles.label}>What to do</h4>
        <ol className={styles.actions}>
          {finding.actions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ol>
      </section>
      <section className={styles.section}>
        <h4 className={styles.label}>How we know</h4>
        <p className={styles.muted}>{finding.howWeKnow}</p>
      </section>
      {finding.focus ? (
        <section className={styles.section}>
          <h4 className={styles.label}>Written with your focus</h4>
          <p className={styles.muted}>{finding.focus}</p>
        </section>
      ) : null}
    </article>
  )
}
