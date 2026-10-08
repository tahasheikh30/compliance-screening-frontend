import { useState } from "react";
import DataNoticeDialog from "./DataNoticeDialog";
import { Link, ROUTES } from "../lib/nav";
import { site } from "../lib/site";

function ExternalIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="site-footer-ext"
    >
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

/** A link to another website: opens in a new tab, says so to screen readers, and sends no referrer. */
function ExternalLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="site-footer-link"
    >
      {children}
      <ExternalIcon />
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * A link to one of this app's own pages. From inside the console it opens in a new tab, so reading the
 * privacy policy never throws away a screening that is half done. On the legal pages themselves it
 * navigates in place.
 */
function PageLink({ to, newTab, children }) {
  if (!newTab) {
    return (
      <Link to={to} className="site-footer-link">
        {children}
      </Link>
    );
  }
  return (
    <Link to={to} className="site-footer-link" target="_blank" rel="noopener">
      {children}
      <span className="visually-hidden"> (opens in a new tab)</span>
    </Link>
  );
}

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": "true",
};

const SOCIAL_ICONS = {
  linkedin: (
    <svg {...ICON_PROPS}>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3zM10 9.75h3.8v1.5h.06c.53-1 1.84-2.06 3.8-2.06 4.06 0 4.8 2.67 4.8 6.14v5.42h-4v-4.8c0-1.15-.02-2.62-1.6-2.62-1.6 0-1.85 1.25-1.85 2.54v4.88h-4z" />
    </svg>
  ),
  facebook: (
    <svg {...ICON_PROPS}>
      <path d="M13.5 21v-7.6h2.55l.4-3h-2.95V8.5c0-.87.24-1.46 1.5-1.46h1.6V4.36A21 21 0 0 0 14.27 4.2c-2.3 0-3.87 1.4-3.87 3.98v2.22H7.8v3h2.6V21z" />
    </svg>
  ),
  instagram: (
    <svg
      {...ICON_PROPS}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  x: (
    <svg {...ICON_PROPS}>
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78zm-1.08 16.16h1.7L7.4 4.75H5.58z" />
    </svg>
  ),
};

/**
 * The footer for every screen: brand, company, legal and support links, then the copyright line.
 * It owns the data handling notice dialog, so a screen only has to render <SiteFooter />.
 * Pass inPlace on the legal pages so their footer links navigate without opening new tabs.
 */
export default function SiteFooter({ inPlace = false }) {
  const [showNotice, setShowNotice] = useState(false);
  const year = new Date().getFullYear();
  const newTab = !inPlace;

  function toTop() {
    const calm = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo?.({ top: 0, behavior: calm ? "auto" : "smooth" });
  }

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <a
              className="site-footer-logo"
              href={site.companyUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="/packages_logo_footer.png"
                width="309"
                height="274"
                loading="lazy"
                decoding="async"
                alt={site.company}
              />
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
            <p className="site-footer-blurb">
              Our mission is to provide excellence to improve the quality of
              living and to drive sustainability based on the triple bottom line
              approach of People, Planet and Prosperity.
            </p>
            <ul className="site-footer-socials" aria-label="Social media">
              {site.social.map((s) => (
                <li key={s.key}>
                  <a
                    className="site-footer-social"
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {SOCIAL_ICONS[s.key]}
                    <span className="visually-hidden">
                      {site.company} on {s.label} (opens in a new tab)
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <nav className="site-footer-col" aria-labelledby="footer-company">
            <h2 id="footer-company" className="site-footer-h">
              Company
            </h2>
            <ul>
              <li>
                <ExternalLink href={site.companyUrl}>
                  About {site.company}
                </ExternalLink>
              </li>
              <li>
                <ExternalLink href={site.storyUrl}>Our story</ExternalLink>
              </li>
              <li>
                <ExternalLink href={site.groupCompaniesUrl}>
                  Group companies
                </ExternalLink>
              </li>
              <li>
                <ExternalLink href={site.careersUrl}>Careers</ExternalLink>
              </li>
            </ul>
          </nav>

          <nav className="site-footer-col" aria-labelledby="footer-explore">
            <h2 id="footer-explore" className="site-footer-h">
              Explore
            </h2>
            <ul>
              <li>
                <ExternalLink href={site.sustainabilityUrl}>
                  Sustainability
                </ExternalLink>
              </li>
              <li>
                <ExternalLink href={site.policiesUrl}>Policies</ExternalLink>
              </li>
              <li>
                <ExternalLink href={site.investorsUrl}>
                  Investor relations
                </ExternalLink>
              </li>
              <li>
                <ExternalLink href={site.newsUrl}>News and updates</ExternalLink>
              </li>
            </ul>
          </nav>

          <nav className="site-footer-col" aria-labelledby="footer-legal">
            <h2 id="footer-legal" className="site-footer-h">
              Legal
            </h2>
            <ul>
              <li>
                {site.privacyUrl ? (
                  <ExternalLink href={site.privacyUrl}>
                    Privacy policy
                  </ExternalLink>
                ) : (
                  <PageLink to={ROUTES.privacy} newTab={newTab}>
                    Privacy policy
                  </PageLink>
                )}
              </li>
              <li>
                {site.termsUrl ? (
                  <ExternalLink href={site.termsUrl}>Terms of use</ExternalLink>
                ) : (
                  <PageLink to={ROUTES.terms} newTab={newTab}>
                    Terms of use
                  </PageLink>
                )}
              </li>
              <li>
                <PageLink to={ROUTES.cookies} newTab={newTab}>
                  Cookie notice
                </PageLink>
              </li>
              <li>
                <PageLink to={ROUTES.accessibility} newTab={newTab}>
                  Accessibility
                </PageLink>
              </li>
              <li>
                <button
                  type="button"
                  className="site-footer-link"
                  onClick={() => setShowNotice(true)}
                >
                  Data handling notice
                </button>
              </li>
            </ul>
          </nav>

          <nav className="site-footer-col" aria-labelledby="footer-support">
            <h2 id="footer-support" className="site-footer-h">
              Support
            </h2>
            <ul>
              <li>
                <ExternalLink href={site.contactUrl}>Contact us</ExternalLink>
              </li>
            </ul>
            <address className="site-footer-address">
              {site.address}
              <br />
              <a
                className="site-footer-link"
                href={`tel:${site.phone.replace(/[^+\d]/g, "")}`}
              >
                {site.phone}
              </a>
            </address>
          </nav>
        </div>

        <div className="site-footer-bar">
          <p>
            &copy; {year} {site.company}. All rights reserved.
          </p>
          <button type="button" className="site-footer-top" onClick={toTop}>
            Back to top
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 19V5" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {showNotice && <DataNoticeDialog onClose={() => setShowNotice(false)} />}
    </footer>
  );
}
