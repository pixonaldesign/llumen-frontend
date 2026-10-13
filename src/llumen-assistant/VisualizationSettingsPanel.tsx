import { useEffect, useState } from 'react'
import type { CreatedComponent } from './assistantReplyTypes'
import {
  getVisualizationConfig,
  type VizSectionId,
  type VizStaticField,
  type VizStaticSection,
} from './visualizationSettingsDemo'
import { useRevealScrollbarOnScroll } from './useRevealScrollbarOnScroll'
import styles from './VisualizationSettingsPanel.module.css'

const SECTION_NAV: { id: VizSectionId; label: string }[] = [
  { id: 'mapping', label: 'Mapping' },
  { id: 'customization', label: 'Customization' },
  { id: 'insights', label: 'Insights' },
  { id: 'readout', label: 'Readout' },
]

function StaticValueField({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{value}</span>
    </div>
  )
}

function StaticToggleField({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={`${styles.toggleBadge}${enabled ? ` ${styles.toggleBadgeOn}` : ''}`}>
        {enabled ? 'On' : 'Off'}
      </span>
    </div>
  )
}

function StaticColorField({
  palette,
  paletteType,
  hex,
  opacity,
}: {
  palette: string
  paletteType: string
  hex: string
  opacity: number
}) {
  return (
    <div className={styles.colorBlock}>
      <div className={styles.colorHeader}>
        <div>
          <p className={styles.colorPaletteName}>{palette}</p>
          <p className={styles.colorPaletteType}>{paletteType}</p>
        </div>
      </div>
      <div className={styles.colorRow}>
        <span className={styles.fieldLabel}>Color</span>
        <div className={styles.colorValue}>
          <span className={styles.colorSwatch} style={{ backgroundColor: hex }} aria-hidden />
          <span>{hex}</span>
        </div>
      </div>
      <div className={styles.colorRow}>
        <span className={styles.fieldLabel}>Opacity</span>
        <span className={styles.fieldValueInline}>{opacity}%</span>
      </div>
    </div>
  )
}

function renderField(field: VizStaticField) {
  if (field.kind === 'value') {
    return <StaticValueField key={field.label} label={field.label} value={field.value} />
  }
  if (field.kind === 'toggle') {
    return <StaticToggleField key={field.label} label={field.label} enabled={field.enabled} />
  }
  return (
    <StaticColorField
      key={field.label}
      palette={field.palette}
      paletteType={field.paletteType}
      hex={field.hex}
      opacity={field.opacity}
    />
  )
}

function SettingsSection({ section }: { section: VizStaticSection }) {
  return (
    <section className={styles.settingsSection}>
      <div className={styles.settingsSectionHeader}>
        <h4 className={styles.settingsSectionTitle}>{section.title}</h4>
      </div>
      <div className={styles.settingsSectionBody}>{section.fields.map(renderField)}</div>
    </section>
  )
}

export function VisualizationSettingsPanel({ component }: { component: CreatedComponent }) {
  const config = getVisualizationConfig(component)
  const [activeSection, setActiveSection] = useState<VizSectionId>('mapping')
  const sectionScrollRef = useRevealScrollbarOnScroll()

  useEffect(() => {
    setActiveSection('mapping')
  }, [component.id])

  return (
    <div className={styles.root}>
      <div className={styles.visualTypeCard}>
        <div className={styles.visualTypeMain}>
          <span>{config.visualType}</span>
        </div>
      </div>

      <div className={styles.settingsShell}>
        <p className={styles.settingsHeading}>Visual Settings</p>

        <div className={styles.settingsLayout}>
          <nav className={styles.sectionNav} aria-label="Visual settings sections">
            {SECTION_NAV.map((item) => {
              const active = activeSection === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.sectionNavBtn}${active ? ` ${styles.sectionNavBtnActive}` : ''}`}
                  onClick={() => setActiveSection(item.id)}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div ref={sectionScrollRef} className={styles.sectionContent}>
            {config.sections[activeSection].map((section) => (
              <SettingsSection key={section.title} section={section} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
