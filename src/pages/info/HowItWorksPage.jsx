import { Link, ROUTES } from "../../lib/nav";
import InfoLayout from "../../components/InfoLayout";

const SOURCES = [
  {
    name: "UN Security Council",
    copy: "The Consolidated List, read from the UN's own published file.",
  },
  {
    name: "OFAC",
    copy: "The US Treasury SDN and Consolidated (non-SDN) lists, including aliases.",
  },
  {
    name: "UK Sanctions List",
    copy: "The sanctions list published by the UK's FCDO.",
  },
  {
    name: "FIA Red Book",
    copy: "The editions published by Pakistan's FIA, read from fia.gov.pk.",
  },
  {
    name: "NACTA",
    copy: "Proscribed Persons under the Fourth Schedule, loaded from NACTA's published export.",
  },
  {
    name: "Politically exposed persons",
    copy: "National and provincial office holders, such as members of the assemblies and the Senate, ministers, chief ministers and governors. A PEP is flagged for enhanced review, not treated as a sanctions match.",
  },
  {
    name: "Open news search",
    copy: "Recent news that names the applicant alongside adverse words such as fraud or arrest.",
  },
];

const STEPS = [
  {
    title: "Enter the applicant",
    copy: "A full name is all that is required. A CNIC, father's name, province, date of birth and nationality are optional and add supporting evidence. Names can be typed in English or in Urdu script.",
  },
  {
    title: "Names are compared",
    copy: "Titles and common spelling variants are folded together, so MOHAMMED and MUHAMMAD are treated alike. Every primary name and alias on each list is scored, and anything at or above the match threshold is reported.",
  },
  {
    title: "Each source reports on its own",
    copy: "You get one card per source with its matches and how many records were screened. If one list cannot be read, the others still run.",
  },
  {
    title: "One verdict, with a next step",
    copy: "The sources roll up into a single verdict, and the screening is saved to History with an evidence PDF whenever something is found.",
  },
];

const AI_ADDS = [
  { name: "Urdu names", copy: "A name in Urdu script is turned into its likely English spellings, and every spelling is screened." },
  { name: "Close names", copy: "Names just under the threshold are read and marked as the same person, possibly, or probably someone else." },
  { name: "News, read", copy: "Articles are checked for namesakes and the type of risk, so a reviewer starts with what matters." },
  { name: "Web findings", copy: "Public offices, relatives and close associates of politically exposed persons, each with its sources." },
];

const AI_NEVER = [
  "It never clears a case. It can only move a clear result to Review.",
  "It never edits a stored result. Its findings sit beside the lists’ own.",
  "It never sees a CNIC or a full date of birth.",
  "Everything it finds is labelled to be verified. A person decides.",
];

const MORE = [
  { name: "Batch screening", copy: "Upload up to 500 applicants from Excel, CSV or Word. Every row is a full screening with its own case and evidence." },
  { name: "Case memo", copy: "A numbered evidence list and a draft memo to edit and approve, then download as a PDF." },
  { name: "Search your history", copy: "Filter your past screenings, or ask in plain words. The filters used are shown back, and only your own cases are searched." },
  { name: "Monitoring", copy: "People you choose are checked again whenever a list changes, and only a new potential match raises an alert." },
];

const VERDICTS = [
  {
    tone: "bad",
    name: "Escalate",
    copy: "At least one watch list has a potential match. Pass it to Compliance.",
  },
  {
    tone: "warn",
    name: "Review",
    copy: "Adverse news was found, or a source could not be fully screened. A person decides.",
  },
  {
    tone: "good",
    name: "Clear",
    copy: "Every source was screened and nothing was found.",
  },
];

export default function HowItWorksPage() {
  return (
    <InfoLayout title="How it works" current={ROUTES.howItWorks}>
      <section className="info-hero" aria-labelledby="info-title">
        <p className="lp-label lp-label-gold">How it works</p>
        <h1 id="info-title">One name, every list, one verdict.</h1>
        <p className="lp-lead">
          Sentinel checks an applicant against international and Pakistani
          watch lists and an open news search at the same moment, then tells
          you what to do next.
        </p>
      </section>

      <section className="info-section" aria-labelledby="info-sources">
        <h2 id="info-sources">What is checked</h2>
        <p className="info-intro">
          Lists are downloaded from the people who publish them and kept up to
          date, so a screening reflects the current list rather than a copy
          from months ago.
        </p>
        <ul className="info-grid info-grid-3">
          {SOURCES.map((s) => (
            <li key={s.name} className="lp-card info-card">
              <h3>{s.name}</h3>
              <p>{s.copy}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="info-section" aria-labelledby="info-steps">
        <h2 id="info-steps">From name to verdict</h2>
        <ol className="info-steps">
          {STEPS.map((s) => (
            <li key={s.title} className="info-step">
              <div>
                <h3>{s.title}</h3>
                <p>{s.copy}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="info-section" aria-labelledby="info-verdicts">
        <h2 id="info-verdicts">What the verdict means</h2>
        <ul className="info-verdicts">
          {VERDICTS.map((v) => (
            <li key={v.name} className={`info-verdict info-verdict-${v.tone}`}>
              <span className="info-verdict-name">{v.name}</span>
              <span className="info-verdict-copy">{v.copy}</span>
            </li>
          ))}
        </ul>
        <p className="info-note">
          A source that could not be read is shown as Not screened, never as
          clear. A match is a lead, not a confirmed identity: a person checks
          every one. A date of birth or nationality never removes a match, and
          a CNIC that equals a listed CNIC is reported whatever the name looks
          like.
        </p>
      </section>

      <section className="info-section" aria-labelledby="info-ai">
        <p className="lp-label lp-label-gold">Optional</p>
        <h2 id="info-ai">AI search, when it is switched on</h2>
        <p className="info-intro">
          An administrator can switch on an AI layer that looks where the lists
          cannot. It adds findings to a screening. It does not decide anything.
        </p>
        <div className="info-split">
          <dl className="info-defs">
            {AI_ADDS.map((a) => (
              <div key={a.name}>
                <dt>{a.name}</dt>
                <dd>{a.copy}</dd>
              </div>
            ))}
          </dl>
          <aside className="info-guard" aria-label="What AI never does">
            <h3>What it never does</h3>
            <ul>
              {AI_NEVER.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section className="info-section" aria-labelledby="info-more">
        <h2 id="info-more">Beyond a single screening</h2>
        <dl className="info-defs info-defs-2">
          {MORE.map((m) => (
            <div key={m.name}>
              <dt>{m.name}</dt>
              <dd>{m.copy}</dd>
            </div>
          ))}
        </dl>
        <p className="info-note">
          A screening reflects one day, so monitoring is opt-in for each
          person. Whatever the feature, the same rule holds: a source that did
          not run is never treated as clear.
        </p>
      </section>

      <section className="info-cta" aria-label="Get started">
        <div className="lp-cta">
          <Link to={ROUTES.signIn} className="lp-btn lp-btn-primary">
            Sign in
          </Link>
          <Link to={ROUTES.requestAccess} className="lp-btn lp-btn-quiet">
            Request an account
          </Link>
        </div>
      </section>
    </InfoLayout>
  );
}
