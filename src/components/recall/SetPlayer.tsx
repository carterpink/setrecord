import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Disc3 } from 'lucide-react'
import type { SessionTrack, SetRecording } from '@/types'
import { toMediaUrl } from '@/utils/mediaUrl'

/** ms → "m:ss" (or "h:mm:ss" past an hour). */
function mmss(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/**
 * Plays a set's lo-fi reference recording (Flight Recorder), with the tracklist
 * mapped onto the audio timeline: each row shows when it dropped and jumps the
 * playhead there, and the row playing right now is highlighted. Native <audio>
 * controls give an accessible scrubber/play for free; per-track seek rides on the
 * `start_ms` the recorder captured.
 */
export function SetPlayer({
  recording,
  tracks
}: {
  recording: SetRecording
  tracks: SessionTrack[]
}): React.JSX.Element {
  const { t } = useTranslation('recall')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentMs, setCurrentMs] = useState(0)

  const seekTo = (startMs?: number): void => {
    const el = audioRef.current
    if (startMs == null || !el) return
    el.currentTime = startMs / 1000
    void el.play()
  }

  return (
    <div className="set-player">
      <div className="set-player-bar">
        <Disc3 size={15} strokeWidth={1.6} className="set-player-icon" />
        <span className="set-player-label">{t('gigs.recordingLabel')}</span>
        <audio
          ref={audioRef}
          className="set-player-audio"
          src={toMediaUrl(recording.audioFilePath)}
          controls
          preload="metadata"
          onTimeUpdate={(e) => setCurrentMs(e.currentTarget.currentTime * 1000)}
        />
      </div>

      <div className="recall-list">
        {tracks.map((st) => {
          const seekable = st.startMs != null
          const active =
            st.startMs != null &&
            currentMs >= st.startMs &&
            (st.endMs == null || currentMs < st.endMs)
          return (
            <button
              key={st.id}
              type="button"
              className={`set-player-row${active ? ' is-active' : ''}`}
              onClick={() => seekTo(st.startMs)}
              disabled={!seekable}
              title={seekable ? t('gigs.jumpToTrack') : undefined}
            >
              <span className="set-player-time mono">
                {st.startMs != null ? mmss(st.startMs) : '—'}
              </span>
              <span className="set-player-track">
                <span className="set-player-title">{st.track.title}</span>
                <span className="set-player-artist">{st.track.artist}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
