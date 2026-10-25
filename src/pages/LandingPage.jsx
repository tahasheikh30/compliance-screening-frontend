import { useEffect, useRef, useState } from "react";
import { Link, ROUTES, arrivedByNavigation } from "../lib/nav";
import PublicHeader from "../components/PublicHeader";
import SiteFooter from "../components/SiteFooter";
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
  "Politically exposed persons (national and provincial)",
  "Open news search",
];

const POINTS = [
  {
    key: "01 / COVERAGE",
    title: "Every list in one search",
    copy: "One name is checked against the UN, OFAC, UK, FIA Red Book and NACTA lists and for politically exposed persons (national and provincial), plus an open news search.",
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

const STEPS = [
  { key: "STEP 1", title: "Enter the applicant", copy: "A name is enough. A CNIC, father or husband, birth date and province make the evidence sharper." },
  { key: "STEP 2", title: "Every source is checked", copy: "The lists, the PEP data and the news search run at once. One that fails never stops the rest." },
  { key: "STEP 3", title: "One verdict", copy: "Escalate, Review or Clear, with a card per source and the reasons for the result." },
  { key: "STEP 4", title: "You decide and record it", copy: "Mark the case cleared, confirmed or escalated with a note. The result itself is never changed." },
];

const VERDICTS = [
  { key: "ESCALATE", tone: "bad", title: "A watch list match", copy: "A name or CNIC matches a sanctions or watch list. Pass it to compliance and verify identity against the source record." },
  { key: "REVIEW", tone: "warn", title: "Needs a person's eye", copy: "Adverse news, a possible politically exposed person, or a source that could not be fully read." },
  { key: "CLEAR", tone: "good", title: "Screened, nothing found", copy: "Every source was read and nothing was found. Anything not screened is never reported as clear." },
];

const AI_POINTS = [
  { key: "URDU", title: "Names in Urdu script", copy: "Type a name in Urdu. Every likely English spelling is screened against the lists, and each spelling is labelled with where it came from." },
  { key: "CLOSE NAMES", title: "Near matches, explained", copy: "Names just under the threshold are read and marked as the same person, possibly, or probably someone else, with a short reason." },
  { key: "NEWS", title: "Adverse media, read", copy: "Articles are read for namesakes and the type of risk, so a reviewer starts with what matters." },
  { key: "WEB", title: "Politically exposed persons", copy: "Public offices, relatives and close associates are looked up on the open web. Every finding shows its sources and its confidence." },
  { key: "MEMO", title: "A case memo to approve", copy: "A numbered evidence list and a draft memo for the officer to edit and approve, then download as a PDF." },
  { key: "ASK", title: "Ask your own history", copy: "Ask in plain words, such as which cases needed attention this month. The filters used are shown back, and only your own cases are searched." },
];

const TEAM_POINTS = [
  { key: "BATCH", title: "Screen a whole file", copy: "Upload up to 500 applicants from Excel, CSV or Word and get every verdict, with results and evidence to download." },
  { key: "MONITORING", title: "Keep watching", copy: "People you choose are screened again whenever a list changes, with alerts for any new potential match." },
  { key: "EVIDENCE", title: "Evidence you can prove", copy: "Each evidence PDF carries a stored SHA-256 fingerprint, so an altered copy can be detected." },
  { key: "AUDIT", title: "A tamper evident trail", copy: "Who did what is recorded in a chained log that never holds an applicant's name or CNIC." },
];

function Steps({ items }) {
  return (
    <ol className="lp-steps">
      {items.map((p, i) => (
        <li key={p.key} className="lp-step">
          <span className="lp-step-num" aria-hidden="true">{i + 1}</span>
          <h3>{p.title}</h3>
          <p>{p.copy}</p>
        </li>
      ))}
    </ol>
  );
}

function VerdictTabs({ items }) {
  const [i, setI] = useState(0);
  const v = items[i];
  return (
    <div className="lp-verdicts">
      <div role="tablist" aria-label="Verdicts" className="lp-vtabs">
        {items.map((x, n) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            id={`lp-vtab-${n}`}
            aria-selected={n === i}
            aria-controls="lp-vpanel"
            tabIndex={n === i ? 0 : -1}
            className={`lp-vtab${n === i ? " is-on" : ""}`}
            onClick={() => setI(n)}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const m = (n + d + items.length) % items.length;
              setI(m);
              document.getElementById(`lp-vtab-${m}`)?.focus();
            }}
          >
            {x.key[0] + x.key.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="lp-vpanel" aria-labelledby={`lp-vtab-${i}`} className="lp-vpanel">
        <span className={`stamp stamp-large stamp-${v.tone}`}>{v.key[0] + v.key.slice(1).toLowerCase()}</span>
        <div>
          <h3>{v.title}</h3>
          <p>{v.copy}</p>
        </div>
      </div>
    </div>
  );
}

function Carousel({ items, label }) {
  const track = useRef(null);
  const move = (dir) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy?.({ left: dir * Math.max(280, el.clientWidth * 0.8), behavior: "smooth" });
  };
  return (
    <div className="lp-carousel" role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="lp-car-nav">
        <button type="button" className="lp-btn lp-btn-quiet lp-car-btn" onClick={() => move(-1)} aria-label="Previous">←</button>
        <button type="button" className="lp-btn lp-btn-quiet lp-car-btn" onClick={() => move(1)} aria-label="Next">→</button>
      </div>
      <ul className="lp-track" ref={track} tabIndex={0} aria-label={`${label}, scroll sideways`}>
        {items.map((p, n) => (
          <li key={p.key} className="lp-slide">
            <span className="lp-slide-n">{String(n + 1).padStart(2, "0")}</span>
            <span className="lp-label lp-label-gold">{p.key}</span>
            <h3>{p.title}</h3>
            <p>{p.copy}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Rows({ items }) {
  return (
    <dl className="lp-rows2">
      {items.map((p) => (
        <div key={p.key} className="lp-row2">
          <dt>{p.title}</dt>
          <dd>{p.copy}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function LandingPage() {
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

      <PublicHeader />

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
              NACTA lists, for politically exposed persons (national and
              provincial) and with an open news search. Get a clear verdict, with the
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
            <div>
              <p className="lp-label lp-label-gold">A clearer process</p>
              <h2 id="lp-how-title">Signal, not noise.</h2>
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

        <section className="lp-section" aria-labelledby="lp-steps-title">
          <div className="lp-divider" />
          <div className="lp-intro">
            <div>
              <p className="lp-label lp-label-gold">From name to verdict</p>
              <h2 id="lp-steps-title">Four steps, one record.</h2>
            </div>
            <p className="lp-intro-copy">
              Every screening follows the same path, so every case can be read, checked and defended the same way.
            </p>
          </div>
          <Steps items={STEPS} />
        </section>

        <section className="lp-section" aria-labelledby="lp-verdicts-title">
          <div className="lp-divider" />
          <div className="lp-intro">
            <div>
              <p className="lp-label lp-label-gold">Three verdicts</p>
              <h2 id="lp-verdicts-title">What the result means.</h2>
            </div>
          </div>
          <VerdictTabs items={VERDICTS} />
        </section>

        <section id="ai" className="lp-section" aria-labelledby="lp-ai-title">
          <div className="lp-divider" />
          <div className="lp-intro">
            <div>
              <p className="lp-label lp-label-gold">AI search, optional</p>
              <h2 id="lp-ai-title">Looks where the lists can’t.</h2>
            </div>
            <p className="lp-intro-copy">
              When an administrator switches it on, AI search goes beyond the published lists: it reads Urdu names, close
              matches and news, searches the open web, and drafts the paperwork. It only suggests. A person decides.
            </p>
          </div>
          <Carousel items={AI_POINTS} label="AI search features" />
        </section>

        <section className="lp-band" aria-labelledby="lp-ai-safe-title">
          <div>
            <p className="lp-label lp-label-gold">AI safeguards</p>
            <h2 id="lp-ai-safe-title">It can add caution, never remove it.</h2>
            <p>
              AI can move a clear result to manual review, but it can never clear a case or change a stored result. The
              CNIC and the full date of birth are never sent to it, everything it finds is labelled to be verified, and
              the application works as before when it is off.
            </p>
          </div>
          <span className="lp-pill lp-pill-solid">Never clears anyone</span>
        </section>

        <section className="lp-section" aria-labelledby="lp-team-title">
          <div className="lp-divider" />
          <div className="lp-intro">
            <div>
              <p className="lp-label lp-label-gold">Built for the team</p>
              <h2 id="lp-team-title">More than a single search.</h2>
            </div>
          </div>
          <Rows items={TEAM_POINTS} />
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
              An internal tool of the Compliance department at IGI Holdings, for account-opening AML/KYC screening. It shows what was
              checked, what was found, and what could not be checked.
            </p>
          </div>
        </section>

        <section className="lp-band lp-final" aria-labelledby="lp-final-title">
          <div>
            <h2 id="lp-final-title">Ready to screen an applicant?</h2>
            <p>Sign in to start, or request an account. An administrator approves every request.</p>
          </div>
          <div className="lp-cta">
            <Link to={ROUTES.signIn} className="lp-btn lp-btn-primary">Sign in</Link>
            <Link to={ROUTES.requestAccess} className="lp-btn lp-btn-quiet">Request an account</Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
