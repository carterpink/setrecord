/**
 * Screen reader for SetRecord Live — the universal sensor.
 *
 * Captures the screen and OCRs it on a slow cadence, emitting the recognised
 * text lines. Main matches those lines to the library by name (see
 * nowPlayingMatch), so it works for ANYTHING that shows the track on screen:
 * Rekordbox, Serato, Traktor, Spotify, a browser tab. No loopback, no
 * master-matching. OCR runs on-device (tesseract.js).
 *
 * Browser/Electron-only. The matching brain it feeds is unit-tested separately.
 */
import { createWorker, type Worker } from 'tesseract.js'

/** How often to OCR a frame. Tracks change every minutes, so slow is fine. */
const OCR_INTERVAL_MS = 2500
/** Downscale wide screens before OCR for speed. */
const MAX_WIDTH = 1366

export interface ScreenReaderHandle {
  stop: () => Promise<void>
}

export async function startScreenReader(
  onLines: (lines: string[]) => void
): Promise<ScreenReaderHandle> {
  // Main auto-grants the primary screen (setDisplayMediaRequestHandler), so no
  // picker — but macOS still requires the Screen Recording permission once.
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })

  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  await video.play()

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  let worker: Worker | null = await createWorker('eng')
  let stopped = false
  let busy = false

  const tick = async (): Promise<void> => {
    if (stopped || busy || !worker || !ctx || !video.videoWidth) return
    busy = true
    try {
      const scale = Math.min(1, MAX_WIDTH / video.videoWidth)
      canvas.width = Math.floor(video.videoWidth * scale)
      canvas.height = Math.floor(video.videoHeight * scale)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const { data } = await worker.recognize(canvas)
      const lines = (data.lines ?? []).map((l) => l.text.trim()).filter(Boolean)
      const out = lines.length
        ? lines
        : data.text
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
      if (!stopped && out.length) onLines(out)
    } catch {
      // skip this frame
    } finally {
      busy = false
    }
  }

  const interval = setInterval(() => void tick(), OCR_INTERVAL_MS)
  void tick() // first read promptly

  return {
    stop: async () => {
      stopped = true
      clearInterval(interval)
      stream.getTracks().forEach((t) => t.stop())
      try {
        await worker?.terminate()
      } catch {
        // ignore
      }
      worker = null
    }
  }
}
