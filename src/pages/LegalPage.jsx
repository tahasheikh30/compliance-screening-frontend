import { useEffect, useRef } from 'react'
import { Link, ROUTES, arrivedByNavigation } from '../lib/nav'
import { MagnifyingGlassIcon } from '../components/ui'
import SiteFooter from '../components/SiteFooter'
import { LEGAL_PAGES, UPDATED } from './legalContent'

/** One of the legal pages (privacy, terms, cookies, accessibility), readable signed in or out. */
export default function LegalPage({ path }) {
  const page = LEGAL_PAGES[path]
  const mainRef = useRef(null)

  useEffect(() => {
    const previous = document.title
    document.title = `${page.title} | Sentinel`
    window.scrollTo?.(0, 0)
    if (arrivedByNavigation()) mainRef.current?.focus({ preventScroll: true })
    return () => { document.title = previous }
  }, [page.title])

  return (
    <div className="gate-page">
      <header className="legal-top">
        <div className="legal-top-inner">
          <Link to={ROUTES.landing} className="legal-brand" aria-label="Sentinel home">
            <span className="brand-mark"><MagnifyingGlassIcon size={20} /></span>
            <span>Sentinel</span>
          </Link>
          <Link to={ROUTES.landing} className="btn btn-ghost">Back to the app</Link>
        </div>
      </header>

      <main id="legal-main" ref={mainRef} tabIndex={-1} className="legal">
        <article className="legal-sheet">
          <h1>{page.title}</h1>
          <p className="legal-updated">Last updated {UPDATED}</p>
          <p className="legal-lead">{page.lead}</p>

          {page.sections.map((s) => (
            <section key={s.h} className="legal-section">
              <h2>{s.h}</h2>
              {s.p?.map((t) => <p key={t}>{t}</p>)}
              {s.ul && <ul>{s.ul.map((t) => <li key={t}>{t}</li>)}</ul>}
            </section>
          ))}
        </article>
      </main>

      <SiteFooter inPlace />
    </div>
  )
}
