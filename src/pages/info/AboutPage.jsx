import { useState } from "react";
import InfoLayout from "../../components/InfoLayout";
import { ROUTES } from "../../lib/nav";

// IGI Holdings' operating companies and their current leadership. Update this list (and drop matching
// images into /public/assets) whenever leadership changes - everything else on the page is driven from here.
const LEADERSHIP = [
  {
    name: "Faisal Khan",
    role: "CEO, IGI General Insurance",
    blurb: "Property, motor, marine and other non-life cover for individuals and businesses.",
    img: "/assets/faisal-khan.jpg",
  },
  {
    name: "Ali Nadeem",
    role: "CEO, IGI Life",
    blurb: "Life and health protection, savings and retirement plans.",
    img: "/assets/ali-nadeem.jpg",
  },
  {
    name: "Raza Hussain Rizvi",
    role: "CEO, IGI Securities",
    blurb: "Brokerage and equity market access for retail and institutional clients.",
    img: "/assets/raza-hussain-rizvi.jpg",
  },
];

// Facts from the Packages Limited and Nestlé Pakistan board profiles and PACRA rating reports.
const HYDER_ALI = {
  name: "Syed Hyder Ali",
  role: "Managing Director & CEO, Packages Limited. CEO, IGI Holdings",
  img: "/assets/syed-hyder-ali.jpg",
  summary:
    "Syed Hyder Ali joined Packages Limited in July 1987 and today leads both Packages Limited and IGI Holdings as chief executive. A chemical engineer by training, he spent his early career in paper production and packaging, including work on the pulp and paper mill that uses wheat straw as its raw material.",
  facts: [
    {
      label: "Education",
      value:
        "BSc Chemical Engineering, University of Michigan (1979); MSc in paper chemistry (1981); Management Development Program, Harvard Business School (1997).",
    },
    {
      label: "Group boards",
      value:
        "Nestlé Pakistan, Sanofi-Aventis Pakistan, Tetra Pak Pakistan, Tri-Pack Films, Packages Lanka, IGI General Insurance and IGI Life, among others.",
    },
    {
      label: "Education and philanthropy",
      value:
        "Board roles with LUMS, the Babar Ali Foundation, Ali Institute of Education, Pakistan Centre for Philanthropy, National Management Foundation and WWF-Pakistan. Trustee of the Packages Foundation.",
    },
    {
      label: "Industry",
      value:
        "Member of the Pakistan Business Council and the International Chamber of Commerce Pakistan.",
    },
  ],
};

// The wider Packages Group companies IGI Holdings sits alongside. IGI's own entities are covered in the
// leadership grid above, so this is the rest of the group. Tones come from the app's own palette.
const SECTOR_TONE = {
  "Packaging & Paper": "var(--manila)",
  "Films & Materials": "var(--tone-warn)",
  Pharmaceuticals: "var(--tone-good)",
  "Real Estate & Trading": "var(--link-dark)",
};

const GROUP_COMPANIES = [
  {
    name: "Packages Limited",
    sector: "Packaging & Paper",
    blurb: "The group's founding company, started in 1956 as a joint venture with Sweden's Akerlund & Rausing; grew from a single carton unit into one of Pakistan's largest conglomerates.",
  },
  {
    name: "Packages Convertors Limited",
    sector: "Packaging & Paper",
    blurb: "A leading Pakistani packaging solutions provider, producing packaging materials and tissue products.",
  },
  {
    name: "Bulleh Shah Packaging",
    sector: "Packaging & Paper",
    blurb: "Produces paper & board and corrugated packaging, with a focus on responsible packaging for local brands.",
  },
  {
    name: "Packages Lanka",
    sector: "Packaging & Paper",
    blurb: "A Sri Lanka-based joint venture near Colombo, and the country's leading flexible packaging manufacturer.",
  },
  {
    name: "Chantler Packages",
    sector: "Packaging & Paper",
    blurb: "A flexible packaging manufacturer in Mississauga, Canada, serving the food industry.",
  },
  {
    name: "Tri-Pack Films Limited",
    sector: "Films & Materials",
    blurb: "Pakistan's top manufacturer of BOPP and CPP packaging films.",
  },
  {
    name: "DIC Pakistan",
    sector: "Films & Materials",
    blurb: "Pakistan's largest printing ink manufacturer, a joint venture with Japan's DIC Asia Pacific.",
  },
  {
    name: "OmyaPack",
    sector: "Films & Materials",
    blurb: "Producer of industrial minerals and specialty chemicals, a joint venture with Switzerland's Omya.",
  },
  {
    name: "StarchPack",
    sector: "Films & Materials",
    blurb: "A Kasur-based facility producing corn-derived starches used across food, paper and pharma industries.",
  },
  {
    name: "Hoechst Pakistan Limited",
    sector: "Pharmaceuticals",
    blurb: "A pharmaceutical company with a 55+ year legacy of improving healthcare in Pakistan.",
  },
  {
    name: "Packages Mall",
    sector: "Real Estate & Trading",
    blurb: "A large Lahore shopping mall with retail, dining and cinema outlets, built on Packages' own site.",
  },
  {
    name: "Packages Trading FZCO",
    sector: "Real Estate & Trading",
    blurb: "Packages Limited's first UAE subsidiary, handling import, export, distribution and warehousing.",
  },
];

// The group's five core values, as published in its Code of Conduct. The colours match the segments of
// the values ribbon graphic (/assets/core-values.png).
const CORE_VALUES = [
  { name: "Care", color: "#C3D62E", blurb: "Fairness and consideration run through everything the group does." },
  { name: "Respect", color: "#29ABE2", blurb: "Everyone is treated with respect and dignity." },
  { name: "Lead", color: "#E63946", blurb: "Aspiring to lead in everything the group takes on." },
  { name: "Honesty", color: "#F5A93F", blurb: "Truthfulness, integrity and trust underpin every activity." },
  { name: "Courage", color: "#9C2D91", blurb: "The willingness to speak up and make bold, principled decisions." },
];

