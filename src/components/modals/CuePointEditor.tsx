import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import type { CuePoint, HotCue, Track } from '@/types'
import { Waveform } from '@/components/shared/Waveform'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
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

  // Persist cues to SQLite and patch libraryStore in-memory
  const saveCues = useCallback(
    async (newCuePoints: CuePoint[], newHotCues: HotCue[]) => {
      if (!track) return
      setCuePoints(newCuePoints)
      setHotCues(newHotCues)
      await window.setsense.updateTrackCues(track.id, newCuePoints, newHotCues)
      patchTrackCues(track.id, newCuePoints, newHotCues)
    },
    [track, patchTrackCues]
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

  // Keyboard: Space = play/pause, ← = nudge -100, → = nudge +100
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
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [duration]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    setPlaying(false)
    closeModal()
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal glass-3"
        style={{ maxWidth: 640, width: '90vw' }}
        role="dialog"
        aria-modal="true"
        aria-label="Cue point editor"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
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
                  src={'media://' + track.filePath}
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

              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />

              {/* Default cue */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="ss-body-sm">Default cue</div>
                  {cuePoints.find((cp) => cp.type === 'cue') && (
                    <div
                      className="ss-caption"
                      style={{ color: '#22C55E', marginTop: 2 }}
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

              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />

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
                          transition: 'all 150ms cubic-bezier(0.32,0.72,0,1)',
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
                            style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}
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
      </div>
    </div>
  )
}
