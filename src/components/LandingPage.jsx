import { useEffect, useRef, useState } from "react";
import { Link, ROUTES, arrivedByNavigation } from "../lib/nav";
import { MagnifyingGlassIcon } from "./ui";
import DataNoticeDialog from "./DataNoticeDialog";
import "../landing.css";

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8.5l3.2 3.2L13 4.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// What the sample panel shows. Illustration only, and labelled as such on the page.
const SAMPLE_ROWS = [
  "UN, OFAC, UK lists",
  "FIA Red Book, NACTA",
  "Open news search",
];

const POINTS = [
  {
    key: "01 / COVERAGE",
    title: "Every list in one search",
    copy: "One name is checked against the UN, OFAC, UK, FIA Red Book and NACTA lists, plus an open news search.",
  },
  {
    key: "02 / CLARITY",
    title: "A verdict you can act on",
    copy: "Escalate, Review or Clear, with the next step and one card per source. A source that could not be read is shown as Not screened, never as clear.",
  },
  {
    key: "03 / RECORD",
    title: "Evidence on file",
    copy: "Every screening is kept in History, searchable by name, and reopens with its evidence PDF.",
  },
];

export default function LandingPage() {
  const [showNotice, setShowNotice] = useState(false);
  const mainRef = useRef(null);

  useEffect(() => {
    if (arrivedByNavigation()) {
      // arriving from another screen: start at the top, with focus placed so a keyboard user
      // continues from the content
      window.scrollTo?.(0, 0);
      mainRef.current?.focus({ preventScroll: true });
      return;
    }
    // A fresh load or a shared link such as /#security: the browser tried to jump to the section before
    // this page existed (the app shows "Loading..." first), so do it now.
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id)
      document
        .getElementById(id)
        ?.scrollIntoView?.({ behavior: "instant", block: "start" });
  }, []);

  return (
    <div className="landing">
      <a className="lp-skip" href="#lp-main">
        Skip to content
      </a>
      <div className="lp-glow" aria-hidden="true" />
      <div className="lp-grid" aria-hidden="true" />

      <header className="lp-frame">
        <div className="lp-header">
          <Link
            to={ROUTES.landing}
            className="lp-wordmark"
            aria-label="Screening console home"
          >
            <span className="brand-mark">
              <MagnifyingGlassIcon size={20} />
            </span>
            <span>Screening console</span>
          </Link>
          <nav className="lp-nav" aria-label="Primary">
            <a href="#how-it-works">How it works</a>
            <a href="#security">Security</a>
            <a href="#about">About</a>
            <Link to={ROUTES.signIn} className="btn btn-ghost lp-nav-signin">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main
        id="lp-main"
        ref={mainRef}
        tabIndex={-1}
        className="lp-frame lp-main"
      >
        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div className="lp-hero-copy">
            <div className="lp-eyebrow">
              {" "}
              <span>Restricted</span>{" "}
            </div>
            <h1 id="lp-hero-title">Know who you’re dealing with.</h1>
            <p className="lp-lead">
              Screen an applicant against the UN, OFAC, UK, FIA Red Book and
              NACTA lists and an open news search. Get a clear verdict, with the
              evidence attached.
            </p>
            <div className="lp-cta">
              <Link to={ROUTES.signIn} className="lp-btn lp-btn-primary">
                Sign in
              </Link>
              <Link to={ROUTES.requestAccess} className="lp-btn lp-btn-quiet">
                Request an account
              </Link>
            </div>
            <p className="lp-trust">
              Authorized personnel only. An administrator approves every
              account.
            </p>
          </div>

          <figure className="lp-preview" aria-label="Sample screening overview">
            <div className="lp-preview-top">
              <span className="lp-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span>Secure view</span>
            </div>
            <div className="lp-preview-body">
              <div className="lp-preview-head">
                <div>
                  <p className="lp-label">Sample view</p>
                  <h2>Screening overview</h2>
                </div>
                <span className="lp-pill">Illustration</span>
              </div>
              <div className="lp-scan" aria-hidden="true">
                <span className="lp-scan-line" />
              </div>
              <ul className="lp-rows">
                {SAMPLE_ROWS.map((row) => (
                  <li key={row} className="lp-row">
                    <span className="lp-row-left">
                      <span className="lp-row-icon">
                        <CheckIcon />
                      </span>
                      <span className="lp-row-text">{row}</span>
                    </span>
                    <span className="lp-row-value">Checked</span>
                  </li>
                ))}
                <li className="lp-row lp-row-verdict">
                  <span className="lp-row-left">
                    <span className="lp-row-text">Verdict</span>
                  </span>
                  <span className="stamp lp-stamp">Clear</span>
                </li>
              </ul>
              <figcaption className="lp-caption">
                Real results list every match with its score, reference and
                source.
              </figcaption>
            </div>
          </figure>
        </section>

        <section
          id="how-it-works"
          className="lp-section"
          aria-labelledby="lp-how-title"
        >
          <div className="lp-divider" />
          <div className="lp-intro">
            <div className="lp-intro-head">
              <p className="lp-label lp-label-gold">A clearer process</p>
              <h2 id="lp-how-title">Signal, not noise.</h2>
            </div>
            <div className="lp-brief">
              <p className="lp-lead lp-lead-small">
                Enter a full name, add a date of birth, nationality or CNIC if
                you have them, and read the findings on one page. A CNIC that
                equals a listed one is reported as a match whatever the name
                looks like.
              </p>
              <ul className="lp-inputs" aria-label="What you can enter">
                <li className="lp-input lp-input-req">Full name</li>
                <li className="lp-input">Date of birth</li>
                <li className="lp-input">Nationality</li>
                <li className="lp-input">CNIC</li>
              </ul>
            </div>
          </div>
          <ul className="lp-cards">
            {POINTS.map((p) => (
              <li key={p.key} className="lp-card">
                <span className="lp-label lp-label-gold">{p.key}</span>
                <h3>{p.title}</h3>
                <p>{p.copy}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="security"
          className="lp-band"
          aria-labelledby="lp-security-title"
        >
          <div>
            <p className="lp-label lp-label-gold">Security</p>
            <h2 id="lp-security-title">Privacy held in the details.</h2>
            <p>
              Nobody can screen until an administrator approves their account.
              Sessions end after 30 minutes without activity, and this site
              makes no third-party requests from your browser.
            </p>
          </div>
          <span className="lp-pill lp-pill-solid">Approved access only</span>
        </section>

        <section
          id="about"
          className="lp-band"
          aria-labelledby="lp-about-title"
        >
          <div>
            <p className="lp-label lp-label-gold">About</p>
            <h2 id="lp-about-title">Confidence without the theatre.</h2>
            <p>
              An internal tool of the Compliance department at IGI General
              Takaful, for account-opening AML/KYC screening. It shows what was
              checked, what was found, and what could not be checked.
            </p>
          </div>
        </section>
      </main>

      <footer className="lp-frame">
        <div className="lp-divider" />
        <div className="lp-footer">
          <span>Internal tool, IGI Holdings, Compliance dept.</span>
          <button
            type="button"
            className="link-btn"
            onClick={() => setShowNotice(true)}
          >
            Data handling notice
          </button>
        </div>
      </footer>

      {showNotice && <DataNoticeDialog onClose={() => setShowNotice(false)} />}
    </div>
  );
}
