import { useEffect, useState } from 'react'
import FocusLock from 'react-focus-lock'
import { CheckCircle, FileText, FolderOpen, Lock, Loader2, RefreshCw, ShieldAlert, X } from 'lucide-react'
import type { LibraryStats, RekordboxDetection } from '@/types'
import { useLibraryStore } from '@/stores/libraryStore'
import { useUiStore } from '@/stores/uiStore'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { LibrarySourceGuide } from '@/components/shared/LibrarySourceGuide'
import { motion, modalBackdrop, modalPanel } from '@/components/shared/Motion'
import { formatTotalDuration } from '@/utils/format'

const numberFmt = new Intl.NumberFormat('en-US')

function formatLastModified(epochMs: number | null): string {
  if (!epochMs) return ''
  try {
    return new Date(epochMs).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

/**
 * Library import modal — the canonical entry point for "load my Rekordbox library."
 *
 * Drives a 5-state flow off useLibraryStore.importState:
 *   detecting → detected (preview + confirm) → importing → done
 *               └→ not-detected (XML guide + file picker)
 *
 * Both Onboarding step 3 and the TopBar Import button open this modal.
 * Settings → Re-sync opens it in 'detecting' too — the flow is identical.
 */
export function ImportModal(): React.JSX.Element {
  const { closeModal } = useUiStore()
  const {
    importProgress,
    importState,
    detection,
    importError,
    libraryStale,
    stats,
    startAutoDetectFlow,
    confirmAutoDetectImport,
    triggerXmlImport,
    resetImportFlow,
  } = useLibraryStore()

  // Tracks whether we've already shown the one-time consent gate to the user
  // before they kicked off a DB read. Persisted in settings on accept.
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null)
  // Local UI sub-state for the confirm-consent step (between "detected" and "importing").
  const [showingConsent, setShowingConsent] = useState(false)

  // Bootstrap: on first mount, if state is idle, run the detection.
  useEffect(() => {
    if (importState === 'idle') {
      void startAutoDetectFlow()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load consent + watch for changes so future imports skip the gate.
  useEffect(() => {
    let cancelled = false
    if (typeof window.setsense !== 'undefined') {
      void window.setsense.getSettings().then((s) => {
        if (!cancelled) setConsentGiven(s.rekordboxDbConsent === true)
      })
    }
    return () => {
      cancelled = true
    }
  }, [])

  function handleClose(): void {
    // Don't reset state mid-import — the import keeps running and the user can reopen.
    if (importState !== 'importing') resetImportFlow()
    closeModal()
  }

  async function handleImportClick(): Promise<void> {
    if (consentGiven === false) {
      setShowingConsent(true)
      return
    }
    await confirmAutoDetectImport()
  }

  async function handleConsentAccept(): Promise<void> {
    if (typeof window.setsense !== 'undefined') {
      await window.setsense.setSettings({ rekordboxDbConsent: true })
    }
    setConsentGiven(true)
    setShowingConsent(false)
    await confirmAutoDetectImport()
  }

  const pct =
    importProgress && importProgress.total > 0
      ? Math.round((importProgress.processed / importProgress.total) * 100)
      : 0

  const isDone = importState === 'done'
  const isImporting = importState === 'importing'

  return (
    <motion.div
      className="modal-overlay"
      variants={modalBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <FocusLock returnFocus>
        <motion.div
          className="modal glass-3"
          variants={modalPanel}
          initial="hidden"
          animate="visible"
          exit="exit"
          role="dialog"
          aria-modal="true"
          aria-label="Import library"
          style={{ minWidth: 460, maxWidth: 520 }}
        >
          <div className="modal-header">
            <span className="ss-h2">
              {libraryStale && importState === 'detected' ? 'Re-sync library' : 'Import library'}
            </span>
            <IconButton icon={X} size="sm" aria-label="Close" onClick={handleClose} />
          </div>

          {/* ── Detecting ──────────────────────────────────────────────── */}
          {importState === 'detecting' && (
            <div className="modal-body" style={{ alignItems: 'center', textAlign: 'center', gap: 16, padding: '24px 0' }}>
              <Loader2
                size={28}
                strokeWidth={1.6}
                style={{ opacity: 0.6, animation: 'spin 1.2s linear infinite' }}
                aria-hidden="true"
              />
              <div className="ss-body-sm" style={{ opacity: 0.7 }}>
                Looking for your Rekordbox library…
              </div>
            </div>
          )}

          {/* ── Detected (master.db readable) ──────────────────────────── */}
          {importState === 'detected' && detection && !showingConsent && (
            <DetectedState
              detection={detection}
              libraryStale={libraryStale}
              onImport={handleImportClick}
              onUseXml={triggerXmlImport}
              onRetry={startAutoDetectFlow}
            />
          )}

          {/* ── Consent gate (inline between detected and importing) ──── */}
          {importState === 'detected' && showingConsent && (
            <ConsentGate
              onAccept={handleConsentAccept}
              onCancel={() => setShowingConsent(false)}
              onUseXml={triggerXmlImport}
            />
          )}

          {/* ── Not detected (XML guide) ───────────────────────────────── */}
          {importState === 'not-detected' && (
            <NotDetectedState
              importError={importError}
              onChooseXml={triggerXmlImport}
              onRetry={startAutoDetectFlow}
            />
          )}

          {/* ── Importing (progress) ───────────────────────────────────── */}
          {isImporting && importProgress && (
            <div className="modal-body">
              <div className="ss-caption" style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
                {importProgress.phase === 'parsing' ? 'Reading library…' : 'Writing to SetSense…'}
              </div>
              <div className="progress-track glass-2">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="ss-caption" style={{ marginTop: 8 }}>
                {numberFmt.format(importProgress.processed)} of {numberFmt.format(importProgress.total)} tracks
              </div>
            </div>
          )}

          {/* ── Done ────────────────────────────────────────────────────── */}
          {isDone && stats && (
            <DoneState stats={stats} onClose={handleClose} />
          )}
        </motion.div>
      </FocusLock>
    </motion.div>
  )
}

// ─── State subcomponents ────────────────────────────────────────────────

interface DetectedStateProps {
  detection: RekordboxDetection
  libraryStale: boolean
  onImport: () => void | Promise<void>
  onUseXml: () => void | Promise<void>
  onRetry: () => void | Promise<void>
}

function DetectedState({ detection, libraryStale, onImport, onUseXml, onRetry }: DetectedStateProps): React.JSX.Element {
  const lastModified = formatLastModified(detection.dbMtime)
  const trackText =
    detection.trackCount != null ? `${numberFmt.format(detection.trackCount)} tracks` : 'Tracks ready'
  const playlistText =
    detection.playlistCount != null && detection.playlistCount > 0
      ? ` · ${numberFmt.format(detection.playlistCount)} playlists`
      : ''

  // If the cipher couldn't open the DB, show a contextual error rather than the import CTA.
  if (detection.dbReadError === 'locked') {
    return (
      <div className="modal-body">
        <PreviewCard
          icon={Lock}
          title="Rekordbox is open"
          body="Quit Rekordbox so SetSense can read its library, then try again."
          accent="warning"
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button variant="secondary" onClick={onUseXml}>
            Use XML file instead
          </Button>
          <Button variant="primary" icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (detection.dbReadError === 'key-mismatch' || detection.dbReadError === 'unknown') {
    return (
      <div className="modal-body">
        <PreviewCard
          icon={ShieldAlert}
          title="Couldn't read your Rekordbox database"
          body="This may be a newer Rekordbox version we don't yet support. Use the XML export below — same result, takes 30 seconds."
          accent="warning"
        />
        <div style={{ marginTop: 16 }}>
          <LibrarySourceGuide />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button variant="primary" icon={FolderOpen} onClick={onUseXml}>
            Choose XML file
          </Button>
        </div>
      </div>
    )
  }

  if (detection.trackCount === 0) {
    return (
      <div className="modal-body">
        <PreviewCard
          icon={FileText}
          title="Your Rekordbox library is empty"
          body="Add some tracks in Rekordbox first, then come back here."
          accent="info"
        />
      </div>
    )
  }

  // Happy path — usable DB with tracks.
  return (
    <div className="modal-body">
      <PreviewCard
        icon={CheckCircle}
        title="Rekordbox library found"
        body={`${trackText}${playlistText}${lastModified ? ` · last modified ${lastModified}` : ''}`}
        accent="accent"
      />
      <div className="ss-caption" style={{ opacity: 0.55, marginTop: 12 }}>
        SetSense reads your Rekordbox library read-only. Your Rekordbox file is never modified.
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={onUseXml}>
          Use XML file instead
        </Button>
        <Button variant="primary" onClick={onImport}>
          {libraryStale ? 'Re-sync now' : 'Import to SetSense'}
        </Button>
      </div>
    </div>
  )
}

interface ConsentGateProps {
  onAccept: () => void | Promise<void>
  onCancel: () => void
  onUseXml: () => void | Promise<void>
}

function ConsentGate({ onAccept, onCancel, onUseXml }: ConsentGateProps): React.JSX.Element {
  return (
    <div className="modal-body">
      <PreviewCard
        icon={ShieldAlert}
        title="One quick confirmation"
        body="SetSense will read your Rekordbox library directly. It opens master.db read-only, never writes to it, and never sends your data anywhere."
        accent="info"
      />
      <div className="ss-caption" style={{ opacity: 0.55, marginTop: 12 }}>
        You&apos;ll only see this once. You can switch to XML import any time.
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={onUseXml}>
          Use XML file instead
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Back
        </Button>
        <Button variant="primary" onClick={onAccept}>
          I understand, import
        </Button>
      </div>
    </div>
  )
}

interface NotDetectedStateProps {
  importError: 'REKORDBOX_LOCKED' | 'REKORDBOX_KEY_MISMATCH' | 'GENERIC' | null
  onChooseXml: () => void | Promise<void>
  onRetry: () => void | Promise<void>
}

function NotDetectedState({ importError, onChooseXml, onRetry }: NotDetectedStateProps): React.JSX.Element {
  return (
    <div className="modal-body">
      {importError === 'GENERIC' && (
        <div className="ss-caption" style={{ color: 'var(--semantic-warning)', marginBottom: 12 }}>
          Something went wrong with the last import. Try again or use a different file.
        </div>
      )}
      <div className="ss-body-sm" style={{ marginBottom: 4 }}>
        We couldn&apos;t auto-detect Rekordbox on this Mac. Export your library and we&apos;ll handle the rest.
      </div>
      <LibrarySourceGuide />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
        <Button variant="secondary" icon={RefreshCw} onClick={onRetry}>
          Try detection again
        </Button>
        <Button variant="primary" icon={FolderOpen} onClick={onChooseXml}>
          Choose XML file
        </Button>
      </div>
    </div>
  )
}

interface DoneStateProps {
  stats: LibraryStats
  onClose: () => void
}

function DoneState({ stats, onClose }: DoneStateProps): React.JSX.Element {
  return (
    <div className="modal-body">
      <div className="import-stats">
        <div className="stat-row">
          <span className="ss-body-sm">Tracks imported</span>
          <span className="ss-mono">{numberFmt.format(stats.totalTracks)}</span>
        </div>
        <div className="stat-row">
          <span className="ss-body-sm">Total duration</span>
          <span className="ss-mono">{formatTotalDuration(stats.totalDuration)}</span>
        </div>
        {stats.missingFiles > 0 && (
          <div className="stat-row warning">
            <span className="ss-body-sm">Missing files</span>
            <span className="ss-mono" style={{ color: 'var(--semantic-warning)' }}>
              {numberFmt.format(stats.missingFiles)}
            </span>
          </div>
        )}
        {stats.tracksWithoutBpm > 0 && (
          <div className="stat-row warning">
            <span className="ss-body-sm">Without BPM</span>
            <span className="ss-mono" style={{ color: 'var(--semantic-warning)' }}>
              {numberFmt.format(stats.tracksWithoutBpm)}
            </span>
          </div>
        )}
        {stats.tracksWithoutKey > 0 && (
          <div className="stat-row warning">
            <span className="ss-body-sm">Without key</span>
            <span className="ss-mono" style={{ color: 'var(--semantic-warning)' }}>
              {numberFmt.format(stats.tracksWithoutKey)}
            </span>
          </div>
        )}
      </div>
      <Button variant="primary" onClick={onClose} style={{ marginTop: 20 }}>
        Done
      </Button>
    </div>
  )
}

// ─── Small preview card used by detected / consent / error states ───────

interface PreviewCardProps {
  icon: typeof CheckCircle
  title: string
  body: string
  accent: 'accent' | 'warning' | 'info'
}

function PreviewCard({ icon: Icon, title, body, accent }: PreviewCardProps): React.JSX.Element {
  const accentColor =
    accent === 'accent'
      ? 'var(--accent)'
      : accent === 'warning'
        ? 'var(--semantic-warning)'
        : 'var(--text-secondary)'
  return (
    <div
      className="glass-2"
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        padding: '14px 16px',
        borderRadius: 12,
      }}
    >
      <Icon size={22} strokeWidth={1.6} style={{ color: accentColor, flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ss-label" style={{ marginBottom: 4 }}>{title}</div>
        <div className="ss-caption" style={{ opacity: 0.7 }}>{body}</div>
      </div>
    </div>
  )
}
