import { useCallback, useEffect, useRef, useState } from 'react'
import { getListsStatus, reloadLists, getNactaStatus, uploadNacta } from '../api'
import ErrorBanner from './ErrorBanner'
import { Pill } from './ui'
import { fmtAge, fmtNum, fmtDateTime, dateOrNull, plural } from '../lib/format'
import { SOURCES } from '../lib/status'

const LIST_KEYS = ['UNSC', 'OFAC', 'UKSL', 'FIA_REDBOOK', 'NACTA']


/**
 * NACTA publishes the Fourth Schedule only through a web app, so it cannot be downloaded
 * like the other lists. It is loaded from an exported CSV or JSON file instead.
 */
function NactaPanel({ onChanged }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const inputRef = useRef(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setStatus(await getNactaStatus())
    } catch (err) {
      setError(err)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function upload(e) {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    setUploadError(null)
    setResult(null)
    try {
      setResult(await uploadNacta(file))
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      await load()
      onChanged?.()
    } catch (err) {
      setUploadError(err)
    } finally {
      setBusy(false)
    }
  }

  let summary = null
  if (status) {
    if (status.source === 'url') {
      summary = <p>Downloaded live from <span className="mono">{status.url}</span> when a screening runs.</p>
    } else if (!status.loaded) {
      summary = (
        <p className="notice notice-warn">
          No NACTA list has been uploaded. Until one is, every screening reports NACTA as not screened and goes to
          manual review.
        </p>
      )
    } else {
      summary = (
        <>
          <p>
            <strong>{status.filename}</strong>: {plural(status.records, 'person', 'people')}, loaded{' '}
            {fmtDateTime(status.uploaded_at)} ({status.age_days < 1 ? 'today' : `${Math.floor(status.age_days)} ${Math.floor(status.age_days) === 1 ? 'day' : 'days'} ago`}).
          </p>
          {status.stale && (
            <p className="notice notice-warn">
              This copy is older than {status.max_age_days} days, so screenings report NACTA as incomplete and go to
              manual review. Upload a fresh export.
            </p>
          )}
        </>
      )
    }
  }

  return (
    <div className="nacta-panel">
      <h2>NACTA Proscribed Persons</h2>
      <p className="lead">
        NACTA publishes the Fourth Schedule only through its web portal (nfs.nacta.gov.pk), so it cannot be downloaded
        automatically like the other lists. Upload it as a CSV or JSON file with a header row that includes the name
        column. A CNIC and father's name column make matching far more precise. The list changes every few weeks, so
        upload a fresh copy regularly.
      </p>
      <ErrorBanner error={error} onRetry={load} onDismiss={() => setError(null)} />
      {summary}
      <form onSubmit={upload} className="nacta-upload">
        <label className="field" htmlFor="nacta-file">
          <span className="field-label">NACTA list file</span>
          <input
            id="nacta-file"
            ref={inputRef}
            type="file"
            accept=".csv,.json,.txt,text/csv,application/json,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={!file || busy}>
          {busy ? 'Uploading...' : 'Upload NACTA list'}
        </button>
      </form>
      <ErrorBanner error={uploadError} onDismiss={() => setUploadError(null)} />
      {result && (
        <div className="reload-result" role="status">
          <p>
            <strong>{plural(result.records, 'person', 'people')} loaded.</strong> {fmtNum(result.with_cnic)} have a usable CNIC.
            {result.rows_skipped > 0 && ` ${fmtNum(result.rows_skipped)} rows without a name were skipped.`}
          </p>
          {(result.warnings || []).map((w) => <p key={w} className="notice notice-warn">{w}</p>)}
        </div>
      )}
    </div>
  )
}

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
                      <td className="nowrap">{s.cached ? fmtAge(s.age_seconds) : (k === 'NACTA' ? 'Loads from the uploaded file' : 'Downloads on the next screening')}</td>
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

        <NactaPanel onChanged={load} />

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
                      : <span>{plural(r.records, 'record', 'records')} in total</span>}
                    {r.lists?.length > 0 && (
                      <ul className="reload-lists">
                        {r.lists.map((l) => {
                          const ok = !l.status || l.status === 'OK'
                          const d = dateOrNull(l.published)
                          return (
                            <li key={l.list} className={ok ? '' : 'reload-bad'}>
                              {l.list}: {ok ? plural(l.records, 'record', 'records') : `not screened: ${l.status}`}
                              {ok && d ? `, dated ${d}` : ''}
                            </li>
                          )
                        })}
                      </ul>
                    )}
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
