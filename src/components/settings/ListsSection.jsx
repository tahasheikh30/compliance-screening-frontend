import { usePreferences } from '../../lib/preferences'
import { SOURCES, SOURCE_ORDER } from '../../lib/status'
import { SettingGroup, SettingRow, Switch } from './controls'

/**
 * Settings, Lists: which lists your own screenings use. Any list can be switched off, for yourself only.
 * A list you switch off is not read or matched for your screenings, the case says it was switched off, and it never
 * counts as screened. Other people's screenings and continuous monitoring are not affected.
 */
export default function ListsSection() {
  const { prefs, loaded, update } = usePreferences()
  const off = prefs.lists.off
  const offNow = SOURCE_ORDER.filter((k) => off.includes(k))

  function toggle(key, on) {
    update((d) => {
      const rest = d.lists.off.filter((k) => k !== key)
      d.lists.off = on ? rest : [...rest, key]
    })
  }

  return (
    <div className="settings-section">
      <SettingGroup
        title="Lists in my screenings"
        hint="Choose which lists your screenings check. A list that is switched off is not checked, every case shows it as switched off, and it is never treated as clear."
      >
        {SOURCE_ORDER.map((key) => {
          const on = !off.includes(key)
          return (
            <SettingRow key={key} title={SOURCES[key].name} description={SOURCES[key].long}>
              <Switch label={`Check ${SOURCES[key].name} in my screenings`} checked={on} disabled={!loaded}
                onChange={(v) => toggle(key, v)} />
            </SettingRow>
          )
        })}
        {offNow.length > 0 && (
          <p className="notice notice-warn" role="note">
            Switched off for your screenings: {offNow.map((k) => SOURCES[k].name).join(', ')}. Results will name them as not checked. The verdict comes from the lists that are still on.
          </p>
        )}
      </SettingGroup>
    </div>
  )
}
