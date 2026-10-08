import { useCallback } from 'react'
import { listUserApplicants } from '../../api'
import HistoryView from '../../components/HistoryView'

/** Administrators: one person's screening history, opened from the People tab. Read only. */
export default function UserHistoryPage({ user, onBack }) {
  const load = useCallback(() => listUserApplicants(user.id), [user.id])
  return (
    <HistoryView
      load={load}
      cacheKey={`history:user:${user.id}`}
      heading={`Screenings by ${user.email}`}
      emptyText={`${user.email} has not screened anyone yet.`}
      lead={(
        <button type="button" className="btn btn-quiet btn-small back-btn" onClick={onBack}>
          Back to People
        </button>
      )}
    />
  )
}
