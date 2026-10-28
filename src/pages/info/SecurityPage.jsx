import { Link, ROUTES } from "../../lib/nav";
import InfoLayout from "../../components/InfoLayout";

// Small line icons for the cards and the timeline. Decorative: the text beside each one says everything.
const ICONS = {
  approve: <><path d="M12 3l7 3v5c0 4.4-2.9 8.3-7 9.5C7.9 19.3 5 15.4 5 11V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></>,
  records: <><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2.5h6.5A1.5 1.5 0 0 1 20 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /><path d="M10 14.5h4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  check: <><path d="M5 12.5l4.2 4.2L19 7" /><path d="M3.5 5.5h6M3.5 18.5h6" /></>,
  trail: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.2" /><circle cx="4.5" cy="12" r="1.2" /><circle cx="4.5" cy="18" r="1.2" /></>,
  fingerprint: <><path d="M6.5 10.5a5.5 5.5 0 0 1 11 0v2" /><path d="M9 20c.8-1.6 1-3 1-5v-4.5a2 2 0 0 1 4 0V15c0 2 .4 3.4 1.2 5" /><path d="M4.5 14.5v-2" /><path d="M19.5 14.5v-2" /></>,
  nolog: <><path d="M5 5h14v14H5z" /><path d="M8.5 9.5h7M8.5 13h4" /><path d="M3.5 20.5l17-17" /></>,
};

function Icon({ name }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const SAFEGUARDS = [
  {
    icon: "approve",
    title: "Approved access only",
    copy: "Anyone can ask for an account, but nobody can screen an applicant or see any data until an administrator approves them.",
  },
  {
    icon: "records",
    title: "Your records stay yours",
    copy: "A person sees only their own screenings and evidence. Someone else's looks exactly like one that does not exist. Administrators can see everyone's, with who ran each one.",
  },
  {
    icon: "clock",
    title: "Sessions end on their own",
    copy: "After 30 minutes without activity you are signed out and asked to sign in again.",
  },
  {
    icon: "check",
    title: "Checked on every request",
    copy: "Each request carries both the app's identity and the signed-in person's identity, and anything that is not set up properly is refused rather than let through.",
  },
];

const RECORDS = [
  {
    icon: "trail",
    tag: "Audit trail",
    title: "A record of who did what",
    copy: "Screenings, evidence downloads, approvals and list changes are written to an audit trail. It holds ids and outcomes, never an applicant's name or CNIC, and each entry is chained to the one before it so an altered or removed entry shows up.",
  },
  {
    icon: "fingerprint",
    tag: "SHA-256",
    title: "Evidence you can verify",
    copy: "Each evidence PDF has its SHA-256 fingerprint stored when it is made. Compare it with the file you hold to confirm nothing has changed.",
  },
  {
    icon: "nolog",
    tag: "Logs",
    title: "No personal data in logs",
    copy: "Request contents are never logged, error messages never repeat what was typed, and applicant data is never cached by the browser.",
  },
];

const AI = [
  { name: "Off until an administrator turns it on", copy: "AI search is optional. It needs a key held only on the server, and an administrator can switch it, or any single feature, off at any time." },
  { name: "Only what a check needs leaves", copy: "A name, nationality, province, father’s or husband’s name and birth year may be sent. A CNIC and a full date of birth never are, and free text is scrubbed of them first." },
  { name: "Treated as untrusted", copy: "Everything the AI returns must fit a strict format, is cleaned, can only point at evidence it was given, and gets links only from the engine’s own citations." },
  { name: "It can only add caution", copy: "AI can move a clear result to manual review. It cannot clear a case, change a stored result or approve a memo. A person decides." },
  { name: "Limited and provider restricted", copy: "Calls are capped per day and per person, a provider outage pauses AI without stopping a screening, and providers are asked not to keep or train on the data." },
];

const SITE = [
  "These public pages load files only from this site, with no third-party scripts, fonts or images.",
  "Links to other websites open in a new tab and send no referrer.",
  "The server only fetches lists over https and refuses internal addresses, and its dependencies and code are scanned on every change.",
  "Requests are rate limited for each signed in person. When the service runs on more than one server, the limits are shared, and every response names the server that answered so a request can be traced.",
];

export default function SecurityPage() {
  return (
    <InfoLayout title="Security" current={ROUTES.security}>
      <section className="info-hero" aria-labelledby="info-title">
        <p className="lp-label lp-label-gold">Security</p>
        <h1 id="info-title">Applicant data is handled with care.</h1>
        <p className="lp-lead">
          Screening means handling names and CNICs. Here is how access is
          controlled, what is recorded, and what this site does not do.
        </p>
        <p className="lp-trust">Approved access only</p>
      </section>

      <section className="info-section" aria-labelledby="info-access">
        <h2 id="info-access">Who can see what</h2>
        <ul className="info-grid info-grid-2">
          {SAFEGUARDS.map((s) => (
            <li key={s.title} className="info-safeguard">
              <span className="info-safeguard-icon"><Icon name={s.icon} /></span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.copy}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="info-section" aria-labelledby="info-records">
        <h2 id="info-records">What is recorded</h2>
        <p className="info-intro">Each record builds on the one before it, so nothing can change quietly.</p>
        <ol className="info-ledger">
          {RECORDS.map((s) => (
            <li key={s.title} className="info-ledger-item">
              <span className="info-ledger-node"><Icon name={s.icon} /></span>
              <div className="info-ledger-body">
                <span className="info-ledger-tag">{s.tag}</span>
                <h3>{s.title}</h3>
                <p>{s.copy}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="info-section" aria-labelledby="info-ai">
        <p className="lp-label lp-label-gold">Optional</p>
        <h2 id="info-ai">AI search and your data</h2>
        <p className="info-intro">
          When AI search is switched on, these rules apply to every feature. Only
          counts of calls, tokens and cost are kept about its use, never the content.
        </p>
        <dl className="info-defs">
          {AI.map((a) => (
            <div key={a.name}>
              <dt>{a.name}</dt>
              <dd>{a.copy}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="info-section" aria-labelledby="info-site">
        <h2 id="info-site">This site</h2>
        <ul className="info-list">
          {SITE.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="info-note">
          For how personal data and cookies are handled, read the{" "}
          <Link to={ROUTES.privacy}>privacy policy</Link> and the{" "}
          <Link to={ROUTES.cookies}>cookie notice</Link>.
        </p>
      </section>
    </InfoLayout>
  );
}
