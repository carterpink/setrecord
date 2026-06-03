import { useCallback, useEffect, useRef, useState } from 'react'
import type { VoiceStatus } from '../types'
import { buildPcm } from './voicePcm'

/**
 * Push-to-talk mic capture for the Home composer. Records raw PCM via the Web
 * Audio API, exposes a live input level for the neural swell, and transcribes
 * with the on-device whisper model (main process) — both interim (while the
 * user is still speaking, so words fill the box live) and a final pass on stop.
 * Nothing leaves the machine.
 */
interface UseVoiceCaptureOptions {
  /** Final transcript on stop — typically auto-submitted. */
  onResult: (text: string) => void
  /** Live partial transcript while speaking (fills the box word-by-word). */
  onInterim?: (text: string) => void
  onError: (message: string) => void
  onTranscribing?: () => void
}

interface UseVoiceCapture {
  listening: boolean
  level: number
  available: boolean
  /** Lifecycle of the on-device model — drives the one-time setup chip. */
  status: VoiceStatus | null
  /** True while the model is downloading or loading (setup in progress). */
  preparing: boolean
  start: () => Promise<void>
  stop: () => Promise<void>
  cancel: () => void
}

const MAX_SECONDS = 30
const INTERIM_MS = 1400

export function useVoiceCapture({
  onResult,
  onInterim,
  onError,
  onTranscribing
}: UseVoiceCaptureOptions): UseVoiceCapture {
  const [listening, setListening] = useState(false)
  const [level, setLevel] = useState(0)
  const [status, setStatus] = useState<VoiceStatus | null>(null)
  const statusRef = useRef<VoiceStatus | null>(null)

  const applyStatus = useCallback((s: VoiceStatus | null) => {
    statusRef.current = s
    setStatus(s)
  }, [])

  // Load initial model status and subscribe to one-time download/load progress
  // so the setup chip can animate. Both are no-ops outside Electron.
  useEffect(() => {
    let alive = true
    void window.setsense?.speechVoiceStatus?.().then((s) => {
      if (alive) applyStatus(s)
    })
    const unsub = window.setsense?.onVoiceProgress?.((s) => applyStatus(s))
    return () => {
      alive = false
      unsub?.()
    }
  }, [applyStatus])

  const preparing = status?.state === 'downloading' || status?.state === 'loading'

  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const nodeRef = useRef<ScriptProcessorNode | null>(null)
  const chunksRef = useRef<Float32Array[]>([])
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interimTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const interimBusyRef = useRef(false)
  // Holds the latest stop fn so the auto-stop timer (set inside `start`) can call
  // it without a forward reference to the not-yet-declared `stopInternal`.
  const stopRef = useRef<() => void>(() => {})

  const available =
    typeof window !== 'undefined' &&
    typeof window.setsense?.speechTranscribe === 'function' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia

  const teardown = useCallback((): number => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }
    if (interimTimerRef.current) {
      clearInterval(interimTimerRef.current)
      interimTimerRef.current = null
    }
    nodeRef.current?.disconnect()
    nodeRef.current = null
    const rate = ctxRef.current?.sampleRate ?? 48000
    void ctxRef.current?.close()
    ctxRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setLevel(0)
    return rate
  }, [])

  const start = useCallback(async () => {
    if (!available || listening) return
    try {
      // Surface the OS mic prompt (and a hard "denied" if blocked) before we
      // open a stream, so a blocked mic reads as actionable instead of a vague
      // getUserMedia failure.
      const access = await window.setsense?.speechEnsureMicAccess?.()
      if (access === 'denied') {
        onError(
          'Microphone access is off. Turn it on for SetSense in System Settings → Privacy & Security → Microphone.'
        )
        return
      }

      // Ensure the on-device model is downloaded + loaded before capturing, so
      // the first utterance transcribes instantly instead of stalling. Progress
      // streams to the setup chip via onVoiceProgress; this is near-instant once
      // the (bundled) model is loaded.
      if (statusRef.current?.state !== 'ready') {
        const prepared = await window.setsense?.speechPrepareVoice?.()
        if (prepared) applyStatus(prepared)
        if (prepared && prepared.state === 'error') {
          onError(prepared.error ?? 'Voice input couldn’t start. You can still type.')
          return
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      ctxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const node = ctx.createScriptProcessor(4096, 1, 1)
      nodeRef.current = node
      chunksRef.current = []
      interimBusyRef.current = false

      node.onaudioprocess = (e): void => {
        const input = e.inputBuffer.getChannelData(0)
        chunksRef.current.push(new Float32Array(input))
        // RMS → 0..1 level for the neural swell.
        let sum = 0
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
        const rms = Math.sqrt(sum / input.length)
        setLevel(Math.min(1, rms * 6))
      }

      // Route through a muted gain so the ScriptProcessor pulls audio without echo.
      const mute = ctx.createGain()
      mute.gain.value = 0
      source.connect(node)
      node.connect(mute)
      mute.connect(ctx.destination)

      setListening(true)

      // Live interim transcription — re-runs whisper on the audio captured so far
      // and pushes a partial transcript so words appear as the user speaks.
      if (onInterim) {
        interimTimerRef.current = setInterval(() => {
          if (interimBusyRef.current || !ctxRef.current) return
          const chunks = chunksRef.current
          const rate = ctxRef.current.sampleRate
          const total = chunks.reduce((n, c) => n + c.length, 0)
          if (total < rate * 0.6) return // need ~0.6s before a first guess
          interimBusyRef.current = true
          const pcm = buildPcm(chunks, rate)
          window
            .setsense!.speechTranscribe(pcm)
            .then((text) => {
              // Ignore a late interim that resolves after the user stopped.
              if (ctxRef.current && text && text.trim()) onInterim(text.trim())
            })
            .catch(() => undefined)
            .finally(() => {
              interimBusyRef.current = false
            })
        }, INTERIM_MS)
      }

      autoStopRef.current = setTimeout(() => stopRef.current(), MAX_SECONDS * 1000)
    } catch (err) {
      teardown()
      setListening(false)
      // A NotAllowedError means the OS/browser layer blocked the mic — point at
      // the fix rather than a generic failure.
      if (
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'SecurityError')
      ) {
        onError(
          'Microphone access is off. Turn it on for SetSense in System Settings → Privacy & Security → Microphone.'
        )
      } else {
        onError(
          err instanceof DOMException
            ? 'I couldn’t access the microphone.'
            : 'Voice input failed to start.'
        )
      }
    }
  }, [available, listening, onError, onInterim, teardown, applyStatus])

  const stopInternal = useCallback(async () => {
    if (!ctxRef.current) return
    const chunks = chunksRef.current
    const rate = teardown()
    setListening(false)

    const total = chunks.reduce((n, c) => n + c.length, 0)
    if (total < rate * 0.25) {
      onError('Didn’t catch that — try again.')
      return
    }
    const pcm = buildPcm(chunks, rate)

    onTranscribing?.()
    try {
      const text = await window.setsense!.speechTranscribe(pcm)
      if (text && text.trim()) onResult(text.trim())
      else {
        const status = await window.setsense!.speechVoiceStatus()
        onError(status.error ?? 'Didn’t catch that — try again.')
      }
    } catch {
      onError('Voice input isn’t available right now.')
    }
  }, [onError, onResult, onTranscribing, teardown])

  // Keep the auto-stop timer pointed at the current stop fn (without touching
  // the ref during render).
  useEffect(() => {
    stopRef.current = () => void stopInternal()
  }, [stopInternal])

  const cancel = useCallback(() => {
    teardown()
    setListening(false)
  }, [teardown])

  return { listening, level, available, status, preparing, start, stop: stopInternal, cancel }
}
