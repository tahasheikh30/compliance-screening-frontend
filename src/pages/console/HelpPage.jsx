import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { SECTIONS, TAB_GUIDE } from './helpContent'
import '../../help.css'

/** Turns **bold** marks in manual text into <strong>. Nothing else is interpreted, so text can never inject markup. */
function Inline({ text }) {
  const parts = String(text).split(/\*\*(.+?)\*\*/g)
  return parts.map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>))
}

const NOTE_LABEL = { tip: 'Tip', warn: 'Important', info: 'Good to know' }

function Block({ block, isAdmin, onOpen }) {
  if (block.admin && !isAdmin) return null
  switch (block.t) {
    case 'p':
      return <p className="help-p"><Inline text={block.text} /></p>
    case 'h':
      return <h3 className="help-h">{block.text}{block.admin && <span className="help-badge">Administrators</span>}</h3>
    case 'steps':
      return (
        <ol className="help-steps">
          {block.items.map((s) => (
            <li key={s.title}>
              <span className="help-step-title"><Inline text={s.title} /></span>
              {s.text && <span className="help-step-text"><Inline text={s.text} /></span>}
            </li>
          ))}
        </ol>
      )
    case 'list':
      return <ul className="help-list">{block.items.map((t) => <li key={t}><Inline text={t} /></li>)}</ul>
    case 'defs':
      return (
        <dl className="help-defs">
          {block.items.map((d) => (
            <div key={d.term} className="help-def">
              <dt>{d.term}</dt>
              <dd><Inline text={d.text} /></dd>
            </div>
          ))}
        </dl>
      )
    case 'table':
      return (
        <div className="help-table-wrap" tabIndex={0} role="group" aria-label="Table, scroll sideways if needed">
          <table className="help-table">
            <thead><tr>{block.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) => (i === 0
                    ? <th key={i} scope="row">{cell}</th>
                    : <td key={i}><Inline text={cell} /></td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'note':
      return (
        <aside className={`help-note help-note-${block.tone || 'info'}`}>
          <span className="help-note-title">{block.title || NOTE_LABEL[block.tone] || NOTE_LABEL.info}</span>
          <span><Inline text={block.text} /></span>
        </aside>
      )
    case 'tabs':
      return (
        <ul className="help-tabs">
          {TAB_GUIDE.filter((t) => !t.admin || isAdmin).map((t) => (
            <li key={t.id}>
              <div>
                <span className="help-tab-name">{t.label}</span>
                <span className="help-tab-text">{t.text}</span>
              </div>
              <button type="button" className="btn btn-quiet btn-small" onClick={() => onOpen?.(t.id)}>
                Open<span className="visually-hidden"> {t.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )
    default:
      return null
  }
}

/** All the text of a section, lower case, for searching. */
function haystack(section, isAdmin) {
  const out = [section.title, section.summary]
  for (const b of section.blocks) {
    if (b.admin && !isAdmin) continue
    out.push(b.text, b.title)
    for (const i of b.items || []) out.push(typeof i === 'string' ? i : `${i.title || i.term || ''} ${i.text || ''}`)
    for (const r of b.rows || []) out.push(r.join(' '))
  }
  return out.filter(Boolean).join(' ').replace(/\*\*/g, '').toLowerCase()
}

/** The user manual: a contents list on the left, the manual on the right, and a search box over both. */
export default function HelpPage({ isAdmin = false, onOpen }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(null)
  const root = useRef(null)

  const visible = useMemo(() => SECTIONS.filter((s) => !s.admin || isAdmin), [isAdmin])
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const shown = useMemo(
    () => (terms.length ? visible.filter((s) => { const h = haystack(s, isAdmin); return terms.every((t) => h.includes(t)) }) : visible),
    [visible, isAdmin, query], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // highlight the section being read (skipped where the browser has no IntersectionObserver)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !root.current) return undefined
    const seen = new Map()
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : null)
      const top = [...seen.entries()].filter(([, v]) => v !== null).sort((a, b) => a[1] - b[1])[0]
      if (top) setActive(top[0].replace('help-', ''))
    }, { rootMargin: '-90px 0px -65% 0px' })
    root.current.querySelectorAll('[data-help-section]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [shown])

  function jump(id) {
    const el = document.getElementById(`help-${id}`)
    if (!el) return
    el.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    el.querySelector('h2')?.focus({ preventScroll: true })
    setActive(id)
  }

  return (
    <div className="workspace workspace-help" ref={root}>
      <nav className="help-toc" aria-label="Manual contents">
        <p className="help-toc-title">Contents</p>
        <ol>
          {visible.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={`help-toc-link${active === s.id ? ' help-toc-on' : ''}`}
                aria-current={active === s.id ? 'true' : undefined}
                disabled={!shown.includes(s)}
                onClick={() => jump(s.id)}
              >
                {s.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section className="sheet help-sheet" aria-labelledby="help-heading">
        <div className="folder-tab">Help</div>
        <h1 id="help-heading">User manual</h1>
        <p className="lead">How every part of Sentinel works, from your first screening to monitoring and settings. Pick a topic on the left or search for a word.</p>

        <div className="help-search">
          <label htmlFor="help-search-input" className="visually-hidden">Search the manual</label>
          <input
            id="help-search-input"
            type="search"
            value={query}
            placeholder="Search the manual, for example CNIC or threshold"
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
          />
          {terms.length > 0 && (
            <p className="help-count" role="status">
              {shown.length === 0 ? 'No topic matches.' : `${shown.length} ${shown.length === 1 ? 'topic matches' : 'topics match'}.`}
            </p>
          )}
        </div>

        {shown.length === 0 && (
          <div className="help-empty">
            <p className="notif-empty-title">Nothing found for "{query.trim()}"</p>
            <p className="muted">Try a shorter word, or clear the search to see every topic.</p>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setQuery('')}>Clear search</button>
          </div>
        )}

        {shown.map((s, n) => (
          <article key={s.id} id={`help-${s.id}`} data-help-section className="help-section" aria-labelledby={`help-${s.id}-h`}>
            <header>
              <span className="help-num" aria-hidden="true">{String(visible.indexOf(s) + 1).padStart(2, '0')}</span>
              <div>
                <h2 id={`help-${s.id}-h`} tabIndex={-1}>
                  {s.title}{s.admin && <span className="help-badge">Administrators</span>}
                </h2>
                <p className="help-summary">{s.summary}</p>
              </div>
            </header>
            {s.blocks.map((b, i) => <Block key={`${n}-${i}`} block={b} isAdmin={isAdmin} onOpen={onOpen} />)}
          </article>
        ))}
      </section>
    </div>
  )
}
