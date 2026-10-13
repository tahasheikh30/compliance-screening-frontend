import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { getSupabase } from '../../lib/supabase'
import { friendlyAuthError } from '../../lib/authErrors'
import { IDLE_CHOICES } from '../../lib/idle'
import { usePreferences } from '../../lib/preferences'
import ErrorBanner from '../ErrorBanner'
import { useToast } from '../Toaster'
import { SettingGroup, SettingRow } from './controls'

/** Settings, Security: how soon an idle session ends, and signing out of this or your other devices. */
export default function SecuritySection() {
  const { signOut } = useAuth()
  const { prefs, update } = usePreferences()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function signOutOthers() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { error: err } = await getSupabase().auth.signOut({ scope: 'others' })
      if (err) throw friendlyAuthError(err)
      toast.success('Signed out of your other devices', { category: 'account', message: 'This device stays signed in.' })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-section">
      <SettingGroup title="Sessions">
        <SettingRow
          title="Sign me out after"
          description="Minutes without any activity before you are signed out. Shorter is safer on a shared computer. 30 minutes is the longest the policy allows."
        >
          <select
            aria-label="Sign me out after"
            value={prefs.security.idle_minutes}
            onChange={(e) => update((d) => { d.security.idle_minutes = Number(e.target.value) })}
          >
            {IDLE_CHOICES.map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </SettingRow>
        <SettingRow
          title="Sign out of my other devices"
          description="Ends your sign in on every other browser and device. This one stays signed in. Use it if you forgot to sign out somewhere."
        >
          <button type="button" className="btn btn-quiet" onClick={signOutOthers} disabled={busy}>
            {busy ? 'Signing out...' : 'Sign out other devices'}
          </button>
        </SettingRow>
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <SettingRow title="Sign out of this device" description="Ends this session and clears the screenings kept in memory.">
          <button type="button" className="btn btn-quiet" onClick={signOut}>Sign out</button>
        </SettingRow>
      </SettingGroup>
    </div>
  )
}
