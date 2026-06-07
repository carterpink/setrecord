import { X } from 'lucide-react'
import { motion, modalBackdrop, modalPanel, stagger, slideUp } from '@/components/shared/Motion'
import type { BriefAnswer } from '@/types'
import { RecallTrackLine } from './RecallTrackLine'

/**
 * The pre-gig "Game plan" overlay: venue profile + proven tracks + a bring/test
 * list + honest notes. Animated with the house modal motion (modalBackdrop /
 * modalPanel) so it matches the rest of the app; the inner sections stagger in.
 * Render inside an <AnimatePresence> and toggle on the store's `briefOpen` flag
 * so the exit animation plays. Strings are plain English (i18n is a follow-up).
 */
export function BriefPanel({
  brief,
  loading,
  onClose
}: {
  brief: BriefAnswer | null
  loading: boolean
  onClose: () => void
}): React.JSX.Element {
  const p = brief?.profile
  return (
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
        variants={modalPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="gig-tracklist-head">
          <div>
            <h3 className="ss-h3">Game plan · {brief?.venueLabel ?? '…'}</h3>
            {brief && <span className="recall-section-sub">{brief.narration}</span>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={1.5} />
          </button>
        </header>

        {loading || !brief ? (
          <div className="recall-empty">Building your game plan…</div>
        ) : (
          <motion.div variants={stagger(0.05)} initial="hidden" animate="visible">
            {p && brief.timesPlayed > 0 && (
              <motion.div
                variants={slideUp}
                className="gig-row-meta"
                style={{ margin: '2px 0 12px' }}
              >
                {p.bpmLow != null && p.bpmHigh != null && (
                  <span className="gig-chip gig-chip-soft">
                    {p.bpmLow}–{p.bpmHigh} BPM
                  </span>
                )}
                {p.avgEnergy != null && (
                  <span className="gig-chip gig-chip-soft">energy {p.avgEnergy}</span>
                )}
                {p.typicalSetLength && (
                  <span className="gig-chip gig-chip-soft">{p.typicalSetLength}</span>
                )}
                {p.topGenres.map((g) => (
                  <span key={g} className="gig-chip gig-chip-soft">
                    {g}
                  </span>
                ))}
              </motion.div>
            )}

            {brief.proven.length > 0 && (
              <motion.section variants={slideUp} style={{ marginBottom: 12 }}>
                <div className="recall-section-sub" style={{ fontWeight: 600, marginBottom: 6 }}>
                  Proven here ({brief.proven.length})
                </div>
                <div className="recall-list">
                  {brief.proven.map((tk) => (
                    <RecallTrackLine key={tk.id} track={tk} compact />
                  ))}
                </div>
              </motion.section>
            )}

            {brief.bring.length > 0 && (
              <motion.section variants={slideUp} style={{ marginBottom: 12 }}>
                <div className="recall-section-sub" style={{ fontWeight: 600, marginBottom: 6 }}>
                  Bring / test ({brief.bring.length})
                </div>
                <div className="recall-list">
                  {brief.bring.map((tk) => (
                    <RecallTrackLine key={tk.id} track={tk} compact />
                  ))}
                </div>
              </motion.section>
            )}

            {brief.notes.map((note, i) => (
              <motion.p
                key={i}
                variants={slideUp}
                className="recall-section-sub"
                style={{ marginTop: 8, opacity: 0.85 }}
              >
                {note}
              </motion.p>
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}
