import { useEffect, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import {
  GraduationCap,
  RefreshCw,
  Shield,
  Sparkles,
  X,
  Crown,
  Download,
  Upload,
  Trash2,
  Sliders,
  Library,
  Languages,
  Accessibility,
  Mic,
  Sprout,
  Headphones,
  type LucideIcon
} from 'lucide-react'
import { APP_NAME } from '@/utils/constants'
import type { CDJModel, ImportSource, LanguagePreference, LicenseActivationError } from '@/types'
import type {
  InspectResult as BackupInspectResult,
  RelinkReport
} from '../../../electron/services/backupService'
import { SUPPORTED_LANGUAGES } from '@/i18n/config'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { RangeSlider } from '@/components/shared/RangeSlider'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { Toggle } from '@/components/shared/Toggle'
import { Modal } from '@/components/shared/Modal'
import { motion, AnimatePresence, slideUp } from '@/components/shared/Motion'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { usePlaybackStore } from '@/stores/playbackStore'
import { setWaveformQuality as applyWaveformQuality } from '@/utils/waveformPeaksCache'
import { getPreferredInputId, setPreferredInputId } from '@/components/live/liveDevice'
import { useLicenseStore } from '@/stores/licenseStore'
import { useCoachmarkStore } from '@/stores/coachmarkStore'
import { useToastStore } from '@/stores/toastStore'
import { LearnTooltip } from '@/components/learn/LearnTooltip'
import { FreshStartOverlay } from '@/components/FreshStartOverlay'

const HARDWARE_OPTIONS: CDJModel[] = ['CDJ-2000NXS2', 'CDJ-3000', 'XDJ-RX3', 'XDJ-XZ', 'CDJ-2000']

/** Maps an activation error to its i18n message key (settings namespace). */
const ACTIVATION_ERROR_KEY: Record<LicenseActivationError, string> = {
  malformed: 'license.activationError.malformed',
  'bad-signature': 'license.activationError.badSignature',
  expired: 'license.activationError.expired',
  'device-mismatch': 'license.activationError.deviceMismatch',
  revoked: 'license.activationError.revoked',
  unknown: 'license.activationError.unknown'
}

type SettingsTab =
  | 'general'
  | 'plan'
  | 'memory'
  | 'mixing'
  | 'playback'
  | 'library'
  | 'data'
  | 'reset'

/**
 * Left-rail sub-tabs. Icon + i18n label (keyed by `tabs.<id>.*`), with an
 * animated active indicator that mirrors the main app switcher. `danger` tints
 * the Reset rail item.
 */
const SETTINGS_TABS: ReadonlyArray<{ id: SettingsTab; icon: LucideIcon; danger?: boolean }> = [
  { id: 'general', icon: Languages },
  { id: 'plan', icon: Crown },
  { id: 'memory', icon: Sparkles },
  { id: 'mixing', icon: Sliders },
  { id: 'playback', icon: Headphones },
  { id: 'library', icon: Library },
  { id: 'data', icon: Shield },
  { id: 'reset', icon: Trash2, danger: true }
]

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '…'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function formatDate(iso: string | null, locale?: string): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

/** Current-plan summary + activate / deactivate / restore controls. */
function LicenseSection(): React.JSX.Element {
  const { t, i18n } = useTranslation('settings')
  const license = useLicenseStore((s) => s.license)
  const deactivate = useLicenseStore((s) => s.deactivate)
  const activate = useLicenseStore((s) => s.activate)
  const refresh = useLicenseStore((s) => s.refresh)
  const showUpgrade = useUiStore((s) => s.showUpgrade)
  const closeModal = useUiStore((s) => s.closeModal)
  const toast = useToastStore()
  const [working, setWorking] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showKeyEntry, setShowKeyEntry] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [activating, setActivating] = useState(false)

  const isPro = license.tier === 'pro'

  // Humane, non-hostile messaging for the anti-abuse states. None of these
  // brick the app — they explain what happened and what to do next.
  const statusNotice: string | null =
    license.status === 'device-mismatch'
      ? t('license.status.deviceMismatch')
      : license.status === 'revoked'
        ? t('license.status.revoked')
        : license.status === 'expired'
          ? t('license.status.expired')
          : license.status === 'invalid'
            ? t('license.status.invalid')
            : license.clockWarning
              ? t('license.status.clockWarning')
              : null

  const handleDeactivate = async (): Promise<void> => {
    setWorking(true)
    try {
      await deactivate()
      toast.info(t('license.removed'))
    } catch {
      toast.error(t('license.deactivateError'))
    } finally {
      setWorking(false)
    }
  }

  const handleActivate = async (): Promise<void> => {
    const key = keyInput.trim()
    if (!key) return
    setActivating(true)
    try {
      const result = await activate(key)
      if (result.ok) {
        toast.success(t('license.activateSuccess'))
        setKeyInput('')
        setShowKeyEntry(false)
      } else {
        toast.error(t(ACTIVATION_ERROR_KEY[result.error ?? 'unknown']))
      }
    } catch {
      toast.error(t(ACTIVATION_ERROR_KEY.unknown))
    } finally {
      setActivating(false)
    }
  }

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await refresh()
      toast.info(t('license.refreshDone'))
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="field-group settings-license">
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Crown
            size={18}
            strokeWidth={1.6}
            style={{
              marginTop: 2,
              color: isPro ? 'var(--accent)' : undefined,
              opacity: isPro ? 1 : 0.8
            }}
            aria-hidden="true"
          />
          <div>
            <div className="ss-label">
              {isPro ? t('license.proPlan', { app: APP_NAME }) : t('license.freePlan')}
            </div>
            <div className="ss-caption" style={{ opacity: 0.65, marginTop: 2, lineHeight: 1.45 }}>
              {isPro ? (
                <>
                  {license.plan === 'lifetime' ? t('license.lifetime') : t('license.subscription')}
                  {license.keyMasked && (
                    <>
                      {' · '}
                      <span className="ss-mono">{license.keyMasked}</span>
                    </>
                  )}
                  {license.buyerEmail && (
                    <div style={{ opacity: 0.8, marginTop: 2 }}>{license.buyerEmail}</div>
                  )}
                  {license.plan === 'subscription' && license.expiresAt && (
                    <div style={{ marginTop: 2 }}>
                      {t('license.renews', { date: formatDate(license.expiresAt, i18n.language) })}
                    </div>
                  )}
                  {license.activatedAt && (
                    <div style={{ opacity: 0.6, marginTop: 2 }}>
                      {t('license.activated', {
                        date: formatDate(license.activatedAt, i18n.language)
                      })}
                    </div>
                  )}
                </>
              ) : (
                t('license.freeBlurb')
              )}
            </div>
          </div>
        </div>
      </div>
      {statusNotice && (
        <div
          className="ss-caption"
          role="status"
          style={{
            marginTop: 10,
            padding: '8px 10px',
            borderRadius: 8,
            lineHeight: 1.45,
            background: 'var(--surface-2, rgba(255,255,255,0.04))',
            color: 'var(--text-secondary)'
          }}
        >
          {statusNotice}
        </div>
      )}
      {isPro && license.deviceBound && (
        <div className="ss-caption" style={{ opacity: 0.6, marginTop: 6 }}>
          {t('license.boundToDevice')}
        </div>
      )}
      <div
        style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
      >
        {isPro ? (
          <>
            <Button variant="secondary" onClick={() => void handleDeactivate()} disabled={working}>
              {working ? t('license.removing') : t('license.deactivate')}
            </Button>
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => void handleRefresh()}
              disabled={refreshing}
            >
              {refreshing ? t('license.refreshing') : t('license.refresh')}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              icon={Sparkles}
              onClick={() => {
                closeModal()
                showUpgrade()
              }}
            >
              {t('license.upgrade')}
            </Button>
            <button
              type="button"
              className="settings-link-btn"
              onClick={() => setShowKeyEntry((s) => !s)}
            >
              {t('license.enterKey')}
            </button>
          </>
        )}
      </div>
      {!isPro && showKeyEntry && (
        <div
          style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <input
            className="feedback-input"
            type="text"
            placeholder={t('license.keyPlaceholder')}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleActivate()
            }}
            style={{ maxWidth: 240 }}
            aria-label={t('license.enterKey')}
            autoFocus
          />
          <Button
            variant="primary"
            onClick={() => void handleActivate()}
            disabled={activating || !keyInput.trim()}
          >
            {activating ? t('license.activating') : t('license.activate')}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Backendless backup & migration. Export the whole SetRecord overlay to a single
 * `.setrecord` file (optionally passphrase-encrypted), and import it on another
 * machine — it re-links to that machine's own library by stable track identity,
 * never touching local file paths. No accounts, no cloud.
 */
