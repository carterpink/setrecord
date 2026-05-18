import { useMemo, useState, useCallback, useEffect } from 'react'
import { X, Play, AlertTriangle, Layers, RefreshCw } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { ClarityBadge } from '@/components/discover/ClarityBadge'
import { motion, modalBackdrop, modalPanel } from '@/components/shared/Motion'
import { useDiscoverStore } from '@/stores/discoverStore'
import { useUiStore } from '@/stores/uiStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSetStore } from '@/stores/setStore'
import { matchManyToLibrary } from '@/utils/libraryMatch'
import { youtubeEmbedUrl } from '@/utils/shopLinks'
import { TracklistRow } from './TracklistRow'

function formatDurationShort(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function SetDetailsModal(): React.JSX.Element | null {
  const closeModal = useUiStore((s) => s.closeModal)
  const showModal = useUiStore((s) => s.showModal)
  const activeId = useUiStore((s) => s.activeDiscoverSetId)
  const getSetById = useDiscoverStore((s) => s.getSetById)
  const tasteProfile = useDiscoverStore((s) => s.tasteProfile)
  const allTracks = useLibraryStore((s) => s.tracks)
  const currentSet = useSetStore((s) => s.currentSet)
  const savedSets = useSetStore((s) => s.savedSets)
  const loadTracklistForSet = useDiscoverStore((s) => s.loadTracklistForSet)
  const [videoActive, setVideoActive] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [tracklistLoading, setTracklistLoading] = useState(false)

  // Auto-fetch tracklist the first time the modal opens for a set that has none yet
  useEffect(() => {
    if (!activeId) return
    const currentSet = getSetById(activeId)
    if (!currentSet || currentSet.tracklist.length > 0) return
    setTracklistLoading(true)
    void loadTracklistForSet(activeId).finally(() => setTracklistLoading(false))
  }, [activeId, getSetById, loadTracklistForSet])

  const handleRefresh = useCallback(async () => {
    if (!activeId || refreshing) return
    if (typeof window.setsense?.discoverRefreshSet !== 'function') return
    setRefreshing(true)
    try {
      const updated = await window.setsense.discoverRefreshSet(activeId, tasteProfile)
      if (updated) {
        // Patch the store's set list with the refreshed payload
        useDiscoverStore.setState((s) => ({
          sets: s.sets.map((existing) => existing.id === updated.id ? updated : existing)
        }))
      }
    } finally {
      setRefreshing(false)
    }
  }, [activeId, tasteProfile, refreshing])

  const set = activeId ? getSetById(activeId) : undefined

  const matches = useMemo(() => {
    if (!set) return []
    return matchManyToLibrary(set.tracklist, allTracks)
  }, [set, allTracks])

  if (!set) return null

  const currentSetName = currentSet?.name ?? 'New set'

  return (
    <motion.div
      className="modal-overlay"
      variants={modalBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={closeModal}
    >
      <motion.div
        className="modal glass-3 set-details-modal"
        variants={modalPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        role="dialog"
        aria-modal="true"
        aria-label={`Set details: ${set.title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="set-details-header-meta">
            <span className="ss-h2">{set.djName}</span>
            {set.eventName && <span className="ss-body-sm set-details-event">@ {set.eventName}</span>}
          </div>
          <IconButton icon={X} size="sm" aria-label="Close" onClick={closeModal} />
        </div>

        <div className="modal-body set-details-body">
          <div className="set-details-video-wrap">
            {videoActive ? (
              <iframe
                title={`${set.djName} — ${set.title}`}
                src={youtubeEmbedUrl(set.videoId)}
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="set-details-video-iframe"
              />
            ) : (
              <button
                type="button"
                className="set-details-video-thumb-btn"
                onClick={() => setVideoActive(true)}
                aria-label="Play video"
              >
                <img
                  src={set.thumbnailUrl}
                  alt=""
                  className="set-details-video-thumb"
                  referrerPolicy="no-referrer"
                />
                <span className="set-details-video-play" aria-hidden="true">
                  <Play size={28} strokeWidth={1.5} fill="currentColor" />
                </span>
              </button>
            )}
          </div>

          <div className="set-details-meta">
            <ClarityBadge clarity={set.clarity} />
            <span className="ss-caption set-details-meta-item">
              <span className="ss-mono">{formatDurationShort(set.durationSeconds)}</span> duration
            </span>
            <span className="ss-caption set-details-meta-item">
              <span className="ss-mono">{set.viewCount.toLocaleString()}</span> views
            </span>
            <span className="ss-caption set-details-meta-item">
              {new Date(set.uploadedAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>

          <div
            className={`set-details-desc ${descExpanded ? 'expanded' : 'collapsed'}`}
            onClick={() => setDescExpanded((v) => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setDescExpanded((v) => !v)
              }
            }}
            aria-expanded={descExpanded}
          >
            <p className="ss-body-sm">{set.description}</p>
          </div>

          <div className="tracklist-header">
            <div className="ss-h3">Tracklist</div>
            <button
              type="button"
              className="discover-refresh-btn"
              aria-label="Refresh tracklist from YouTube"
              title="Re-fetch tracklist from YouTube"
              disabled={refreshing || tracklistLoading}
              onClick={() => void handleRefresh()}
            >
              <RefreshCw
                size={13}
                strokeWidth={1.7}
                className={refreshing || tracklistLoading ? 'discover-spin' : ''}
              />
            </button>
            {!tracklistLoading && set.tracklist.length > 0 && (
              <div className="ss-caption tracklist-summary">
                {set.tracklist.length} tracks ·{' '}
                <span className={matches.filter((m) => m.match).length === set.tracklist.length ? 'tracklist-summary-good' : ''}>
                  {matches.filter((m) => m.match).length} in your library
                </span>
                {set.tracklistConfidence > 0 && set.tracklistConfidence < 0.6 && (
                  <span className="tracklist-incomplete-badge">
                    <AlertTriangle size={12} strokeWidth={1.7} aria-hidden="true" /> Incomplete
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="tracklist">
            {tracklistLoading ? (
              <div className="tracklist-loading ss-body-sm">
                <div className="discover-loading-spinner" />
                Extracting tracklist…
              </div>
            ) : set.tracklist.length === 0 ? (
              <div className="tracklist-empty ss-caption">
                No tracklist found in the description.{' '}
                <button type="button" className="discover-error-action" onClick={() => void handleRefresh()}>
                  Try again
                </button>
              </div>
            ) : (
              set.tracklist.map((t, i) => (
                <TracklistRow
                  key={t.id}
                  set={set}
                  track={t}
                  libraryMatch={matches[i]?.match ?? null}
                  currentSetName={currentSetName}
                  savedSets={savedSets}
                />
              ))
            )}
          </div>
        </div>

        <div className="modal-footer set-details-footer">
          <Button
            variant="primary"
            icon={Layers}
            onClick={() => showModal('bulkImportConfirm')}
          >
            Bulk import set
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
