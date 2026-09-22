import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listFiaEditions, uploadFiaEdition, deleteFiaEdition, browseFiaEntries,
  diffFiaEdition, activateFiaEdition, checkFiaWebsite, fetchFiaPageImageUrl,
} from '../api'
import { ApiError } from '../lib/apiError'
import ErrorBanner from './ErrorBanner'
import ConfirmDialog from './ConfirmDialog'

const STATUS_LABEL = { active: 'Active', staged: 'Staged — needs review', archived: 'Archived' }
const SEVERITY_ORDER = { high: 0, medium: 1, info: 2 }

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function fmtBytes(n) {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function StatusPill({ status }) {
  return <span className={`edition-pill edition-pill-${status}`}>{STATUS_LABEL[status] || status}</span>
}

function WarningList({ warnings }) {
  if (!warnings || warnings.length === 0) {
    return <p className="fia-no-warnings">No parsing warnings for this edition.</p>
  }
  const sorted = [...warnings].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
  return (
    <ul className="fia-warning-list">
      {sorted.map((w, i) => (
        <li key={i} className={`fia-warning fia-warning-${w.severity}`}>
          <span className="fia-warning-severity">{w.severity}</span>
          <span>{w.message}</span>
        </li>
      ))}
    </ul>
  )
}

// --- upload dropzone --------------------------------------------------------

function UploadPanel({ onUploaded }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [notes, setNotes] = useState('')
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  function pickFile(f) {
    setError(null)
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError(new ApiError({ code: 'FIA_WRONG_EXTENSION', message: 'Please choose a PDF file.' }))
      return
    }
    setFile(f)
  }

  async function doUpload() {
    if (!file) return
    setError(null)
    setProgress(0)
    try {
      const result = await uploadFiaEdition(file, notes.trim() || null, { onProgress: setProgress })
      setFile(null)
      setNotes('')
      setProgress(null)
      onUploaded(result)
    } catch (err) {
      setProgress(null)
      setError(err)
    }
  }

  return (
    <div className="fia-upload-panel">
      <div
        className={`fia-dropzone ${dragging ? 'fia-dropzone-active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          pickFile(e.dataTransfer.files?.[0])
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        aria-label="Upload a Red Book PDF"
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        {file ? (
          <div className="fia-dropzone-filename">{file.name} <span>({fmtBytes(file.size)})</span></div>
        ) : (
          <>
            <div className="fia-dropzone-title">Drop a Red Book PDF here, or click to choose one</div>
            <div className="fia-dropzone-sub">Downloaded and reviewed from fia.gov.pk. Max 20MB.</div>
          </>
        )}
      </div>

      <label className="field" htmlFor="fia-notes-input">
        <span>Notes (optional — e.g. where this copy came from)</span>
        <input
          id="fia-notes-input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Downloaded from fia.gov.pk, 22 Sep 2026"
        />
      </label>

      {progress !== null && (
        <div className="fia-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="fia-progress-fill" style={{ width: `${progress}%` }} />
          <span className="fia-progress-label">{progress < 100 ? `Uploading… ${progress}%` : 'Processing…'}</span>
        </div>
      )}

      <ErrorBanner error={error} onDismiss={() => setError(null)} onRetry={file ? doUpload : undefined} />

      <button type="button" className="submit-btn" onClick={doUpload} disabled={!file || progress !== null}>
        {progress !== null ? 'Uploading…' : 'Upload & stage for review'}
      </button>
      <p className="fia-upload-hint">
        This only stages the edition — it will not be used for screening until you review the parsed
        names below and activate it.
      </p>
    </div>
  )
}

// --- entries browser ---------------------------------------------------------

function EntriesBrowser({ editionId }) {
  const [q, setQ] = useState('')
  const [cnicOnly, setCnicOnly] = useState(false)
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const limit = 25

  const load = useCallback(async (o = offset, query = q, cnic = cnicOnly) => {
    setLoading(true)
    setError(null)
    try {
      const res = await browseFiaEntries(editionId, { q: query || undefined, cnicOnly: cnic, offset: o, limit })
      setData(res)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId])

  useEffect(() => { setOffset(0); load(0, q, cnicOnly) }, [editionId, cnicOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  function onSearchSubmit(e) {
    e.preventDefault()
    setOffset(0)
    load(0, q, cnicOnly)
  }

  return (
    <div className="fia-entries">
      <form className="fia-entries-search" onSubmit={onSearchSubmit}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or CNIC"
          aria-label="Search parsed entries"
        />
        <label className="fia-checkbox-label">
          <input type="checkbox" checked={cnicOnly} onChange={(e) => { setCnicOnly(e.target.checked) }} />
          Only entries with a CNIC
        </label>
        <button type="submit" className="submit-btn fia-btn-compact">Search</button>
      </form>

      <ErrorBanner error={error} onRetry={() => load()} onDismiss={() => setError(null)} />

      {loading && <p className="fia-loading-note">Loading entries…</p>}

      {data && (
        <>
          <table className="fia-entries-table">
            <thead>
              <tr><th>Name</th><th>CNIC</th><th>PDF page</th></tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr><td colSpan={3} className="fia-entries-empty">No entries match.</td></tr>
              )}
              {data.items.map((it, i) => (
                <tr key={i}>
                  <td>{it.name}</td>
                  <td>{it.cnic || '—'}</td>
                  <td>{it.page || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="fia-pagination">
            <span>{data.total === 0 ? '0 entries' : `${data.offset + 1}–${Math.min(data.offset + data.items.length, data.total)} of ${data.total}`}</span>
            <div>
              <button type="button" className="fia-btn-compact" disabled={offset === 0}
                     onClick={() => { const o = Math.max(0, offset - limit); setOffset(o); load(o) }}>Prev</button>
              <button type="button" className="fia-btn-compact" disabled={offset + limit >= data.total}
                     onClick={() => { const o = offset + limit; setOffset(o); load(o) }}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// --- PDF page viewer -----------------------------------------------------

function PageViewer({ editionId, pageCount }) {
  const [page, setPage] = useState(1)
  const [imgUrl, setImgUrl] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl = null
    setLoading(true)
    setError(null)
    fetchFiaPageImageUrl(editionId, page)
      .then((url) => {
        if (cancelled) { window.URL.revokeObjectURL(url); return }
        objectUrl = url
        setImgUrl(url)
      })
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
      if (objectUrl) window.URL.revokeObjectURL(objectUrl)
    }
  }, [editionId, page])

  return (
    <div className="fia-page-viewer">
      <div className="fia-page-controls">
        <button type="button" className="fia-btn-compact" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
        <span>Page {page}{pageCount ? ` of ${pageCount}` : ''}</span>
        <button type="button" className="fia-btn-compact" disabled={pageCount ? page >= pageCount : false}
               onClick={() => setPage((p) => p + 1)}>Next →</button>
      </div>
      {error && <ErrorBanner error={error} onRetry={() => setPage((p) => p)} onDismiss={() => setError(null)} />}
      {loading && <p className="fia-loading-note">Rendering page…</p>}
      {imgUrl && !loading && <img className="fia-page-image" src={imgUrl} alt={`Red Book PDF page ${page}`} />}
    </div>
  )
}

// --- diff vs active --------------------------------------------------------

function DiffPanel({ editionId }) {
  const [diff, setDiff] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setDiff(await diffFiaEdition(editionId))
    } catch (err) {
      setError(err)
    }
  }, [editionId])

  useEffect(() => { load() }, [load])

  if (error) return <ErrorBanner error={error} onRetry={load} onDismiss={() => setError(null)} />
  if (!diff) return <p className="fia-loading-note">Comparing…</p>
  if (!diff.active_edition_id) return <p className="fia-no-warnings">No edition is active yet, so there's nothing to compare against.</p>
  if (diff.is_active) return <p className="fia-no-warnings">This is the active edition.</p>

  return (
    <div className="fia-diff">
      <p>
        Versus the active edition: <strong>+{diff.added}</strong> added, <strong>−{diff.removed}</strong> removed,{' '}
        {diff.unchanged} unchanged.
      </p>
      {diff.added_sample.length > 0 && (
        <details>
          <summary>Added names ({diff.added})</summary>
          <ul className="fia-diff-list">{diff.added_sample.map((n) => <li key={n}>{n}</li>)}</ul>
        </details>
      )}
      {diff.removed_sample.length > 0 && (
        <details>
          <summary>Removed names ({diff.removed})</summary>
          <ul className="fia-diff-list">{diff.removed_sample.map((n) => <li key={n}>{n}</li>)}</ul>
        </details>
      )}
    </div>
  )
}

// --- one edition's expanded review panel -----------------------------------

function EditionPanel({ edition, onChanged }) {
  const [section, setSection] = useState('entries')
  const [confirmActivate, setConfirmActivate] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)

  const firstActivation = edition.activation_count === 0

  async function doActivate() {
    setBusy(true)
    setActionError(null)
    try {
      await activateFiaEdition(edition.id, { confirmReviewed: confirmChecked, note: note.trim() || null })
      setConfirmActivate(false)
      setConfirmChecked(false)
      setNote('')
      onChanged()
    } catch (err) {
      setActionError(err)
    } finally {
      setBusy(false)
    }
  }

  async function doDiscard() {
    setBusy(true)
    setActionError(null)
    try {
      await deleteFiaEdition(edition.id)
      setConfirmDiscard(false)
      onChanged()
    } catch (err) {
      setActionError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fia-panel">
      <div className="fia-panel-meta">
        <div><span className="fia-meta-label">Uploaded</span> {fmtDate(edition.created_at)}</div>
        <div><span className="fia-meta-label">Source</span> {edition.source === 'upload' ? 'Manual upload' : edition.source === 'scrape' ? 'FIA website scan' : edition.source}</div>
        <div><span className="fia-meta-label">File</span> {edition.original_filename || '—'} ({fmtBytes(edition.size_bytes)}, {edition.page_count} pages)</div>
        <div><span className="fia-meta-label">Parsed</span> {edition.names_found} names, {edition.cnics_found} with a CNIC</div>
        {edition.notes && <div><span className="fia-meta-label">Notes</span> {edition.notes}</div>}
        {edition.last_activated_at && (
          <div><span className="fia-meta-label">Last activated</span> {fmtDate(edition.last_activated_at)} ({edition.activation_count}×)</div>
        )}
      </div>

      <WarningList warnings={edition.warnings} />

      <nav className="fia-panel-tabs">
        <button type="button" className={section === 'entries' ? 'active' : ''} onClick={() => setSection('entries')}>Parsed names</button>
        <button type="button" className={section === 'pages' ? 'active' : ''} onClick={() => setSection('pages')}>PDF pages</button>
        <button type="button" className={section === 'diff' ? 'active' : ''} onClick={() => setSection('diff')}>Compare to active</button>
      </nav>

      {section === 'entries' && <EntriesBrowser editionId={edition.id} />}
      {section === 'pages' && <PageViewer editionId={edition.id} pageCount={edition.page_count} />}
      {section === 'diff' && <DiffPanel editionId={edition.id} />}

      <ErrorBanner error={actionError} onDismiss={() => setActionError(null)} />

      <div className="fia-panel-actions">
        {edition.status !== 'active' && (
          <button type="button" className="submit-btn" onClick={() => setConfirmActivate(true)}>
            {edition.status === 'archived' ? 'Roll back to this edition' : 'Activate this edition'}
          </button>
        )}
        {edition.status === 'staged' && (
          <button type="button" className="fia-btn-danger" onClick={() => setConfirmDiscard(true)}>Discard</button>
        )}
      </div>

      {confirmActivate && (
        <ConfirmDialog
          title={edition.status === 'archived' ? 'Roll back to this edition?' : 'Activate this edition?'}
          body={
            edition.status === 'archived'
              ? 'Screening will use this edition\'s names again, starting immediately.'
              : 'Screening will use this edition\'s names starting immediately. Make sure you\'ve reviewed the parsed names and warnings above.'
          }
          confirmLabel={busy ? 'Activating…' : 'Activate'}
          disabled={busy || (firstActivation && !confirmChecked)}
          onCancel={() => { setConfirmActivate(false); setConfirmChecked(false); setActionError(null) }}
          onConfirm={doActivate}
        >
          {firstActivation && (
            <label className="fia-checkbox-label fia-confirm-checkbox">
              <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
              I have reviewed the parsed names (and warnings, if any) against the PDF.
            </label>
          )}
          <label className="field" htmlFor="activate-note">
            <span>Note (optional)</span>
            <input id="activate-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. spot-checked pages 1–5" />
          </label>
        </ConfirmDialog>
      )}

      {confirmDiscard && (
        <ConfirmDialog
          title="Discard this staged edition?"
          body="This removes the uploaded PDF and parsed names from the server. It was never made active, so no past screening result refers to it."
          confirmLabel={busy ? 'Discarding…' : 'Discard'}
          danger
          disabled={busy}
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={doDiscard}
        />
      )}
    </div>
  )
}

// --- top-level tab -----------------------------------------------------------

export default function FiaRedbookTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState(null)
  const [checkError, setCheckError] = useState(null)

  const load = useCallback(async (opts = {}) => {
    if (!opts.silent) setLoading(true)
    setError(null)
    try {
      const res = await listFiaEditions()
      setData(res)
      return res
    } catch (err) {
      setError(err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function onUploaded(result) {
    await load({ silent: true })
    setExpandedId(result.id)
  }

  async function onCheckWebsite() {
    setChecking(true)
    setCheckError(null)
    setCheckResult(null)
    try {
      const res = await checkFiaWebsite()
      setCheckResult(res)
      await load({ silent: true })
      if (res.edition_id && res.status === 'STAGED_NEEDS_REVIEW') setExpandedId(res.edition_id)
    } catch (err) {
      setCheckError(err)
    } finally {
      setChecking(false)
    }
  }

  if (loading) {
    return <div className="folder"><div className="folder-tab">FIA Red Book</div><p className="fia-loading-note">Loading editions…</p></div>
  }

  return (
    <div className="folder">
      <div className="folder-tab">FIA Red Book</div>
      <header className="folder-header">
        <h1>FIA Red Book editions</h1>
        <p className="folder-meta">
          {data?.active_edition_id
            ? `Active edition: ${data.editions.find((e) => e.id === data.active_edition_id)?.original_filename || data.active_edition_id}`
            : 'No edition is active — screening against the FIA Red Book will show "not checked" until one is.'}
        </p>
      </header>

      <ErrorBanner error={error} onRetry={() => load()} onDismiss={() => setError(null)} />

      <section className="fia-section">
        <div className="fia-section-heading">
          <h2>Upload a new edition</h2>
          <button type="button" className="fia-btn-compact" onClick={onCheckWebsite} disabled={checking}>
            {checking ? 'Checking fia.gov.pk…' : 'Check FIA website for a new edition'}
          </button>
        </div>
        <ErrorBanner error={checkError} onDismiss={() => setCheckError(null)} onRetry={onCheckWebsite} />
        {checkResult && (
          <p className="fia-check-result">
            {checkResult.status === 'NO_PDF_FOUND' && 'No Red Book PDF link was found on the FIA site.'}
            {checkResult.status === 'UNCHANGED' && 'The FIA site\'s PDF matches an edition already on file.'}
            {checkResult.status === 'STAGED_NEEDS_REVIEW' && `A new edition was found and staged (${checkResult.names_found} names) — review it below.`}
            {checkResult.status === 'REFRESHED' && `A new edition was found and auto-activated (${checkResult.names_found} names).`}
          </p>
        )}
        <UploadPanel onUploaded={onUploaded} />
      </section>

      <section className="fia-section">
        <h2>All editions</h2>
        {(!data || data.editions.length === 0) && <p className="fia-no-warnings">No editions uploaded yet.</p>}
        <ul className="fia-edition-list">
          {data?.editions.map((ed) => (
            <li key={ed.id} className="fia-edition-item">
              <button
                type="button"
                className="fia-edition-row"
                onClick={() => setExpandedId(expandedId === ed.id ? null : ed.id)}
                aria-expanded={expandedId === ed.id}
              >
                <StatusPill status={ed.status} />
                <span className="fia-edition-filename">{ed.original_filename || ed.id}</span>
                <span className="fia-edition-counts">{ed.names_found} names</span>
                {ed.warnings?.some((w) => w.severity === 'high') && <span className="fia-warning-dot" title="Has high-severity warnings" />}
                <span className="fia-edition-date">{fmtDate(ed.created_at)}</span>
                <span className="fia-edition-chevron">{expandedId === ed.id ? '▾' : '▸'}</span>
              </button>
              {expandedId === ed.id && (
                <EditionPanel edition={ed} onChanged={async () => { await load({ silent: true }) }} />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