function BackupSection(): React.JSX.Element {
  const { t } = useTranslation('settings')
  const toast = useToastStore()
  const hasBridge = typeof window.setrecord !== 'undefined'

  const [exportPass, setExportPass] = useState('')
  const [exporting, setExporting] = useState(false)

  const [importPath, setImportPath] = useState<string | null>(null)
  const [inspect, setInspect] = useState<BackupInspectResult | null>(null)
  const [needsPass, setNeedsPass] = useState(false)
  const [importPass, setImportPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<RelinkReport | null>(null)

  function resetImport(): void {
    setImportPath(null)
    setInspect(null)
    setNeedsPass(false)
    setImportPass('')
    setReport(null)
  }

  async function handleExport(): Promise<void> {
    if (!hasBridge) return
    setExporting(true)
    try {
      const r = await window.setrecord.backupExport(exportPass || undefined)
      if (r.success) {
        toast.success(
          t('backup.exportSuccess', {
            tracks: r.counts?.tracks ?? 0,
            sets: r.counts?.sets ?? 0,
            sessions: r.counts?.sessions ?? 0
          })
        )
        setExportPass('')
      } else if (r.error && r.error !== 'cancelled') {
        toast.error(r.error)
      }
    } finally {
      setExporting(false)
    }
  }

  async function runInspect(path: string, pass?: string): Promise<void> {
    if (!hasBridge) return
    setBusy(true)
    try {
      const res = await window.setrecord.backupInspect(path, pass)
      if (res.needsPassphrase) {
        setNeedsPass(true)
        setInspect(null)
        if (pass) toast.error(t('backup.wrongPassphrase'))
        return
      }
      if (!res.ok) {
        toast.error(res.error ?? t('backup.readError'))
        resetImport()
        return
      }
      setNeedsPass(false)
      setInspect(res)
    } finally {
      setBusy(false)
    }
  }

  async function handlePick(): Promise<void> {
    if (!hasBridge) return
    const path = await window.setrecord.backupPick()
    if (!path) return
    resetImport()
    setImportPath(path)
    await runInspect(path)
  }

  async function handleImport(): Promise<void> {
    if (!hasBridge || !importPath || !inspect) return
    setBusy(true)
    try {
      const r = await window.setrecord.backupImport(
        importPath,
        inspect.suggestedMode ?? 'merge',
        importPass || undefined
      )
      if (r.success && r.report) {
        setReport(r.report)
        toast.success(t('backup.importSuccess'))
        await useLibraryStore.getState().loadLibrary()
        await useSetStore.getState().loadSets()
      } else {
        toast.error(r.error ?? t('backup.importError'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field-group" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Export */}
      <div>
        <div className="ss-label">{t('backup.exportTitle')}</div>
        <div className="ss-caption" style={{ opacity: 0.65, marginTop: 2, lineHeight: 1.45 }}>
          <Trans
            t={t}
            i18nKey="backup.exportCaption"
            components={[<span key="mono" className="ss-mono" />]}
          />
        </div>
        <div
          style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <input
            className="feedback-input"
            type="password"
            placeholder={t('backup.passphrasePlaceholder')}
            value={exportPass}
            onChange={(e) => setExportPass(e.target.value)}
            style={{ maxWidth: 220 }}
            aria-label={t('backup.passphraseAria')}
          />
          <Button
            variant="secondary"
            icon={Download}
            onClick={handleExport}
            disabled={exporting || !hasBridge}
          >
            {exporting ? t('backup.exporting') : t('backup.exportButton')}
          </Button>
        </div>
        <div className="ss-caption" style={{ opacity: 0.5, marginTop: 6, lineHeight: 1.4 }}>
          {exportPass ? t('backup.encryptedNote') : t('backup.unencryptedNote')}
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--hairline, rgba(255,255,255,0.08))' }} />

      {/* Import */}
      <div>
        <div className="ss-label">{t('backup.importTitle')}</div>
        <div className="ss-caption" style={{ opacity: 0.65, marginTop: 2, lineHeight: 1.45 }}>
          <Trans
            t={t}
            i18nKey="backup.importCaption"
            components={[<span key="mono" className="ss-mono" />]}
          />
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            variant="secondary"
            icon={Upload}
            onClick={handlePick}
            disabled={busy || !hasBridge}
          >
            {t('backup.chooseButton')}
          </Button>
          {importPath && (
            <button type="button" className="settings-link-btn" onClick={resetImport}>
              {t('clear', { ns: 'common' })}
            </button>
          )}
        </div>

        {/* Passphrase prompt */}
        {needsPass && importPath && (
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap'
            }}
          >
            <input
              className="feedback-input"
              type="password"
              placeholder={t('backup.enterPassphrase')}
              value={importPass}
              onChange={(e) => setImportPass(e.target.value)}
              style={{ maxWidth: 240 }}
              aria-label={t('backup.enterPassphrase')}
            />
            <Button
              variant="secondary"
              onClick={() => runInspect(importPath, importPass)}
              disabled={busy || !importPass}
            >
              {t('backup.unlock')}
            </Button>
          </div>
        )}

        {/* Confirmation panel */}
        {inspect && inspect.ok && !report && (
          <div
            className="ss-caption"
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              background: 'var(--surface-2, rgba(255,255,255,0.04))',
              lineHeight: 1.6
            }}
          >
            <div>
              <Trans
                t={t}
                i18nKey="backup.fromMachine"
                values={{
                  machine: inspect.sourceMachine ?? t('backup.anotherMac'),
                  tracks: inspect.counts?.tracks ?? 0,
                  sets: inspect.counts?.sets ?? 0,
                  sessions: inspect.counts?.sessions ?? 0
                }}
                components={[<span key="mono" className="ss-mono" />]}
              />
            </div>
            <div style={{ opacity: 0.7, marginTop: 4 }}>
              {inspect.suggestedMode === 'restore'
                ? t('backup.restoreHint')
                : t('backup.mergeHint')}
            </div>
            <div style={{ marginTop: 10 }}>
              <Button variant="primary" onClick={handleImport} disabled={busy}>
                {busy ? t('backup.importing') : t('backup.importButton')}
              </Button>
            </div>
          </div>
        )}

        {/* Re-link report */}
        {report && (
          <div
            className="ss-caption"
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              background: 'var(--surface-2, rgba(255,255,255,0.04))',
              lineHeight: 1.6
            }}
          >
            <div className="ss-label" style={{ marginBottom: 4 }}>
              {t('backup.complete')}
            </div>
            <div>
              {t('backup.relinkSummary', {
                matched: report.matched,
                sets: report.setsImported,
                sessions: report.sessionsImported,
                tags: report.tagsApplied
              })}
            </div>
            {(report.unmatched > 0 || report.ambiguous > 0) && (
              <div style={{ opacity: 0.7, marginTop: 4 }}>
                {t('backup.notFound', { count: report.unmatched })}
                {report.ambiguous > 0 ? t('backup.ambiguous', { count: report.ambiguous }) : ''}
                {t('backup.notFoundHint')}
              </div>
            )}
            {report.setsPartial.length > 0 && (
              <div style={{ opacity: 0.7, marginTop: 4 }}>
                {t('backup.partialSets', { count: report.setsPartial.length })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Fresh Start — wipe the app back to first-launch. Two-step inline confirm (no
 * nested modal, matching BackupSection), then a full-screen deletion animation
 * that triggers the main-process wipe + relaunch. The license stays in the
 * keychain, so Pro survives; only library/settings/history/caches are cleared.
 */
function DangerZoneSection(): React.JSX.Element {
  const { t } = useTranslation('settings')
  const [confirming, setConfirming] = useState(false)
  const [wiping, setWiping] = useState(false)
  const hasBridge = typeof window.setrecord !== 'undefined'

  function handleConfirm(): void {
    // Drop renderer-persisted UI state up front; the main process wipes the rest
    // and relaunches once the animation completes.
    try {
      localStorage.clear()
    } catch {
      /* best effort — main process also clears storage before relaunch */
    }
    setWiping(true)
  }

  return (
    <div className="field-group">
      <div className="ss-label">{t('dangerZone.label', { app: APP_NAME })}</div>
      <div className="ss-caption" style={{ opacity: 0.65, marginTop: 2, lineHeight: 1.45 }}>
        {t('dangerZone.caption', { app: APP_NAME })}
      </div>

      <div style={{ marginTop: 12 }}>
        {!confirming ? (
          <Button
            variant="secondary"
            className="btn-danger-outline"
            icon={Trash2}
            onClick={() => setConfirming(true)}
            disabled={!hasBridge || wiping}
          >
            {t('dangerZone.eraseButton')}
          </Button>
        ) : (
          <div
            className="ss-caption"
            style={{
              padding: 12,
              borderRadius: 8,
              background: 'var(--surface-2, rgba(255,255,255,0.04))',
              lineHeight: 1.6
            }}
          >
            <div style={{ color: 'var(--semantic-danger)', fontWeight: 600 }}>
              {t('dangerZone.cantUndo')}
            </div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>
              {t('dangerZone.confirmDetail', { app: APP_NAME })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={wiping}>
                {t('cancel', { ns: 'common' })}
              </Button>
              <Button
                variant="primary"
                className="btn-danger-solid"
                onClick={handleConfirm}
                disabled={wiping || !hasBridge}
              >
                {t('dangerZone.eraseConfirm')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {wiping && <FreshStartOverlay onComplete={() => void window.setrecord.freshStart()} />}
    </div>
  )
}

export function SettingsModal(): React.JSX.Element {
  const { t, i18n } = useTranslation('settings')
  const { closeModal, showModal } = useUiStore()
  const setLearnModeEnabled = useUiStore((s) => s.setLearnModeEnabled)
  const keyNotation = useUiStore((s) => s.keyNotation)
  const setKeyNotation = useUiStore((s) => s.setKeyNotation)
  const language = useUiStore((s) => s.language)
  const setLanguage = useUiStore((s) => s.setLanguage)
  const reducedMotion = useUiStore((s) => s.reducedMotion)
  const setReducedMotion = useUiStore((s) => s.setReducedMotion)
  const libraryDensity = useUiStore((s) => s.libraryDensity)
  const setLibraryDensity = useUiStore((s) => s.setLibraryDensity)
  const launchMode = useUiStore((s) => s.launchMode)
  const setLaunchMode = useUiStore((s) => s.setLaunchMode)
  const isBeginner = useUiStore((s) => s.isBeginner)
  const setIsBeginner = useUiStore((s) => s.setIsBeginner)
  const voiceInputEnabled = useUiStore((s) => s.voiceInputEnabled)
  const setVoiceInputEnabled = useUiStore((s) => s.setVoiceInputEnabled)
  const showOnboarding = useUiStore((s) => s.showOnboarding)
  const startImportFlow = useLibraryStore((s) => s.startImportFlow)
  const libraryStale = useLibraryStore((s) => s.libraryStale)
  const toast = useToastStore()

  const [targetHardware, setTargetHardware] = useState<CDJModel>('CDJ-2000NXS2')
  const [bpmLow, setBpmLow] = useState(120)
  const [bpmHigh, setBpmHigh] = useState(132)
  const [harmonicMixing, setHarmonicMixing] = useState(true)
  // Local state — consistent with all other toggles; persists on Save
  const [learnMode, setLearnMode] = useState(false)
  const [memoryAi, setMemoryAi] = useState(false)
  const [crashReportingEnabled, setCrashReportingEnabled] = useState(false)
  const [flightRecorderEnabled, setFlightRecorderEnabled] = useState(false)
  const [reactionCaptureEnabled, setReactionCaptureEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState<SettingsTab>('general')
  // Library source state
  const [lastImportSource, setLastImportSource] = useState<ImportSource | null>(null)
  const [lastImportPath, setLastImportPath] = useState<string | null>(null)
  const [lastImportAt, setLastImportAt] = useState<string | null>(null)
  const [autoDetectRekordbox, setAutoDetectRekordbox] = useState(true)
  // Library / tagging
  const [autoTaggingEnabled, setAutoTaggingEnabled] = useState(true)
  const [defaultTagExportRoute, setDefaultTagExportRoute] = useState<'xml' | 'native'>('xml')
  const [rekordboxDbConsent, setRekordboxDbConsent] = useState(false)
  // Updates / network
  const [updateAutoCheck, setUpdateAutoCheck] = useState(true)
  const [updateFrequency, setUpdateFrequency] = useState<'daily' | 'weekly' | 'manual'>('daily')
  const [updatePreRelease, setUpdatePreRelease] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)
  // Playback
  const [previewMaxSeconds, setPreviewMaxSeconds] = useState(60)
  const [previewVolume, setPreviewVolume] = useState(1)
  const [previewFade, setPreviewFade] = useState(false)
  const [outputDeviceId, setOutputDeviceId] = useState<string | null>(null)
  // Waveform / export
  const [waveformQuality, setWaveformQuality] = useState<'low' | 'standard' | 'high'>('standard')
  const [defaultExportFormat, setDefaultExportFormat] = useState<'engine' | 'beatport' | 'ask'>(
    'ask'
  )
  // Audio device pickers (Playback tab), enumerated lazily when the tab opens.
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([])
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([])
  const [liveInputId, setLiveInputId] = useState(() => getPreferredInputId() ?? '')
  // Privacy/data actions
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [clearingArtwork, setClearingArtwork] = useState(false)
  const [artworkCacheBytes, setArtworkCacheBytes] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window.setrecord === 'undefined') return
    window.setrecord.getSettings().then((s) => {
      setTargetHardware(s.targetHardware)
      setBpmLow(s.defaultBpmMin)
      setBpmHigh(s.defaultBpmMax)
      setHarmonicMixing(s.harmonicMixingDefault)
      setLearnMode(s.learnModeEnabled ?? false)
      setMemoryAi(s.memoryAiEnabled ?? false)
      setLastImportSource(s.lastImportSource ?? null)
      setLastImportPath(s.lastImportPath ?? null)
      setLastImportAt(s.lastImportAt ?? null)
      setAutoDetectRekordbox(s.autoDetectRekordbox ?? true)
      setCrashReportingEnabled(s.crashReportingEnabled ?? false)
      setFlightRecorderEnabled(s.flightRecorderEnabled ?? false)
      setReactionCaptureEnabled(s.reactionCaptureEnabled ?? false)
      setAutoTaggingEnabled(s.autoTaggingEnabled ?? true)
      setDefaultTagExportRoute(s.defaultTagExportRoute ?? 'xml')
      setRekordboxDbConsent(s.rekordboxDbConsent ?? false)
      setUpdateAutoCheck(s.updateAutoCheck ?? true)
      setUpdateFrequency(s.updateFrequency ?? 'daily')
      setUpdatePreRelease(s.updatePreRelease ?? false)
      setOfflineMode(s.offlineMode ?? false)
      setPreviewMaxSeconds(s.previewMaxSeconds ?? 60)
      setPreviewVolume(s.previewVolume ?? 1)
      setPreviewFade(s.previewFade ?? false)
      setOutputDeviceId(s.outputDeviceId ?? null)
      setWaveformQuality(s.waveformQuality ?? 'standard')
      setDefaultExportFormat(s.defaultExportFormat ?? 'ask')
      setLoaded(true)
    })
  }, [])

  // Enumerate audio devices when the Playback tab is opened.
  useEffect(() => {
    if (tab !== 'playback') return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        setOutputDevices(devices.filter((d) => d.kind === 'audiooutput'))
        setInputDevices(devices.filter((d) => d.kind === 'audioinput'))
      })
      .catch(() => {})
  }, [tab])

  // Load artwork-cache size when the Privacy & data tab opens.
  useEffect(() => {
    if (tab !== 'data' || typeof window.setrecord === 'undefined') return
    window.setrecord
      .artworkCacheStats()
      .then((st) => setArtworkCacheBytes(st.bytes))
      .catch(() => {})
  }, [tab])

  async function handleSave(): Promise<void> {
    setSaving(true)
    try {
      await window.setrecord.setSettings({
        targetHardware,
        defaultBpmMin: bpmLow,
        defaultBpmMax: bpmHigh,
        harmonicMixingDefault: harmonicMixing,
        learnModeEnabled: learnMode,
        autoDetectRekordbox,
        crashReportingEnabled,
        flightRecorderEnabled,
        reactionCaptureEnabled,
        autoTaggingEnabled,
        defaultTagExportRoute,
        updateAutoCheck,
        updateFrequency,
        updatePreRelease,
        offlineMode,
        previewMaxSeconds,
        previewVolume,
        previewFade,
        outputDeviceId,
        waveformQuality,
        defaultExportFormat
      })
    } catch (err) {
      toast.error(t('saveError'))
      console.error('[settings] save failed', err)
      setSaving(false)
      return
    }

    setLearnModeEnabled(learnMode)
    // Apply playback prefs to the live preview engine immediately.
    usePlaybackStore.getState().applyPlaybackSettings({
      previewVolume,
      previewMaxSeconds,
      previewFade,
      outputDeviceId
    })
    applyWaveformQuality(waveformQuality)
    setSaving(false)
    closeModal()
  }

  async function handleRevokeConsent(): Promise<void> {
    if (typeof window.setrecord === 'undefined') return
    await window.setrecord.setSettings({ rekordboxDbConsent: false })
    setRekordboxDbConsent(false)
    toast.info(t('rbConsent.revoked'))
  }

  async function handleCheckUpdates(): Promise<void> {
    if (typeof window.setrecord === 'undefined') return
    setCheckingUpdate(true)
    try {
      const result = await window.setrecord.checkForUpdatesNow()
      const key =
        result === 'updated'
          ? 'updates.resultUpdated'
          : result === 'up-to-date'
            ? 'updates.resultCurrent'
            : result === 'offline'
              ? 'updates.resultOffline'
              : 'updates.resultUnavailable'
      toast.info(t(key))
    } finally {
      setCheckingUpdate(false)
    }
  }

  async function handleClearArtwork(): Promise<void> {
    if (typeof window.setrecord === 'undefined') return
    setClearingArtwork(true)
    try {
      const res = await window.setrecord.artworkClearCache()
      setArtworkCacheBytes(0)
      toast.success(t('artworkCache.cleared', { count: res.removed }))
    } finally {
      setClearingArtwork(false)
    }
  }

  return (
    <Modal
      onClose={closeModal}
      ariaLabel={t('title')}
      className="settings-modal"
      style={{ width: 760, maxWidth: 'calc(100vw - 48px)' }}
      closeOnBackdrop={false}
    >
      {/* Header — pinned above scroll */}
      <div className="modal-header">
        <div className="ss-h2">{t('title')}</div>
        <IconButton icon={X} aria-label={t('closeAria')} onClick={closeModal} />
      </div>

      {/* Two-column body: left rail of sub-tabs + animated content panel */}
      <div className="settings-layout">
        <nav className="settings-rail" aria-label={t('title')}>
          {SETTINGS_TABS.map(({ id, icon: Icon, danger }) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                className={`settings-rail-item${active ? ' is-active' : ''}${
                  danger ? ' is-danger' : ''
                }`}
                onClick={() => setTab(id)}
                aria-current={active ? 'true' : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="settings-rail-indicator"
                    className="settings-rail-indicator"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    aria-hidden="true"
                  />
                )}
                <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
                <span>{t(`tabs.${id}.label`)}</span>
              </button>
            )
          })}
        </nav>

        <div className="settings-panel">
          {loaded && (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                className="settings-tab"
                variants={slideUp}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="settings-tab-head">
                  <div className="settings-tab-title">{t(`tabs.${tab}.title`)}</div>
                  <div className="settings-tab-desc ss-caption">{t(`tabs.${tab}.desc`)}</div>
                </div>

                <div className="settings-tab-body">
                  {/* ── General: language + key notation ── */}
                  {tab === 'general' && (
                    <>
                      <div className="field-group">
                        <label
                          className="ss-label"
                          htmlFor="settings-language"
                          style={{ display: 'block', marginBottom: 8 }}
                        >
                          {t('language.label')}
                        </label>
                        <select
                          id="settings-language"
                          className="feedback-input"
                          value={language}
                          onChange={(e) => setLanguage(e.target.value as LanguagePreference)}
                          style={{ width: '100%' }}
                        >
                          <option value="system">{t('language.system')}</option>
                          {SUPPORTED_LANGUAGES.map((l) => (
                            <option key={l.code} value={l.code}>
                              {l.nativeName}
                            </option>
                          ))}
                        </select>
                        <div
                          className="ss-caption"
                          style={{ opacity: 0.55, marginTop: 6, lineHeight: 1.45 }}
                        >
                          {t('language.caption')}
                        </div>
                      </div>

                      <div className="field-group">
                        <div
                          className="ss-label"
                          id="settings-key-notation-label"
                          style={{ display: 'block', marginBottom: 8 }}
                        >
                          {t('keyNotation.label')}
                        </div>
                        <SegmentedControl
                          options={[t('keyNotation.camelot'), t('keyNotation.openKey')]}
                          value={
                            keyNotation === 'camelot'
                              ? t('keyNotation.camelot')
                              : t('keyNotation.openKey')
                          }
                          onChange={(v) =>
                            setKeyNotation(v === t('keyNotation.openKey') ? 'standard' : 'camelot')
                          }
                          ariaLabelledby="settings-key-notation-label"
                        />
                        <div className="ss-caption" style={{ opacity: 0.55, marginTop: 6 }}>
                          {t('keyNotation.caption')}
                        </div>
                      </div>

                      <div className="field-group">
                        <div
                          className="ss-label"
                          id="settings-density-label"
                          style={{ display: 'block', marginBottom: 8 }}
                        >
                          {t('density.label')}
                        </div>
                        <SegmentedControl
                          options={[t('density.standard'), t('density.compact')]}
                          value={
                            libraryDensity === 'compact'
                              ? t('density.compact')
                              : t('density.standard')
                          }
                          onChange={(v) =>
                            setLibraryDensity(v === t('density.compact') ? 'compact' : 'standard')
                          }
                          ariaLabelledby="settings-density-label"
                        />
                        <div className="ss-caption" style={{ opacity: 0.55, marginTop: 6 }}>
                          {t('density.caption')}
                        </div>
                      </div>

                      <div className="field-group">
                        <div
                          className="ss-label"
                          id="settings-launch-label"
                          style={{ display: 'block', marginBottom: 8 }}
                        >
                          {t('launch.label')}
                        </div>
                        <SegmentedControl
                          options={[
                            t('launch.last'),
                            t('launch.home'),
                            t('launch.library'),
                            t('launch.build')
                          ]}
                          value={
                            launchMode === 'Home'
                              ? t('launch.home')
                              : launchMode === 'Library'
                                ? t('launch.library')
                                : launchMode === 'Build'
                                  ? t('launch.build')
                                  : t('launch.last')
                          }
                          onChange={(v) =>
                            setLaunchMode(
                              v === t('launch.home')
                                ? 'Home'
                                : v === t('launch.library')
                                  ? 'Library'
                                  : v === t('launch.build')
                                    ? 'Build'
                                    : 'last'
                            )
                          }
                          ariaLabelledby="settings-launch-label"
                        />
                        <div className="ss-caption" style={{ opacity: 0.55, marginTop: 6 }}>
                          {t('launch.caption')}
                        </div>
                      </div>

                      <div className="field-group">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 16
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <Accessibility
                              size={18}
                              strokeWidth={1.6}
                              style={{ marginTop: 2, opacity: 0.8 }}
                              aria-hidden="true"
                            />
                            <div>
                              <div className="ss-label">{t('reducedMotion.label')}</div>
                              <div className="ss-caption" style={{ opacity: 0.65, marginTop: 2 }}>
                                {t('reducedMotion.caption')}
                              </div>
                            </div>
                          </div>
                          <Toggle
                            on={reducedMotion}
                            onChange={setReducedMotion}
                            aria-label={t('reducedMotion.toggleAria')}
                          />
                        </div>
                      </div>

                      <div className="field-group">
                        <div className="ss-label">{t('replayOnboarding.label')}</div>
                        <div
                          className="ss-caption"
                          style={{ opacity: 0.65, marginTop: 2, lineHeight: 1.45 }}
                        >
                          {t('replayOnboarding.caption')}
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              closeModal()
                              showOnboarding()
                            }}
                          >
                            {t('replayOnboarding.button')}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Plan ── */}
                  {tab === 'plan' && <LicenseSection />}

                  {/* ── Memory: plain-English search + learn mode ── */}
                  {tab === 'memory' && (
                    <>
                      <div className="field-group">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 16
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <Sparkles
                              size={18}
                              strokeWidth={1.6}
                              style={{ marginTop: 2, opacity: 0.8 }}
                              aria-hidden="true"
                            />
                            <div>
                              <div className="ss-label">{t('plainSearch.label')}</div>
                              <div className="ss-caption" style={{ opacity: 0.65, marginTop: 2 }}>
                                {t('plainSearch.caption')}
                              </div>
                            </div>
                          </div>
                          <Toggle
                            on={memoryAi}
                            onChange={(v) => {
                              setMemoryAi(v)
                              if (typeof window.setrecord !== 'undefined')
                                void window.setrecord.recallAiEnable(v)
                            }}
                            aria-label={t('plainSearch.toggleAria')}
                          />
                        </div>
                      </div>

                      <div className="field-group">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 16
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <GraduationCap
                              size={18}
                              strokeWidth={1.6}
                              style={{ marginTop: 2, opacity: 0.8 }}
                              aria-hidden="true"
                            />
                            <div>
                              <div className="ss-label">{t('learnMode.label')}</div>
                              <div className="ss-caption" style={{ opacity: 0.65, marginTop: 2 }}>
                                {t('learnMode.caption')}
                              </div>
                            </div>
                          </div>
                          <Toggle
                            on={learnMode}
                            onChange={setLearnMode}
                            aria-label={t('learnMode.toggleAria')}
                          />
                        </div>
                        {learnMode && (
                          <button
                            type="button"
                            className="settings-link-btn"
                            style={{ marginTop: 10, marginLeft: 28 }}
                            onClick={() => useCoachmarkStore.getState().reset()}
                          >
                            {t('learnMode.replayTips')}
                          </button>
                        )}
                      </div>

                      <div className="field-group">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 16
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <Sprout
                              size={18}
                              strokeWidth={1.6}
                              style={{ marginTop: 2, opacity: 0.8 }}
                              aria-hidden="true"
                            />
                            <div>
                              <div className="ss-label">{t('beginnerMode.label')}</div>
                              <div className="ss-caption" style={{ opacity: 0.65, marginTop: 2 }}>
                                {t('beginnerMode.caption')}
                              </div>
                            </div>
                          </div>
                          <Toggle
                            on={isBeginner}
                            onChange={setIsBeginner}
                            aria-label={t('beginnerMode.toggleAria')}
                          />
                        </div>
                      </div>

                      <div className="field-group">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 16
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <Mic
                              size={18}
                              strokeWidth={1.6}
                              style={{ marginTop: 2, opacity: 0.8 }}
                              aria-hidden="true"
                            />
                            <div>
                              <div className="ss-label">{t('voiceInput.label')}</div>
                              <div className="ss-caption" style={{ opacity: 0.65, marginTop: 2 }}>
                                {t('voiceInput.caption')}
                              </div>
                            </div>
                          </div>
                          <Toggle
                            on={voiceInputEnabled}
                            onChange={setVoiceInputEnabled}
                            aria-label={t('voiceInput.toggleAria')}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Mixing: hardware + bpm range + harmonic mixing ── */}
                  {tab === 'mixing' && (
                    <>
                      <div className="field-group">
                        <label className="ss-label">
                          <LearnTooltip
                            explanation={{
                              summary: t('targetHardware.label'),
                              detail: t('targetHardware.detail')
                            }}
                            iconLabel={t('targetHardware.iconLabel')}
                          >
                            {t('targetHardware.label')}
                          </LearnTooltip>
                        </label>
                        <div style={{ marginTop: 8 }}>
                          <SegmentedControl
                            options={HARDWARE_OPTIONS}
                            value={targetHardware}
                            onChange={(v) => setTargetHardware(v as CDJModel)}
                            ariaLabel={t('targetHardware.label')}
                          />
                        </div>
                      </div>

                      <div className="field-group">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline'
                          }}
                        >
                          <label className="ss-label">
                            <LearnTooltip
                              explanation={{
                                summary: t('bpmRange.label'),
                                detail: t('bpmRange.detail')
                              }}
                              iconLabel={t('bpmRange.iconLabel')}
                            >
                              {t('bpmRange.label')}
                            </LearnTooltip>
                          </label>
                          <span className="ss-mono ss-caption" style={{ opacity: 0.7 }}>
                            {t('bpmRange.value', { low: bpmLow, high: bpmHigh })}
                          </span>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <RangeSlider
                            min={60}
                            max={200}
                            step={1}
                            low={bpmLow}
                            high={bpmHigh}
                            onChange={(low, high) => {
                              setBpmLow(low)
                              setBpmHigh(high)
                            }}
                          />
                        </div>
                      </div>

                      <div className="field-group">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div className="ss-label">
                              <LearnTooltip
                                explanation={{
                                  summary: t('harmonicMixing.label'),
                                  detail: t('harmonicMixing.detail')
                                }}
                                iconLabel={t('harmonicMixing.iconLabel')}
                              >
                                {t('harmonicMixing.label')}
                              </LearnTooltip>
                            </div>
                            <div className="ss-caption" style={{ opacity: 0.6, marginTop: 2 }}>
                              {t('harmonicMixing.caption')}
                            </div>
                          </div>
                          <Toggle on={harmonicMixing} onChange={setHarmonicMixing} />
                        </div>
                      </div>

                      <div className="field-group">
                        <div
                          className="ss-label"
                          id="settings-export-format-label"
                          style={{ display: 'block', marginBottom: 8 }}
                        >
                          {t('exportFormat.label')}
                        </div>
                        <SegmentedControl
                          options={[
                            t('exportFormat.ask'),
                            t('exportFormat.engine'),
                            t('exportFormat.beatport')
                          ]}
                          value={
                            defaultExportFormat === 'engine'
                              ? t('exportFormat.engine')
                              : defaultExportFormat === 'beatport'
                                ? t('exportFormat.beatport')
                                : t('exportFormat.ask')
                          }
                          onChange={(v) =>
                            setDefaultExportFormat(
                              v === t('exportFormat.engine')
                                ? 'engine'
                                : v === t('exportFormat.beatport')
                                  ? 'beatport'
                                  : 'ask'
                            )
                          }
                          ariaLabelledby="settings-export-format-label"
                        />
                        <div className="ss-caption" style={{ opacity: 0.55, marginTop: 6 }}>
                          {t('exportFormat.caption')}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Playback: preview + devices + waveform ── */}
                  {tab === 'playback' && (
                    <>
                      <div className="field-group">
                        <div
                          className="ss-label"
                          id="settings-preview-len-label"
                          style={{ display: 'block', marginBottom: 8 }}
                        >
                          {t('playback.lengthLabel')}
                        </div>
                        <SegmentedControl
                          options={[
                            t('playback.len30'),
                            t('playback.len1m'),
                            t('playback.len2m'),
                            t('playback.len5m'),
                            t('playback.lenFull')
                          ]}
                          value={
                            previewMaxSeconds === 30
                              ? t('playback.len30')
                              : previewMaxSeconds === 120
                                ? t('playback.len2m')
                                : previewMaxSeconds === 300
                                  ? t('playback.len5m')
                                  : previewMaxSeconds === 0
                                    ? t('playback.lenFull')
                                    : t('playback.len1m')
                          }
                          onChange={(v) =>
                            setPreviewMaxSeconds(
                              v === t('playback.len30')
                                ? 30
                                : v === t('playback.len2m')
                                  ? 120
                                  : v === t('playback.len5m')
                                    ? 300
                                    : v === t('playback.lenFull')
                                      ? 0
                                      : 60
                            )
                          }
                          ariaLabelledby="settings-preview-len-label"
                        />
                        <div className="ss-caption" style={{ opacity: 0.55, marginTop: 6 }}>
                          {t('playback.lengthCaption')}
                        </div>
                      </div>

                      <div className="field-group">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline'
                          }}
                        >
                          <div className="ss-label">{t('playback.volumeLabel')}</div>
                          <span className="ss-mono ss-caption" style={{ opacity: 0.7 }}>
                            {Math.round(previewVolume * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(previewVolume * 100)}
                          onChange={(e) => setPreviewVolume(Number(e.target.value) / 100)}
                          aria-label={t('playback.volumeLabel')}
                          style={{ width: '100%', marginTop: 8, accentColor: 'var(--accent)' }}
                        />
                      </div>

                      <div className="field-group">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 16
                          }}
                        >
                          <div>
                            <div className="ss-label">{t('playback.fadeLabel')}</div>
                            <div className="ss-caption" style={{ opacity: 0.6, marginTop: 2 }}>
                              {t('playback.fadeCaption')}
                            </div>
                          </div>
                          <Toggle
                            on={previewFade}
                            onChange={setPreviewFade}
                            aria-label={t('playback.fadeLabel')}
                          />
                        </div>
                      </div>

                      <div className="field-group">
                        <label
                          className="ss-label"
                          htmlFor="settings-output-device"
                          style={{ display: 'block', marginBottom: 8 }}
                        >
                          {t('playback.outputLabel')}
                        </label>
                        <select
                          id="settings-output-device"
                          className="feedback-input"
                          value={outputDeviceId ?? ''}
                          onChange={(e) => setOutputDeviceId(e.target.value || null)}
                          style={{ width: '100%' }}
                        >
                          <option value="">{t('playback.systemDefault')}</option>
                          {outputDevices.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>
                              {d.label || t('playback.unnamedDevice')}
                            </option>
                          ))}
                        </select>
                        <div className="ss-caption" style={{ opacity: 0.55, marginTop: 6 }}>
                          {t('playback.outputCaption')}
                        </div>
                      </div>

                      <div className="field-group">
                        <label
                          className="ss-label"
                          htmlFor="settings-input-device"
                          style={{ display: 'block', marginBottom: 8 }}
                        >
                          {t('playback.inputLabel')}
                        </label>
                        <select
                          id="settings-input-device"
                          className="feedback-input"
                          value={liveInputId}
                          onChange={(e) => {
                            const id = e.target.value
                            setLiveInputId(id)
                            setPreferredInputId(id || undefined)
                          }}
                          style={{ width: '100%' }}
                        >
                          <option value="">{t('playback.systemDefault')}</option>
                          {inputDevices.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>
                              {d.label || t('playback.unnamedDevice')}
                            </option>
                          ))}
                        </select>
                        <div className="ss-caption" style={{ opacity: 0.55, marginTop: 6 }}>
                          {t('playback.inputCaption')}
                        </div>
                      </div>

                      <div className="field-group">
                        <div
                          className="ss-label"
                          id="settings-waveform-label"
                          style={{ display: 'block', marginBottom: 8 }}
                        >
                          {t('playback.waveformLabel')}
                        </div>
                        <SegmentedControl
                          options={[
                            t('playback.wfLow'),
                            t('playback.wfStandard'),
                            t('playback.wfHigh')
                          ]}
                          value={
                            waveformQuality === 'low'
                              ? t('playback.wfLow')
                              : waveformQuality === 'high'
                                ? t('playback.wfHigh')
                                : t('playback.wfStandard')
                          }
                          onChange={(v) =>
                            setWaveformQuality(
                              v === t('playback.wfLow')
                                ? 'low'
                                : v === t('playback.wfHigh')
                                  ? 'high'
                                  : 'standard'
                            )
                          }
                          ariaLabelledby="settings-waveform-label"
                        />
                        <div className="ss-caption" style={{ opacity: 0.55, marginTop: 6 }}>
                          {t('playback.waveformCaption')}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Library: source + auto-detect ── */}
                  {tab === 'library' && (
                    <>
                      <div className="field-group">
                        <div className="ss-label">
                          {t('librarySource.label', { app: APP_NAME })}
                        </div>
                        <div
                          className="ss-caption"
                          style={{ opacity: 0.65, marginTop: 4, lineHeight: 1.45 }}
                        >
                          {lastImportSource ? (
                            <>
                              {lastImportSource === 'rekordbox-db'
                                ? t('librarySource.fromDb')
                                : t('librarySource.fromXml')}
                              {lastImportAt && (
                                <>
                                  {' · '}
                                  <span className="ss-mono">
                                    {t('librarySource.lastImported', {
                                      date: formatDate(lastImportAt, i18n.language)
                                    })}
                                  </span>
                                </>
                              )}
                              {lastImportPath && (
                                <div
                                  style={{ opacity: 0.5, marginTop: 4, wordBreak: 'break-all' }}
                                  className="ss-mono"
                                >
                                  {lastImportPath}
                                </div>
                              )}
                            </>
                          ) : (
                            t('librarySource.none')
                          )}
                        </div>
                        <div
                          style={{
                            marginTop: 12,
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                            flexWrap: 'wrap'
                          }}
                        >
                          <Button
                            variant={libraryStale ? 'primary' : 'secondary'}
                            icon={RefreshCw}
                            onClick={() => {
                              void startImportFlow()
                              closeModal()
                              showModal('import')
                            }}
                          >
                            {libraryStale
                              ? t('librarySource.resyncNow')
                              : t('librarySource.resync')}
                          </Button>
                          {libraryStale && (
                            <span className="ss-caption" style={{ color: 'var(--accent)' }}>
                              {t('librarySource.staleHint')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="field-group">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div className="ss-label">{t('autoDetect.label')}</div>
                            <div className="ss-caption" style={{ opacity: 0.6, marginTop: 2 }}>
                              {t('autoDetect.caption')}
                            </div>
                          </div>
                          <Toggle
                            on={autoDetectRekordbox}
                            onChange={setAutoDetectRekordbox}
                            aria-label={t('autoDetect.toggleAria')}
                          />
                        </div>
                      </div>

                      <div className="field-group">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 16
                          }}
                        >
                          <div>
                            <div className="ss-label">{t('autoTagging.label')}</div>
                            <div className="ss-caption" style={{ opacity: 0.6, marginTop: 2 }}>
                              {t('autoTagging.caption')}
                            </div>
                          </div>
                          <Toggle
                            on={autoTaggingEnabled}
                            onChange={setAutoTaggingEnabled}
                            aria-label={t('autoTagging.label')}
                          />
                        </div>
                      </div>

                      <div className="field-group">
                        <div
                          className="ss-label"
                          id="settings-tagroute-label"
                          style={{ display: 'block', marginBottom: 8 }}
                        >
                          {t('tagRoute.label')}
                        </div>
                        <SegmentedControl
                          options={[t('tagRoute.xml'), t('tagRoute.native')]}
                          value={
                            defaultTagExportRoute === 'native'
                              ? t('tagRoute.native')
                              : t('tagRoute.xml')
                          }
                          onChange={(v) =>
                            setDefaultTagExportRoute(v === t('tagRoute.native') ? 'native' : 'xml')
                          }
                          ariaLabelledby="settings-tagroute-label"
                        />
                        <div className="ss-caption" style={{ opacity: 0.55, marginTop: 6 }}>
                          {t('tagRoute.caption')}
                        </div>
                      </div>

                      {rekordboxDbConsent && (
                        <div className="field-group">
                          <div className="ss-label">{t('rbConsent.label')}</div>
                          <div
                            className="ss-caption"
                            style={{ opacity: 0.65, marginTop: 2, lineHeight: 1.45 }}
                          >
                            {t('rbConsent.caption')}
                          </div>
                          <div style={{ marginTop: 12 }}>
                            <Button variant="secondary" onClick={() => void handleRevokeConsent()}>
                              {t('rbConsent.button')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Privacy & Backup: crash reporting + backup/migration ── */}
                  {tab === 'data' && (
                    <>
                      <div className="field-group">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 16
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <Shield
                              size={18}
                              strokeWidth={1.6}
                              style={{ marginTop: 2, opacity: 0.8, flexShrink: 0 }}
                              aria-hidden="true"
                            />
                            <div>
                              <div className="ss-label">{t('crashReporting.label')}</div>
                              <div
                                className="ss-caption"
                                style={{ opacity: 0.65, marginTop: 2, lineHeight: 1.5 }}
                              >
                                {t('crashReporting.caption')}
                              </div>
                              <div
                                className="ss-caption"
                                style={{ opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}
                              >
                                {t('crashReporting.privacyNote', { app: APP_NAME })}
                              </div>
                            </div>
                          </div>
                          <Toggle
                            on={crashReportingEnabled}
                            onChange={setCrashReportingEnabled}
                            aria-label={t('crashReporting.toggleAria')}
                          />
                        </div>
                      </div>

                      <div className="field-group">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 16
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <Mic
                              size={18}
                              strokeWidth={1.6}
                              style={{ marginTop: 2, opacity: 0.8, flexShrink: 0 }}
                              aria-hidden="true"
                            />
                            <div>
                              <div className="ss-label">{t('flightRecorder.label')}</div>
                              <div
                                className="ss-caption"
                                style={{ opacity: 0.65, marginTop: 2, lineHeight: 1.5 }}
                              >
                                {t('flightRecorder.caption')}
                              </div>
                              <div
                                className="ss-caption"
                                style={{ opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}
                              >
                                {t('flightRecorder.privacyNote')}
                              </div>
                            </div>
                          </div>
                          <Toggle
                            on={flightRecorderEnabled}
                            onChange={setFlightRecorderEnabled}
                            aria-label={t('flightRecorder.toggleAria')}
                          />
                        </div>

                        {flightRecorderEnabled && (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              gap: 16,
                              marginTop: 14,
                              paddingTop: 14,
                              borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.06))'
                            }}
                          >
                            <div>
                              <div className="ss-label">
                                {t('flightRecorder.reactionLabel')}{' '}
                                <span style={{ opacity: 0.55, fontWeight: 400 }}>
                                  {t('flightRecorder.experimental')}
                                </span>
                              </div>
                              <div
                                className="ss-caption"
                                style={{ opacity: 0.65, marginTop: 2, lineHeight: 1.5 }}
                              >
                                {t('flightRecorder.reactionCaption')}
                              </div>
                            </div>
                            <Toggle
                              on={reactionCaptureEnabled}
                              onChange={setReactionCaptureEnabled}
                              aria-label={t('flightRecorder.reactionToggleAria')}
                            />
                          </div>
                        )}
                      </div>

                      <div className="field-group">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 16
                          }}
                        >
                          <div>
                            <div className="ss-label">{t('updates.label')}</div>
                            <div className="ss-caption" style={{ opacity: 0.6, marginTop: 2 }}>
                              {t('updates.caption')}
                            </div>
                          </div>
                          <Toggle
                            on={updateAutoCheck}
                            onChange={setUpdateAutoCheck}
                            aria-label={t('updates.label')}
                          />
                        </div>
                        {updateAutoCheck && (
                          <div style={{ marginTop: 12 }}>
                            <SegmentedControl
                              options={[t('updates.daily'), t('updates.weekly')]}
                              value={
                                updateFrequency === 'weekly'
                                  ? t('updates.weekly')
                                  : t('updates.daily')
                              }
                              onChange={(v) =>
                                setUpdateFrequency(v === t('updates.weekly') ? 'weekly' : 'daily')
                              }
                              ariaLabel={t('updates.frequency')}
                            />
                          </div>
                        )}
                        <div
                          style={{
                            marginTop: 12,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 16
                          }}
                        >
                          <div>
                            <div className="ss-label">{t('updates.preReleaseLabel')}</div>
                            <div className="ss-caption" style={{ opacity: 0.6, marginTop: 2 }}>
                              {t('updates.preReleaseCaption')}
                            </div>
                          </div>
                          <Toggle
                            on={updatePreRelease}
                            onChange={setUpdatePreRelease}
                            aria-label={t('updates.preReleaseLabel')}
                          />
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <Button
                            variant="secondary"
                            icon={RefreshCw}
                            onClick={() => void handleCheckUpdates()}
                            disabled={checkingUpdate}
                          >
                            {checkingUpdate ? t('updates.checking') : t('updates.checkNow')}
                          </Button>
                        </div>
                      </div>

                      <div className="field-group">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 16
                          }}
                        >
                          <div>
                            <div className="ss-label">{t('offline.label')}</div>
                            <div className="ss-caption" style={{ opacity: 0.6, marginTop: 2 }}>
                              {t('offline.caption')}
                            </div>
                          </div>
                          <Toggle
                            on={offlineMode}
                            onChange={setOfflineMode}
                            aria-label={t('offline.label')}
                          />
                        </div>
                      </div>

                      <div className="field-group">
                        <div className="ss-label">{t('artworkCache.label')}</div>
                        <div
                          className="ss-caption"
                          style={{ opacity: 0.65, marginTop: 2, lineHeight: 1.45 }}
                        >
                          {t('artworkCache.caption', { size: formatBytes(artworkCacheBytes) })}
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <Button
                            variant="secondary"
                            icon={Trash2}
                            onClick={() => void handleClearArtwork()}
                            disabled={clearingArtwork || artworkCacheBytes === 0}
                          >
                            {clearingArtwork ? t('artworkCache.clearing') : t('artworkCache.clear')}
                          </Button>
                        </div>
                      </div>

                      <BackupSection />
                    </>
                  )}

                  {/* ── Reset ── */}
                  {tab === 'reset' && <DangerZoneSection />}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Footer — pinned below scroll */}
      <div className="modal-footer">
        <Button variant="secondary" onClick={closeModal}>
          {t('cancel', { ns: 'common' })}
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving || !loaded}>
          {saving ? t('saving') : t('save')}
        </Button>
      </div>
    </Modal>
  )
}
