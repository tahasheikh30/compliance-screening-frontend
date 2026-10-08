import { listApplicants } from '../../api'
import HistoryView from '../../components/HistoryView'

/**
 * The signed in person's own screenings. An administrator sees only their own here too: they read another
 * person's history from the People tab.
 */
export default function HistoryTab() {
  return (
    <HistoryView
      load={listApplicants}
      cacheKey="history:me"
      heading="Past screenings"
      emptyText="You have not screened anyone yet. Run one from the Screening tab and it will appear here."
      canMonitor
    />
  )
}
