/**
 * architectQuery.ts — Deterministic natural-language → Set Architect params.
 *
 * Same philosophy as the Recall conversation parser: no model, instant, exact.
 * Maps a plain-English brief ("90 min peak-time techno set, 128–132, build the
 * energy") onto a partial ArchitectParams the modal merges into its form.
 */

import type { ArchitectParams, SetVibe, VenueType, EnergyCurveType } from '../types'

export type SlotTime = 'early' | 'peak' | 'late' | 'closing'

export interface ArchitectQueryResult {
  params: Partial<ArchitectParams>
  /** Human summary of what was understood, for an inline confirmation. */
  summary: string
}

export function parseArchitectQuery(raw: string): ArchitectQueryResult {
  const q = raw.toLowerCase().trim()
  const params: Partial<ArchitectParams> = {}
  const notes: string[] = []
  if (!q) return { params, summary: '' }

  // ── Duration ────────────────────────────────────────────────────────────
  let duration: number | undefined
  const hm = q.match(/(\d+)[\s-]*h(?:ours?|rs?)?[\s-]*(\d+)[\s-]*m/)
  const decimalH = q.match(/(\d+(?:\.\d+)?)[\s-]*(?:h|hr|hrs|hours?)\b/)
  const mins = q.match(/(\d+)[\s-]*(?:minutes?|mins?|m)\b/)
  if (hm) duration = +hm[1] * 60 + +hm[2]
  else if (decimalH) duration = Math.round(parseFloat(decimalH[1]) * 60)
  else if (mins) duration = +mins[1]
  else if (/\b(an hour|one hour|1 hour)\b/.test(q)) duration = 60
  else if (/\b(two hours|2 hours|a couple hours)\b/.test(q)) duration = 120
  if (duration != null && duration >= 15 && duration <= 480) {
    params.targetDuration = duration
    notes.push(`${duration} min`)
  }

  // ── BPM ─────────────────────────────────────────────────────────────────
  const range = q.match(/(\d{2,3})\s*(?:-|–|—|to|and)\s*(\d{2,3})\s*(?:bpm)?/)
  const around = q.match(/\b(?:around|about|near|at|~)\s*(\d{2,3})\b/)
  const single = q.match(/(\d{2,3})\s*bpm/)
  if (range && +range[1] >= 60 && +range[2] <= 210) {
    params.bpmMin = Math.min(+range[1], +range[2])
    params.bpmMax = Math.max(+range[1], +range[2])
    notes.push(`${params.bpmMin}–${params.bpmMax} BPM`)
  } else {
    const m = single ?? around
    if (m) {
      const t = +m[1]
      if (t >= 60 && t <= 210) {
        params.bpmMin = t - 4
        params.bpmMax = t + 4
        notes.push(`~${t} BPM`)
      }
    }
  }

  // ── Vibe ──────────────────────────────────────────────────────────────────
  let vibe: SetVibe | undefined
  if (/\b(peak[- ]?time|peak hour|prime time|main set)\b/.test(q)) vibe = 'peak'
  else if (/\b(warm[- ]?up|opening|opener|early doors)\b/.test(q)) vibe = 'warmup'
  else if (/\b(clos(e|ing|er)|last set|end of (the )?night|after[- ]?hours)\b/.test(q)) vibe = 'closing'
  else if (/\b(festival|main stage)\b/.test(q)) vibe = 'festival'
  else if (/\b(underground|raw|hypnotic|dark|deep cuts?)\b/.test(q)) vibe = 'underground'
  else if (/\b(club night|club set|nightclub)\b/.test(q)) vibe = 'club'
  else if (/\b(mixed|all rounder|bit of everything|eclectic)\b/.test(q)) vibe = 'mixed'
  if (vibe) {
    params.vibe = vibe
    notes.push(`${vibe} vibe`)
  }

  // ── Slot time ─────────────────────────────────────────────────────────────
  let slot: SlotTime | undefined
  if (/\b(warm[- ]?up|opening|opener|early)\b/.test(q)) slot = 'early'
  else if (/\b(clos(e|ing|er)|end of (the )?night)\b/.test(q)) slot = 'closing'
  else if (/\b(late|after[- ]?hours|3am|4am|graveyard)\b/.test(q)) slot = 'late'
  else if (/\b(peak|prime time|headline)\b/.test(q)) slot = 'peak'
  if (slot) {
    params.slotTime = slot
    if (!notes.some((n) => n.includes('vibe'))) notes.push(`${slot} slot`)
  }

  // ── Venue ───────────────────────────────────────────────────────────────
  let venue: VenueType | undefined
  if (/\b(festival|main stage|outdoor stage)\b/.test(q)) venue = 'festival'
  else if (/\b(club|nightclub|warehouse)\b/.test(q)) venue = 'club'
  else if (/\b(bar|lounge|pub|cocktail)\b/.test(q)) venue = 'bar'
  else if (/\b(private|wedding|corporate|house party|birthday)\b/.test(q)) venue = 'private'
  else if (/\b(outdoor|beach|pool|rooftop|garden|terrace)\b/.test(q)) venue = 'outdoor'
  if (venue) {
    params.venueType = venue
    notes.push(`${venue} venue`)
  }

  // ── Crowd age ───────────────────────────────────────────────────────────
  if (/\b(young|students?|gen[- ]?z|teens?|18)\b/.test(q)) params.crowdAge = 'young'
  else if (/\b(mature|older|grown|40s|50s)\b/.test(q)) params.crowdAge = 'mature'
  else if (/\bmixed (crowd|ages?)\b/.test(q)) params.crowdAge = 'mixed'

  // ── Energy curve ──────────────────────────────────────────────────────────
  let curve: EnergyCurveType | undefined
  if (/\b(drop[- ]?in|straight in|start hot|hit hard|bang(ing)? from the start)\b/.test(q)) curve = 'drop-in'
  else if (/\b(plateau|sustain|keep it high|steady peak|hold the energy)\b/.test(q)) curve = 'peak-sustain'
  else if (/\b(wave|ebb and flow|up and down|peaks and valleys|dynamic|breathe)\b/.test(q)) curve = 'wave'
  else if (/\b(build|rise|rising|gradual|slow burn|ramp up|escalat)\b/.test(q)) curve = 'rise'
  if (curve) {
    params.followEnergyCurve = true
    params.energyCurveType = curve
    notes.push(`${curve} energy`)
  }

  // ── Harmonic mixing ───────────────────────────────────────────────────────
  if (/\b(harmonic|in key|key mixing|mix in key|camelot)\b/.test(q)) params.harmonicMixing = true
  else if (/\b(ignore key|no harmonic|don'?t worry about key)\b/.test(q)) params.harmonicMixing = false

  return { params, summary: notes.join(' · ') }
}
