/**
 * DESIGN PREVIEW ONLY. The batch backend does not exist yet, so this stands in for it and produces
 * made up rows so every screen state can be reviewed. When the real endpoint is ready, replace the
 * call to simulateBatch() in BatchScreening.jsx with the real request and delete this file.
 *
 * Nothing here reads the uploaded file or contacts a server. The names are placeholders.
 */

const SAMPLE = [
  ['Sample applicant 01', 'AUTO_CLEAR', 0, 0],
  ['Sample applicant 02', 'ESCALATE_TO_COMPLIANCE', 2, 1],
  ['Sample applicant 03', 'AUTO_CLEAR', 0, 0],
  ['Sample applicant 04', 'MANUAL_REVIEW', 0, 2],
  ['Sample applicant 05', 'AUTO_CLEAR', 0, 0],
  ['Sample applicant 06', 'AUTO_CLEAR', 0, 0],
  ['Sample applicant 07', 'MANUAL_REVIEW', 1, 0],
  ['Sample applicant 08', 'AUTO_CLEAR', 0, 0],
  ['Sample applicant 09', 'ESCALATE_TO_COMPLIANCE', 1, 0],
  ['Sample applicant 10', 'AUTO_CLEAR', 0, 0],
  ['Sample applicant 11', 'AUTO_CLEAR', 0, 1],
  ['Sample applicant 12', 'AUTO_CLEAR', 0, 0],
].map(([full_name, overall_status, sanctions, news], i) => ({ row: i + 1, full_name, overall_status, sanctions, news }))

/** Pretends to screen the rows one by one. Returns a function that cancels it. */
export function simulateBatch({ onProgress, onDone, stepMs = 280 }) {
  const total = SAMPLE.length
  let done = 0
  onProgress({ done, total })
  const timer = setInterval(() => {
    done += 1
    onProgress({ done, total })
    if (done >= total) {
      clearInterval(timer)
      onDone(SAMPLE)
    }
  }, stepMs)
  return () => clearInterval(timer)
}
