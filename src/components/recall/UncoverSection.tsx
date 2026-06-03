import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Telescope,
  Heart,
  X,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Flame,
  Sparkles,
  FlaskConical,
  Disc3
} from 'lucide-react'
import type { UncoverCard, UncoverSource } from '@/types'
import { useRecallStore } from '@/stores/recallStore'
import { useSetStore } from '@/stores/setStore'
import { usePlaybackStore } from '@/stores/playbackStore'
import { toMediaUrl } from '@/utils/mediaUrl'
import { formatBpm, formatDuration, gradientForId } from '@/utils/format'
import { tagLabel } from '@/utils/tagging/taxonomy'

type Action = 'dismiss' | 'keep' | 'set'

const SOURCE_META: Record<UncoverSource, { label: string; icon: typeof Flame }> = {
  heater: { label: 'Forgotten heater', icon: Flame },
  gem: { label: 'Forgotten gem', icon: Sparkles },
  untested: { label: 'Never tested live', icon: FlaskConical },
  audition: { label: 'Worth auditioning', icon: Disc3 }
}

// Pixels past which a release commits the swipe.
const THRESHOLD_X = 110
const THRESHOLD_Y = 96
const EXIT_MS = 260
const STACK_DEPTH = 3

export function UncoverSection(): React.JSX.Element {
  const deck = useRecallStore((s) => s.uncoverDeck)
  const loading = useRecallStore((s) => s.uncoverLoading)
  const loadUncover = useRecallStore((s) => s.loadUncover)
  const dismissUncover = useRecallStore((s) => s.dismissUncover)
  const undismissUncover = useRecallStore((s) => s.undismissUncover)
  const resetUncover = useRecallStore((s) => s.resetUncover)
  const flagForGig = useRecallStore((s) => s.flagForGig)
  const addTrackAndToast = useSetStore((s) => s.addTrackAndToast)

  const startPreview = usePlaybackStore((s) => s.startPreview)
  const togglePlay = usePlaybackStore((s) => s.togglePlay)

  const [index, setIndex] = useState(0)
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [exit, setExit] = useState<Action | null>(null)
  const [history, setHistory] = useState<{ action: Action; card: UncoverCard }[]>([])
  const [saved, setSaved] = useState(0)
  const [skipped, setSkipped] = useState(0)

  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const animating = useRef(false)

  useEffect(() => {
    void loadUncover()
    return () => usePlaybackStore.getState().stopPreview()
  }, [loadUncover])

  const done = !loading && deck.length > 0 && index >= deck.length
  const topTrackId = deck[index]?.track.id

  // Autoplay: preview the top card the moment it becomes active.
  useEffect(() => {
    if (!topTrackId) return
    const top = deck[index]
    if (top) startPreview(top.track)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topTrackId])

  const commit = useCallback(
    (action: Action) => {
      const current = deck[index]
      if (!current || animating.current) return
      animating.current = true

      if (action === 'dismiss') {
        dismissUncover(current.track.id)
        setSkipped((n) => n + 1)
      } else if (action === 'keep') {
        void flagForGig([current.track.id])
        setSaved((n) => n + 1)
      } else {
        addTrackAndToast(current.track)
        setSaved((n) => n + 1)
      }

      usePlaybackStore.getState().stopPreview()
      setHistory((h) => [...h, { action, card: current }])
      setExit(action)
      setDrag(null)
      window.setTimeout(() => {
        setExit(null)
        animating.current = false
        setIndex((i) => i + 1)
      }, EXIT_MS)
    },
    [deck, index, dismissUncover, flagForGig, addTrackAndToast]
  )

  const undo = useCallback(() => {
    if (animating.current || history.length === 0) return
    const last = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    if (last.action === 'dismiss') {
      undismissUncover(last.card.track.id)
      setSkipped((n) => Math.max(0, n - 1))
    } else {
      setSaved((n) => Math.max(0, n - 1))
    }
    usePlaybackStore.getState().stopPreview()
    setIndex((i) => Math.max(0, i - 1))
  }, [history, undismissUncover])

  const togglePreview = useCallback(() => {
    const current = deck[index]
    if (!current) return
    const pb = usePlaybackStore.getState()
    if (pb.previewTrack?.id === current.track.id) togglePlay()
    else startPreview(current.track)
  }, [deck, index, startPreview, togglePlay])

  // Keyboard control. Re-subscribes when the handlers change.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          commit('dismiss')
          break
        case 'ArrowRight':
          e.preventDefault()
          commit('keep')
          break
        case 'ArrowUp':
          e.preventDefault()
          commit('set')
          break
        case ' ':
          e.preventDefault()
          togglePreview()
          break
        case 'Backspace':
        case 'z':
        case 'Z':
          e.preventDefault()
          undo()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commit, undo, togglePreview])

  // ───────── Pointer (mouse / trackpad) drag ─────────
  const onPointerDown = (e: React.PointerEvent): void => {
    if (animating.current) return
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    pointerStart.current = { x: e.clientX, y: e.clientY }
    setDrag({ x: 0, y: 0 })
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    if (!pointerStart.current) return
    setDrag({ x: e.clientX - pointerStart.current.x, y: e.clientY - pointerStart.current.y })
  }
  const onPointerUp = (): void => {
    if (!pointerStart.current) return
    pointerStart.current = null
    const d = drag ?? { x: 0, y: 0 }
    if (d.x > THRESHOLD_X) commit('keep')
    else if (d.x < -THRESHOLD_X) commit('dismiss')
    else if (d.y < -THRESHOLD_Y && Math.abs(d.y) > Math.abs(d.x)) commit('set')
    else setDrag(null)
  }

  // ───────── Render ─────────
  if (loading) {
    return (
      <div className="uncover">
        <UncoverHeader saved={saved} skipped={skipped} remaining={0} />
        <div className="uncover-stage">
          <div className="uncover-empty">
            <Telescope size={28} strokeWidth={1.4} />
            <span>Digging up forgotten tracks…</span>
          </div>
        </div>
      </div>
    )
  }

  if (deck.length === 0 || done) {
    return (
      <div className="uncover">
        <UncoverHeader saved={saved} skipped={skipped} remaining={0} />
        <div className="uncover-stage">
          <div className="uncover-empty">
            <Telescope size={28} strokeWidth={1.4} />
            {deck.length === 0 ? (
              <span>
                Nothing buried right now — every heater, gem and untested track has surfaced. Import
                more or check back as your history grows.
              </span>
            ) : (
              <span>
                That’s the whole stack. You saved <strong>{saved}</strong> and skipped{' '}
                <strong>{skipped}</strong>.
              </span>
            )}
            <button type="button" className="btn-primary" onClick={() => void resetUncover()}>
              <RotateCcw size={15} strokeWidth={1.6} /> Start a fresh dig
            </button>
          </div>
        </div>
      </div>
    )
  }

  const remaining = deck.length - index
  // Top card transform from drag or exit animation.
  const tx = drag?.x ?? (exit === 'keep' ? 640 : exit === 'dismiss' ? -640 : 0)
  const ty = drag?.y ?? (exit === 'set' ? -760 : 0)
  const rot = tx / 18
  const dragging = drag !== null && exit === null
  const swipeStrength = Math.min(
    1,
    Math.max(Math.abs(tx) / THRESHOLD_X, Math.abs(ty) / THRESHOLD_Y)
  )

  // Directional intent for the clean edge-glow + icon cue.
  let swipeDir: Action | null = null
  if (exit) swipeDir = exit
  else if (drag) {
    if (drag.x > 16) swipeDir = 'keep'
    else if (drag.x < -16) swipeDir = 'dismiss'
    else if (drag.y < -16) swipeDir = 'set'
  }

  // Render up to STACK_DEPTH cards, back-to-front.
  const stack = deck.slice(index, index + STACK_DEPTH)

  return (
    <div className="uncover">
      <UncoverHeader saved={saved} skipped={skipped} remaining={remaining} />

      <div className="uncover-stage">
        {stack
          .map((c, depth) => ({ c, depth }))
          .reverse()
          .map(({ c, depth }) => {
            const isTop = depth === 0
            const style: React.CSSProperties = isTop
              ? {
                  transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg)`,
                  transition: dragging
                    ? 'none'
                    : `transform ${EXIT_MS}ms cubic-bezier(0.22,1,0.36,1)`,
                  cursor: dragging ? 'grabbing' : 'grab',
                  zIndex: STACK_DEPTH
                }
              : {
                  transform: `translateY(${depth * 12}px) scale(${1 - depth * 0.05})`,
                  transition: 'transform 300ms cubic-bezier(0.22,1,0.36,1)',
                  zIndex: STACK_DEPTH - depth,
                  opacity: depth > 1 ? 0 : 1
                }
            return (
              <UncoverCardView
                key={c.track.id}
                card={c}
                style={style}
                isTop={isTop}
                swipeDir={isTop ? swipeDir : null}
                swipeStrength={isTop ? swipeStrength : 0}
                onPointerDown={isTop ? onPointerDown : undefined}
                onPointerMove={isTop ? onPointerMove : undefined}
                onPointerUp={isTop ? onPointerUp : undefined}
                onPointerCancel={isTop ? onPointerUp : undefined}
                onTogglePreview={togglePreview}
              />
            )
          })}
      </div>

      <div className="uncover-controls">
        <button
          type="button"
          className="uncover-btn undo"
          title="Undo (Z)"
          aria-label="Undo last swipe"
          onClick={undo}
          disabled={history.length === 0}
        >
          <RotateCcw size={17} strokeWidth={1.9} />
        </button>

        <div className="uncover-actions">
          <button
            type="button"
            className="uncover-btn dismiss"
            title="Skip (←)"
            aria-label="Skip"
            onClick={() => commit('dismiss')}
          >
            <X size={24} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className="uncover-btn set"
            title="Add to current set (↑)"
            aria-label="Add to current set"
            onClick={() => commit('set')}
          >
            <Plus size={22} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className="uncover-btn keep"
            title="Test at next gig (→)"
            aria-label="Test at next gig"
            onClick={() => commit('keep')}
          >
            <Heart size={24} strokeWidth={2.2} />
          </button>
        </div>

        {/* Spacer mirrors the undo button so the action trio stays centred. */}
        <span className="uncover-controls-spacer" aria-hidden="true" />
      </div>

      <p className="uncover-hint">
        <kbd>←</kbd> skip · <kbd>↑</kbd> add to set · <kbd>→</kbd> test at gig · <kbd>space</kbd>{' '}
        play/pause · <kbd>Z</kbd> undo
      </p>
    </div>
  )
}

function UncoverHeader({
  saved,
  skipped,
  remaining
}: {
  saved: number
  skipped: number
  remaining: number
}): React.JSX.Element {
  return (
    <header className="recall-section-head uncover-head">
      <div>
        <h2 className="ss-h2">Uncover</h2>
        <p className="recall-section-sub">
          Swipe through the tracks your library forgot. Right to test at your next gig, left to move
          on.
        </p>
      </div>
      <div className="uncover-stats">
        <span className="uncover-stat saved">{saved} saved</span>
        <span className="uncover-stat skipped">{skipped} skipped</span>
        <span className="uncover-stat">{remaining} left</span>
      </div>
    </header>
  )
}

const DIR_ICON: Record<Action, typeof Heart> = { keep: Heart, dismiss: X, set: Plus }
const DIR_LABEL: Record<Action, string> = {
  keep: 'Test at gig',
  dismiss: 'Skip',
  set: 'Add to set'
}

function UncoverCardView({
  card,
  style,
  isTop,
  swipeDir,
  swipeStrength,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onTogglePreview
}: {
  card: UncoverCard
  style: React.CSSProperties
  isTop: boolean
  swipeDir: Action | null
  swipeStrength: number
  onPointerDown?: (e: React.PointerEvent) => void
  onPointerMove?: (e: React.PointerEvent) => void
  onPointerUp?: () => void
  onPointerCancel?: () => void
  onTogglePreview: () => void
}): React.JSX.Element {
  const { track } = card
  const meta = SOURCE_META[card.source]
  const SourceIcon = meta.icon
  const playing = usePlaybackStore((s) => s.previewTrack?.id === track.id && s.isPlaying)
  const vibeTags = (track.tags ?? []).filter((t) => t.category === 'vibe').slice(0, 3)
  const gradient = track.artGradient ?? gradientForId(track.id)
  const DirIcon = swipeDir ? DIR_ICON[swipeDir] : null
  const subtitle = [track.genre, track.album].filter(Boolean).join(' · ')

  return (
    <div
      className={`uncover-card glass-3${isTop ? ' top' : ''}${swipeDir ? ` cue-${swipeDir}` : ''}`}
      style={{ ...style, ['--cue' as string]: isTop ? swipeStrength : 0 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {isTop && DirIcon && (
        <div className={`uncover-cue ${swipeDir}`} style={{ opacity: swipeStrength }}>
          <DirIcon size={26} strokeWidth={2.4} />
          <span>{DIR_LABEL[swipeDir as Action]}</span>
        </div>
      )}

      <span className={`uncover-source ${card.source}`}>
        <SourceIcon size={12} strokeWidth={1.8} /> {meta.label}
      </span>

      <div className="uncover-art" style={{ background: gradient }}>
        {track.albumArtPath ? (
          <img src={toMediaUrl(track.albumArtPath)} alt="" draggable={false} />
        ) : (
          <Disc3 className="uncover-art-glyph" size={40} strokeWidth={1.3} />
        )}
        {isTop && (
          <button
            type="button"
            className={`uncover-play${playing ? ' playing' : ''}`}
            title={playing ? 'Pause' : 'Play'}
            aria-label={playing ? 'Pause' : 'Play'}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onTogglePreview()
            }}
          >
            {playing ? <Pause size={18} strokeWidth={2.2} /> : <Play size={18} strokeWidth={2.2} />}
          </button>
        )}
      </div>

      <div className="uncover-info">
        <h3 className="uncover-title" title={track.title}>
          {track.title}
        </h3>
        <p className="uncover-artist" title={track.artist}>
          {track.artist}
        </p>
        {subtitle && (
          <p className="uncover-subtitle" title={subtitle}>
            {subtitle}
          </p>
        )}

        <div className="uncover-stats-grid">
          <div className="uncover-stat-cell">
            <span className="uncover-stat-label">Key</span>
            <span className="uncover-stat-val">{track.key || '—'}</span>
          </div>
          <div className="uncover-stat-cell">
            <span className="uncover-stat-label">BPM</span>
            <span className="uncover-stat-val">{formatBpm(track.bpm)}</span>
          </div>
          <div className="uncover-stat-cell">
            <span className="uncover-stat-label">Energy</span>
            <span className="uncover-stat-val">{track.energy}/10</span>
          </div>
          <div className="uncover-stat-cell">
            <span className="uncover-stat-label">Length</span>
            <span className="uncover-stat-val">{formatDuration(track.duration)}</span>
          </div>
        </div>

        {vibeTags.length > 0 && (
          <div className="uncover-tags">
            {vibeTags.map((t) => (
              <span key={t.value} className="uncover-tag">
                {tagLabel('vibe', t.value)}
              </span>
            ))}
          </div>
        )}

        <p className="uncover-reason">{card.reason}</p>
      </div>
    </div>
  )
}