function initials(name) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Shows the photo; if the file is missing or fails to load, shows initials instead of a broken image icon.
function Portrait({ name, img, className }) {
  const [failed, setFailed] = useState(false);
  if (img && !failed) {
    return (
      <img
        src={img}
        alt={name}
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className={`${className} info-avatar`} role="img" aria-label={name}>
      {initials(name)}
    </div>
  );
}

// Hides an illustration that is not there yet rather than showing a broken image.
function OptionalImage({ src, alt, className }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}

export default function AboutPage() {
  return (
    <InfoLayout title="About" current={ROUTES.about}>
      <section className="info-hero" aria-labelledby="info-title">
        <p className="lp-label lp-label-gold">About</p>
        <h1 id="info-title">Confidence without the theatre.</h1>
        <p className="lp-lead">
          Sentinel is an internal tool of the Compliance department at IGI
          Holdings, for account-opening AML/KYC screening. It shows what was
          checked, what was found, and what could not be checked.
        </p>
      </section>

      <section className="info-section" aria-labelledby="about-founder">
        <div className="info-profile">
          <Portrait
            name="Syed Babar Ali"
            img="/assets/syed-babar-ali.png"
            className="info-profile-photo"
          />
          <div>
            <p className="lp-label lp-label-gold">In tribute to</p>
            <h2 id="about-founder">Syed Babar Ali</h2>
            <p className="info-role">Founder, Packages Group</p>
            <p className="info-body">
              Syed Babar Ali was born in Lahore in 1926 and trained as a
              chemical engineer before joining the family business in 1953,
              building it into Packages Limited. He went on to found or
              co-found Milkpak (now Nestlé Pakistan), IGI Insurance, IGI
              Investment Bank, and Tri Pack Films, often through joint
              ventures with major multinationals. Beyond business, he founded
              the Lahore University of Management Sciences in 1985 and
              remained a lifelong advocate for education and philanthropy in
              Pakistan. IGI Holdings grew out of that same founding vision:
              institutions built to last, run with discipline and integrity.
            </p>
            <p className="info-body">
              This system is a small, practical extension of that principle:
              using accurate, well-organized data to help the people who keep
              the company running do their work a little better.
            </p>
          </div>
        </div>
      </section>

      <section className="info-section" aria-labelledby="about-hyder">
        <div className="info-profile">
          <Portrait
            name={HYDER_ALI.name}
            img={HYDER_ALI.img}
            className="info-profile-photo"
          />
          <div>
            <p className="lp-label lp-label-gold">Leading the group today</p>
            <h2 id="about-hyder">{HYDER_ALI.name}</h2>
            <p className="info-role">{HYDER_ALI.role}</p>
            <p className="info-body">{HYDER_ALI.summary}</p>
            <dl className="info-facts">
              {HYDER_ALI.facts.map((f) => (
                <div key={f.label} className="info-fact">
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="info-section" aria-labelledby="about-igi">
        <h2 id="about-igi">IGI Holdings</h2>
        <p className="info-intro">
          IGI Holdings is the listed holding company behind four independently
          licensed and regulated businesses - General insurance, Life
          insurance, Investments, and Securities - each run by its own
          leadership team under a shared standard of governance and service.
        </p>
        <ul className="info-grid info-grid-3">
          {LEADERSHIP.map((p) => (
            <li key={p.name} className="lp-card info-person">
              <Portrait
                name={p.name}
                img={p.img}
                className="info-person-photo"
              />
              <h3>{p.name}</h3>
              <p className="info-role">{p.role}</p>
              <p>{p.blurb}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="info-section" aria-labelledby="about-group">
        <h2 id="about-group">Part of Packages Group</h2>
        <p className="info-intro">
          IGI Holdings operates alongside {GROUP_COMPANIES.length} sister
          companies under the Packages Group umbrella - spanning packaging and
          paper, films and industrial materials, pharmaceuticals, and real
          estate, all built on the same founding principles of discipline and
          integrity.
        </p>
        <figure className="info-banner">
          <OptionalImage
            src="/assets/packages-about.jpg"
            alt="Packages Group companies"
          />
        </figure>
        <ul className="info-grid info-grid-3">
          {GROUP_COMPANIES.map((c) => (
            <li key={c.name} className="lp-card info-company">
              <span
                className="info-sector"
                style={{ "--sector": SECTOR_TONE[c.sector] }}
              >
                {c.sector}
              </span>
              <h3>{c.name}</h3>
              <p>{c.blurb}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="info-section" aria-labelledby="about-values">
        <h2 id="about-values">Our core values</h2>
        <p className="info-intro">
          Values the group holds higher than self-interest, and expects of
          every company, employee and partner acting under its name.
        </p>
        <div className="info-values">
          <OptionalImage
            src="/assets/core-values.png"
            alt="Packages Group core values: Care, Respect, Lead, Honesty, Courage"
            className="info-values-image"
          />
          <ul className="info-value-list">
            {CORE_VALUES.map((v) => (
              <li
                key={v.name}
                className="info-value"
                style={{ borderLeftColor: v.color }}
              >
                <h3>{v.name}</h3>
                <p>{v.blurb}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="info-note">
          Packages Group's mission is to raise the everyday quality of life and
          build sustainability on the triple bottom line of people, planet and
          prosperity.
        </p>
      </section>
    </InfoLayout>
  );
}
