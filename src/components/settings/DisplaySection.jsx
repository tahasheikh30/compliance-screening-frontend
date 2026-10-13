import { usePreferences } from '../../lib/preferences'
import { SettingGroup, SettingRow } from './controls'

const TABS = [
  { id: 'screen', label: 'Screening' },
  { id: 'history', label: 'History' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'lists', label: 'Lists' },
]

/** Settings, Display: the tab the console opens on, and how dense tables and sheets are. */
export default function DisplaySection() {
  const { prefs, update } = usePreferences()
  return (
    <div className="settings-section">
      <SettingGroup title="Layout">
        <SettingRow title="Open on" description="The tab you land on after signing in. A page refresh still keeps the tab you were on.">
          <select aria-label="Open on" value={prefs.display.default_tab}
            onChange={(e) => update((d) => { d.display.default_tab = e.target.value })}>
            {TABS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </SettingRow>
        <SettingRow title="Density" description="Compact fits more rows on screen: tighter tables and sheets.">
          <select aria-label="Density" value={prefs.display.density}
            onChange={(e) => update((d) => { d.display.density = e.target.value })}>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </SettingRow>
      </SettingGroup>
    </div>
  )
}
