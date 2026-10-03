import { useEffect, useRef } from 'react'

/**
 * Data handling notice as a native modal <dialog>: opened with showModal() so
 * the browser traps focus, handles Escape, and puts it above everything else.
 * closedby="any" adds click-outside dismissal where supported; the click
 * handler below does the same where it is not (Safari).
 */
export default function DataNoticeDialog({ onClose }) {
  const ref = useRef(null)

  // No cleanup that calls close(): unmounting the element already removes it
  // from the top layer, and close() would fire onClose again (React StrictMode
  // runs effects twice in development, which made the dialog vanish at once).
  // Focus lands on the heading, not the Close button at the bottom: this dialog is
  // long, and focusing the last element would open it scrolled past the title.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    dialog.querySelector('h2')?.focus({ preventScroll: true })
    dialog.scrollTop = 0
  }, [])

  function onBackdropClick(e) {
    const dialog = ref.current
    if (e.target !== dialog) return
    const r = dialog.getBoundingClientRect()
    const inside = r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right
    if (!inside) dialog.close()
  }

  return (
    <dialog
      ref={ref}
      className="notice-dialog"
      closedby="any"
      aria-labelledby="data-notice-title"
      onClose={onClose}
      onClick={onBackdropClick}
    >
      <div className="notice-body">
        <h2 id="data-notice-title" tabIndex={-1}>Data handling notice</h2>
        <p className="muted">Internal reference for staff using this tool. Not a public-facing legal document.</p>

        <h3>What this tool collects</h3>
        <p>
          The applicant's full name, and optionally a date of birth, nationality, CNIC and father's or husband's
          name. Nothing else about the applicant is collected here. These are only compared against listed
          records and shown as supporting evidence, except that a CNIC equal to a listed CNIC is reported as a match.
        </p>

        <h3>What it is used for</h3>
        <p>
          The applicant is checked against the UN Security Council list, the OFAC SDN and Consolidated lists, the
          UK Sanctions List, the FIA Red Books and the NACTA Proscribed Persons list, solely for
          account-opening AML/KYC screening. The NACTA list is a file that staff upload to the server. The result and any evidence PDF are stored on the server so a
          compliance officer can review the finding later.
        </p>

        <h3>What leaves this system</h3>
        <p>
          For the adverse media check, the backend sends the applicant's name, with a set of risk keywords, as
          a search to Google News. The list downloads do not include any applicant data. Apart from that
          search, no applicant details are sent to a third party, and this site makes no third-party requests
          from your browser.
        </p>

        <h3>Consent</h3>
        <p>
          This tool assumes the applicant has already been informed and has consented to KYC/AML screening as
          part of your organization's standard account-opening process. Do not enter data for anyone outside
          that process.
        </p>

        <h3>Legal context</h3>
        <p>
          Pakistan does not yet have a comprehensive enacted data protection law, and the Personal Data
          Protection Bill remains in draft. The Prevention of Electronic Crimes Act 2016, along with SBP/SECP
          sector regulations, currently govern relevant data handling obligations. Confirm specific retention,
          storage, and disclosure requirements with your compliance or legal team rather than relying on this
          notice alone.
        </p>

        <form method="dialog" className="notice-actions">
          <button type="submit" className="btn btn-primary">Close</button>
        </form>
      </div>
    </dialog>
  )
}
