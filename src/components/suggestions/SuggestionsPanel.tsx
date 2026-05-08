import { RefreshCw } from 'lucide-react'
import { IconButton } from '@/components/shared/IconButton'
import { useSetStore } from '@/stores/setStore'
import { useSuggestions } from '@/hooks/useSuggestions'
import { formatPosition } from '@/utils/format'
import { SuggestionCard } from './SuggestionCard'


export function SuggestionsPanel(): React.JSX.Element {
  const { currentSet, selectedTrackId, addTrack } = useSetStore()

  const selectedSetTrack = currentSet?.tracks.find((st) => st.id === selectedTrackId)

  // Pass live track IDs so the engine excludes them even before the DB save debounce fires
  const currentTrackIds = currentSet?.tracks.map((st) => st.trackId) ?? []

  const { suggestions, isLoading, refresh } = useSuggestions(
    selectedSetTrack?.trackId ?? null,
    currentSet?.id ?? null,
    6,
    currentTrackIds,
  )

  return (
    <div className="panel glass-1">
      <div className="sugg-header">
        <div className="ss-h2">Suggested next</div>
        <IconButton
          icon={RefreshCw}
          size="sm"
          aria-label="Refresh suggestions"
          onClick={refresh}
          style={isLoading ? { animation: 'spin 0.6s linear infinite' } : undefined}
        />
      </div>

      {selectedSetTrack ? (
        <div className="ss-body-sm" style={{ marginBottom: 12 }}>
          Based on track {formatPosition(selectedSetTrack.position)} —{' '}
          {selectedSetTrack.track.title}
        </div>
      ) : (
        <div className="ss-body-sm" style={{ marginBottom: 12, color: 'var(--text-tertiary)' }}>
          Select a track in your set to see suggestions
        </div>
      )}

      <div className="sugg-list">
        {isLoading && suggestions.length === 0 ? (
          <div
            className="ss-caption"
            style={{ color: 'var(--text-tertiary)', padding: '12px 0' }}
          >
            Finding matches…
          </div>
        ) : (
          suggestions.map((s) => (
            <SuggestionCard
              key={s.track.id}
              suggestion={s}
              onAdd={() => addTrack(s.track)}
            />
          ))
        )}
      </div>
    </div>
  )
}
