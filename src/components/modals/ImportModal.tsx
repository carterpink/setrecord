import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
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

function formatLastModified(epochMs: number | null, locale?: string): string {
  if (!epochMs) return ''
  try {
    return new Date(epochMs).toLocaleDateString(locale, {
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
  const { t } = useTranslation('modals')
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
      ariaLabel={t('import.ariaLabel')}
      style={{ minWidth: 460, maxWidth: 520 }}
    >
      <div className="modal-header">
        <span className="ss-h2">
          {libraryStale && importState === 'detected' ? t('import.resyncTitle') : t('import.title')}
        </span>
        <IconButton icon={X} size="sm" aria-label={t('common.close')} onClick={handleClose} />
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
            {t('import.looking')}
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
            {importProgress.phase === 'parsing'
              ? t('import.readingLibrary')
              : t('import.savingLibrary')}
          </div>
          <div className="progress-track glass-2">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="ss-caption" style={{ marginTop: 8 }}>
            {t('import.progressTracks', {
              processed: numberFmt.format(importProgress.processed),
              total: numberFmt.format(importProgress.total)
            })}
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
  const { t, i18n } = useTranslation('modals')
  const lastModified = formatLastModified(detection.dbMtime, i18n.language)
  const trackText =
    detection.trackCount != null
      ? t('import.tracksReadyCount', {
          count: detection.trackCount,
          display: numberFmt.format(detection.trackCount)
        })
      : t('import.tracksReady')
  const playlistText =
    detection.playlistCount != null && detection.playlistCount > 0
      ? t('import.playlistsSuffix', {
          count: detection.playlistCount,
          display: numberFmt.format(detection.playlistCount)
        })
      : ''

  // If the cipher couldn't open the DB, show a contextual error rather than the import CTA.
  if (detection.dbReadError === 'locked') {
    return (
      <div className="modal-body">
        <PreviewCard
          icon={Lock}
          title={t('import.rekordboxOpenTitle')}
          body={t('import.rekordboxOpenBody', { app: APP_NAME })}
          accent="warning"
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button variant="secondary" onClick={onUseXml}>
            {t('import.useXmlInstead')}
          </Button>
          <Button variant="primary" icon={RefreshCw} onClick={onRetry}>
            {t('import.tryAgain')}
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
          title={t('import.dbReadErrorTitle')}
          body={t('import.dbReadErrorBody')}
          accent="warning"
        />
        <div style={{ marginTop: 16 }}>
          <LibrarySourceGuide />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button variant="primary" icon={FolderOpen} onClick={onUseXml}>
            {t('import.chooseXml')}
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
          title={t('import.emptyTitle')}
          body={t('import.emptyBody')}
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
        title={t('import.foundTitle')}
        body={`${trackText}${playlistText}${
          lastModified ? t('import.lastModifiedSuffix', { date: lastModified }) : ''
        }`}
        accent="accent"
      />
      <div className="ss-caption" style={{ opacity: 0.55, marginTop: 12 }}>
        {t('import.readOnlyNote', { app: APP_NAME })}
      </div>
      <div className="ss-caption" style={{ opacity: 0.45, marginTop: 6 }}>
        {t('import.reimportNote', { app: APP_NAME })}
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
          {t('import.useXmlInstead')}
        </Button>
        <Button variant="primary" onClick={onImport}>
          {libraryStale ? t('import.resyncNow') : t('import.title')}
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
  const { t } = useTranslation('modals')
  return (
    <div className="modal-body">
      <PreviewCard
        icon={ShieldAlert}
        title={t('import.consentTitle')}
        body={t('import.consentBody', { app: APP_NAME })}
        accent="info"
      />
      <div className="ss-caption" style={{ opacity: 0.55, marginTop: 12 }}>
        {t('import.consentNote')}
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
          {t('import.useXmlInstead')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {t('common.back')}
        </Button>
        <Button variant="primary" onClick={onAccept}>
          {t('import.consentAccept')}
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
  const { t } = useTranslation('modals')
  return (
    <div className="modal-body">
      {importError === 'GENERIC' && (
        <div className="ss-caption" style={{ color: 'var(--semantic-warning)', marginBottom: 12 }}>
          {t('import.genericError')}
        </div>
      )}

      <div className="ss-body-sm" style={{ marginBottom: 6 }}>
        {t('import.notFoundBody')}
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
        {t('import.alreadyHaveExport')}
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
            {t('import.whatsExportTitle')}
          </div>
          <div className="ss-caption" style={{ opacity: 0.7 }}>
            {t('import.whatsExportBody', { app: APP_NAME })}
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
          {t('import.tryDetectionAgain')}
        </Button>
        <Button variant="primary" icon={FolderOpen} onClick={onChooseXml}>
          {t('import.chooseXml')}
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
  const { t } = useTranslation('modals')
  return (
    <div className="modal-body">
      <div className="import-stats">
        <div className="stat-row">
          <span className="ss-body-sm">{t('import.statTracksImported')}</span>
          <span className="ss-mono">{numberFmt.format(stats.totalTracks)}</span>
        </div>
        <div className="stat-row">
          <span className="ss-body-sm">{t('import.statTotalDuration')}</span>
          <span className="ss-mono">{formatTotalDuration(stats.totalDuration)}</span>
        </div>
        {stats.missingFiles > 0 && (
          <div className="stat-row warning">
            <span className="ss-body-sm">{t('import.statMissingFiles')}</span>
            <span className="ss-mono" style={{ color: 'var(--semantic-warning)' }}>
              {numberFmt.format(stats.missingFiles)}
            </span>
          </div>
        )}
        {stats.unknownSize > 0 && (
          <div className="stat-row">
            <span className="ss-body-sm">{t('import.statUnknownSize')}</span>
            <span className="ss-mono">{numberFmt.format(stats.unknownSize)}</span>
          </div>
        )}
        {stats.tracksWithoutBpm > 0 && (
          <div className="stat-row warning">
            <span className="ss-body-sm">{t('import.statWithoutBpm')}</span>
            <span className="ss-mono" style={{ color: 'var(--semantic-warning)' }}>
              {numberFmt.format(stats.tracksWithoutBpm)}
            </span>
          </div>
        )}
        {stats.tracksWithoutKey > 0 && (
          <div className="stat-row warning">
            <span className="ss-body-sm">{t('import.statWithoutKey')}</span>
            <span className="ss-mono" style={{ color: 'var(--semantic-warning)' }}>
              {numberFmt.format(stats.tracksWithoutKey)}
            </span>
          </div>
        )}
      </div>
      <Button variant="primary" onClick={onClose} style={{ marginTop: 20 }}>
        {t('common.done')}
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

function sourceSubtitle(s: SourceDetection, t: TFunction<'modals'>): string {
  if (s.readError === 'locked') return t('import.source.closeAndRetry')
  if (s.readError === 'unsupported') return t('import.source.unsupported')
  if (!s.installed) return t('import.source.notFound')
  if (s.meta?.beta === true && s.trackCount != null) {
    return t('import.source.tracksBeta', {
      count: s.trackCount,
      display: numberFmt.format(s.trackCount)
    })
  }
  if (s.trackCount != null) {
    const tracks = t('import.source.tracks', {
      count: s.trackCount,
      display: numberFmt.format(s.trackCount)
    })
    const crates =
      s.playlistCount != null && s.playlistCount > 0
        ? s.sourceId === 'serato'
          ? t('import.source.cratesSuffix', {
              count: s.playlistCount,
              display: numberFmt.format(s.playlistCount)
            })
          : t('import.source.playlistsSuffix', {
              count: s.playlistCount,
              display: numberFmt.format(s.playlistCount)
            })
        : ''
    return `${tracks}${crates}`
  }
  return t('import.source.readyToImport')
}

function SourcePicker({ sources, onSelect, onUseXml }: SourcePickerProps): React.JSX.Element {
  const { t } = useTranslation('modals')
  // Order: detected/usable sources first, then unavailable ones.
  const ordered = [...sources].sort(
    (a, b) => Number(b.installed && !b.readError) - Number(a.installed && !a.readError)
  )

  return (
    <div className="modal-body">
      <div className="ss-body-sm" style={{ marginBottom: 12, opacity: 0.8 }}>
        {t('import.source.which', { app: APP_NAME })}
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
                  {sourceSubtitle(s, t)}
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
        {t('import.orImportXml')}
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
  const { t } = useTranslation('modals')
  const label = detection?.label ?? t('import.source.libraryFallback')
  const isSerato = detection?.sourceId === 'serato'
  const isBeta = detection?.meta?.beta === true
  const trackText =
    detection?.trackCount != null
      ? t('import.tracksReadyCount', {
          count: detection.trackCount,
          display: numberFmt.format(detection.trackCount)
        })
      : t('import.tracksReady')
  const listText =
    detection?.playlistCount != null && detection.playlistCount > 0
      ? isSerato
        ? t('import.source.cratesSuffix', {
            count: detection.playlistCount,
            display: numberFmt.format(detection.playlistCount)
          })
        : t('import.source.playlistsSuffix', {
            count: detection.playlistCount,
            display: numberFmt.format(detection.playlistCount)
          })
      : ''

  return (
    <div className="modal-body">
      <PreviewCard
        icon={CheckCircle}
        title={t('import.source.foundTitle', { label })}
        body={`${trackText}${listText}`}
        accent="accent"
      />
      <div className="ss-caption" style={{ opacity: 0.55, marginTop: 12 }}>
        {t('import.source.readOnlyNote', { app: APP_NAME, label })}
      </div>
      {isBeta && (
        <div
          className="ss-caption"
          style={{ marginTop: 10, color: 'var(--semantic-warning)', opacity: 0.9 }}
        >
          {t('import.source.betaNote', { label })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <Button variant="secondary" onClick={onBack}>
          {t('common.back')}
        </Button>
        <Button variant="primary" onClick={onImport}>
          {t('import.title')}
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
