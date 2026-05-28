import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { AlertCircle, Disc3, ExternalLink, History, Lock, LockOpen, MoreHorizontal, Pause, Play, ShoppingCart, X } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ComboResult, SetTrack, Track } from '@/types'
import { usePlaybackStore } from '@/stores/playbackStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { formatBpm, formatDuration, formatPosition } from '@/utils/format'
import { EnergyChip } from '@/components/shared/EnergyChip'
import { TransitionDot } from '@/components/shared/TransitionDot'
import { Waveform } from '@/components/shared/Waveform'
import { KeyChip } from '@/components/shared/KeyChip'
import { LearnTooltip } from '@/components/learn/LearnTooltip'
import { explainTransition } from '@/utils/learnMode/explanations'


interface TimelineTrackCardProps {
  setTrack: SetTrack
  /** Previous track in the set — used by Learn Mode to explain the transition into this slot. */
  previousTrack?: Track
  isSelected?: boolean
  onSelect?: () => void
  onRemove?: () => void
}

export const TimelineTrackCard = memo(function TimelineTrackCard({
  setTrack,
  previousTrack,
  isSelected,
  onSelect,
  onRemove,
}: TimelineTrackCardProps): React.JSX.Element {
  const { track, position, transitionScore } = setTrack
  const score = transitionScore
  const isLocked = setTrack.locked === true
  const toggleLock = useSetStore((s) => s.toggleLock)
  const learnModeEnabled = useUiStore((s) => s.learnModeEnabled)
  const showModal = useUiStore((s) => s.showModal)
  const isPhantom = track.phantom === true

  const [combosData, setCombosData] = useState<{ results: ComboResult[]; loading: boolean } | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuBtnRef = useRef<HTMLButtonElement | null>(null)

  // Close the overflow menu when clicking outside
  useEffect(() => {
    if (!showMenu) return
    function onPointer(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    window.addEventListener('pointerdown', onPointer, { capture: true })
    return () => window.removeEventListener('pointerdown', onPointer, { capture: true })
  }, [showMenu])

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation()
    if (menuBtnRef.current) {
      const r = menuBtnRef.current.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setShowMenu((v) => !v)
  }

  async function handleShowCombos(e: React.MouseEvent) {
    e.stopPropagation()
    setCombosData({ results: [], loading: true })
    try {
      if (typeof window.setsense !== 'undefined') {
        const results = await window.setsense.recallCombos(track.id)
        setCombosData({ results, loading: false })
      } else {
        setCombosData({ results: [], loading: false })
      }
    } catch {
      setCombosData({ results: [], loading: false })
    }
  }

  function handleEditCues(e: React.MouseEvent) {
    e.stopPropagation()
    onSelect?.()
    showModal('cueEditor')
  }
  const missing = track.missingFile === true && !isPhantom
  const { startPreview, togglePlay, previewTrack, isPlaying } = usePlaybackStore()
  const isThisPlaying = previewTrack?.id === track.id && isPlaying && !missing && !isPhantom
  // Only subscribe to currentTime ticks when this card is the playing one
  const previewCurrentTime = usePlaybackStore((s) =>
    isThisPlaying ? s.currentTime : 0
  )

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: setTrack.id,
    data: { source: 'timeline', setTrack },
    disabled: isLocked,
  })

  // Combined ref: dnd-kit needs setNodeRef, we need the DOM node for scrollIntoView
  const domRef = useRef<HTMLDivElement | null>(null)
  const combinedRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node)
      domRef.current = node
    },
    [setNodeRef],
  )

  // Scroll this card into view whenever it becomes selected
  useEffect(() => {
    if (isSelected && domRef.current) {
      domRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isSelected])

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isLocked ? 'default' : isDragging ? 'grabbing' : 'grab',
  }

  return (
    <>
    <div
      ref={combinedRef}
      style={style}
      className={clsx('tl-card glass-2', isSelected && 'selected', isPhantom && 'phantom', isLocked && 'tl-card--locked')}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect?.() }}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        className={clsx('tl-handle', isThisPlaying && 'playing')}
        aria-label={
          isPhantom
            ? 'Phantom track — not in your library yet'
            : missing
              ? 'File not found'
              : isThisPlaying
                ? `Pause ${track.title}`
                : `Preview ${track.title}`
        }
        disabled={missing || isPhantom}
        title={
          isPhantom
            ? 'Buy or download this track to enable preview'
            : missing
              ? `File not found: ${track.filePath}`
              : undefined
        }
        style={missing || isPhantom ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
        onClick={(e) => {
          e.stopPropagation()
          if (missing || isPhantom) return
          if (previewTrack?.id === track.id) {
            togglePlay()
          } else {
            startPreview(track)
          }
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {isPhantom ? (
          <ShoppingCart size={14} strokeWidth={1.5} aria-hidden="true" />
        ) : missing ? (
          <AlertCircle size={14} strokeWidth={1.5} color="var(--semantic-warning)" aria-hidden="true" />
        ) : isThisPlaying ? (
          <Pause size={14} strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <Play size={14} strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>

      <div className="tl-body">
        <div className="tl-row1">
          <span className="tl-num ss-mono">{formatPosition(position)}</span>
          <span className="ss-h3">{track.title}</span>
        </div>
        <div className="ss-body-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{track.artist} · {formatBpm(track.bpm)} · <KeyChip>{track.key}</KeyChip></span>
          <span
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ marginLeft: 4 }}
          >
            <EnergyChip
              value={setTrack.energyOverride ?? track.energy}
              isPending={!setTrack.energyOverride && (!track.energySource || track.energySource === 'pending')}
              isOverride={setTrack.energyOverride !== undefined}
              editable
              onChange={(v) => useSetStore.getState().setEnergyOverride(setTrack.id, v)}
            />
          </span>
        </div>
        {missing && (
          <div
            className="ss-caption"
            style={{ color: 'var(--semantic-warning)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}
          >
            <AlertCircle size={10} strokeWidth={2} />
            File not found
          </div>
        )}
        {isPhantom && track.discoverMeta && (
          <div className="tl-phantom-shop ss-caption">
            <button
              type="button"
              className="tl-shop-link"
              title="Search Beatport"
              onClick={(e) => {
                e.stopPropagation()
                void window.setsense.openExternal(track.discoverMeta!.beatportUrl)
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <ExternalLink size={10} strokeWidth={1.7} aria-hidden="true" />
              Beatport
            </button>
            <button
              type="button"
              className="tl-shop-link"
              title="Search SoundCloud"
              onClick={(e) => {
                e.stopPropagation()
                void window.setsense.openExternal(track.discoverMeta!.soundcloudUrl)
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <ExternalLink size={10} strokeWidth={1.7} aria-hidden="true" />
              SoundCloud
            </button>
          </div>
        )}
        {score ? (
          <div
            className="tl-q"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            title={`Score ${score.score}/100 · ${score.reasons.join(' · ')} — green = clean mix, amber = messy, red = trainwreck`}
          >
            <TransitionDot kind={score.dotKind} />
            {learnModeEnabled && previousTrack ? (
              <LearnTooltip
                explanation={explainTransition(score, previousTrack, track)}
                iconLabel={`Explain transition: ${score.label}`}
              >
                <span
                  className="ss-caption"
                  style={{
                    color:
                      score.dotKind === 'trainwreck'
                        ? 'var(--semantic-danger)'
                        : `var(--semantic-${score.dotKind})`,
                  }}
                >
                  {score.label}
                </span>
              </LearnTooltip>
            ) : (
              <span
                className="ss-caption"
                style={{
                  color:
                    score.dotKind === 'trainwreck'
                      ? 'var(--semantic-danger)'
                      : `var(--semantic-${score.dotKind})`,
                }}
              >
                {score.label}
              </span>
            )}
          </div>
        ) : null}
      </div>

      <div className="tl-time">{formatDuration(track.duration)}</div>

      <div className="tl-actions-wrap">
        <button
          type="button"
          className={clsx('icon-btn sm tl-lock-btn', isLocked && 'tl-lock-btn--locked')}
          aria-label={isLocked ? `Unlock ${track.title}` : `Lock ${track.title} in place`}
          aria-pressed={isLocked}
          title={
            isLocked
              ? 'Locked in place — Set Architect will preserve this position'
              : "Lock in place — Set Architect won't replace this track"
          }
          onClick={(e) => { e.stopPropagation(); toggleLock(setTrack.id) }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {isLocked ? (
            <Lock size={13} strokeWidth={2} aria-hidden="true" />
          ) : (
            <LockOpen size={13} strokeWidth={2} aria-hidden="true" />
          )}
        </button>

        {onRemove && (
          <button
            type="button"
            className="icon-btn sm"
            aria-label={`Remove ${track.title}`}
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <X size={13} strokeWidth={2} aria-hidden="true" />
          </button>
        )}

        {!isPhantom && (
          <button
            ref={menuBtnRef}
            type="button"
            className="icon-btn sm tl-lock-btn"
            aria-label="More actions"
            title="More actions"
            aria-expanded={showMenu}
            onClick={openMenu}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={13} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>

      {isThisPlaying && (
        <div
          className="tl-wave"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <Waveform
            filePath={track.filePath}
            compact
            currentTime={previewCurrentTime}
            onSeek={(ms) => usePlaybackStore.getState().requestSeek(ms)}
          />
        </div>
      )}
    </div>

    {showMenu && menuPos && createPortal(
      <div
        ref={menuRef}
        className="tl-overflow-menu glass-3"
        style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="tl-overflow-btn"
          onClick={(e) => { e.stopPropagation(); setShowMenu(false); void handleShowCombos(e) }}
        >
          <History size={13} strokeWidth={1.7} aria-hidden="true" />
          Play history
        </button>
        <button
          type="button"
          className="tl-overflow-btn"
          onClick={(e) => { e.stopPropagation(); setShowMenu(false); handleEditCues(e) }}
        >
          <Disc3 size={13} strokeWidth={1.7} aria-hidden="true" />
          Edit cue points
        </button>
      </div>,
      document.body,
    )}

    {combosData && createPortal(
      <div
        className="combos-overlay"
        role="dialog"
        aria-label={`Tracks played after ${track.title}`}
        onClick={(e) => { if (e.target === e.currentTarget) setCombosData(null) }}
      >
        <div className="combos-popover glass-3">
          <div className="combos-header">
            <div>
              <div className="ss-label" style={{ color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>After</div>
              <div className="ss-body-sm" style={{ fontWeight: 500 }}>{track.title}</div>
            </div>
            <button className="smart-filter-dismiss" onClick={() => setCombosData(null)} aria-label="Close">
              <X size={12} strokeWidth={2} />
            </button>
          </div>
          {combosData.loading ? (
            <div className="ss-caption" style={{ color: 'var(--text-tertiary)', padding: '8px 0' }}>
              Loading…
            </div>
          ) : combosData.results.length === 0 ? (
            <div className="ss-caption" style={{ color: 'var(--text-tertiary)', padding: '8px 0' }}>
              No play history yet. Import your Rekordbox performance data to see this.
            </div>
          ) : (
            <div className="combos-list">
              {combosData.results.slice(0, 5).map((c) => (
                <div key={c.track.id} className="combo-row">
                  <div className="combo-track">
                    <div className="ss-body-sm">{c.track.title}</div>
                    <div className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>{c.track.artist}</div>
                  </div>
                  <span className="combo-count ss-caption">{c.count}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>,
      document.body,
    )}
    </>
  )
})
