import { useEffect } from 'react'
import { Activity, RefreshCw, Sparkles } from 'lucide-react'
import { motion, fadeScale, stagger, slideUp } from '@/components/shared/Motion'
import { useRecallStore } from '@/stores/recallStore'

/**
 * Sound Mirror (Frontier 2A) — the longitudinal "who you're becoming" panel that
 * leads the Identity section. Where the charts below are a static snapshot of the
 * whole library, this measures DRIFT across the sets you actually played: BPM /
 * energy / brightness deltas, vibe shifts, ruts (same opener/closer on repeat),
 * and a one-line "you're becoming…". Self-loads from the recall store and
 * degrades gracefully (a gentle nudge) when there's no gig history yet.
 * Animated with the house motion; strings are plain English (i18n follow-up).
 */
export function SoundMirrorPanel(): React.JSX.Element | null {
  const mirror = useRecallStore((s) => s.soundMirror)
  const loading = useRecallStore((s) => s.soundMirrorLoading)
  const loadSoundMirror = useRecallStore((s) => s.loadSoundMirror)

  useEffect(() => {
    void loadSoundMirror()
  }, [loadSoundMirror])

  if (loading && !mirror) {
    return (
      <div className="recall-stat-card glass-2" style={{ marginBottom: 16 }}>
        <span className="recall-section-sub">Reading how your sound has moved…</span>
      </div>
    )
  }
  if (!mirror) return null

  const hasHistory = mirror.windows.length > 0
  const driftStatements = mirror.drift?.statements ?? []

  return (
    <motion.section
      className="recall-stat-card glass-2"
      style={{ marginBottom: 16 }}
      variants={fadeScale}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={stagger(0.06)} initial="hidden" animate="visible">
        <motion.div
          variants={slideUp}
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
        >
          <Activity size={15} strokeWidth={1.7} color="var(--accent)" />
          <h3 className="recall-stat-title" style={{ margin: 0 }}>
            Sound Mirror
          </h3>
        </motion.div>

        {mirror.becoming && hasHistory && (
          <motion.div
            variants={slideUp}
            className="ss-h3"
            style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}
          >
            <Sparkles size={16} strokeWidth={1.7} color="var(--accent)" />
            {mirror.becoming}
          </motion.div>
        )}

        <motion.p
          variants={slideUp}
          className="recall-section-sub"
          style={{ margin: '2px 0 10px', lineHeight: 1.5 }}
        >
          {mirror.narration}
        </motion.p>

        {driftStatements.length > 0 && (
          <motion.ul
            variants={slideUp}
            style={{ listStyle: 'none', padding: 0, margin: '0 0 10px', display: 'grid', gap: 4 }}
          >
            {driftStatements.map((s, i) => (
              <li
                key={i}
                className="recall-section-sub"
                style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}
              >
                <span aria-hidden="true" style={{ color: 'var(--accent)' }}>
                  ›
                </span>
                {s}
              </li>
            ))}
          </motion.ul>
        )}

        {mirror.drift && (
          <motion.div variants={slideUp} className="gig-row-meta" style={{ marginBottom: 10 }}>
            <span className="gig-chip gig-chip-soft">
              {mirror.drift.fromLabel} → {mirror.drift.toLabel}
            </span>
            <span className="gig-chip gig-chip-soft">
              BPM {mirror.drift.bpmDelta >= 0 ? '+' : ''}
              {mirror.drift.bpmDelta}
            </span>
            <span className="gig-chip gig-chip-soft">
              energy {mirror.drift.energyDelta >= 0 ? '+' : ''}
              {mirror.drift.energyDelta}
            </span>
            {mirror.drift.brightnessDelta != null && (
              <span className="gig-chip gig-chip-soft">
                {mirror.drift.brightnessDelta < 0 ? 'darker' : 'brighter'}
              </span>
            )}
          </motion.div>
        )}

        {mirror.ruts.length > 0 && (
          <motion.div variants={slideUp} style={{ display: 'grid', gap: 4 }}>
            {mirror.ruts.map((r) => (
              <div
                key={`${r.kind}-${r.trackId}`}
                className="recall-section-sub"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'var(--text-secondary)'
                }}
              >
                <RefreshCw size={13} strokeWidth={1.6} color="var(--semantic-warning)" />
                Rut: “{r.title}” {r.kind === 'opener' ? 'opened' : 'closed'} {r.occurrences} of your
                last {r.ofLast} sets.
              </div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.section>
  )
}
