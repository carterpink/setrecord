import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import type { Track } from '@/types'
import { toMediaUrl } from '@/utils/mediaUrl'
import { useSetStore } from '@/stores/setStore'

/** Small album-art tile that falls back to the track's deterministic gradient. */
export function TrackArt({ track }: { track: Track }): React.JSX.Element {
  return (
    <span
      className="track-art"
      style={track.artGradient ? { background: track.artGradient } : undefined}
    >
      {track.albumArtPath && (
        <img
          src={toMediaUrl(track.albumArtPath)}
          alt=""
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
        />
      )}
    </span>
  )
}

/** The "+" add-to-set button used across the bespoke result rows. */
export function AddButton({ track, title }: { track: Track; title?: string }): React.JSX.Element {
  const { t } = useTranslation('home')
  const addTrackAndToast = useSetStore((s) => s.addTrackAndToast)
  const label = title ?? t('shared.addToCurrentSet')
  return (
    <button
      type="button"
      className="row-add"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        addTrackAndToast(track)
      }}
    >
      <Plus size={15} strokeWidth={1.7} />
    </button>
  )
}
