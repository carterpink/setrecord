import { useEffect, useRef } from 'react'
import type { CuePoint, HotCue } from '@/types'
import { HOT_CUE_COLORS } from '@/utils/constants'

interface WaveformProps {
  src: string
  cuePoints: CuePoint[]
  hotCues: HotCue[]
  playing: boolean
  currentTime: number   // ms — used for seekTo from parent nudge actions
  onSeek: (ms: number) => void
  onDuration: (ms: number) => void
  onTimeUpdate: (ms: number) => void
}

// WaveSurfer is imported dynamically so it never blocks the renderer thread
type WS = import('wavesurfer.js').default

export function Waveform({
  src,
  cuePoints,
  hotCues,
  playing,
  currentTime,
  onSeek,
  onDuration,
  onTimeUpdate,
}: WaveformProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WS | null>(null)
  const durationRef = useRef(0)
  // Track whether last currentTime change came from WaveSurfer or from the parent (nudge)
  const internalTimeRef = useRef(0)

  // Create WaveSurfer instance once and load initial src
  useEffect(() => {
    if (!containerRef.current) return
    let ws: WS

    import('wavesurfer.js').then(({ default: WaveSurfer }) => {
      if (!containerRef.current) return
      ws = WaveSurfer.create({
        container: containerRef.current,
        height: 80,
        waveColor: 'rgba(255,255,255,0.25)',
        progressColor: '#C8FF3D',
        cursorColor: '#ffffff',
        cursorWidth: 1,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        interact: true,
      })

      ws.on('ready', (dur: number) => {
        durationRef.current = dur
        onDuration(dur * 1000)
      })

      ws.on('timeupdate', (t: number) => {
        internalTimeRef.current = t * 1000
        onTimeUpdate(t * 1000)
      })

      ws.on('seeking', (t: number) => {
        internalTimeRef.current = t * 1000
        onSeek(t * 1000)
      })

      ws.load(src)
      wsRef.current = ws
    })

    return () => {
      ws?.destroy()
      wsRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when src changes (new track selected)
  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return
    ws.load(src)
  }, [src])

  // Sync play/pause
  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return
    if (playing) {
      ws.play().catch(() => {})
    } else {
      ws.pause()
    }
  }, [playing])

  // Seek when parent nudges (currentTime changed externally, not from WaveSurfer events)
  const prevCurrentTimeRef = useRef(currentTime)
  useEffect(() => {
    const delta = Math.abs(currentTime - prevCurrentTimeRef.current)
    prevCurrentTimeRef.current = currentTime
    // Only act if the change is small (nudge ±100ms) and didn't originate from WaveSurfer
    if (delta > 0 && delta <= 200 && Math.abs(currentTime - internalTimeRef.current) > 50) {
      const ws = wsRef.current
      const dur = durationRef.current
      if (ws && dur > 0) {
        const progress = Math.max(0, Math.min(1, currentTime / 1000 / dur))
        ws.seekTo(progress)
      }
    }
  }, [currentTime])

  const durationMs = durationRef.current * 1000 || 1

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div ref={containerRef} style={{ width: '100%' }} />

      {/* Cue point markers */}
      {durationRef.current > 0 && (
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

function formatMs(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  const m = Math.floor(totalSecs / 60)
  const s = totalSecs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
