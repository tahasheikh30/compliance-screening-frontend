import { useState } from 'react'
import { listApplicants, exportHistory } from '../../api'
import ErrorBanner from '../../components/ErrorBanner'
import HistoryView from '../../components/HistoryView'

/**
 * The signed in person's own screenings. An administrator sees only their own here too: they read another
 * person's history from the People tab.
 */
export default function HistoryTab() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function download() {
    setBusy(true)
    setError(null)
    try {
      await exportHistory()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <HistoryView
      load={listApplicants}
      cacheKey="history:me"
      heading="Past screenings"
      emptyText="You have not screened anyone yet. Run one from the Screening tab and it will appear here."
      canMonitor
      lead={(
        <div className="history-actions">
          <button type="button" className="btn btn-quiet btn-small" onClick={download} disabled={busy}>
            {busy ? 'Preparing...' : 'Download as CSV'}
          </button>
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
        </div>
      )}
    />
  )
}
