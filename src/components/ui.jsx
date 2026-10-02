import { useEffect, useState } from 'react'

export function MagnifyingGlassIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
      <line x1="15.1" y1="15.1" x2="20.5" y2="20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** A rubber-stamp style label. `tone` is 'bad' | 'warn' | 'good'. */
export function Stamp({ tone = 'warn', children, large = false }) {
  return <span className={`stamp stamp-${tone} ${large ? 'stamp-large' : ''}`}>{children}</span>
}

/** Small coloured status label used inside rows. */
export function Pill({ tone = 'warn', children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}

const SCAN_SOURCES = ['UN Security Council', 'OFAC', 'UK Sanctions List', 'FIA Red Book', 'News search']

/**
 * Shown while a screening request is in flight. The backend does not report
 * progress, so this shows only what is true: what is being checked and how long
 * it has been running. Nothing here pretends to be a percentage.
 */
export function ScanningAnimation() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const pages = [15, 115, 215, 315]
  return (
    <div className="scan" role="status" aria-live="polite">
      <svg className="scan-scene" viewBox="0 0 400 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        {pages.map((x, i) => (
          <g key={x}>
            <rect className="scan-page-rect" data-page={i + 1} x={x} y="25" width="70" height="90" rx="4" />
            <rect className="scan-page-line" x={x + 12} y="45" width="46" height="4" rx="2" />
            <rect className="scan-page-line" x={x + 12} y="58" width="46" height="4" rx="2" />
            <rect className="scan-page-line" x={x + 12} y="71" width="32" height="4" rx="2" />
          </g>
        ))}
        <g className="scan-glass-group">
          <circle className="scan-glass-ring" cx="0" cy="0" r="24" />
          <line className="scan-glass-handle" x1="17" y1="17" x2="33" y2="33" />
        </g>
      </svg>
      <p className="scan-title">Downloading the latest lists and checking records</p>
      <p className="scan-sub">
        Checking {SCAN_SOURCES.join(', ')}. This usually takes 20 to 40 seconds, and is quicker when the
        lists were loaded recently. <span className="scan-clock">{seconds}s</span>
      </p>
    </div>
  )
}
