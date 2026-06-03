/**
 * Live audio capture for SetSense Live (renderer side).
 *
 * Captures master-out from a chosen input device — a loopback device such as
 * BlackHole / Loopback fed by the DJ master, or a hardware interface with the
 * booth/record-out patched in — and emits fixed-length probe windows at the
 * fingerprint sample rate. The windows are handed upward (over IPC to the main
 * process, where the fingerprint index lives) via the `onWindow` callback.
 *
 * Browser/Electron-only (Web Audio). The windowing maths it relies on is unit
 * tested separately (RollingWindower); this module is the thin device glue.
 */
import { RollingWindower } from './rollingWindow'

/** Must match the fingerprint engine's FP_SAMPLE_RATE. */
export const CAPTURE_SAMPLE_RATE = 22_050
/** Probe length and how often a probe is emitted. */
export const CAPTURE_WINDOW_SEC = 6
export const CAPTURE_HOP_SEC = 1.5

export interface InputDevice {
  deviceId: string
  label: string
}

export interface AudioFeedHandle {
  stop: () => Promise<void>
}

/** Linear-resample mono PCM from `fromRate` to `toRate`. No-op when equal. */
function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input
  const ratio = fromRate / toRate
  const outLen = Math.floor(input.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio
    const i0 = Math.floor(pos)
    const frac = pos - i0
    const a = input[i0] ?? 0
    const b = input[i0 + 1] ?? a
    out[i] = a + (b - a) * frac
  }
  return out
}

/** List selectable audio input devices (labels require a prior permission grant). */
export async function listInputDevices(): Promise<InputDevice[]> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((d) => d.kind === 'audioinput')
    .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Audio input' }))
}

// AudioWorklet processor shipped as a blob URL so no separate bundled file is
// needed. It forwards a copy of each mono frame to the main thread.
const WORKLET_SRC = `
class SSCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]
    const ch = input && input[0]
    if (ch && ch.length) {
      // Copy — the worklet reuses this buffer across calls.
      this.port.postMessage(ch.slice(0))
    }
    return true
  }
}
registerProcessor('ss-capture', SSCaptureProcessor)
`

/**
 * Start capturing from `deviceId` (undefined = default input). Returns a handle
 * to stop. Audio processing (AGC/noise/echo) is disabled so the fingerprint
 * sees the raw master signal.
 */
export async function startAudioFeed(
  deviceId: string | undefined,
  onWindow: (samples: Float32Array) => void
): Promise<AudioFeedHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    },
    video: false
  })

  const ctx = new AudioContext({ sampleRate: CAPTURE_SAMPLE_RATE })
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      // a user gesture should already have unlocked it
    }
  }
  const source = ctx.createMediaStreamSource(stream)
  // The OS may ignore the requested 22.05k and run at e.g. 48k; resample each
  // emitted window down to the fingerprint rate so probes actually match.
  const actualRate = ctx.sampleRate
  const emit =
    actualRate === CAPTURE_SAMPLE_RATE
      ? onWindow
      : (w: Float32Array): void => onWindow(resampleLinear(w, actualRate, CAPTURE_SAMPLE_RATE))
  const windower = new RollingWindower(
    Math.floor(CAPTURE_WINDOW_SEC * actualRate),
    Math.floor(CAPTURE_HOP_SEC * actualRate),
    emit
  )

  // Prefer an AudioWorklet; fall back to a ScriptProcessor if the worklet module
  // can't load (e.g. CSP), so capture still works either way.
  let node: AudioNode
  try {
    const blobUrl = URL.createObjectURL(
      new Blob([WORKLET_SRC], { type: 'application/javascript' })
    )
    try {
      await ctx.audioWorklet.addModule(blobUrl)
    } finally {
      URL.revokeObjectURL(blobUrl)
    }
    const worklet = new AudioWorkletNode(ctx, 'ss-capture')
    worklet.port.onmessage = (e: MessageEvent<Float32Array>) => windower.push(e.data)
    node = worklet
  } catch {
    const sp = ctx.createScriptProcessor(4096, 1, 1)
    sp.onaudioprocess = (e) => windower.push(e.inputBuffer.getChannelData(0).slice(0))
    node = sp
  }

  source.connect(node)
  // A muted sink keeps the graph pulling without echoing audio back out.
  const sink = ctx.createGain()
  sink.gain.value = 0
  node.connect(sink)
  sink.connect(ctx.destination)

  return {
    stop: async () => {
      try {
        if (node instanceof AudioWorkletNode) node.port.onmessage = null
        else (node as ScriptProcessorNode).onaudioprocess = null
        node.disconnect()
        source.disconnect()
        sink.disconnect()
        stream.getTracks().forEach((t) => t.stop())
        await ctx.close()
      } catch {
        // best-effort teardown
      }
    }
  }
}
