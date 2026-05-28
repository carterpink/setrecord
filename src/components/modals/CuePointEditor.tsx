import { useCallback, useEffect, useRef, useState } from 'react'
import FocusLock from 'react-focus-lock'
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import type { CuePoint, HotCue, Track } from '@/types'
import { Waveform } from '@/components/shared/Waveform'
import { motion, modalBackdrop, modalPanel } from '@/components/shared/Motion'
import { toMediaUrl } from '@/utils/mediaUrl'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { useToastStore } from '@/stores/toastStore'
import { HOT_CUE_COLORS, HOT_CUE_LABELS } from '@/utils/constants'

function formatMs(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  const m = Math.floor(totalSecs / 60)
  const s = totalSecs % 60
  const tenths = Math.floor((ms % 1000) / 100)
  return `${m}:${s.toString().padStart(2, '0')}.${tenths}`
}

export function CuePointEditor(): React.JSX.Element {
  const { closeModal } = useUiStore()
  const { selectedTrackId, currentSet } = useSetStore()
  const { patchTrackCues } = useLibraryStore()

  // Resolve the selected SetTrack → Track
  const selectedSetTrack = currentSet?.tracks.find((st) => st.id === selectedTrackId) ?? null
  const track: Track | null = selectedSetTrack?.track ?? null

  const [cuePoints, setCuePoints] = useState<CuePoint[]>(track?.cuePoints ?? [])
  const [hotCues, setHotCues] = useState<HotCue[]>(track?.hotCues ?? [])
  const [currentTime, setCurrentTime] = useState(0)   // ms
  const [duration, setDuration] = useState(0)         // ms
  const [playing, setPlaying] = useState(false)

  // Reset state when track changes
  useEffect(() => {
    setCuePoints(track?.cuePoints ?? [])
    setHotCues(track?.hotCues ?? [])
    setCurrentTime(0)
    setDuration(0)
    setPlaying(false)
  }, [track?.id])

  // Persist cues to SQLite and patch libraryStore in-memory. If the write fails
  // we roll back the local state — otherwise the editor would lie about what's
  // saved to disk and the next reload would silently revert.
  const saveCues = useCallback(
    async (newCuePoints: CuePoint[], newHotCues: HotCue[]) => {
      if (!track) return
      const prevCuePoints = cuePoints
      const prevHotCues = hotCues
      setCuePoints(newCuePoints)
      setHotCues(newHotCues)
      try {
        await window.setsense.updateTrackCues(track.id, newCuePoints, newHotCues)
        patchTrackCues(track.id, newCuePoints, newHotCues)
      } catch (err) {
        console.error('[CuePointEditor] updateTrackCues failed', err)
        setCuePoints(prevCuePoints)
        setHotCues(prevHotCues)
        useToastStore.getState().error('Could not save cue point — try again.')
      }
    },
    [track, cuePoints, hotCues, patchTrackCues]
  )

  // Default cue: set/replace the single {type:'cue'} entry
  function handleSetDefaultCue() {
    const filtered = cuePoints.filter((cp) => cp.type !== 'cue')
    saveCues([...filtered, { position: currentTime, type: 'cue' }], hotCues)
  }

  // Hot cue: toggle set/clear at current position
  function handleHotCue(index: number) {
    const exists = hotCues.find((hc) => hc.index === index)
    if (exists) {
      saveCues(cuePoints, hotCues.filter((hc) => hc.index !== index))
    } else {
      saveCues(cuePoints, [
        ...hotCues,
        { index, position: currentTime, color: HOT_CUE_COLORS[index] },
      ])
    }
  }

  // Nudge ±100ms, clamped to [0, duration]
  function nudge(deltaMs: number) {
    setCurrentTime((t) => Math.max(0, Math.min(duration, t + deltaMs)))
  }

  // Keep a ref to the latest handleHotCue so key shortcuts always see fresh cue state
  const handleHotCueRef = useRef(handleHotCue)
  handleHotCueRef.current = handleHotCue
  const handleCloseRef = useRef(handleClose)
  handleCloseRef.current = handleClose

  // Keyboard shortcuts:
  //   Space        = play/pause
  //   ← / →        = nudge ±100ms
  //   A–H          = set/clear hot cues A–H at current position
  //   Escape       = close modal
  //   Delete/Backspace = clear nearest cue (hot cue within 500ms, or default cue)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying((p) => !p)
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        nudge(-100)
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        nudge(100)
      } else if (e.code === 'Escape') {
        e.preventDefault()
        handleCloseRef.current()
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
        const upper = e.key.toUpperCase()
        if (upper >= 'A' && upper <= 'H') {
          e.preventDefault()
          handleHotCueRef.current(upper.charCodeAt(0) - 65)
        }
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        // Clear the nearest hot cue within 500ms, or the default cue if none
        e.preventDefault()
        const nearestHotCue = hotCues
          .filter((hc) => Math.abs(hc.position - currentTime) <= 500)
          .sort((a, b) => Math.abs(a.position - currentTime) - Math.abs(b.position - currentTime))[0]
        if (nearestHotCue) {
          saveCues(cuePoints, hotCues.filter((hc) => hc.index !== nearestHotCue.index))
        } else {
          const nearestDefault = cuePoints
            .filter((cp) => cp.type === 'cue' && Math.abs(cp.position - currentTime) <= 500)[0]
          if (nearestDefault) {
            saveCues(cuePoints.filter((cp) => cp !== nearestDefault), hotCues)
          }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, hotCues, cuePoints, currentTime])

  function handleClose() {
    setPlaying(false)
    closeModal()
  }

  return (
    <motion.div
      className="modal-overlay"
      variants={modalBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={handleClose}
    >
      <FocusLock returnFocus>
      <motion.div
        className="modal glass-3"
        variants={modalPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{ maxWidth: 640, width: '90vw' }}
        role="dialog"
        aria-modal="true"
        aria-label="Cue point editor"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          {track && (
            <div
              aria-hidden="true"
              style={{
                position: 'relative',
                width: 48,
                height: 48,
                flexShrink: 0,
                marginRight: 12,
                borderRadius: 'var(--radius-xs)',
                overflow: 'hidden',
                ...(track.artGradient ? { background: track.artGradient } : {}),
              }}
            >
              {track.albumArtPath && (
                <img
                  src={toMediaUrl(track.albumArtPath)}
                  alt=""
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              )}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {track ? (
              <>
                <div className="ss-h3" style={{ marginBottom: 2 }}>{track.title}</div>
                <div className="ss-body-sm" style={{ color: 'var(--text-secondary)' }}>
                  {track.artist}
                </div>
              </>
            ) : (
              <div className="ss-h3">Cue point editor</div>
            )}
          </div>
          <button className="icon-btn" onClick={handleClose} aria-label="Close">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {!track ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              <div className="ss-body-sm">
                Select a track in the set timeline, then open the cue editor.
              </div>
            </div>
          ) : (
            <>
              {/* Waveform */}
              <div
                style={{
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.04)',
                }}
              >
                <Waveform
                  filePath={track.filePath}
                  cuePoints={cuePoints}
                  hotCues={hotCues}
                  playing={playing}
                  currentTime={currentTime}
                  onSeek={(ms) => setCurrentTime(ms)}
                  onDuration={(ms) => setDuration(ms)}
                  onTimeUpdate={(ms) => setCurrentTime(ms)}
                />
              </div>

              {/* Transport controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  className="icon-btn"
                  onClick={() => nudge(-100)}
                  aria-label="Back 100ms"
                  title="← Back 100ms"
                >
                  <ChevronLeft size={16} strokeWidth={1.5} />
                </button>

                <button
                  className="icon-btn"
                  style={{
                    background: 'var(--accent)',
                    color: '#000',
                    borderRadius: '50%',
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? 'Pause' : 'Play'}
                >
                  {playing ? (
                    <Pause size={18} strokeWidth={1.5} />
                  ) : (
                    <Play size={18} strokeWidth={1.5} />
                  )}
                </button>

                <button
                  className="icon-btn"
                  onClick={() => nudge(100)}
                  aria-label="Forward 100ms"
                  title="→ Forward 100ms"
                >
                  <ChevronRight size={16} strokeWidth={1.5} />
                </button>

                <span
                  className="ss-mono"
                  style={{
                    marginLeft: 8,
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                    letterSpacing: '0.02em',
                  }}
                >
                  {formatMs(currentTime)}
                  {duration > 0 && (
                    <span style={{ opacity: 0.4 }}> / {formatMs(duration)}</span>
                  )}
                </span>
              </div>

              <div style={{ height: 1, background: 'var(--border-subtle)' }} />

              {/* Default cue */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="ss-body-sm">Default cue</div>
                  {cuePoints.find((cp) => cp.type === 'cue') && (
                    <div
                      className="ss-caption"
                      style={{ color: 'var(--semantic-success)', marginTop: 2 }}
                    >
                      {formatMs(cuePoints.find((cp) => cp.type === 'cue')!.position)}
                    </div>
                  )}
                </div>
                <button
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: '1px solid #22C55E',
                    background: 'transparent',
                    color: '#22C55E',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                  onClick={handleSetDefaultCue}
                >
                  Set cue
                </button>
              </div>

              <div style={{ height: 1, background: 'var(--border-subtle)' }} />

              {/* Hot cues A–H */}
              <div>
                <div className="ss-body-sm" style={{ marginBottom: 12 }}>Hot cues</div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 8,
                  }}
                >
                  {HOT_CUE_LABELS.map((label, index) => {
                    const hc = hotCues.find((h) => h.index === index)
                    const color = HOT_CUE_COLORS[index]
                    return (
                      <button
                        key={label}
                        onClick={() => handleHotCue(index)}
                        style={{
                          padding: '10px 8px',
                          borderRadius: 8,
                          border: hc
                            ? `1.5px solid ${color}`
                            : '1.5px solid rgba(255,255,255,0.12)',
                          background: hc ? `${color}18` : 'rgba(255,255,255,0.04)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 4,
                          transition:
                            'background-color 150ms cubic-bezier(0.32,0.72,0.12,1), border-color 150ms cubic-bezier(0.32,0.72,0.12,1), transform 150ms cubic-bezier(0.32,0.72,0.12,1)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: hc ? color : 'rgba(255,255,255,0.2)',
                            }}
                          />
                          <span
                            className="ss-mono"
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: hc ? color : 'var(--text-secondary)',
                            }}
                          >
                            {label}
                          </span>
                        </div>
                        {hc ? (
                          <span
                            className="ss-caption"
                            style={{ color: 'var(--text-secondary)', fontSize: 10 }}
                          >
                            {formatMs(hc.position)}
                          </span>
                        ) : (
                          <span
                            className="ss-caption"
                            style={{ color: 'var(--text-tertiary)', fontSize: 10 }}
                          >
                            empty
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
      </FocusLock>
    </motion.div>
  )
}
