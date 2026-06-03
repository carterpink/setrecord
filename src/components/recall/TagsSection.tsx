import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { Track } from '@/types'
import { useLibraryStore } from '@/stores/libraryStore'
import { TagsLibraryView } from '@/components/library/TagsLibraryView'
import { RekordboxTagExportModal } from '@/components/library/tags/RekordboxTagExportModal'
import { labelForSlug } from '@/utils/tagging/taxonomy'
import { RecallTrackLine } from './RecallTrackLine'

/** Cap rows rendered at once — this list isn't virtualised. */
const MAX_RENDER = 200

/**
 * Tags lives on the Library (Recall) screen: the auto-tagger's home. Browse the
 * tag vocabulary with live coverage, re-tag the library, send tags to Rekordbox,
 * and click any tag to audition the tracks that carry it — right here, no need to
 * jump to the Build collection.
 */
export function TagsSection(): React.JSX.Element {
  const tracks = useLibraryStore((s) => s.tracks)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  if (selectedTag) {
    const matches: Track[] = tracks.filter((t) => t.tags?.some((tt) => tt.value === selectedTag))
    return (
      <div className="recall-scroll">
        <button type="button" className="crate-back" onClick={() => setSelectedTag(null)}>
          <ChevronLeft size={14} strokeWidth={1.7} /> All tags
        </button>
        <div className="crate-tab-head">
          <span className="crate-tab-name">{labelForSlug(selectedTag)}</span>
          <span className="crate-tab-count">{matches.length} tracks</span>
        </div>
        {matches.length === 0 ? (
          <div className="library-empty" style={{ padding: 16 }}>
            No tracks carry this tag yet.
          </div>
        ) : (
          matches
            .slice(0, MAX_RENDER)
            .map((track) => <RecallTrackLine key={track.id} track={track} />)
        )}
        {matches.length > MAX_RENDER && (
          <div className="recall-more-note">
            Showing first {MAX_RENDER} of {matches.length}.
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <TagsLibraryView onSelectTag={setSelectedTag} onSendToRekordbox={() => setExportOpen(true)} />
      {exportOpen && <RekordboxTagExportModal onClose={() => setExportOpen(false)} />}
    </>
  )
}
