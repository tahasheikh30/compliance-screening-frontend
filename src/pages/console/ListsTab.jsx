import { useCallback, useEffect, useRef, useState } from 'react'
import { getListsStatus, reloadLists, getNactaStatus, uploadNacta, getPepStatus, uploadPep, deletePepUpload, refreshPep } from '../../api'
import ErrorBanner from '../../components/ErrorBanner'
import { Pill } from '../../components/ui'
import { fmtAge, fmtNum, fmtDateTime, plural, safeUrl } from '../../lib/format'
import { SOURCES } from '../../lib/status'
import { useToast } from '../../components/Toaster'
import { peek, remember } from '../../lib/readCache'

const LIST_KEYS = ['UNSC', 'OFAC', 'UKSL', 'FIA_REDBOOK', 'NACTA', 'PEP']


/** One row per list. A source made of several lists (the FIA Red Books, the two OFAC lists) gets a row for each. */
function listRows(key, s) {
  const source = SOURCES[key]
  const lists = s?.lists || []
  if (lists.length === 0) {
    return [{
      id: key,
      name: source.long,
      ok: false,
      pill: { tone: 'warn', label: 'Not loaded yet' },
      records: null,
      loaded: key === 'NACTA' ? 'Loads from the uploaded file' : key === 'PEP' ? 'Loads from Wikidata and your list' : 'Downloads on the next screening',
    }]
  }
  return lists.map((l) => {
    const ok = !l.status || l.status === 'OK'
    return {
      id: `${key}-${l.list}`,
      name: l.list === key ? source.long : l.list,
      ok,
      pill: ok ? { tone: 'good', label: 'Ready' } : { tone: 'bad', label: 'Problem' },
      reason: ok ? null : l.status,
      note: l.note || null,
      source: safeUrl(l.source),
      sample: l.sample || null,
      records: ok ? l.records : 0,
      loaded: s.cached ? fmtAge(s.age_seconds) : 'Not loaded',
    }
  })
}

function CopyButton({ text }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch { /* clipboard blocked: the text is still selectable */ }
  }
  return <button type="button" className="btn btn-quiet btn-small" onClick={copy}>{done ? 'Copied' : 'Copy text'}</button>
}

/**
 * NACTA publishes the Fourth Schedule only through a web app, so it cannot be downloaded
 * like the other lists. It is loaded from an exported CSV or JSON file instead.
 */
