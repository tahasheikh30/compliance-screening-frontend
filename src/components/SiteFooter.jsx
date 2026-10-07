import { useState } from 'react'
import DataNoticeDialog from './DataNoticeDialog'
import { MagnifyingGlassIcon } from './ui'
import { site } from '../lib/site'

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="site-footer-ext">
      <path d="M7 17L17 7" /><path d="M8 7h9v9" />
    </svg>
  )
}

/** A link to another website: opens in a new tab, says so to screen readers, and sends no referrer. */
function ExternalLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="site-footer-link">
      {children}<ExternalIcon /><span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  )
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3zM10 9.75h3.8v1.5h.06c.53-1 1.84-2.06 3.8-2.06 4.06 0 4.8 2.67 4.8 6.14v5.42h-4v-4.8c0-1.15-.02-2.62-1.6-2.62-1.6 0-1.85 1.25-1.85 2.54v4.88h-4z" />
    </svg>
  )
}

/**
 * The footer for every screen: company, legal and support links, then the copyright line.
 * It owns the data handling notice dialog, so a screen only has to render <SiteFooter />.
 * Links come from lib/site.js and only appear when they have somewhere real to go.
 */
export default function SiteFooter() {
  const [showNotice, setShowNotice] = useState(false)
  const year = new Date().getFullYear()

  function toTop() {
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.scrollTo?.({ top: 0, behavior: calm ? 'auto' : 'smooth' })
  }

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <p className="site-footer-wordmark">{site.company}</p>
            <p className="site-footer-app">
              <span className="site-footer-appmark" aria-hidden="true"><MagnifyingGlassIcon size={14} /></span>
              {site.product}, applicant screening
            </p>
            <p className="site-footer-blurb">
              An application of {site.company} for account-opening AML/KYC screening. Authorised personnel only.
            </p>
            {site.linkedinUrl && (
              <a className="site-footer-social" href={site.linkedinUrl} target="_blank" rel="noopener noreferrer">
                <LinkedInIcon />
                <span className="visually-hidden">{site.company} on LinkedIn (opens in a new tab)</span>
              </a>
            )}
          </div>

          <nav className="site-footer-col" aria-labelledby="footer-company">
            <h2 id="footer-company" className="site-footer-h">Company</h2>
            <ul>
              <li><ExternalLink href={site.companyUrl}>About {site.company}</ExternalLink></li>
            </ul>
          </nav>

          <nav className="site-footer-col" aria-labelledby="footer-legal">
            <h2 id="footer-legal" className="site-footer-h">Legal</h2>
            <ul>
              {site.privacyUrl && <li><ExternalLink href={site.privacyUrl}>Privacy policy</ExternalLink></li>}
              {site.termsUrl && <li><ExternalLink href={site.termsUrl}>Terms of use</ExternalLink></li>}
              <li>
                <button type="button" className="site-footer-link" onClick={() => setShowNotice(true)}>
                  Data handling notice
                </button>
              </li>
            </ul>
          </nav>

          <nav className="site-footer-col" aria-labelledby="footer-support">
            <h2 id="footer-support" className="site-footer-h">Support</h2>
            <ul>
              <li>
                {site.contactIsEmail
                  ? <a href={site.contactHref} className="site-footer-link">Contact us</a>
                  : <ExternalLink href={site.contactHref}>Contact us</ExternalLink>}
              </li>
            </ul>
          </nav>
        </div>

        <div className="site-footer-bar">
          <p>&copy; {year} {site.company}. All rights reserved.</p>
          <button type="button" className="site-footer-top" onClick={toTop}>
            Back to top
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>
          </button>
        </div>
      </div>

      {showNotice && <DataNoticeDialog onClose={() => setShowNotice(false)} />}
    </footer>
  )
}
