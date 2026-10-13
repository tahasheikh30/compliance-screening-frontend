import { useAuth } from '../../auth/AuthContext'
import { usePreferences } from '../../lib/preferences'
import { useNotifications } from '../Toaster'
import { SettingGroup, SettingRow, Switch } from './controls'

const KINDS = [
  { id: 'screening', title: 'Screenings and batches', description: 'A screening or a batch finished, or failed.' },
  { id: 'monitoring', title: 'Continuous monitoring', description: 'A list change brought up a possible new match on someone you monitor, or you started or stopped monitoring.' },
  { id: 'lists', title: 'Lists', description: 'A watch list was uploaded, reloaded or could not be read.' },
  { id: 'account', title: 'Account', description: 'Your password was changed or your history was cleared.' },
  { id: 'admin', title: 'People waiting for approval', description: 'New accounts are waiting for you to approve them.', adminOnly: true },
]

/** Settings, Notifications: all messages on or off, pop-ups on or off, and each kind of message on its own. */
export default function NotificationsSection() {
  const { isAdmin } = useAuth()
  const { prefs, update } = usePreferences()
  const { notifications, clearAll } = useNotifications()
  const n = prefs.notifications
  const kinds = KINDS.filter((k) => !k.adminOnly || isAdmin)

  return (
    <div className="settings-section">
      <SettingGroup
        title="Notifications"
        hint="Error messages that need your attention, such as a screening that failed, are always shown, whatever you choose here."
      >
        <SettingRow
          title="All notifications"
          description={n.enabled ? 'Messages appear as they happen and are kept in the Notifications list.' : 'Off: no messages appear and none are kept, except errors.'}
        >
          <Switch label="All notifications" checked={n.enabled} onChange={(v) => update((d) => { d.notifications.enabled = v })} />
        </SettingRow>
        <SettingRow
          title="Show pop-ups"
          description="Off: messages are only kept in the Notifications list and do not pop up in the corner."
        >
          <Switch label="Show pop-ups" checked={n.popups} disabled={!n.enabled}
            onChange={(v) => update((d) => { d.notifications.popups = v })} />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="What to tell me about" hint="Turn off the kinds of message you do not need. A red dot, tab counts and the Monitoring tab itself are not affected.">
        {kinds.map((k) => (
          <SettingRow key={k.id} title={k.title} description={k.description}>
            <Switch label={k.title} checked={n.categories[k.id] !== false} disabled={!n.enabled}
              onChange={(v) => update((d) => { d.notifications.categories[k.id] = v })} />
          </SettingRow>
        ))}
      </SettingGroup>

      <SettingGroup title="Notification list" hint="Messages from this session are kept in this browser tab only, and are gone when you reload or sign out.">
        <div className="form-actions">
          <button type="button" className="btn btn-quiet" onClick={clearAll} disabled={notifications.length === 0}>
            Clear the notification list
          </button>
        </div>
      </SettingGroup>
    </div>
  )
}
