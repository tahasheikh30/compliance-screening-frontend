import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteUser, listUsers, setUserRole, setUserStatus } from '../../api'
import ErrorBanner from '../../components/ErrorBanner'
import ConfirmDialog from '../../components/ConfirmDialog'
import { Pill } from '../../components/ui'
import { fmtDateTime } from '../../lib/format'
import { useToast } from '../../components/Toaster'

const FILTERS = [
  { id: 'pending', label: 'Waiting' },
  { id: 'all', label: 'Everyone' },
  { id: 'rejected', label: 'Declined' },
  { id: 'disabled', label: 'Disabled' },
]

const STATUS_PILL = {
  pending: { tone: 'warn', label: 'Waiting' },
  approved: { tone: 'good', label: 'Approved' },
  rejected: { tone: 'bad', label: 'Declined' },
  disabled: { tone: 'bad', label: 'Disabled' },
}

/**
 * Administrators only. Approve or decline people who signed up, switch accounts off (Disable) and back on
 * (Enable), delete accounts, and choose who is an administrator.
 * Anything that removes access, deletes someone or grants admin asks first. The server has the final word: it refuses to
 * remove the last administrator, and says so.
 */
export default function UsersTab({ selfId, onPendingCount, onOpenHistory }) {
  const toast = useToast()
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('pending')
  const [busyId, setBusyId] = useState(null)
  const [confirm, setConfirm] = useState(null)       // { user, kind, title, body, label, danger, run }

  const load = useCallback(async () => {
    setError(null)
    try {
      const all = await listUsers()
      setUsers(all)
      onPendingCount?.(all.filter((u) => u.status === 'pending').length)
    } catch (err) {
      setError(err)
    }
  }, [onPendingCount])

  useEffect(() => { load() }, [load])

  const shown = useMemo(() => (users || []).filter((u) => filter === 'all' || u.status === filter), [users, filter])
  const waiting = (users || []).filter((u) => u.status === 'pending').length

  async function apply(user, change, done = 'Account updated') {
    setConfirm(null)
    setBusyId(user.id)
    setError(null)
    try {
      await change()
      toast.success(done, { message: user.email })
      await load()
    } catch (err) {
      setError(err)
      toast.error('Could not update the account', { message: err?.message })
    } finally {
      setBusyId(null)
    }
  }

  const approve = (u) => apply(u, () => setUserStatus(u.id, 'approved'), u.status === 'disabled' ? 'Account enabled' : 'Account approved')

  function ask(user, spec) {
    setConfirm({ user, ...spec })
  }

  return (
    <section className="sheet users" aria-labelledby="users-heading">
      <div className="folder-tab">Administration</div>
      <h1 id="users-heading">People</h1>
      <p className="lead">
        New accounts wait here until you approve them. Approving, declining, disabling and deleting take effect on their next action. Select a person to see their screening history.
      </p>

      <div className="filter-group" role="group" aria-label="Show">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={`filter-btn ${filter === f.id ? 'filter-btn-on' : ''}`}
            aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}{f.id === 'pending' && waiting > 0 ? ` (${waiting})` : ''}
          </button>
        ))}
      </div>

      <ErrorBanner error={error} onRetry={load} onDismiss={() => setError(null)} />
      {users === null && !error && <p className="muted state-note">Loading...</p>}
      {users && shown.length === 0 && (
        <p className="muted state-note">{filter === 'pending' ? 'Nobody is waiting for approval.' : 'No one to show here.'}</p>
      )}

      {shown.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th scope="col">Person</th><th scope="col">Status</th><th scope="col">Actions</th></tr>
            </thead>
            <tbody>
              {shown.map((u) => {
                const self = u.id === selfId
                const pill = STATUS_PILL[u.status] || STATUS_PILL.pending
                const busy = busyId === u.id
                return (
                  <tr key={u.id}>
                    <td>
                      <button type="button" className="row-btn user-email" onClick={() => onOpenHistory?.(u)}
                        aria-label={`View screenings by ${u.email}`}>{u.email}</button>{self && <span className="row-sub">This is you</span>}
                      <span className="row-sub">Signed up {fmtDateTime(u.created_at)}</span>
                    </td>
                    <td>
                      <Pill tone={pill.tone}>{pill.label}</Pill>
                      {u.role === 'admin' && <span className="row-sub">Administrator</span>}
                    </td>
                    <td>
                      <div className="row-actions">
                        {u.status !== 'approved' && (
                          <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => approve(u)}>
                            {u.status === 'disabled' ? 'Enable' : 'Approve'}
                          </button>
                        )}
                        {u.status === 'pending' && !self && (
                          <button type="button" className="btn btn-quiet btn-small" disabled={busy}
                            onClick={() => ask(u, {
                              title: `Decline ${u.email}?`,
                              body: 'They will not be able to use the console.',
                              label: 'Decline', danger: true,
                              run: () => setUserStatus(u.id, 'rejected'),
                            })}>
                            Decline
                          </button>
                        )}
                        {u.status === 'approved' && !self && (
                          u.role === 'admin' ? (
                            <button type="button" className="btn btn-quiet btn-small" disabled={busy}
                              onClick={() => ask(u, {
                                title: `Remove administrator rights from ${u.email}?`,
                                body: 'They keep their account but can no longer approve people, manage the lists or open other people\'s screening history.',
                                label: 'Remove rights', danger: true,
                                run: () => setUserRole(u.id, 'user'),
                              })}>
                              Make a regular user
                            </button>
                          ) : (
                            <button type="button" className="btn btn-quiet btn-small" disabled={busy}
                              onClick={() => ask(u, {
                                title: `Make ${u.email} an administrator?`,
                                body: 'They will be able to approve people, manage the lists and open each person\'s screening history from this tab.',
                                label: 'Make administrator', danger: false,
                                run: () => setUserRole(u.id, 'admin'),
                              })}>
                              Make administrator
                            </button>
                          )
                        )}
                        {u.status === 'approved' && !self && (
                          <button type="button" className="btn btn-quiet btn-small" disabled={busy}
                            onClick={() => ask(u, {
                              title: `Disable ${u.email}?`,
                              body: 'They lose access at once, and any batch they are running stops. Nothing is deleted: you can switch them back on later, and their past screenings stay in the history.',
                              label: 'Disable', danger: true,
                              run: () => setUserStatus(u.id, 'disabled'),
                              done: 'Account disabled',
                            })}>
                            Disable
                          </button>
                        )}
                        {!self && (
                          <button type="button" className="btn btn-quiet btn-small" disabled={busy}
                            onClick={() => ask(u, {
                              title: `Delete ${u.email}?`,
                              body: 'This removes their account and they can no longer sign in. Their past screenings stay in the history, without their name on them. This cannot be undone. To stop someone for now, disable them instead.',
                              label: 'Delete', danger: true,
                              run: () => deleteUser(u.id),
                              done: 'Account deleted',
                            })}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.label}
          danger={confirm.danger}
          onCancel={() => setConfirm(null)}
          onConfirm={() => apply(confirm.user, confirm.run, confirm.done)}
        />
      )}
    </section>
  )
}