function NactaPanel({ onChanged, isAdmin }) {
  const toast = useToast()
  const [status, setStatus] = useState(() => peek('lists:nacta'))
  const [error, setError] = useState(null)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const inputRef = useRef(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setStatus(remember('lists:nacta', await getNactaStatus()))
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
      toast.success('NACTA list uploaded', { to: 'lists' })
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      await load()
      onChanged?.()
    } catch (err) {
      setUploadError(err)
      toast.error('NACTA upload failed', { message: err?.message })
    } finally {
      setBusy(false)
    }
  }

  let summary = null
  if (status) {
    if (status.source === 'url') {
      summary = (
        <>
          <p>Downloaded automatically from <span className="mono">{status.url_host || 'the configured address'}</span> whenever the lists are loaded.</p>
          {status.loaded && status.live_copy && (
            <p>
              Last good copy: {plural(status.records, 'person', 'people')}, saved {fmtDateTime(status.uploaded_at)}. It is
              used if NACTA cannot be reached, as long as it is not older than {status.max_age_days} days.
            </p>
          )}
        </>
      )
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
        {status?.source === 'url'
          ? 'The list is downloaded automatically from the configured address. You can still upload a file by hand, which is used if the download has never worked.'
          : 'NACTA\'s portal (nfs.nacta.gov.pk) has no download address, so the list is loaded from a file. On the portal, click the JSON button to save the list, then upload that file here. Your administrator can also schedule an automatic refresh. A CNIC, father\'s name and province column make matching far more precise, and the list changes every few weeks, so keep it fresh.'}
      </p>
      <ErrorBanner error={error} onRetry={load} onDismiss={() => setError(null)} />
      {summary}
      {isAdmin ? (
        <>
        <form onSubmit={upload} className="nacta-upload">
          <label className="field" htmlFor="nacta-file">
            <span className="field-label">{status?.source === 'url' ? 'Or upload a NACTA list file by hand' : 'NACTA list file'}</span>
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
        </>
      ) : (
        <p className="field-hint">An administrator uploads and refreshes this list.</p>
      )}
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

/**
 * Politically exposed persons. There is no official Pakistani PEP list, so the server keeps a copy of national and
 * provincial office holders from Wikidata (refreshed in the background) and an administrator can add their own list.
 */
function PepPanel({ onChanged, isAdmin }) {
  const toast = useToast()
  const [status, setStatus] = useState(() => peek('lists:pep'))
  const [error, setError] = useState(null)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const inputRef = useRef(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setStatus(remember('lists:pep', await getPepStatus()))
    } catch (err) {
      setError(err)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // while the server is fetching from Wikidata, look again every few seconds; when it ends, refresh the list table too
  const fetching = !!status?.fetch?.running
  useEffect(() => {
    if (!fetching) return undefined
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [fetching, load])
  const wasFetching = useRef(false)
  useEffect(() => {
    if (wasFetching.current && !fetching) onChanged?.()
    wasFetching.current = fetching
  }, [fetching, onChanged])

  async function fetchNow() {
    setUploadError(null)
    try {
      setStatus(remember('lists:pep', await refreshPep()))
      toast.info('Fetching from Wikidata', { message: 'This runs in the background and can take a minute or two.', log: false })
    } catch (err) {
      setUploadError(err)
    }
  }

  async function upload(e) {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    setUploadError(null)
    setResult(null)
    try {
      setResult(await uploadPep(file))
      toast.success('PEP list uploaded', { to: 'lists' })
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      await load()
      onChanged?.()
    } catch (err) {
      setUploadError(err)
      toast.error('PEP upload failed', { message: err?.message })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setUploadError(null)
    try {
      await deletePepUpload()
      setResult(null)
      toast.success('PEP list removed', { to: 'lists' })
      await load()
      onChanged?.()
    } catch (err) {
      setUploadError(err)
      toast.error('Could not remove the PEP list', { message: err?.message })
    } finally {
      setBusy(false)
    }
  }

  const age = (d) => (d == null ? '' : d < 1 ? 'today' : `${Math.floor(d)} ${Math.floor(d) === 1 ? 'day' : 'days'} ago`)
  const wd = status?.wikidata
  const own = status?.upload

  return (
    <div className="nacta-panel pep-panel">
      <h2>Politically exposed persons (PEPs)</h2>
      <p className="lead">
        Pakistan publishes no official PEP list. Screening uses national and provincial office holders from Wikidata
        (the Senate and National Assembly, ministers, chief ministers, governors, provincial assemblies and similar),
        refreshed in the background, together with any list your administrator uploads. A PEP match is not a
        sanctions hit: it sends the applicant to manual review for enhanced due diligence.
      </p>
      <ErrorBanner error={error} onRetry={load} onDismiss={() => setError(null)} />
      {status && (
        <>
          {fetching && <p className="notice" role="status">Fetching the PEP list from Wikidata now. This can take a minute or two.</p>}
          {!fetching && status.fetch?.error && (
            <p className="notice notice-warn">The last fetch from Wikidata failed: {status.fetch.error}.{wd?.loaded ? ' The last good copy is still used.' : ''}</p>
          )}
          {status.wikidata_enabled ? (
            wd?.loaded
              ? <p>Wikidata copy: {plural(wd.records, 'person', 'people')}, fetched {fmtDateTime(wd.uploaded_at)} ({age(wd.age_days)}). People who left office more than {status.lookback_years} {status.lookback_years === 1 ? 'year' : 'years'} ago are not included.</p>
              : <p className="notice notice-warn">The Wikidata copy has not been fetched yet. It is fetched in the background; check again in a minute or two.</p>
          ) : (
            <p>The Wikidata fetch is switched off on the server. Only the uploaded list is used.</p>
          )}
          {own?.loaded
            ? <p><strong>{own.filename}</strong>: {plural(own.records, 'person', 'people')}, uploaded {fmtDateTime(own.uploaded_at)} ({age(own.age_days)}).</p>
            : <p className="muted">No list of your own has been uploaded.</p>}
          {!wd?.loaded && !own?.loaded && (
            <p className="notice notice-warn">
              No PEP data is loaded, so PEPs are not being checked.{status.required ? ' Every screening goes to manual review until some is loaded.' : ''}
            </p>
          )}
        </>
      )}
      {isAdmin ? (
        <>
          <form onSubmit={upload} className="nacta-upload">
            <label className="field" htmlFor="pep-file">
              <span className="field-label">Your own PEP list (CSV, JSON or XML)</span>
              <input
                id="pep-file"
                ref={inputRef}
                type="file"
                accept=".csv,.json,.xml,.txt,text/csv,application/json,text/xml,text/plain"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <span className="field-hint">
                Columns: Name (required), Position, Level (National or Provincial), Province, CNIC, Father Name, Date of Birth, Aliases, Party.
                A new upload replaces your previous one; the Wikidata copy is not affected.
              </span>
            </label>
            <button type="submit" className="btn btn-primary" disabled={!file || busy}>
              {busy ? 'Working...' : 'Upload PEP list'}
            </button>
            {own?.loaded && (
              <button type="button" className="btn btn-quiet" onClick={remove} disabled={busy}>Remove my list</button>
            )}
            {status?.wikidata_enabled && (
              <button type="button" className="btn btn-quiet" onClick={fetchNow} disabled={busy || fetching}>
                {fetching ? 'Fetching...' : 'Fetch from Wikidata now'}
              </button>
            )}
          </form>
          <ErrorBanner error={uploadError} onDismiss={() => setUploadError(null)} />
        </>
      ) : (
        <p className="field-hint">An administrator manages the PEP list.</p>
      )}
      {result && (
        <div className="reload-result" role="status">
          <p>
            <strong>{plural(result.records, 'person', 'people')} loaded</strong>: {fmtNum(result.national)} national, {fmtNum(result.provincial)} provincial.
            {result.rows_skipped > 0 && ` ${fmtNum(result.rows_skipped)} rows without a name were skipped.`}
          </p>
          {(result.warnings || []).map((w) => <p key={w} className="notice notice-warn">{w}</p>)}
        </div>
      )}
    </div>
  )
}

export default function ListsTab({ isAdmin = true }) {
  const toast = useToast()
  const [status, setStatus] = useState(() => peek('lists:status'))   // the last answer, shown at once while it refreshes
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [reloaded, setReloaded] = useState(null)
  const [reloadError, setReloadError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setStatus(remember('lists:status', await getListsStatus()))
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
      toast.success('Lists reloaded', { to: 'lists' })
      await load()
    } catch (err) {
      setReloadError(err)
      toast.error('Could not reload the lists', { message: err?.message })
    } finally {
      setBusy(false)
    }
  }

  // names of the lists that have a problem, taken from the same rows the table shows
  const problems = status ? LIST_KEYS.flatMap((k) => listRows(k, status[k])).filter((r) => !r.ok && r.reason).map((r) => r.name) : []

  return (
    <div className="workspace workspace-single">
      <section className="sheet" aria-labelledby="lists-heading">
        <div className="folder-tab">Lists</div>
        <h1 id="lists-heading">Watch lists</h1>
        <p className="lead">
          Lists are downloaded live from the publishers when a screening runs, then kept in the server's memory
          for a while (an hour by default) so repeated screenings are quick. You normally never need to touch
          this page.{isAdmin ? ' Reload only if you want to be certain the next screening uses lists fetched right now.' : ''}
        </p>

        <ErrorBanner error={error} onRetry={load} onDismiss={() => setError(null)} />
        {!status && !error && <p className="muted">Loading...</p>}

        {status && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th scope="col">List</th><th scope="col">Status</th><th scope="col">Records</th><th scope="col">Loaded</th></tr>
              </thead>
              <tbody>
                {LIST_KEYS.flatMap((k) => listRows(k, status[k]).map((r) => (
                  <tr key={r.id} className={r.ok ? '' : 'row-problem'}>
                    <td>
                      <span className="list-name">{r.name}</span>
                      {r.reason && <span className="list-reason">{r.reason}</span>}
                      {r.note && <span className="list-note">{r.note}</span>}
                      {r.source && (
                        <span className="list-link">
                          <a href={r.source} target="_blank" rel="noopener noreferrer">Open the source file</a>
                        </span>
                      )}
                      {r.sample && (
                        <details className="list-sample">
                          <summary>Show the text read from this PDF</summary>
                          <p>
                            The file downloaded but no people could be found in it, so its layout is probably one the
                            reader does not understand. Copy this text and send it to whoever maintains the screening
                            tool so the layout can be added.
                          </p>
                          <pre>{r.sample}</pre>
                          <CopyButton text={r.sample} />
                        </details>
                      )}
                    </td>
                    <td><Pill tone={r.pill.tone}>{r.pill.label}</Pill></td>
                    <td className="num">{r.records == null ? 'n/a' : fmtNum(r.records)}</td>
                    <td className="nowrap">{r.loaded}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}

        {isAdmin && (
          <div className="form-actions form-actions-spaced">
            <button type="button" className="btn btn-primary" onClick={reload} disabled={busy}>
              {busy ? 'Reloading lists...' : 'Reload all lists now'}
            </button>
            <span className="field-hint">Takes up to 40 seconds. Limited to 5 reloads an hour.</span>
          </div>
        )}
        <ErrorBanner error={reloadError} onDismiss={() => setReloadError(null)} />

        <NactaPanel onChanged={load} isAdmin={isAdmin} />
        <PepPanel onChanged={load} isAdmin={isAdmin} />

        {reloaded && (
          <p className="reload-summary" role="status">
            {problems.length === 0
              ? 'Reloaded. Every list loaded.'
              : `Reloaded, but ${plural(problems.length, 'list has', 'lists have')} a problem: ${problems.join('; ')}. The reason is shown in the table above.`}
          </p>
        )}
      </section>
    </div>
  )
}
