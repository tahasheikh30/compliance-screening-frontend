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

const SITE = [
  "These public pages load files only from this site, with no third-party scripts, fonts or images.",
  "Links to other websites open in a new tab and send no referrer.",
  "The server only fetches lists over https and refuses internal addresses, and its dependencies and code are scanned on every change.",
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
