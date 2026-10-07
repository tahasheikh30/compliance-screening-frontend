import { useEffect, useRef, useState } from "react";
import { useIsBusy } from "../lib/activity";

// Quick actions finish before anyone could read a loader, and a flash of one feels worse than none.
// So it appears only after SHOW_DELAY_MS, and once shown stays at least MIN_VISIBLE_MS.
const SHOW_DELAY_MS = 250;
const MIN_VISIBLE_MS = 600;

function useDelayedVisibility(active) {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    let timer;
    if (active && !visible) {
      timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, SHOW_DELAY_MS);
    } else if (!active && visible) {
      const remaining = Math.max(
        0,
        MIN_VISIBLE_MS - (Date.now() - shownAt.current),
      );
      timer = setTimeout(() => setVisible(false), remaining);
    }
    return () => clearTimeout(timer);
  }, [active, visible]);
  return visible;
}

/** A magnifying glass searching a page. Used by the loader and by the full screen waiting messages. */
export function SearchingGlass({ size = 44 }) {
  return (
    <svg
      className="glass-spin"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <rect
        className="glass-spin-page"
        x="6"
        y="6"
        width="30"
        height="36"
        rx="3"
      />
      <line className="glass-spin-line" x1="12" y1="15" x2="30" y2="15" />
      <line className="glass-spin-line" x1="12" y1="22" x2="30" y2="22" />
      <line className="glass-spin-line" x1="12" y1="29" x2="24" y2="29" />
      <g className="glass-spin-lens">
        <circle cx="26" cy="26" r="9" />
        <line x1="32.5" y1="32.5" x2="42" y2="42" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/**
 * One loader for the whole app: a bar across the top and a small badge with a searching magnifying
 * glass, shown whenever a request or a tab is loading. It never blocks clicks.
 */
export default function GlobalLoader() {
  const visible = useDelayedVisibility(useIsBusy());
  if (!visible) return null;
  return (
    <div
      className="gl"
      role="progressbar"
      aria-label="Loading"
      aria-busy="true"
    >
      <div className="gl-bar" />
      <div className="gl-badge">
        <SearchingGlass />
        <span>Working...</span>
      </div>
    </div>
  );
}
