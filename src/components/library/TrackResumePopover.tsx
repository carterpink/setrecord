import { createPortal } from 'react-dom'
import { X, Award, TrendingDown } from 'lucide-react'
import { motion, modalBackdrop, modalPanel, stagger, slideUp } from '@/components/shared/Motion'
import type { Track, TrackResume } from '@/types'

/**
 * Track Résumé (Frontier 4C) — a track's lived reputation, surfaced from the
 * library context menu. Shows how often it's been played out, where it landed
 * and where it cooled, and (when Black Box reaction data exists) the rooms it
 * kills in. Animated with the house modal motion so it matches the app; inner
 * sections stagger in. Reaction context degrades gracefully to play-history.
 * Strings are plain English (i18n is a follow-up, like BriefPanel).
 */
function fmtDate(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

export function TrackResumePopover({
  track,
  resume,
  loading,
  onClose
}: {
  track: Track
  resume: TrackResume | null
  loading: boolean
  onClose: () => void
}): React.JSX.Element {
  const neverPlayed = !!resume && resume.timesPlayedLive === 0
  return createPortal(
    <motion.div
      className="gig-tracklist-overlay"
      variants={modalBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={onClose}
    >
      <motion.div
        className="gig-tracklist glass-1"
        style={{ maxWidth: 460 }}
        variants={modalPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="gig-tracklist-head">
          <div>
            <h3 className="ss-h3">Track Résumé</h3>
            <span className="recall-section-sub">
              {track.title} · {track.artist}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={1.5} />
          </button>
        </header>

        {loading || !resume ? (
          <div className="recall-empty">Reading this track&rsquo;s history…</div>
        ) : (
          <motion.div variants={stagger(0.05)} initial="hidden" animate="visible">
            <motion.p
              variants={slideUp}
              className="recall-section-sub"
              style={{ margin: '2px 0 12px', opacity: 0.95, lineHeight: 1.5 }}
            >
              {resume.narration}
            </motion.p>

            {!neverPlayed && (
              <motion.div variants={slideUp} className="gig-row-meta" style={{ marginBottom: 12 }}>
                <span className="gig-chip gig-chip-soft">
                  Played live {resume.timesPlayedLive}×
                </span>
                {resume.totalPlayCount > 0 && (
                  <span className="gig-chip gig-chip-soft">{resume.totalPlayCount} CDJ plays</span>
                )}
                {resume.lastVenue && (
                  <span className="gig-chip gig-chip-soft">
                    Last · {resume.lastVenue}
                    {resume.lastPlayedAt ? ` · ${fmtDate(resume.lastPlayedAt)}` : ''}
                  </span>
                )}
              </motion.div>
            )}

            {resume.hasReactionData && resume.bestContext?.avgReaction != null && (
              <motion.div variants={slideUp} style={{ marginBottom: 12 }}>
                <div
                  className="gig-chip"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: 'var(--accent)'
                  }}
                >
                  <Award size={13} strokeWidth={1.5} />
                  Lands hardest at {resume.bestContext.label} ·{' '}
                  {Math.round(resume.bestContext.avgReaction * 10)}/10
                </div>
                {resume.worstContext?.avgReaction != null &&
                  resume.worstContext.label !== resume.bestContext.label && (
                    <div
                      className="gig-chip"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        marginLeft: 6,
                        color: 'var(--text-tertiary)'
                      }}
                    >
                      <TrendingDown size={13} strokeWidth={1.5} />
                      Cools at {resume.worstContext.label} ·{' '}
                      {Math.round(resume.worstContext.avgReaction * 10)}/10
                    </div>
                  )}
              </motion.div>
            )}

            {resume.venues.length > 0 && (
              <motion.section variants={slideUp} style={{ marginBottom: 12 }}>
                <div className="recall-section-sub" style={{ fontWeight: 600, marginBottom: 6 }}>
                  Where you&rsquo;ve played it
                </div>
                <div className="gig-row-meta">
                  {resume.venues.map((v) => (
                    <span key={v.label} className="gig-chip gig-chip-soft">
                      {v.label} ×{v.count}
                      {v.avgReaction != null ? ` · ${Math.round(v.avgReaction * 10)}/10` : ''}
                    </span>
                  ))}
                </div>
              </motion.section>
            )}

            {resume.byEventType.length > 0 && (
              <motion.section variants={slideUp}>
                <div className="recall-section-sub" style={{ fontWeight: 600, marginBottom: 6 }}>
                  By event type
                </div>
                <div className="gig-row-meta">
                  {resume.byEventType.map((e) => (
                    <span key={e.label} className="gig-chip gig-chip-soft">
                      {e.label} ×{e.count}
                    </span>
                  ))}
                </div>
              </motion.section>
            )}
          </motion.div>
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}
