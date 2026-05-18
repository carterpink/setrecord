import { useState, useRef, useEffect } from 'react'
import { Plus, ChevronDown, ShoppingCart, ExternalLink, UserPlus } from 'lucide-react'
import type { DiscoverSet, DiscoverTrack, Track, Set as DJSet } from '@/types'
import { useSetStore } from '@/stores/setStore'
import { useToastStore } from '@/stores/toastStore'
import { useDiscoverStore } from '@/stores/discoverStore'
import { toPhantomTrack } from '@/utils/discoverPhantomTrack'

interface Props {
  set: DiscoverSet
  track: DiscoverTrack
  libraryMatch: Track | null
  currentSetName: string
  savedSets: DJSet[]
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function TracklistRow({
  set,
  track,
  libraryMatch,
  currentSetName,
  savedSets,
}: Props): React.JSX.Element {
  const addTrack = useSetStore((s) => s.addTrack)
  const loadCurrentSet = useSetStore((s) => s.loadCurrentSet)
  const toast = useToastStore()
  const favouriteArtists = useDiscoverStore((s) => s.tasteProfile.favouriteArtists)
  const followArtist = useDiscoverStore((s) => s.followArtist)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const isPhantom = !libraryMatch
  const trackToAdd: Track = libraryMatch ?? toPhantomTrack(track, set)
  const alreadyFollowingArtist = favouriteArtists.some(
    (a) => a.toLowerCase() === track.artist.toLowerCase()
  )
  const canFollow = isPhantom && !alreadyFollowingArtist && track.artist.trim().length > 0

  async function handleFollowArtist(): Promise<void> {
    await followArtist(track.artist)
    toast.success(`Now following ${track.artist}`)
  }

  function handleAdd(targetSetId?: string): void {
    if (targetSetId) {
      // Switch active set first, then add
      void loadCurrentSet(targetSetId).then(() => {
        addTrack(trackToAdd)
        const targetName = savedSets.find((s) => s.id === targetSetId)?.name ?? 'set'
        toast.success(
          `Added ${isPhantom ? 'phantom: ' : ''}${track.artist} — ${track.title} to ${targetName}`
        )
      })
    } else {
      addTrack(trackToAdd)
      toast.success(
        `Added ${isPhantom ? 'phantom: ' : ''}${track.artist} — ${track.title} to ${currentSetName}`
      )
    }
    setMenuOpen(false)
  }

  return (
    <div className={`tracklist-row ${isPhantom ? 'phantom' : 'matched'}`}>
      <div className="tracklist-row-idx ss-mono">{String(track.position).padStart(2, '0')}</div>
      <div className="tracklist-row-info">
        <div className="tracklist-row-title">
          {isPhantom ? (
            <ShoppingCart
              size={13}
              strokeWidth={1.7}
              className="tracklist-phantom-icon"
              aria-label="Not in your library — search to buy"
            />
          ) : (
            <span className="tracklist-match-dot" aria-label="In your library" />
          )}
          <span className="tracklist-artist">{track.artist}</span>
          <span className="tracklist-dash">—</span>
          <span className="tracklist-title">{track.title}</span>
        </div>
        {libraryMatch && libraryMatch.title.toLowerCase() !== track.title.toLowerCase() && (
          <div className="tracklist-row-match ss-caption">
            Matched library: {libraryMatch.artist} — {libraryMatch.title}
          </div>
        )}
      </div>
      <div className="tracklist-row-meta ss-mono">
        {track.startSeconds != null && <span>{formatTimestamp(track.startSeconds)}</span>}
      </div>
      <div className="tracklist-row-actions">
        <button
          type="button"
          className="btn btn-secondary tracklist-add-btn"
          onClick={() => handleAdd()}
          title={`Add to ${currentSetName}`}
        >
          <Plus size={14} strokeWidth={1.7} aria-hidden="true" />
          <span>Add</span>
        </button>
        {savedSets.length > 1 && (
          <div className="tracklist-add-menu" ref={menuRef}>
            <button
              type="button"
              className="btn btn-ghost tracklist-add-menu-btn"
              aria-label="Add to another set"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <ChevronDown size={14} strokeWidth={1.7} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className="tracklist-add-menu-list glass-3" role="menu">
                {savedSets.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="tracklist-add-menu-item"
                    role="menuitem"
                    onClick={() => handleAdd(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {canFollow && (
          <button
            type="button"
            className="tracklist-follow-btn"
            title={`Follow ${track.artist}`}
            aria-label={`Follow ${track.artist}`}
            onClick={(e) => {
              e.stopPropagation()
              void handleFollowArtist()
            }}
          >
            <UserPlus size={12} strokeWidth={1.7} aria-hidden="true" />
            <span className="ss-caption">Follow {track.artist}</span>
          </button>
        )}
        {isPhantom && trackToAdd.discoverMeta && (
          <div className="tracklist-shop-icons">
            <button
              type="button"
              className="tracklist-shop-link"
              title="Search Beatport"
              aria-label="Search Beatport"
              onClick={(e) => {
                e.stopPropagation()
                void window.setsense.openExternal(trackToAdd.discoverMeta!.beatportUrl)
              }}
            >
              <ExternalLink size={12} strokeWidth={1.7} aria-hidden="true" />
              <span className="ss-caption">Beatport</span>
            </button>
            <button
              type="button"
              className="tracklist-shop-link"
              title="Search SoundCloud"
              aria-label="Search SoundCloud"
              onClick={(e) => {
                e.stopPropagation()
                void window.setsense.openExternal(trackToAdd.discoverMeta!.soundcloudUrl)
              }}
            >
              <ExternalLink size={12} strokeWidth={1.7} aria-hidden="true" />
              <span className="ss-caption">SoundCloud</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
