import { RefreshCw, Sparkles } from 'lucide-react'
import { IconButton } from '@/components/shared/IconButton'
import { EmptyState } from '@/components/shared/EmptyState'
import { motion, AnimatePresence, stagger } from '@/components/shared/Motion'
import { useSetStore } from '@/stores/setStore'
import { useSuggestions } from '@/hooks/useSuggestions'
import { formatPosition } from '@/utils/format'
import { SuggestionCard } from './SuggestionCard'

const listVariants = stagger(0.05)


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
          // Skeleton cards while computing suggestions
          <div className="library-skeleton" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="track-row"
                style={{
                  borderRadius: 10,
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.04)',
                  height: 72,
                }}
              />
            ))}
          </div>
        ) : !selectedSetTrack ? (
          <EmptyState
            icon={Sparkles}
            title="No track selected"
            body="Select a track in your set and suggestions will appear here."
          />
        ) : suggestions.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No matches found"
            body="Try adding more tracks to your library or adjusting BPM range."
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={suggestions.map((s) => s.track.id).join('|')}
              variants={listVariants}
              initial="hidden"
              animate="visible"
              style={{ display: 'flex', flexDirection: 'column', gap: 'inherit' }}
            >
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.track.id}
                  suggestion={s}
                  fromTrack={selectedSetTrack?.track}
                  onAdd={() => addTrack(s.track)}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
