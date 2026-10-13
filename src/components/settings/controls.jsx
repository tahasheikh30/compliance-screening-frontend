import { useId } from "react";

/**
 * An on/off switch. It is a real button with role "switch", so it works with the keyboard (Space or Enter) and is
 * read out as "<label>, switch, on" by a screen reader. `label` is the accessible name; the visible title and
 * description sit beside it in SettingRow.
 */
export function Switch({ checked, onChange, label, disabled, id }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`switch${checked ? " switch-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" aria-hidden="true" />
    </button>
  );
}

/** One setting: a title and what it does on the left, the control on the right. */
export function SettingRow({ title, description, children, locked }) {
  return (
    <div className={`setting-row${locked ? " setting-row-locked" : ""}`}>
      <div className="setting-text">
        <p className="setting-title">{title}</p>
        {description && <p className="setting-desc">{description}</p>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

/** A group of settings under a heading. */
export function SettingGroup({ title, hint, children, danger }) {
  const id = useId();
  return (
    <section
      className={`setting-group${danger ? " setting-group-danger" : ""}`}
      aria-labelledby={id}
    >
      <h3 id={id}>{title}</h3>
      {hint && <p className="setting-hint">{hint}</p>}
      {children}
    </section>
  );
}
