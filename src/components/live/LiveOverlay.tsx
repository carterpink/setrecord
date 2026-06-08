import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronUp, ChevronDown, Sparkles, AudioLines, Building2 } from 'lucide-react'
import { useLiveStore, type LiveNextUp } from '@/stores/liveStore'
import { interactiveHandlers } from './clickThrough'
import { LiveActivation } from './LiveActivation'
import './liveHud.css'

/** How long the go-live activation sweep plays before the HUD takes over. */
const ACTIVATION_MS = 1700

/** Set Health colour ramp — green ≥80, amber 60–79, red below. */
function healthColor(h: number): string {
  if (h >= 80) return 'var(--accent)'
  if (h >= 60) return 'var(--semantic-warning)'
  return 'var(--semantic-danger)'
}

/** Consequence dot — a key clash is always a warning; otherwise by match score. */
function consequenceColor(n: LiveNextUp): string {
  if (n.keyCompatibility === 'clash') return 'var(--semantic-danger)'
  if (n.matchScore >= 88) return 'var(--semantic-success)'
  if (n.matchScore >= 70) return 'var(--semantic-warning)'
  return 'var(--semantic-danger)'
}

function clock(sec: number | null): string {
  if (sec == null) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const panelMotion = {
  initial: { opacity: 0, y: -8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
  transition: { duration: 0.26, ease: [0.32, 0.72, 0.12, 1] as const }
}

function NextRow({ n, rank }: { n: LiveNextUp; rank: number }): React.JSX.Element {
  return (
    <div className={`lv-row${n.best ? ' is-best' : ''}`}>
      <span className="lv-rank">{rank}</span>
      <div className="lv-row-main">
        <div className="lv-row-title">
          {n.title} <span className="lv-row-artist">· {n.artist}</span>
        </div>
        <div className="lv-row-conseq">
          <span className="lv-conseq-dot" style={{ background: consequenceColor(n) }} />
          <span className="lv-row-summary">{n.summary}</span>
        </div>
      </div>
      <span className="lv-score">{n.matchScore}%</span>
    </div>
  )
}

export function LiveOverlay(): React.JSX.Element | null {
  const { t } = useTranslation('live')
  const isLive = useLiveStore((s) => s.isLive)
  const expanded = useLiveStore((s) => s.expanded)
  const status = useLiveStore((s) => s.status)
  const current = useLiveStore((s) => s.current)
  const nextUp = useLiveStore((s) => s.nextUp)
  const setHealth = useLiveStore((s) => s.setHealth)
  const positionSec = useLiveStore((s) => s.positionSec)
  const elapsedSec = useLiveStore((s) => s.elapsedSec)
  const venue = useLiveStore((s) => s.venue)
  const indexProgress = useLiveStore((s) => s.indexProgress)
  const toggleExpanded = useLiveStore((s) => s.toggleExpanded)
  const endLive = useLiveStore((s) => s.endLive)

  // Play the activation sweep once when the session opens.
  const [intro, setIntro] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setIntro(false), ACTIVATION_MS)
    return () => clearTimeout(t)
  }, [])

  // Honour the Flight Recorder consent promise: show a REC indicator whenever the
  // room mic is actually being captured (driven from the main-window recorder).
  const [recording, setRecording] = useState(false)
  useEffect(() => {
    if (typeof window.setrecord === 'undefined') return
    return window.setrecord.onLiveRecordingState((active) => setRecording(active))
  }, [])

  // In the real overlay window, End closes the window + stops the engine;
  // in browser preview it just hides the mock HUD.
  const handleEnd = (): void => {
    window.setrecord?.liveStop()
    endLive()
  }

  if (!isLive) return null

  const locked = status === 'locked' && current
  const indexing = status === 'indexing'
  const best = nextUp.find((n) => n.best) ?? nextUp[0]
  const indexPct = indexProgress?.total
    ? Math.round((indexProgress.done / indexProgress.total) * 100)
    : 0

  return (
    <div className="lv-stage">
      <AnimatePresence>{intro && <LiveActivation key="activation" />}</AnimatePresence>

      <motion.div
        className="lv-content"
        initial={{ opacity: 0, y: -6, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.05, duration: 0.55, ease: [0.32, 0.72, 0.12, 1] }}
      >
        {/* ───── control strip ───── */}
        <div className="lv-strip" {...interactiveHandlers}>
          <span className="lv-dot" />
          <span className="lv-strip-label">
            {locked ? (
              <>
                <AudioLines size={14} strokeWidth={1.8} className="lv-wave" />
                {t('strip.live')}
              </>
            ) : indexing ? (
              t('strip.preparing', { percent: indexPct })
            ) : (
              t('strip.listening')
            )}
          </span>
          <span className="lv-timer">{clock(elapsedSec)}</span>

          {recording && (
            <>
              <span className="lv-strip-div" />
              <span className="lv-rec" title="Recording this set — audio stays on your device">
                <span className="lv-rec-dot" />
                REC
              </span>
            </>
          )}

          {locked && (
            <>
              <span className="lv-strip-div" />
              <span className="lv-strip-health" title={t('strip.setHealth')}>
                <span style={{ color: healthColor(setHealth) }}>{setHealth}</span>
                <span className="lv-strip-health-lbl">{t('strip.health')}</span>
              </span>
            </>
          )}

          {venue && (
            <>
              <span className="lv-strip-div" />
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  opacity: 0.85,
                  fontSize: 12
                }}
                title="Venue"
              >
                <Building2 size={13} strokeWidth={1.7} />
                {venue}
              </span>
            </>
          )}
          <span className="lv-strip-div" />
          <span className="lv-hint">
            {expanded ? t('strip.hide') : t('strip.show')}
            <kbd className="lv-kbd">⌘</kbd>
            <kbd className="lv-kbd">\</kbd>
          </span>
          <button
            type="button"
            className="lv-strip-btn"
            aria-label={expanded ? t('strip.collapseAria') : t('strip.expandAria')}
            onClick={toggleExpanded}
          >
            {expanded ? (
              <ChevronUp size={15} strokeWidth={1.8} />
            ) : (
              <ChevronDown size={15} strokeWidth={1.8} />
            )}
          </button>
          <button
            type="button"
            className="lv-strip-btn"
            aria-label={t('strip.endAria')}
            onClick={handleEnd}
          >
            <X size={15} strokeWidth={1.8} />
          </button>
        </div>

        {/* ───── floating panels ───── */}
        <AnimatePresence>
          {expanded && (
            <motion.div key="panels" className="lv-panels" {...panelMotion}>
              {/* Now playing */}
              <div className="lv-panel" {...interactiveHandlers}>
                <div className="lv-panel-head">
                  <Sparkles size={15} strokeWidth={1.8} className="lv-panel-icon" />
                  <span className="lv-panel-title">{t('nowPlaying.title')}</span>
                </div>
                {locked ? (
                  <>
                    <div className="lv-now-title">{current!.title}</div>
                    <div className="lv-now-artist">{current!.artist}</div>
                    <div className="lv-now-meta">
                      <span className="lv-bpm">
                        {current!.bpm.toFixed(0)}
                        <small>{t('nowPlaying.bpm')}</small>
                      </span>
                      <span className="lv-chip lv-chip-key">{current!.key}</span>
                      <span className="lv-chip">
                        {t('nowPlaying.energy', { energy: current!.energy })}
                      </span>
                      <span className="lv-now-pos">{clock(positionSec)}</span>
                    </div>
                  </>
                ) : indexing ? (
                  <div className="lv-listening">
                    <span className="lv-listening-text">
                      {t('nowPlaying.preparingLibrary', {
                        done: indexProgress?.done ?? 0,
                        total: indexProgress?.total ?? 0
                      })}
                    </span>
                  </div>
                ) : (
                  <div className="lv-listening">
                    <span className="lv-listening-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className="lv-listening-text">{t('nowPlaying.listeningForTrack')}</span>
                  </div>
                )}
              </div>

              {/* Best next */}
              <div className="lv-panel" {...interactiveHandlers}>
                <div className="lv-panel-head">
                  <span className="lv-panel-title">{t('bestNext.title')}</span>
                  {locked && best && (
                    <span className="lv-panel-meta">
                      {t('bestNext.options', { n: nextUp.length })}
                    </span>
                  )}
                </div>
                {locked ? (
                  nextUp.map((n, i) => <NextRow key={n.id} n={n} rank={i + 1} />)
                ) : (
                  <div className="lv-listening">
                    <span className="lv-listening-text dim">{t('bestNext.empty')}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
