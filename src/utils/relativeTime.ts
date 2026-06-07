/** Months since an ISO date, as a human "8 months" / "1 year" / "never" string. */
export function lastPlayedLabel(iso?: string): string {
  if (!iso) return 'never'
  const months = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  )
  if (months === 0) return 'this month'
  if (months === 1) return '1 month'
  if (months < 12) return `${months} months`
  const years = Math.round(months / 12)
  return years === 1 ? '1 year' : `${years} years`
}
