import { DEFAULT_THRESHOLD, usePreferences } from '../../lib/preferences'
import { SettingGroup, SettingRow, Switch } from './controls'

/** Settings, Screening: what a new screening starts from. The form can still be changed for one screening. */
export default function ScreeningSection() {
  const { prefs, update } = usePreferences()
  const own = prefs.screening.threshold
  const shown = own ?? DEFAULT_THRESHOLD
  return (
    <div className="settings-section">
      <SettingGroup title="Starting points" hint="These only set what the screening form starts with. You can still change them for a single screening.">
        <div className="setting-row setting-row-stack">
          <div className="setting-text">
            <label className="setting-title" htmlFor="settings-threshold">
              Match threshold <output htmlFor="settings-threshold" className="threshold-value">{shown}%</output>
            </label>
            <p className="setting-desc">
              {own === null
                ? `Using the standard ${DEFAULT_THRESHOLD}%. A lower threshold catches more spelling variants, with many more false matches to review.`
                : 'A lower threshold catches more spelling variants, with many more false matches to review.'}
            </p>
          </div>
          <div className="setting-control setting-control-wide">
            <input
              id="settings-threshold"
              type="range"
              min="50"
              max="100"
              step="1"
              value={shown}
              style={{ '--fill': `${((Number(shown) - 50) / 50) * 100}%` }}
              onChange={(e) => update((d) => { d.screening.threshold = Number(e.target.value) })}
            />
            <button type="button" className="btn btn-quiet btn-small" disabled={own === null}
              onClick={() => update((d) => { d.screening.threshold = null })}>
              Use the standard {DEFAULT_THRESHOLD}%
            </button>
          </div>
        </div>
        <SettingRow
          title="Monitor new screenings by default"
          description="Tick “Keep monitoring this person” on the form for you. Continuous monitoring re-screens them whenever a watch list changes."
        >
          <Switch label="Monitor new screenings by default" checked={prefs.screening.monitor_by_default}
            onChange={(v) => update((d) => { d.screening.monitor_by_default = v })} />
        </SettingRow>
      </SettingGroup>
    </div>
  )
}
