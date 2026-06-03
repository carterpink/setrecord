import { useEffect, useState } from 'react'
import { APP_NAME } from '@/utils/constants'
import {
  CheckCircle,
  ChevronRight,
  Disc3,
  FileText,
  FolderOpen,
  Lock,
  Loader2,
  RefreshCw,
  ShieldAlert,
  X
} from 'lucide-react'
import type { LibraryStats, LibrarySourceId, RekordboxDetection, SourceDetection } from '@/types'
import { useLibraryStore } from '@/stores/libraryStore'
import { useUiStore } from '@/stores/uiStore'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { LibrarySourceGuide } from '@/components/shared/LibrarySourceGuide'
import { Modal } from '@/components/shared/Modal'
import { formatTotalDuration } from '@/utils/format'

const numberFmt = new Intl.NumberFormat('en-US')

function formatLastModified(epochMs: number | null): string {
  if (!epochMs) return ''
  try {
    return new Date(epochMs).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
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
    availableSources,
    startImportFlow,
    selectSource,
    selectedSourceId,
    confirmSourceImport,
    startAutoDetectFlow,
    confirmAutoDetectImport,
    triggerXmlImport,
    showXmlGuide,
    resetImportFlow
  } = useLibraryStore()
  const importInitialView = useUiStore((s) => s.importInitialView)

  // Tracks whether we've already shown the one-time consent gate to the user
  // before they kicked off a DB read. Persisted in settings on accept.
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null)
  // Local UI sub-state for the confirm-consent step (between "detected" and "importing").
  const [showingConsent, setShowingConsent] = useState(false)

  // Bootstrap: on first mount, if state is idle, either run auto-detect or — when
  // opened from a "How to export Rekordbox XML" link — jump straight to the guide.
  useEffect(() => {
    if (importState === 'idle') {
      if (importInitialView === 'guide') {
        showXmlGuide()
      } else {
        void startImportFlow()
      }
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
    <Modal
      onClose={handleClose}
      ariaLabel="Import library"
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
        <div
          className="modal-body"
          style={{ alignItems: 'center', textAlign: 'center', gap: 16, padding: '24px 0' }}
        >
          <Loader2
            size={28}
            strokeWidth={1.6}
            style={{ opacity: 0.6, animation: 'spin 1.2s linear infinite' }}
            aria-hidden="true"
          />
          <div className="ss-body-sm" style={{ opacity: 0.7 }}>
            Looking for your DJ library…
          </div>
        </div>
      )}

      {/* ── Source picker (Rekordbox / Serato / Engine DJ) ─────────── */}
      {importState === 'source-picker' && (
        <SourcePicker
          sources={availableSources}
          onSelect={selectSource}
          onUseXml={triggerXmlImport}
        />
      )}

      {/* ── Payload source detected (Serato / Engine DJ) ───────────── */}
      {importState === 'source-detected' && (
        <SourceDetectedState
          detection={availableSources.find((s) => s.sourceId === selectedSourceId)}
          onImport={confirmSourceImport}
          onBack={startImportFlow}
        />
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
            {importProgress.phase === 'parsing' ? 'Reading library…' : 'Saving your library…'}
          </div>
          <div className="progress-track glass-2">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="ss-caption" style={{ marginTop: 8 }}>
            {numberFmt.format(importProgress.processed)} of {numberFmt.format(importProgress.total)}{' '}
            tracks
          </div>
        </div>
      )}

      {/* ── Done ────────────────────────────────────────────────────── */}
      {isDone && stats && <DoneState stats={stats} onClose={handleClose} />}
    </Modal>
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

function DetectedState({
  detection,
  libraryStale,
  onImport,
  onUseXml,
  onRetry
}: DetectedStateProps): React.JSX.Element {
  const lastModified = formatLastModified(detection.dbMtime)
  const trackText =
    detection.trackCount != null
      ? `${numberFmt.format(detection.trackCount)} tracks`
      : 'Tracks ready'
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
          body={`Quit Rekordbox so ${APP_NAME} can read its library, then try again.`}
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
        {APP_NAME} reads your Rekordbox library read-only. Your Rekordbox file is never modified.
      </div>
      <div className="ss-caption" style={{ opacity: 0.45, marginTop: 6 }}>
        Re-importing updates existing tracks and adds new ones. Energy analysis and cue points
        you&apos;ve set in {APP_NAME} are preserved.
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          marginTop: 16,
          flexWrap: 'wrap'
        }}
      >
        <Button variant="secondary" onClick={onUseXml}>
          Use XML file instead
        </Button>
        <Button variant="primary" onClick={onImport}>
          {libraryStale ? 'Re-sync now' : 'Import library'}
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
        body={`${APP_NAME} will read your Rekordbox library directly. It opens master.db read-only, never writes to it, and never sends your data anywhere.`}
        accent="info"
      />
      <div className="ss-caption" style={{ opacity: 0.55, marginTop: 12 }}>
        You&apos;ll only see this once. You can switch to XML import any time.
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          marginTop: 16,
          flexWrap: 'wrap'
        }}
      >
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

