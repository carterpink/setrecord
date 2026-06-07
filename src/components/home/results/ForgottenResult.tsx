import { useTranslation } from 'react-i18next'
import type { Track } from '@/types'
import { formatBpm } from '@/utils/format'
import { usePlaybackStore } from '@/stores/playbackStore'
import { lastPlayedLabel } from '@/utils/relativeTime'
import { TrackArt, AddButton } from './shared'

interface ForgottenResultProps {
  tracks: Track[]
  requested: number
}

const MAX_ROWS = 8

export function ForgottenResult({ tracks }: ForgottenResultProps): React.JSX.Element {
  const { t } = useTranslation('home')
  const startPreview = usePlaybackStore((s) => s.startPreview)
  const shown = tracks.slice(0, MAX_ROWS)
  const more = Math.max(0, tracks.length - shown.length)

  return (
    <div className="answer">
      <div className="res-head">
        <span className="res-title">{t('forgotten.title', { count: tracks.length })}</span>
        <span className="res-meta">{t('forgotten.meta')}</span>
      </div>
      <div className="res-card glass-1">
        <div className="track-list">
          {shown.map((t) => (
            <div
              className="track-row"
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => startPreview(t)}
            >
              <TrackArt track={t} />
              <div className="track-meta">
                <div className="t">{t.title}</div>
                <div className="a">{t.artist}</div>
              </div>
              <span className="track-last">{lastPlayedLabel(t.lastPlayed)}</span>
              <span className="track-bpm">{formatBpm(t.bpm)}</span>
              <AddButton track={t} />
            </div>
          ))}
        </div>
        {more > 0 && (
          <div className="bp-more" style={{ paddingLeft: 12 }}>
            {t('forgotten.moreInList', { count: more })}
          </div>
        )}
      </div>
    </div>
  )
}
