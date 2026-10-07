import { Link, ROUTES } from "../lib/nav";
import { MagnifyingGlassIcon } from "./ui";

// The links in the header of every public page. Each one is a page of its own.
export const PUBLIC_NAV = [
  { to: ROUTES.howItWorks, label: "How it works" },
  { to: ROUTES.security, label: "Security" },
  { to: ROUTES.about, label: "About" },
];

/** The header shared by the landing page and the public information pages. `current` is the page's route. */
export default function PublicHeader({ current }) {
  return (
    <header className="lp-frame">
      <div className="lp-header">
        <Link
          to={ROUTES.landing}
          className="lp-wordmark"
          aria-label="Sentinel by Packages home"
        >
          <span className="brand-mark">
            <MagnifyingGlassIcon size={20} />
          </span>
          <span>Sentinel by Packages</span>
        </Link>
        <nav className="lp-nav" aria-label="Primary">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={current === item.to ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          <Link to={ROUTES.signIn} className="btn btn-ghost lp-nav-signin">
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
