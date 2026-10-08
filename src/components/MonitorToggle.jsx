import { useState } from 'react'
import { setMonitoring } from '../api'
import ErrorBanner from './ErrorBanner'
import { useToast } from './Toaster'
import { forget } from '../lib/readCache'

/**
 * Start or stop continuous monitoring of one screened person. While it is on, the person is screened again
 * whenever a sanctions list changes, and any new potential match becomes an alert on the Monitoring tab.
 * Starting also checks them against today's lists straight away.
 */
export default function MonitorToggle({ applicantId, monitored: initial, onChange }) {
  const toast = useToast()
  const [monitored, setMonitored] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      const next = !monitored
      const out = await setMonitoring(applicantId, next)
      setMonitored(out.monitored)
      forget('monitoring:')
      onChange?.(out.monitored)
      if (!next) {
        toast.info('Monitoring stopped', { message: 'Existing alerts are kept.', log: false })
      } else if (out.new_alerts > 0) {
        toast.warn(out.new_alerts === 1 ? 'Possible match found' : `${out.new_alerts} possible matches found`,
          { message: 'Found when checking against the current lists. Review it on the Monitoring tab.', to: 'monitoring' })
      } else {
        toast.success('Monitoring started', { message: 'You will be told if a list change brings up a new match.', to: 'monitoring' })
      }
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="monitor-toggle">
      <div>
        <p className="monitor-toggle-title">{monitored ? 'Under continuous monitoring' : 'Not monitored'}</p>
        <p className="field-hint">
          {monitored
            ? 'This person is screened again whenever a sanctions list changes. New matches appear on the Monitoring tab.'
            : 'Screen this person again automatically whenever a sanctions list changes, and be told about any new match.'}
        </p>
      </div>
      <button type="button" className={`btn btn-small ${monitored ? 'btn-quiet' : 'btn-primary'}`} onClick={toggle} disabled={busy}>
        {busy ? 'Working...' : monitored ? 'Stop monitoring' : 'Start monitoring'}
      </button>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
    </div>
  )
}
