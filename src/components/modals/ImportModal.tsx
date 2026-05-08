import { X } from 'lucide-react'
import { useLibraryStore } from '@/stores/libraryStore'
import { useUiStore } from '@/stores/uiStore'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { formatTotalDuration } from '@/utils/format'

/**
 * Library import modal. Three states:
 * 1. Idle — prompt to select a Rekordbox XML file.
 * 2. In-progress — chartreuse progress bar + phase label.
 * 3. Done — library stats summary with close button.
 */
export function ImportModal(): React.JSX.Element {
  const { closeModal } = useUiStore()
  const { importProgress, stats, triggerImport } = useLibraryStore()

  const pct =
    importProgress && importProgress.total > 0
      ? Math.round((importProgress.processed / importProgress.total) * 100)
      : 0

  const isDone = importProgress?.phase === 'done'
  const isActive = importProgress && !isDone

  return (
    <div className="modal-overlay">
      <div className="modal glass-3" role="dialog" aria-modal="true" aria-label="Import library">
        {/* Header */}
        <div className="modal-header">
          <span className="ss-h2">Import library</span>
          <IconButton icon={X} size="sm" aria-label="Close" onClick={closeModal} />
        </div>

        {/* Idle */}
        {!importProgress && (
          <div className="modal-body">
            <p className="ss-body-sm" style={{ marginBottom: 20 }}>
              Select your Rekordbox XML export file. SetSense reads all track metadata,
              cue points, and hot cues without modifying your Rekordbox library.
            </p>
            <Button
              variant="primary"
              onClick={async () => {
                await triggerImport()
              }}
            >
              Select file
            </Button>
          </div>
        )}

        {/* In progress */}
        {isActive && (
          <div className="modal-body">
            <div
              className="ss-caption"
              style={{ marginBottom: 8, color: 'var(--text-secondary)' }}
            >
              {importProgress.phase === 'parsing' ? 'Parsing XML…' : 'Writing to library…'}
            </div>
            <div className="progress-track glass-2">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="ss-caption" style={{ marginTop: 8 }}>
              {importProgress.processed.toLocaleString()} of{' '}
              {importProgress.total.toLocaleString()} tracks
            </div>
          </div>
        )}

        {/* Done */}
        {isDone && stats && (
          <div className="modal-body">
            <div className="import-stats">
              <div className="stat-row">
                <span className="ss-body-sm">Tracks imported</span>
                <span className="ss-mono">{stats.totalTracks.toLocaleString()}</span>
              </div>
              <div className="stat-row">
                <span className="ss-body-sm">Total duration</span>
                <span className="ss-mono">{formatTotalDuration(stats.totalDuration)}</span>
              </div>
              {stats.missingFiles > 0 && (
                <div className="stat-row warning">
                  <span className="ss-body-sm">Missing files</span>
                  <span className="ss-mono" style={{ color: 'var(--semantic-warning)' }}>
                    {stats.missingFiles.toLocaleString()}
                  </span>
                </div>
              )}
              {stats.tracksWithoutBpm > 0 && (
                <div className="stat-row warning">
                  <span className="ss-body-sm">Without BPM</span>
                  <span className="ss-mono" style={{ color: 'var(--semantic-warning)' }}>
                    {stats.tracksWithoutBpm.toLocaleString()}
                  </span>
                </div>
              )}
              {stats.tracksWithoutKey > 0 && (
                <div className="stat-row warning">
                  <span className="ss-body-sm">Without key</span>
                  <span className="ss-mono" style={{ color: 'var(--semantic-warning)' }}>
                    {stats.tracksWithoutKey.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <Button variant="primary" onClick={closeModal} style={{ marginTop: 20 }}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
