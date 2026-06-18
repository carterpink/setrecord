import { createPortal } from 'react-dom'
import { X, Zap } from 'lucide-react'
import { motion, modalBackdrop, modalPanel, stagger, slideUp } from '@/components/shared/Motion'
import type { Track, CourageResult } from '@/types'
import { RecallTrackLine } from '@/components/recall/RecallTrackLine'

/**
 * Courage Engine (Frontier 2B) — the anti-recommendation, surfaced from the
 * library context menu as the deliberate counterpart to "Find similar". Out of
 * the reference track it lists picks that are genuinely mixable (clean key + BPM
 * window) but from genres OUTSIDE the comfort zone — the cure for the rut the
 * Sound Mirror detects. Each row carries its "why it's safe to dare" reason and
 * a + to drop it into the set. House modal motion; strings are plain English.
 */
export function CouragePopover({
  reference,
  courage,
  loading,
  onClose
}: {
  reference: Track
  courage: CourageResult | null
  loading: boolean
  onClose: () => void
}): React.JSX.Element {
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
        style={{ maxWidth: 520 }}
        variants={modalPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="gig-tracklist-head">
          <div>
            <h3 className="ss-h3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} strokeWidth={1.7} color="var(--accent)" />
              Dare something different
            </h3>
            <span className="recall-section-sub">
              Mixable out of {reference.title} · {reference.artist}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={1.5} />
          </button>
        </header>

        {loading || !courage ? (
          <div className="recall-empty">Looking past your comfort zone…</div>
        ) : (
          <motion.div variants={stagger(0.05)} initial="hidden" animate="visible">
            <motion.p
              variants={slideUp}
              className="recall-section-sub"
              style={{ margin: '2px 0 12px', lineHeight: 1.5 }}
            >
              {courage.narration}
            </motion.p>

            {courage.comfortGenres.length > 0 && (
              <motion.div variants={slideUp} className="gig-row-meta" style={{ marginBottom: 12 }}>
                <span className="recall-section-sub" style={{ marginRight: 4 }}>
                  Your lane:
                </span>
                {courage.comfortGenres.slice(0, 4).map((g) => (
                  <span key={g} className="gig-chip gig-chip-soft">
                    {g}
                  </span>
                ))}
              </motion.div>
            )}

            {courage.candidates.length > 0 ? (
              <motion.div variants={slideUp} className="recall-list">
                {courage.candidates.map((c) => (
                  <RecallTrackLine key={c.track.id} track={c.track} note={c.reason} compact />
                ))}
              </motion.div>
            ) : (
              <motion.p variants={slideUp} className="recall-empty">
                No daring-but-clean pick out of this one right now.
              </motion.p>
            )}
          </motion.div>
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}
