import { Link, ROUTES } from "../../lib/nav";
import InfoLayout from "../../components/InfoLayout";

const SAFEGUARDS = [
  {
    title: "Approved access only",
    copy: "Anyone can ask for an account, but nobody can screen an applicant or see any data until an administrator approves them.",
  },
  {
    title: "Your records stay yours",
    copy: "A person sees only their own screenings and evidence. Someone else's looks exactly like one that does not exist. Administrators can see everyone's, with who ran each one.",
  },
  {
    title: "Sessions end on their own",
    copy: "After 30 minutes without activity you are signed out and asked to sign in again.",
  },
  {
    title: "Checked on every request",
    copy: "Each request carries both the app's identity and the signed-in person's identity, and anything that is not set up properly is refused rather than let through.",
  },
];

const RECORDS = [
  {
    title: "A record of who did what",
    copy: "Screenings, evidence downloads, approvals and list changes are written to an audit trail. It holds ids and outcomes, never an applicant's name or CNIC, and each entry is chained to the one before it so an altered or removed entry shows up.",
  },
  {
    title: "Evidence you can verify",
    copy: "Each evidence PDF has its SHA-256 fingerprint stored when it is made. Compare it with the file you hold to confirm nothing has changed.",
  },
  {
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
            <li key={s.title} className="lp-card info-card">
              <h3>{s.title}</h3>
              <p>{s.copy}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="info-section" aria-labelledby="info-records">
        <h2 id="info-records">What is recorded</h2>
        <ul className="info-grid info-grid-3">
          {RECORDS.map((s) => (
            <li key={s.title} className="lp-card info-card">
              <h3>{s.title}</h3>
              <p>{s.copy}</p>
            </li>
          ))}
        </ul>
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
