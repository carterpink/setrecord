import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Magnet,
  Pause,
  Play,
  Repeat,
  SkipBack,
  Volume2,
  X
} from 'lucide-react'
import type { CuePoint, HotCue, Loop, Track } from '@/types'
import { ProWaveform, type ProWaveformHandle } from '@/components/waveform/ProWaveform'
import { CueTimeReadout } from '@/components/modals/cue-editor/CueTimeReadout'
import { HotCueGrid } from '@/components/modals/cue-editor/HotCueGrid'
import { Modal } from '@/components/shared/Modal'
import { toMediaUrl } from '@/utils/mediaUrl'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { useToastStore } from '@/stores/toastStore'
import { usePlaybackStore } from '@/stores/playbackStore'
import { HOT_CUE_COLORS } from '@/utils/constants'
import { formatMs } from '@/utils/format'
import { loadPeaks, getCachedPeaks, type WaveformPeaks } from '@/utils/waveformPeaksCache'
import { detectPhrases, type PhraseSegment } from '@/utils/phrases'
import { makeBeatgrid, nearestBeatMs, beatsToMs } from '@/utils/beatgrid'

type LoadStatus = 'loading' | 'ready' | 'error' | 'missing'
const BEAT_LOOP_OPTIONS = [0.5, 1, 2, 4, 8, 16]

