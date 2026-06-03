import { useEffect } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { APP_NAME } from '@/utils/constants'
import { IconButton } from '@/components/shared/IconButton'
import { EmptyState } from '@/components/shared/EmptyState'
import { PlaylistSourceDropdown } from '@/components/shared/PlaylistSourceDropdown'
import { motion, AnimatePresence, stagger } from '@/components/shared/Motion'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlaybackStore } from '@/stores/playbackStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { useSuggestions } from '@/hooks/useSuggestions'
import { formatPosition } from '@/utils/format'
import { useCanUse } from '@/stores/licenseStore'
import { ProLock } from '@/components/shared/ProGate'
import { NoLibraryState } from '@/components/shared/NoLibraryState'
import { useProgressStore } from '@/stores/progressStore'
import { SuggestionCard } from './SuggestionCard'

const listVariants = stagger(0.05)

export function SuggestionsPanel(): React.JSX.Element {
  const { currentSet, selectedTrackId, addTrackAfterSelected } = useSetStore()
  const playlists = useLibraryStore((s) => s.playlists)
  const totalTracks = useLibraryStore((s) => s.tracks.length)
  const libraryTracks = useLibraryStore((s) => s.tracks)
  const hasLibrary = useLibraryStore((s) => s.hasLibrary)
  const suggestionsSourcePlaylistIds = useUiStore((s) => s.suggestionsSourcePlaylistIds)
  const setSuggestionsSourcePlaylistIds = useUiStore((s) => s.setSuggestionsSourcePlaylistIds)
  const selectedLibraryTrackId = useUiStore((s) => s.selectedLibraryTrackId)
  const startPreview = usePlaybackStore((s) => s.startPreview)
  const canSuggest = useCanUse('suggestions')

  const selectedSetTrack = currentSet?.tracks.find((st) => st.id === selectedTrackId)

  // Library mode: no timeline track selected but user clicked a library row
  const isLibraryMode = !selectedSetTrack && !!selectedLibraryTrackId
  const libraryTrack = isLibraryMode
    ? (libraryTracks.find((t) => t.id === selectedLibraryTrackId) ?? null)
    : null

  const effectiveTrackId = selectedSetTrack?.trackId ?? selectedLibraryTrackId

  // Pass live track IDs so the engine excludes them even before the DB save debounce fires
  const currentTrackIds = currentSet?.tracks.map((st) => st.trackId) ?? []

  const { suggestions, isLoading, refresh } = useSuggestions(
    effectiveTrackId,
    currentSet?.id ?? null,
    6,
    currentTrackIds,
    suggestionsSourcePlaylistIds
  )

  // Activation moment: the first time real suggestions render, record it. This
  // is the core "what mixes next" payoff and the leading retention indicator.
  useEffect(() => {
    if (suggestions.length > 0) void useProgressStore.getState().markFirst('suggestion')
  }, [suggestions.length])

  // No library yet → route to import before anything else. There are no tracks
  // to suggest from, so we never show a paywall or a fake "finding matches" state.
  if (!hasLibrary) {
    return (
      <div className="panel glass-1">
        <div className="sugg-header">
          <div className="ss-h2">Suggested next</div>
        </div>
        <NoLibraryState
          body={`Pick any track and ${APP_NAME} suggests what mixes next — matched on key, BPM and energy. Import your library to get recommendations.`}
        />
      </div>
    )
  }

  if (!canSuggest) {
    return (
      <div className="panel glass-1">
        <div className="sugg-header">
          <div className="ss-h2">Suggested next</div>
        </div>
        <ProLock feature="suggestions" />
      </div>
    )
  }

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
        <div className="ss-body-sm" style={{ marginBottom: 8 }}>
          Based on track {formatPosition(selectedSetTrack.position)} —{' '}
          {selectedSetTrack.track.title}
        </div>
      ) : isLibraryMode && libraryTrack ? (
        <div className="ss-body-sm" style={{ marginBottom: 8 }}>
          What mixes after{' '}
          <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {libraryTrack.title}
          </strong>
        </div>
      ) : (
        <div className="ss-body-sm" style={{ marginBottom: 8, color: 'var(--text-tertiary)' }}>
          Select a track in your set or click a library track to see suggestions
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <PlaylistSourceDropdown
          playlists={playlists}
          selectedIds={suggestionsSourcePlaylistIds}
          onChange={setSuggestionsSourcePlaylistIds}
          totalCount={totalTracks}
        />
      </div>

      <div className="sugg-list">
        {isLoading && suggestions.length === 0 ? (
          // Skeleton cards while computing suggestions
          <div
            className="library-skeleton"
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="track-row"
                style={{
                  borderRadius: 10,
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.04)',
                  height: 72
                }}
              />
            ))}
          </div>
        ) : !effectiveTrackId ? (
          <EmptyState
            icon={Sparkles}
            title="No track selected"
            body="Select a track in your set or click a library track to see suggestions."
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
                  fromTrack={selectedSetTrack?.track ?? libraryTrack ?? undefined}
                  onPreview={() => startPreview(s.track)}
                  onAdd={() => addTrackAfterSelected(s.track)}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
