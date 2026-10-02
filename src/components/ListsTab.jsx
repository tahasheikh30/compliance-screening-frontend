import { useCallback, useEffect, useState } from 'react'
import { getListsStatus, reloadLists } from '../api'
import ErrorBanner from './ErrorBanner'
import { Pill } from './ui'
import { fmtAge, fmtNum, dateOrNull, plural } from '../lib/format'
import { SOURCES } from '../lib/status'

const LIST_KEYS = ['UNSC', 'OFAC', 'UKSL', 'FIA_REDBOOK']

export default function ListsTab() {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [reloaded, setReloaded] = useState(null)
  const [reloadError, setReloadError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setStatus(await getListsStatus())
    } catch (err) {
      setError(err)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function reload() {
    setBusy(true)
    setReloadError(null)
    setReloaded(null)
    try {
      setReloaded(await reloadLists())
      await load()
    } catch (err) {
      setReloadError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="workspace workspace-single">
      <section className="sheet" aria-labelledby="lists-heading">
        <div className="folder-tab">Lists</div>
        <h1 id="lists-heading">Watch lists</h1>
        <p className="lead">
          Lists are downloaded live from the publishers when a screening runs, then kept in the server's memory
          for a while (an hour by default) so repeated screenings are quick. You normally never need to touch
          this page. Reload only if you want to be certain the next screening uses lists fetched right now.
        </p>

        <ErrorBanner error={error} onRetry={load} onDismiss={() => setError(null)} />
        {!status && !error && <p className="muted">Loading...</p>}

        {status && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th scope="col">List</th><th scope="col">In memory</th><th scope="col">Records</th><th scope="col">Loaded</th></tr>
              </thead>
              <tbody>
                {LIST_KEYS.map((k) => {
                  const s = status[k] || {}
                  return (
                    <tr key={k}>
                      <td>{SOURCES[k].long}</td>
                      <td>{s.cached ? <Pill tone="good">Ready</Pill> : <Pill tone="warn">Not loaded</Pill>}</td>
                      <td className="num">{s.cached ? fmtNum(s.records) : 'n/a'}</td>
                      <td className="nowrap">{s.cached ? fmtAge(s.age_seconds) : 'Downloads on the next screening'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-actions form-actions-spaced">
          <button type="button" className="btn btn-primary" onClick={reload} disabled={busy}>
            {busy ? 'Reloading lists...' : 'Reload all lists now'}
          </button>
          <span className="field-hint">Takes up to 40 seconds. Limited to 5 reloads an hour.</span>
        </div>
        <ErrorBanner error={reloadError} onDismiss={() => setReloadError(null)} />

        {reloaded && (
          <div className="reload-result" role="status">
            <h2>Reload result</h2>
            <ul>
              {LIST_KEYS.map((k) => {
                const r = reloaded[k]
                if (!r) return null
                return (
                  <li key={k}>
                    <strong>{SOURCES[k].name}</strong>{' '}
                    {r.error
                      ? <span className="reload-bad">Could not be loaded. {r.error}</span>
                      : <span>{plural(r.records, 'record', 'records')}
                        {r.lists?.length > 0 && <> ({r.lists.map((l) => {
                          const d = dateOrNull(l.published)
                          return d ? `${l.list}, dated ${d}` : l.list
                        }).join('; ')})</>}
                      </span>}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