function NotDetectedState({
  importError,
  onChooseXml,
  onRetry
}: NotDetectedStateProps): React.JSX.Element {
  return (
    <div className="modal-body">
      {importError === 'GENERIC' && (
        <div className="ss-caption" style={{ color: 'var(--semantic-warning)', marginBottom: 12 }}>
          Something went wrong with the last import. Try again or use a different file.
        </div>
      )}

      <div className="ss-body-sm" style={{ marginBottom: 6 }}>
        We couldn&apos;t find Rekordbox automatically — no problem. You can connect your library in
        about 30 seconds.
      </div>

      {/* Power-user shortcut: skip the guide and go straight to the picker. */}
      <button
        type="button"
        onClick={onChooseXml}
        className="ss-caption"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          cursor: 'pointer',
          padding: 0,
          marginBottom: 16,
          textAlign: 'left'
        }}
      >
        Already have an export? Choose your XML file →
      </button>

      {/* First-timer explainer — what an export actually is and why it's safe. */}
      <div
        className="glass-2"
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
          padding: '14px 16px',
          borderRadius: 12,
          marginBottom: 16
        }}
      >
        <FileText
          size={22}
          strokeWidth={1.6}
          style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}
          aria-hidden="true"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ss-label" style={{ marginBottom: 4 }}>
            What&apos;s a Rekordbox export?
          </div>
          <div className="ss-caption" style={{ opacity: 0.7 }}>
            It&apos;s a single file that lists every track in your collection — BPM, key, cue points
            and all. {APP_NAME} reads it to map out your music. It stays on your Mac, and your
            Rekordbox library is never changed.
          </div>
        </div>
      </div>

      <LibrarySourceGuide />

      <div
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          marginTop: 16,
          flexWrap: 'wrap'
        }}
      >
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
            <span className="ss-body-sm">Missing files (not on disk)</span>
            <span className="ss-mono" style={{ color: 'var(--semantic-warning)' }}>
              {numberFmt.format(stats.missingFiles)}
            </span>
          </div>
        )}
        {stats.unknownSize > 0 && (
          <div className="stat-row">
            <span className="ss-body-sm">Unknown file size</span>
            <span className="ss-mono">{numberFmt.format(stats.unknownSize)}</span>
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

// ─── Source picker (cross-platform import) ──────────────────────────────

interface SourcePickerProps {
  sources: SourceDetection[]
  onSelect: (id: LibrarySourceId) => void | Promise<void>
  onUseXml: () => void | Promise<void>
}

function sourceSubtitle(s: SourceDetection): string {
  if (s.readError === 'locked') return 'Close the app and try again'
  if (s.readError === 'unsupported') return 'Not available on this platform yet'
  if (!s.installed) return 'Not found on this Mac'
  if (s.meta?.beta === true && s.trackCount != null) {
    return `${numberFmt.format(s.trackCount)} tracks · Beta (untested)`
  }
  if (s.trackCount != null) {
    const tracks = `${numberFmt.format(s.trackCount)} tracks`
    const crates =
      s.playlistCount != null && s.playlistCount > 0
        ? ` · ${numberFmt.format(s.playlistCount)} ${s.sourceId === 'serato' ? 'crates' : 'playlists'}`
        : ''
    return `${tracks}${crates}`
  }
  return 'Ready to import'
}

function SourcePicker({ sources, onSelect, onUseXml }: SourcePickerProps): React.JSX.Element {
  // Order: detected/usable sources first, then unavailable ones.
  const ordered = [...sources].sort(
    (a, b) => Number(b.installed && !b.readError) - Number(a.installed && !a.readError)
  )

  return (
    <div className="modal-body">
      <div className="ss-body-sm" style={{ marginBottom: 12, opacity: 0.8 }}>
        Which DJ software do you use? {APP_NAME} reads your library read-only.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ordered.map((s) => {
          const selectable = s.installed && !s.readError
          return (
            <button
              key={s.sourceId}
              type="button"
              disabled={!selectable && s.readError !== 'locked'}
              onClick={() => selectable && void onSelect(s.sourceId)}
              className="glass-2"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 16px',
                borderRadius: 12,
                border: 'none',
                textAlign: 'left',
                cursor: selectable ? 'pointer' : 'default',
                opacity: selectable ? 1 : 0.5,
                width: '100%'
              }}
            >
              <Disc3
                size={22}
                strokeWidth={1.6}
                style={{
                  color: selectable ? 'var(--accent)' : 'var(--text-secondary)',
                  flexShrink: 0
                }}
                aria-hidden="true"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ss-label">{s.label}</div>
                <div className="ss-caption" style={{ opacity: 0.7 }}>
                  {sourceSubtitle(s)}
                </div>
              </div>
              {selectable && (
                <ChevronRight
                  size={18}
                  style={{ color: 'var(--text-secondary)', flexShrink: 0 }}
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={onUseXml}
        className="ss-caption"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          cursor: 'pointer',
          padding: 0,
          marginTop: 16,
          textAlign: 'left'
        }}
      >
        Or import a Rekordbox XML file →
      </button>
    </div>
  )
}

interface SourceDetectedStateProps {
  detection: SourceDetection | undefined
  onImport: () => void | Promise<void>
  onBack: () => void | Promise<void>
}

function SourceDetectedState({
  detection,
  onImport,
  onBack
}: SourceDetectedStateProps): React.JSX.Element {
  const label = detection?.label ?? 'Library'
  const isSerato = detection?.sourceId === 'serato'
  const isBeta = detection?.meta?.beta === true
  const trackText =
    detection?.trackCount != null
      ? `${numberFmt.format(detection.trackCount)} tracks`
      : 'Tracks ready'
  const listText =
    detection?.playlistCount != null && detection.playlistCount > 0
      ? ` · ${numberFmt.format(detection.playlistCount)} ${isSerato ? 'crates' : 'playlists'}`
      : ''

  return (
    <div className="modal-body">
      <PreviewCard
        icon={CheckCircle}
        title={`${label} library found`}
        body={`${trackText}${listText}`}
        accent="accent"
      />
      <div className="ss-caption" style={{ opacity: 0.55, marginTop: 12 }}>
        {APP_NAME} reads your {label} library read-only. Cue points, hot cues and beatgrids are
        imported in a background pass shortly after.
      </div>
      {isBeta && (
        <div
          className="ss-caption"
          style={{ marginTop: 10, color: 'var(--semantic-warning)', opacity: 0.9 }}
        >
          {label} import is in beta and hasn&apos;t been tested on real Denon hardware. Cues,
          beatgrids and musical keys aren&apos;t imported yet — please report anything that looks
          off.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onImport}>
          Import library
        </Button>
      </div>
    </div>
  )
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
        borderRadius: 12
      }}
    >
      <Icon
        size={22}
        strokeWidth={1.6}
        style={{ color: accentColor, flexShrink: 0, marginTop: 2 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ss-label" style={{ marginBottom: 4 }}>
          {title}
        </div>
        <div className="ss-caption" style={{ opacity: 0.7 }}>
          {body}
        </div>
      </div>
    </div>
  )
}
