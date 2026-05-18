import { useEffect, useRef } from 'react'
import type { CuePoint, HotCue } from '@/types'
import { HOT_CUE_COLORS } from '@/utils/constants'

interface WaveformProps {
  /** Absolute path to the audio file. Loaded via IPC + Blob → WaveSurfer. */
  filePath: string
  cuePoints?: CuePoint[]
  hotCues?: HotCue[]
  playing?: boolean
  /** ms. Editor: drives seekTo on nudge. Compact: drives a passive playhead. */
  currentTime?: number
  onSeek?: (ms: number) => void
  onDuration?: (ms: number) => void
  onTimeUpdate?: (ms: number) => void
  /** Smaller height, no cue markers, no internal playback. Still scrubbable. */
  compact?: boolean
}

type WS = import('wavesurfer.js').default

export function Waveform({
  filePath,
  cuePoints = [],
  hotCues = [],
  playing = false,
  currentTime = 0,
  onSeek,
  onDuration,
  onTimeUpdate,
  compact = false,
}: WaveformProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WS | null>(null)
  const durationRef = useRef(0)
  const internalTimeRef = useRef(0)
  const pathRef = useRef(filePath)
  pathRef.current = filePath
  const compactRef = useRef(compact)
  compactRef.current = compact
  const onSeekRef = useRef(onSeek)
  onSeekRef.current = onSeek

  // Create WaveSurfer instance once
  useEffect(() => {
    if (!containerRef.current) return
    let ws: WS
    let cancelled = false

    import('wavesurfer.js').then(({ default: WaveSurfer }) => {
      if (cancelled || !containerRef.current) return
      ws = WaveSurfer.create({
        container: containerRef.current,
        height: compactRef.current ? 28 : 80,
        waveColor: 'rgba(255,255,255,0.25)',
        progressColor: '#C8FF3D',
        cursorColor: compactRef.current ? 'rgba(255,255,255,0.6)' : '#ffffff',
        cursorWidth: 1,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        // Compact rows are still scrubbable — click anywhere to seek.
        interact: true,
      })

      ws.on('ready', (dur: number) => {
        durationRef.current = dur
        onDuration?.(dur * 1000)
      })

      ws.on('timeupdate', (t: number) => {
        internalTimeRef.current = t * 1000
        onTimeUpdate?.(t * 1000)
      })

      // 'interaction' fires on user click — distinct from programmatic setTime
      ws.on('interaction', (newTime: number) => {
        const ms = newTime * 1000
        internalTimeRef.current = ms
        onSeekRef.current?.(ms)
      })

      ws.on('error', (err: unknown) => {
        console.error('[waveform] error', err, 'path:', pathRef.current)
      })

      wsRef.current = ws
      void loadPath(ws, pathRef.current)
    }).catch((err) => {
      console.error('[waveform] dynamic import failed', err)
    })

    return () => {
      cancelled = true
      ws?.destroy()
      wsRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when filePath changes
  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return
    void loadPath(ws, filePath)
  }, [filePath])

  // Sync play/pause — only the cue editor uses internal WaveSurfer playback.
  // Compact mode never auto-plays (audio comes from singleton HTMLAudioElement).
  useEffect(() => {
    if (compact) return
    const ws = wsRef.current
    if (!ws) return
    if (playing) {
      ws.play().catch((err) => console.error('[waveform] play() rejected', err))
    } else {
      ws.pause()
    }
  }, [playing, compact])

  // Drive playhead from externally-supplied currentTime
  const prevCurrentTimeRef = useRef(currentTime)
  useEffect(() => {
    const ws = wsRef.current
    const dur = durationRef.current
    if (!ws || dur <= 0) {
      prevCurrentTimeRef.current = currentTime
      return
    }
    const seconds = Math.max(0, Math.min(dur, currentTime / 1000))

    if (compact) {
      ws.setTime(seconds)
      prevCurrentTimeRef.current = currentTime
      return
    }

    // Editor: only act on nudge-sized deltas not originated from WaveSurfer itself
    const delta = Math.abs(currentTime - prevCurrentTimeRef.current)
    prevCurrentTimeRef.current = currentTime
    if (delta > 0 && delta <= 200 && Math.abs(currentTime - internalTimeRef.current) > 50) {
      ws.setTime(seconds)
    }
  }, [currentTime, compact])

  const durationMs = durationRef.current * 1000 || 1

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', minHeight: compact ? 28 : 80 }} />

      {!compact && durationRef.current > 0 && (
        <>
          {cuePoints.map((cp, i) => (
            <div
              key={`cp-${i}`}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${(cp.position / durationMs) * 100}%`,
                width: 2,
                borderRadius: 1,
                background: cp.type === 'cue' ? '#22C55E' : '#F97316',
                opacity: 0.9,
                pointerEvents: 'none',
              }}
              title={`${cp.type === 'cue' ? 'Cue' : 'Memory'}: ${formatMs(cp.position)}`}
            />
          ))}
          {hotCues.map((hc) => (
            <div
              key={`hc-${hc.index}`}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${(hc.position / durationMs) * 100}%`,
                width: 2,
                borderRadius: 1,
                background: HOT_CUE_COLORS[hc.index] ?? '#fff',
                opacity: 0.9,
                pointerEvents: 'none',
              }}
              title={`Hot cue ${'ABCDEFGH'[hc.index]}: ${formatMs(hc.position)}`}
            />
          ))}
        </>
      )}
    </div>
  )
}

/**
 * Read the file as raw bytes via IPC, wrap in a Blob, and feed to WaveSurfer.
 *
 * Why not `ws.load(url)` or `fetch()`: WaveSurfer's internal fetch and the
 * renderer-side `fetch('media://…')` both fail silently for custom schemes,
 * even though `<audio src="media://…">` works fine (different Chromium code
 * paths). Reading via Node's fs in the main process and shipping bytes back
 * is the only reliable path. Acceptable for preview-length audio — a typical
 * track is ~10MB.
 */
async function loadPath(ws: WS, filePath: string): Promise<void> {
  try {
    const buf = await window.setsense.readAudioFile(filePath)
    if (!buf) {
      console.error('[waveform] readAudioFile returned null', filePath)
      return
    }
    const blob = new Blob([buf])
    await ws.loadBlob(blob)
  } catch (err) {
    console.error('[waveform] load failed', err, 'path:', filePath)
  }
}

function formatMs(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  const m = Math.floor(totalSecs / 60)
  const s = totalSecs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
