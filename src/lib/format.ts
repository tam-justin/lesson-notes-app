/** "Oct 2, 2026" from a YYYY-MM-DD lesson date. */
export const fmtDate = (d: string) =>
  new Date(`${d}T00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

/** "6:28 PM" from a timestamp. */
export const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
