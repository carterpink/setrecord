/**
 * Room recorder (renderer side) — the Flight Recorder's lo-fi AUDIO capture.
 *
 * Opens the default microphone and streams compact webm/opus chunks (via the
 * `onChunk` callback → IPC → main's setRecorder) for the duration of a live set.
 * Separate from `audioFeed` (which downsamples to 22 kHz mono probe windows for
 * fingerprinting): this keeps the raw mic signal so the saved reference recording
 * is listenable. Gated behind the `flightRecorderEnabled` setting by the caller.
 */

const OPUS_MIME = 'audio/webm;codecs=opus'
/** Lo-fi "memory reference" bitrate — small files, plenty for recall. */
const AUDIO_BITS_PER_SECOND = 32_000
/** Flush a chunk to disk this often so RAM stays flat across a long set. */
const TIMESLICE_MS = 5000

export interface RoomRecorderHandle {
  stop: () => void
}

/**
 * Start recording the room mic. Returns a handle to stop (which also releases the
 * mic). Throws if mic permission is denied or MediaRecorder is unavailable — the
 * caller treats audio capture as best-effort and leaves the tracklist unaffected.
 */
export async function startRoomRecorder(
  onChunk: (chunk: ArrayBuffer) => void
): Promise<RoomRecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    video: false
  })

  const mimeType = MediaRecorder.isTypeSupported(OPUS_MIME) ? OPUS_MIME : undefined
  const recorder = new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    audioBitsPerSecond: AUDIO_BITS_PER_SECOND
  })

  recorder.ondataavailable = (e: BlobEvent): void => {
    if (e.data && e.data.size > 0) {
      e.data
        .arrayBuffer()
        .then(onChunk)
        .catch(() => {
          /* a dropped chunk just shortens the recording; never fatal */
        })
    }
  }

  recorder.start(TIMESLICE_MS)

  return {
    stop: (): void => {
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } catch {
        /* already stopped */
      }
      stream.getTracks().forEach((t) => t.stop())
    }
  }
}
