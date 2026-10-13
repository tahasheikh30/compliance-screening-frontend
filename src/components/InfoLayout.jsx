import { useEffect, useRef } from "react";
import { arrivedByNavigation } from "../lib/nav";
import PublicHeader from "./PublicHeader";
import SiteFooter from "./SiteFooter";
import "../landing.css";
import "../info.css";

/**
 * The frame for a public information page: the landing page's backdrop and header, a main area that takes
 * focus when the person arrives from another screen, and the site footer. It sets the tab title too.
 */
export default function InfoLayout({ title, current, children }) {
  const mainRef = useRef(null);

  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | Sentinel by Packages`;
    window.scrollTo?.({ top: 0, left: 0, behavior: "instant" });
    if (arrivedByNavigation()) mainRef.current?.focus({ preventScroll: true });
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div className="landing">
      <a className="lp-skip" href="#lp-main">
        Skip to content
      </a>
      <div className="lp-glow" aria-hidden="true" />
      <div className="lp-grid" aria-hidden="true" />
      <PublicHeader current={current} />
      <main
        id="lp-main"
        ref={mainRef}
        tabIndex={-1}
        className="lp-frame lp-main info-main"
      >
        {children}
      </main>
      <SiteFooter inPlace />
    </div>
  );
}
