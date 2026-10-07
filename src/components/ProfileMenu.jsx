import { useCallback, useEffect, useRef, useState } from "react";

const CLOSE_DELAY_MS = 180;

function Icon({ children }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/**
 * The round profile button at the right of the top bar. The menu opens on hover, and also on click or
 * tap and from the keyboard (Enter or Space on the button, Escape to close), so it does not depend on a
 * mouse. A red dot sits on the button while there are unread notifications.
 *
 * The items are always in the page and only hidden with CSS while closed, so they are never reachable by
 * Tab or a screen reader until the menu is open.
 */
export default function ProfileMenu({
  email,
  isAdmin,
  unread = 0,
  onAccount,
  onNotifications,
  onSignOut,
}) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const button = useRef(null);
  const closeTimer = useRef(null);

  const show = useCallback(() => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  }, []);
  const hideSoon = useCallback(() => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, []);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // click or tap anywhere else closes it
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!root.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  function onKeyDown(e) {
    if (e.key === "Escape" && open) {
      setOpen(false);
      button.current?.focus();
    }
  }

  function onBlur(e) {
    // keyboard focus left the whole menu
    if (!root.current?.contains(e.relatedTarget)) hideSoon();
  }

  function choose(action) {
    setOpen(false);
    action();
  }

  const initial = (email || "?").charAt(0).toUpperCase();
  const label =
    unread > 0
      ? `Account menu, ${unread} unread ${unread === 1 ? "notification" : "notifications"}`
      : "Account menu";

  return (
    <div
      ref={root}
      className={`profile${open ? " profile-open" : ""}`}
      onMouseEnter={show}
      onMouseLeave={hideSoon}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <button
        ref={button}
        type="button"
        className="profile-btn"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="profile-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{initial}</span>
        {unread > 0 && <span className="profile-dot" aria-hidden="true" />}
      </button>

      <div id="profile-panel" className="profile-panel">
        <div className="profile-card">
          <div className="profile-head">
            <span className="profile-head-email" title={email}>
              {email}
            </span>
            <span className="profile-head-role">
              {isAdmin ? "Administrator" : "User"}
            </span>
          </div>
          <div className="profile-items">
            <button
              type="button"
              className="profile-item"
              onClick={() => choose(onAccount)}
            >
              <Icon>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" />
              </Icon>
              <span>Account</span>
            </button>
            <button
              type="button"
              className="profile-item"
              onClick={() => choose(onNotifications)}
            >
              <Icon>
                <path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15z" />
                <path d="M10 21a2 2 0 0 0 4 0" />
              </Icon>
              <span>Notifications</span>
              {unread > 0 && (
                <span className="profile-count" aria-label={`${unread} unread`}>
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            <div className="profile-sep" role="separator" />
            <button
              type="button"
              className="profile-item profile-item-danger"
              onClick={() => choose(onSignOut)}
            >
              <Icon>
                <path d="M9 4H5v16h4" />
                <path d="M16 8l4 4-4 4" />
                <path d="M20 12H9" />
              </Icon>
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