export function CuePointEditor(): React.JSX.Element {
  const { t } = useTranslation('modals')
  const { closeModal } = useUiStore()
  const { selectedTrackId, currentSet } = useSetStore()
  const { patchTrackCues, patchTrackBeatgrid, patchTrackLoops } = useLibraryStore()

  const selectedSetTrack = currentSet?.tracks.find((st) => st.id === selectedTrackId) ?? null
  const baseTrack: Track | null = selectedSetTrack?.track ?? null
  // Prefer the libraryStore copy (patched on save) so re-opening reflects edits.
  const libTrack = useLibraryStore((s) =>
    baseTrack ? s.tracks.find((t) => t.id === baseTrack.id) : undefined
  )
  const track = libTrack ?? baseTrack

  const [cuePoints, setCuePoints] = useState<CuePoint[]>(track?.cuePoints ?? [])
  const [hotCues, setHotCues] = useState<HotCue[]>(track?.hotCues ?? [])
  const [loops, setLoops] = useState<Loop[]>(track?.loops ?? [])
  const [bpm, setBpm] = useState(track?.bpm ?? 0)
  const [anchorMs, setAnchorMs] = useState(track?.beatgridOffset ?? 0)
  const [durationMs, setDurationMs] = useState((track?.duration ?? 0) * 1000)
  const [playing, setPlaying] = useState(false)
  const [snap, setSnap] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [showPhrases, setShowPhrases] = useState(false)
  const [follow, setFollow] = useState(false)
  const [zoomPx, setZoomPx] = useState(0)
  const [volume, setVolume] = useState(() => usePlaybackStore.getState().volume)
  const [draftLoopStart, setDraftLoopStart] = useState<number | null>(null)
  const [activeLoop, setActiveLoop] = useState<Loop | null>(null)
  const [peaks, setPeaks] = useState<WaveformPeaks | null>(() =>
    track ? (getCachedPeaks(track.filePath) ?? null) : null
  )
  const [status, setStatus] = useState<LoadStatus>(peaks ? 'ready' : 'loading')

  // Mutations go through the ref (DOM is mutable); the state copy propagates the
  // element to children once it mounts (a plain ref wouldn't trigger their render).
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)
  const setAudio = useCallback((el: HTMLAudioElement | null) => {
    audioRef.current = el
    setAudioEl(el)
  }, [])
  const wfRef = useRef<ProWaveformHandle>(null)

  const grid = useMemo(() => (bpm > 0 ? makeBeatgrid(bpm, anchorMs) : null), [bpm, anchorMs])
  const phrases = useMemo<PhraseSegment[]>(
    () => (showPhrases && peaks ? detectPhrases(peaks) : []),
    [showPhrases, peaks]
  )

  // Pause the library preview while the editor owns playback.
  useEffect(() => {
    usePlaybackStore.getState().setIsPlaying(false)
  }, [])

  // Reset everything when the selected track changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCuePoints(track?.cuePoints ?? [])
    setHotCues(track?.hotCues ?? [])
    setLoops(track?.loops ?? [])
    setBpm(track?.bpm ?? 0)
    setAnchorMs(track?.beatgridOffset ?? 0)
    setDurationMs((track?.duration ?? 0) * 1000)
    setPlaying(false)
    setActiveLoop(null)
    setDraftLoopStart(null)
    setPeaks(track ? (getCachedPeaks(track.filePath) ?? null) : null)
    setStatus(track && getCachedPeaks(track.filePath) ? 'ready' : 'loading')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id])

  // Load decoded peaks for the waveform colour + phrases.
  useEffect(() => {
    if (!track) return
    let cancelled = false
    const cached = getCachedPeaks(track.filePath)
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPeaks(cached)
      setStatus('ready')
      return
    }

    setStatus('loading')
    void loadPeaks(track.filePath).then((st) => {
      if (cancelled) return
      if (st.status === 'ready') {
        setPeaks(st.peaks)
        setStatus('ready')
        if (!durationMs) setDurationMs(st.peaks.durationSec * 1000)
      } else {
        setStatus(st.status)
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.filePath])

  // Wire the dedicated <audio> element.
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.volume = volume
    const onPlay = (): void => setPlaying(true)
    const onPause = (): void => setPlaying(false)
    const onMeta = (): void => {
      if (isFinite(a.duration)) setDurationMs(a.duration * 1000)
    }
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('loadedmetadata', onMeta)
    return () => {
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('loadedmetadata', onMeta)
      a.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioEl])

  // Active-loop wrap: jump back to loop start when playback passes the end.
  useEffect(() => {
    if (!activeLoop) return
    let raf = 0
    const tick = (): void => {
      const a = audioRef.current
      if (a && a.currentTime * 1000 >= activeLoop.endMs) {
        a.currentTime = activeLoop.startMs / 1000
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [activeLoop, audioEl])

  // ── Persistence ────────────────────────────────────────────────────────────
  const saveCues = useCallback(
    async (nextCues: CuePoint[], nextHot: HotCue[]) => {
      if (!track) return
      const pc = cuePoints
      const ph = hotCues
      setCuePoints(nextCues)
      setHotCues(nextHot)
      try {
        await window.setrecord.updateTrackCues(track.id, nextCues, nextHot)
        patchTrackCues(track.id, nextCues, nextHot)
      } catch (err) {
        console.error('[CuePointEditor] updateTrackCues failed', err)
        setCuePoints(pc)
        setHotCues(ph)
        useToastStore.getState().error(t('cueEditor.saveCueError'))
      }
    },
    [track, cuePoints, hotCues, patchTrackCues, t]
  )

  const saveBeatgrid = useCallback(
    async (nextBpm: number, nextAnchor: number) => {
      if (!track) return
      setBpm(nextBpm)
      setAnchorMs(nextAnchor)
      try {
        await window.setrecord.updateTrackBeatgrid(track.id, nextBpm, nextAnchor)
        patchTrackBeatgrid(track.id, nextBpm, nextAnchor)
      } catch (err) {
        console.error('[CuePointEditor] updateTrackBeatgrid failed', err)
        useToastStore.getState().error(t('cueEditor.saveBeatgridError'))
      }
    },
    [track, patchTrackBeatgrid, t]
  )

  const saveLoops = useCallback(
    async (next: Loop[]) => {
      if (!track) return
      const prev = loops
      setLoops(next)
      try {
        await window.setrecord.updateTrackLoops(track.id, next)
        patchTrackLoops(track.id, next)
      } catch (err) {
        console.error('[CuePointEditor] updateTrackLoops failed', err)
        setLoops(prev)
        useToastStore.getState().error(t('cueEditor.saveLoopError'))
      }
    },
    [track, loops, patchTrackLoops, t]
  )

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const nowMs = (): number => {
    const a = audioRef.current
    return a && isFinite(a.currentTime) ? a.currentTime * 1000 : 0
  }
  const snapMs = (ms: number): number => (snap && grid ? nearestBeatMs(grid, ms) : ms)
  const seek = (ms: number): void => {
    const a = audioRef.current
    if (a) a.currentTime = Math.max(0, ms) / 1000
  }
  const togglePlay = (): void => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) void a.play().catch(() => {})
    else a.pause()
  }
  const nudge = (deltaMs: number): void => seek(nowMs() + deltaMs)

  function handleSetDefaultCue(): void {
    const ms = Math.round(snapMs(nowMs()))
    saveCues([...cuePoints.filter((c) => c.type !== 'cue'), { position: ms, type: 'cue' }], hotCues)
  }
  function handleHotCue(index: number): void {
    const exists = hotCues.find((hc) => hc.index === index)
    if (exists) {
      saveCues(
        cuePoints,
        hotCues.filter((hc) => hc.index !== index)
      )
      return
    }
    const ms = Math.round(snapMs(nowMs()))
    saveCues(cuePoints, [...hotCues, { index, position: ms, color: HOT_CUE_COLORS[index] }])
  }
  function handleDelete(): void {
    const cur = nowMs()
    const nearHot = hotCues
      .filter((hc) => Math.abs(hc.position - cur) <= 500)
      .sort((a, b) => Math.abs(a.position - cur) - Math.abs(b.position - cur))[0]
    if (nearHot) {
      saveCues(
        cuePoints,
        hotCues.filter((hc) => hc.index !== nearHot.index)
      )
      return
    }
    const nearCue = cuePoints.find((c) => c.type === 'cue' && Math.abs(c.position - cur) <= 500)
    if (nearCue) {
      saveCues(
        cuePoints.filter((c) => c !== nearCue),
        hotCues
      )
    }
  }

  // ── Beatgrid editing ──────────────────────────────────────────────────────────
  const setDownbeatHere = (): void => {
    void saveBeatgrid(bpm, Math.round(nowMs()))
  }
  const nudgeGrid = (deltaMs: number): void => {
    void saveBeatgrid(bpm, Math.round(anchorMs + deltaMs))
  }
  const halveBpm = (): void => {
    if (bpm > 0) void saveBeatgrid(Math.round((bpm / 2) * 100) / 100, anchorMs)
  }
  const doubleBpm = (): void => {
    if (bpm > 0) void saveBeatgrid(Math.round(bpm * 2 * 100) / 100, anchorMs)
  }

  // ── Loops ──────────────────────────────────────────────────────────────────────
  function beatLoop(beats: number): void {
    if (!grid) return
    const start = snapMs(nowMs())
    const end = start + beatsToMs(grid, beats)
    const loop: Loop = { startMs: Math.round(start), endMs: Math.round(end), beats }
    setActiveLoop(loop)
    seek(start)
    saveLoops([...loops.filter((l) => !sameLoop(l, loop)), loop])
  }
  function handleLoopInOut(): void {
    if (draftLoopStart === null) {
      setDraftLoopStart(snapMs(nowMs()))
    } else {
      const start = Math.min(draftLoopStart, snapMs(nowMs()))
      const end = Math.max(draftLoopStart, snapMs(nowMs()))
      if (end - start > 20) {
        const loop: Loop = { startMs: Math.round(start), endMs: Math.round(end) }
        setActiveLoop(loop)
        saveLoops([...loops, loop])
      }
      setDraftLoopStart(null)
    }
  }
  const exitLoop = (): void => {
    setActiveLoop(null)
    setDraftLoopStart(null)
  }
  function deleteLoop(loop: Loop): void {
    saveLoops(loops.filter((l) => !sameLoop(l, loop)))
    if (activeLoop && sameLoop(activeLoop, loop)) setActiveLoop(null)
  }

  function handleClose(): void {
    closeModal()
  }

  // Keyboard — refs keep the listener stable.
  const refs = useRef({ handleHotCue, handleDelete, handleClose, togglePlay, nudge })
  useEffect(() => {
    refs.current = { handleHotCue, handleDelete, handleClose, togglePlay, nudge }
  })
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const r = refs.current
      if (e.code === 'Space') {
        e.preventDefault()
        r.togglePlay()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        r.nudge(-100)
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        r.nudge(100)
      } else if (e.code === 'Escape') {
        e.preventDefault()
        r.handleClose()
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault()
        r.handleDelete()
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
        const u = e.key.toUpperCase()
        if (u >= 'A' && u <= 'H') {
          e.preventDefault()
          r.handleHotCue(u.charCodeAt(0) - 65)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const defaultCue = cuePoints.find((c) => c.type === 'cue')
  const liveMs = audioEl && isFinite(audioEl.currentTime) ? audioEl.currentTime * 1000 : 0
  const draftLoop =
    draftLoopStart !== null
      ? { startMs: draftLoopStart, endMs: Math.max(draftLoopStart, liveMs) }
      : (activeLoop ?? null)

  return (
    <Modal
      onClose={handleClose}
      ariaLabel={t('cueEditor.title')}
      style={{ maxWidth: 880, width: '94vw' }}
      closeOnEscape={false}
    >
      {track && (
        <audio
          ref={setAudio}
          src={toMediaUrl(track.filePath)}
          preload="auto"
          style={{ display: 'none' }}
        />
      )}

      <div className="modal-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          {track ? (
            <>
              <div className="ss-h3" style={{ marginBottom: 2 }}>
                {track.title}
              </div>
              <div className="ss-body-sm" style={{ color: 'var(--text-secondary)' }}>
                {track.artist}
              </div>
            </>
          ) : (
            <div className="ss-h3">{t('cueEditor.title')}</div>
          )}
        </div>
        <button className="icon-btn" onClick={handleClose} aria-label={t('common.close')}>
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!track ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
            <div className="ss-body-sm">{t('cueEditor.noTrack')}</div>
          </div>
        ) : (
          <>
            <ProWaveform
              ref={wfRef}
              peaks={peaks}
              status={status}
              durationMs={durationMs}
              grid={grid}
              cuePoints={cuePoints}
              hotCues={hotCues}
              loops={loops}
              phrases={phrases}
              showGrid={showGrid}
              showPhrases={showPhrases}
              audio={audioEl}
              onSeek={seek}
              onZoomChange={setZoomPx}
              draftLoop={draftLoop}
            />

            {status === 'error' && (
              <div className="ss-caption" style={{ color: 'var(--semantic-danger)' }}>
                {t('cueEditor.decodeError')}
              </div>
            )}
            {status === 'missing' && (
              <div className="ss-caption" style={{ color: 'var(--semantic-warning)' }}>
                {t('cueEditor.fileNotFound')}
              </div>
            )}

            {/* Transport */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="icon-btn"
                onClick={() => seek(0)}
                aria-label={t('cueEditor.jumpToStart')}
                title={t('cueEditor.jumpToStart')}
              >
                <SkipBack size={16} strokeWidth={1.5} />
              </button>
              <button
                className="icon-btn"
                onClick={() => nudge(-100)}
                aria-label={t('cueEditor.back100')}
                title={t('cueEditor.back100Title')}
              >
                <ChevronLeft size={16} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? t('cueEditor.pause') : t('cueEditor.play')}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--accent)',
                  color: 'var(--text-on-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                {playing ? (
                  <Pause size={20} strokeWidth={1.5} />
                ) : (
                  <Play size={20} strokeWidth={1.5} />
                )}
              </button>
              <button
                className="icon-btn"
                onClick={() => nudge(100)}
                aria-label={t('cueEditor.forward100')}
                title={t('cueEditor.forward100Title')}
              >
                <ChevronRight size={16} strokeWidth={1.5} />
              </button>

              <div style={{ marginLeft: 6 }}>
                <CueTimeReadout audio={audioEl} durationMs={durationMs} grid={grid} />
              </div>

              <div style={{ flex: 1 }} />
              <Volume2
                size={16}
                strokeWidth={1.5}
                aria-hidden="true"
                style={{ color: 'var(--text-tertiary)' }}
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setVolume(v)
                  if (audioRef.current) audioRef.current.volume = v
                }}
                aria-label={t('cueEditor.volume')}
                style={{ width: 84, accentColor: 'var(--accent)' }}
              />
            </div>

            {/* View controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Toggle
                label={t('cueEditor.snap')}
                icon={Magnet}
                active={snap}
                onClick={() => setSnap((v) => !v)}
              />
              <Toggle
                label={t('cueEditor.grid')}
                active={showGrid}
                onClick={() => setShowGrid((v) => !v)}
              />
              <Toggle
                label={t('cueEditor.phrases')}
                active={showPhrases}
                onClick={() => setShowPhrases((v) => !v)}
              />
              <Toggle
                label={t('cueEditor.follow')}
                icon={Crosshair}
                active={follow}
                onClick={() => {
                  const next = !follow
                  setFollow(next)
                  wfRef.current?.setFollow(next)
                }}
              />
              <div style={{ flex: 1 }} />
              <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                {t('cueEditor.zoom')}
              </span>
              <button className="pill-btn" onClick={() => wfRef.current?.zoomFit()}>
                {t('cueEditor.fit')}
              </button>
              <button className="pill-btn" onClick={() => wfRef.current?.zoomBy(0.5)}>
                –
              </button>
              <input
                type="range"
                min={1}
                max={600}
                step={1}
                value={Math.round(zoomPx) || 1}
                onChange={(e) => wfRef.current?.zoomTo(Number(e.target.value))}
                aria-label={t('cueEditor.zoom')}
                style={{ width: 110, accentColor: 'var(--accent)' }}
              />
              <button className="pill-btn" onClick={() => wfRef.current?.zoomBy(2)}>
                +
              </button>
            </div>

            {/* Beatgrid */}
            <div className="cue-row">
              <span className="cue-row-label">{t('cueEditor.beatgrid')}</span>
              <span
                className="ss-mono"
                style={{ fontSize: 13, color: 'var(--accent)', minWidth: 64 }}
              >
                {bpm > 0 ? bpm.toFixed(2) : '—'} <span style={{ opacity: 0.5 }}>BPM</span>
              </span>
              <button className="pill-btn" onClick={halveBpm} title={t('cueEditor.halveBpm')}>
                ½×
              </button>
              <button className="pill-btn" onClick={doubleBpm} title={t('cueEditor.doubleBpm')}>
                2×
              </button>
              <button
                className="pill-btn"
                onClick={setDownbeatHere}
                title={t('cueEditor.setDownbeatTitle')}
              >
                {t('cueEditor.setDownbeat')}
              </button>
              <button
                className="pill-btn"
                onClick={() => nudgeGrid(-5)}
                title={t('cueEditor.shiftEarlier')}
              >
                ◂ 5ms
              </button>
              <button
                className="pill-btn"
                onClick={() => nudgeGrid(5)}
                title={t('cueEditor.shiftLater')}
              >
                5ms ▸
              </button>
            </div>

            {/* Loops */}
            <div className="cue-row">
              <span className="cue-row-label">
                <Repeat size={12} strokeWidth={1.5} style={{ verticalAlign: '-2px' }} />{' '}
                {t('cueEditor.loops')}
              </span>
              {BEAT_LOOP_OPTIONS.map((b) => (
                <button
                  key={b}
                  className="pill-btn"
                  disabled={!grid}
                  onClick={() => beatLoop(b)}
                  title={t('cueEditor.beatLoopTitle', { beats: b })}
                >
                  {b < 1 ? '½' : b}
                </button>
              ))}
              <button
                className="pill-btn"
                data-active={draftLoopStart !== null}
                onClick={handleLoopInOut}
              >
                {draftLoopStart !== null ? t('cueEditor.setOut') : t('cueEditor.loopIn')}
              </button>
              <button
                className="pill-btn"
                disabled={!activeLoop && draftLoopStart === null}
                onClick={exitLoop}
              >
                {t('cueEditor.exit')}
              </button>
              {loops.length > 0 && (
                <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                  {t('cueEditor.loopsSaved', { count: loops.length })}
                </span>
              )}
            </div>

            {/* Saved loops chips */}
            {loops.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {loops.map((lp, i) => (
                  <span
                    key={i}
                    className="loop-chip"
                    data-active={activeLoop ? sameLoop(activeLoop, lp) : false}
                  >
                    <button
                      onClick={() => {
                        setActiveLoop(lp)
                        seek(lp.startMs)
                      }}
                      title={t('cueEditor.jumpToLoop')}
                    >
                      {formatMs(lp.startMs)}
                      {lp.beats ? ` · ${lp.beats < 1 ? '½' : lp.beats}b` : ''}
                    </button>
                    <button
                      onClick={() => deleteLoop(lp)}
                      aria-label={t('cueEditor.deleteLoop')}
                      className="loop-chip-x"
                    >
                      <X size={11} strokeWidth={2} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div style={{ height: 1, background: 'var(--border-subtle)' }} />

            {/* Default cue */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="ss-body-sm">{t('cueEditor.defaultCue')}</div>
                {defaultCue && (
                  <div
                    className="ss-caption"
                    style={{ color: 'var(--semantic-success)', marginTop: 2 }}
                  >
                    {formatMs(defaultCue.position)}
                  </div>
                )}
              </div>
              <button
                type="button"
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid #22C55E',
                  background: 'transparent',
                  color: '#22C55E',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500
                }}
                onClick={handleSetDefaultCue}
              >
                {t('cueEditor.setCue')}
              </button>
            </div>

            <div style={{ height: 1, background: 'var(--border-subtle)' }} />

            <div>
              <div className="ss-body-sm" style={{ marginBottom: 12 }}>
                {t('cueEditor.hotCues')}
              </div>
              <HotCueGrid hotCues={hotCues} onToggle={handleHotCue} />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

function sameLoop(a: Loop, b: Loop): boolean {
  return Math.abs(a.startMs - b.startMs) < 2 && Math.abs(a.endMs - b.endMs) < 2
}

function Toggle({
  label,
  icon: Icon,
  active,
  onClick
}: {
  label: string
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button type="button" className="pill-btn" data-active={active} onClick={onClick}>
      {Icon ? <Icon size={12} strokeWidth={1.5} /> : null}
      {label}
    </button>
  )
}
