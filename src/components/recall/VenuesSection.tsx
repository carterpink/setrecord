import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, ClipboardList } from 'lucide-react'
import { motion, AnimatePresence, stagger, slideUp } from '@/components/shared/Motion'
import type { PlaySession, VenueType } from '@/types'
import { useRecallStore } from '@/stores/recallStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { NoLibraryState } from '@/components/shared/NoLibraryState'
import { BriefPanel } from './BriefPanel'

/**
 * Venues — your rooms, place-first (Gigs is time-first). A browsable grid of the
 * venues you've played; tapping one opens the animated pre-gig Brief. This is the
 * un-buried home for venue intelligence. Cards animate in (stagger + slideUp).
 * Strings are plain English for now (i18n follow-up); inline styles keep it off
 * the in-flux global stylesheet.
 */

interface VenueCard {
  venue: string
  count: number
  lastPlayedAt?: string
  eventType?: VenueType
  city?: string
}

function aggregate(gigs: PlaySession[]): VenueCard[] {
  const map = new Map<string, VenueCard>()
  for (const g of gigs) {
    const v = g.venue?.trim()
    if (!v) continue
    const key = v.toLowerCase()
    const cur =
      map.get(key) ?? ({ venue: v, count: 0, eventType: g.eventType, city: g.city } as VenueCard)
    cur.count += 1
    if (g.performedAt && (!cur.lastPlayedAt || g.performedAt > cur.lastPlayedAt))
      cur.lastPlayedAt = g.performedAt
    if (!cur.eventType && g.eventType) cur.eventType = g.eventType
    if (!cur.city && g.city) cur.city = g.city
    map.set(key, cur)
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

function fmtDate(iso: string | undefined, locale: string): string {
  if (!iso) return ''
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

export function VenuesSection(): React.JSX.Element {
  const { i18n } = useTranslation('recall')
  const hasLibrary = useLibraryStore((s) => s.hasLibrary)
  const gigs = useRecallStore((s) => s.gigs)
  const loadGigs = useRecallStore((s) => s.loadGigs)
  const loadBrief = useRecallStore((s) => s.loadBrief)
  const activeBrief = useRecallStore((s) => s.activeBrief)
  const briefOpen = useRecallStore((s) => s.briefOpen)
  const briefLoading = useRecallStore((s) => s.briefLoading)
  const clearBrief = useRecallStore((s) => s.clearBrief)

  useEffect(() => {
    void loadGigs()
  }, [loadGigs])

  const venues = useMemo(() => aggregate(gigs), [gigs])

  if (!hasLibrary) {
    return (
      <div className="recall-section">
        <header className="recall-section-head">
          <h2 className="ss-h2">Venues</h2>
          <p className="recall-section-sub">Your rooms — tap one for a pre-gig game plan.</p>
        </header>
        <NoLibraryState body="Import your library to see the venues you've played." />
      </div>
    )
  }

  return (
    <div className="recall-section">
      <header className="recall-section-head">
        <h2 className="ss-h2">Venues</h2>
        <p className="recall-section-sub">
          Your rooms — tap one for a pre-gig game plan from your history there.
        </p>
      </header>

      {venues.length === 0 ? (
        <div className="recall-empty">
          No venues yet. Add a venue to a gig in the Gigs tab and it&apos;ll appear here.
        </div>
      ) : (
        <motion.div
          variants={stagger(0.04)}
          initial="hidden"
          animate="visible"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12
          }}
        >
          {venues.map((v) => (
            <motion.button
              key={v.venue.toLowerCase()}
              type="button"
              variants={slideUp}
              className="glass-2"
              onClick={() => void loadBrief(v.venue, v.eventType)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '14px 16px',
                textAlign: 'left',
                cursor: 'pointer',
                border: 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={16} strokeWidth={1.5} />
                <span style={{ fontWeight: 600 }}>{v.venue}</span>
              </div>
              <div className="gig-row-meta">
                <span className="gig-chip gig-chip-soft">{v.count}× played</span>
                {v.lastPlayedAt && (
                  <span className="gig-chip gig-chip-soft">
                    last {fmtDate(v.lastPlayedAt, i18n.language)}
                  </span>
                )}
                {v.eventType && <span className="gig-chip gig-chip-soft">{v.eventType}</span>}
                {v.city && <span className="gig-chip gig-chip-soft">{v.city}</span>}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  opacity: 0.75
                }}
              >
                <ClipboardList size={13} strokeWidth={1.5} /> Game plan
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {briefOpen && (
          <BriefPanel brief={activeBrief} loading={briefLoading} onClose={clearBrief} />
        )}
      </AnimatePresence>
    </div>
  )
}
