import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { AlertCircle, ChevronDown, ChevronUp, Pause, Play, ShoppingCart } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Suggestion, Track } from '@/types'
import { KeyChip } from '@/components/shared/KeyChip'
import { InlineWaveform } from '@/components/shared/InlineWaveform'
import { motion, AnimatePresence } from '@/components/shared/Motion'
import type { Variants } from 'framer-motion'
import { useClickOrDoubleClick } from '@/hooks/useClickOrDoubleClick'
import { usePlaybackStore } from '@/stores/playbackStore'
import { BpmChip } from '@/components/shared/BpmChip'
import { MatchReasonChips } from './MatchReasonChips'

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.32, 0.72, 0.12, 1] }
  }
}

interface SuggestionCardProps {
  suggestion: Suggestion
  /** The currently-selected set track — used to generate Learn Mode "from → to" explanations. */
  fromTrack?: Track
  /** Single click = preview. */
  onPreview?: () => void
  /** Double click = add to set after the currently-selected timeline track. */
  onAdd?: () => void
}

export function SuggestionCard({
  suggestion,
  fromTrack,
  onPreview,
  onAdd
}: SuggestionCardProps): React.JSX.Element {
  const { t } = useTranslation('suggestions')
  const { track, matchReasons, best, transitionScore } = suggestion
  const [showBreakdown, setShowBreakdown] = useState(false)
  const isPhantom = track.phantom === true
  const missing = track.missingFile === true && !isPhantom
  const unavailable = missing || isPhantom

  const { startPreview, togglePlay, previewTrack, isPlaying } = usePlaybackStore()
  const isThisPlaying = previewTrack?.id === track.id && isPlaying && !missing && !isPhantom
  // Only subscribe to currentTime ticks when this card is playing.
  const previewCurrentTime = usePlaybackStore((s) => (isThisPlaying ? s.currentTime : 0))

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sugg-${track.id}`,
    data: { source: 'library', track },
    disabled: unavailable
  })

  const { onClick, onDoubleClick } = useClickOrDoubleClick(
    () => onPreview?.(),
    () => onAdd?.()
  )

  function handlePlayClick(e: React.MouseEvent | React.PointerEvent): void {
    e.stopPropagation()
    if (unavailable) return
    if (previewTrack?.id === track.id) {
      togglePlay()
    } else {
      startPreview(track)
    }
  }

  return (
    <motion.div
      ref={setNodeRef}
      className={clsx('sugg-card', best ? 'glass-3 best' : 'glass-2', isThisPlaying && 'playing')}
      variants={cardVariants}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        cursor: unavailable ? 'default' : isDragging ? 'grabbing' : 'grab'
      }}
      onClick={unavailable ? undefined : onClick}
      onDoubleClick={unavailable ? undefined : onDoubleClick}
      {...listeners}
      {...attributes}
    >
      {best ? (
        <motion.span
          className="best-badge"
          title={t('card.bestBadgeTitle')}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0.12, 1], delay: 0.1 }}
        >
          {t('card.bestBadge')}
        </motion.span>
      ) : null}

      <div className="sugg-row" style={{ marginTop: best ? 6 : 0 }}>
        <button
          type="button"
          className={clsx('sugg-play', isThisPlaying && 'playing')}
          disabled={unavailable}
          aria-label={
            isPhantom
              ? t('card.phantomAria')
              : missing
                ? t('card.fileNotFoundAria')
                : isThisPlaying
                  ? t('card.pauseAria', { title: track.title })
                  : t('card.previewAria', { title: track.title })
          }
          title={
            isPhantom
              ? t('card.phantomTitle')
              : missing
                ? t('card.fileNotFoundTitle', { path: track.filePath })
                : undefined
          }
          onClick={handlePlayClick}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {isPhantom ? (
            <ShoppingCart size={13} strokeWidth={1.5} aria-hidden="true" />
          ) : missing ? (
            <AlertCircle
              size={13}
              strokeWidth={1.5}
              color="var(--semantic-warning)"
              aria-hidden="true"
            />
          ) : isThisPlaying ? (
            <Pause size={13} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Play size={13} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sugg-title">{track.title}</div>
          <div className="sugg-artist">{track.artist}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <BpmChip className="sugg-mono">{track.bpm}</BpmChip>
          <div
            style={{
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              justifyContent: 'flex-end'
            }}
          >
            {fromTrack?.key ? (
              <>
                <KeyChip>{fromTrack.key}</KeyChip>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1 }}>
                  →
                </span>
                <KeyChip>{track.key}</KeyChip>
              </>
            ) : (
              <KeyChip>{track.key}</KeyChip>
            )}
          </div>
        </div>
      </div>

      <MatchReasonChips reasons={matchReasons} fromTrack={fromTrack} toTrack={track} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          type="button"
          className="sugg-breakdown-toggle"
          aria-expanded={showBreakdown}
          onClick={(e) => {
            e.stopPropagation()
            setShowBreakdown((v) => !v)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title={showBreakdown ? t('card.hideBreakdown') : t('card.showBreakdown')}
        >
          {showBreakdown ? (
            <ChevronUp size={11} strokeWidth={2} />
          ) : (
            <ChevronDown size={11} strokeWidth={2} />
          )}
          <span>{t('card.score', { score: transitionScore.score })}</span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showBreakdown && (
          <motion.div
            className="sugg-score-breakdown"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0.12, 1] }}
            style={{ overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="breakdown-row">
              <span>{t('card.breakdown.bpmDelta')}</span>
              <span>±{transitionScore.bpmDelta.toFixed(1)}</span>
            </div>
            <div className="breakdown-row">
              <span>{t('card.breakdown.key')}</span>
              <span style={{ textTransform: 'capitalize' }}>
                {transitionScore.keyCompatibility.replace('-', ' ')}
              </span>
            </div>
            <div className="breakdown-row">
              <span>{t('card.breakdown.energyDelta')}</span>
              <span>
                {transitionScore.energyDelta > 0
                  ? `+${transitionScore.energyDelta}`
                  : transitionScore.energyDelta}
              </span>
            </div>
            <div className="breakdown-row">
              <span style={{ color: 'var(--text-primary)' }}>{t('card.breakdown.total')}</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {t('card.breakdown.totalValue', { score: transitionScore.score })}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isThisPlaying && (
        <div
          className="sugg-wave"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <InlineWaveform
            filePath={track.filePath}
            currentTime={previewCurrentTime}
            onSeek={(ms) => usePlaybackStore.getState().requestSeek(ms)}
          />
        </div>
      )}
    </motion.div>
  )
}
