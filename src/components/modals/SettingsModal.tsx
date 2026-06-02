import { useEffect, useState } from 'react'
import FocusLock from 'react-focus-lock'
import { GraduationCap, RefreshCw, Shield, Sparkles, X, Crown } from 'lucide-react'
import type { CDJModel, ImportSource } from '@/types'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { RangeSlider } from '@/components/shared/RangeSlider'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { Toggle } from '@/components/shared/Toggle'
import { motion, modalBackdrop, modalPanel } from '@/components/shared/Motion'
import { useLibraryStore } from '@/stores/libraryStore'
import { useUiStore } from '@/stores/uiStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { useCoachmarkStore } from '@/stores/coachmarkStore'
import { useToastStore } from '@/stores/toastStore'
import { LearnTooltip } from '@/components/learn/LearnTooltip'

const HARDWARE_OPTIONS: CDJModel[] = ['CDJ-2000NXS2', 'CDJ-3000', 'XDJ-RX3', 'XDJ-XZ', 'CDJ-2000']

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

/** Current-plan summary + activate / deactivate / restore controls. */
function LicenseSection(): React.JSX.Element {
  const license = useLicenseStore((s) => s.license)
  const deactivate = useLicenseStore((s) => s.deactivate)
  const showUpgrade = useUiStore((s) => s.showUpgrade)
  const closeModal = useUiStore((s) => s.closeModal)
  const toast = useToastStore()
  const [working, setWorking] = useState(false)

  const isPro = license.tier === 'pro'

  // Humane, non-hostile messaging for the anti-abuse states. None of these
  // brick the app — they explain what happened and what to do next.
  const statusNotice: string | null =
    license.status === 'device-mismatch'
      ? 'This licence is activated on another device. Deactivate it there, or contact support to move it — your key is otherwise valid.'
      : license.status === 'revoked'
        ? 'This licence was cancelled or refunded. If that’s unexpected, contact support and we’ll help.'
        : license.status === 'expired'
          ? 'Your subscription has lapsed. Renew to restore Pro — your settings and library are untouched.'
          : license.status === 'invalid'
            ? 'This stored key couldn’t be verified. Re-paste it, or contact support.'
            : license.clockWarning
              ? 'Your system clock looks like it moved backwards. Pro still works; just check your date & time so subscription dates stay accurate.'
              : null

  const handleDeactivate = async (): Promise<void> => {
    setWorking(true)
    try {
      await deactivate()
      toast.info('License removed from this device.')
    } catch {
      toast.error('Could not deactivate the license.')
    } finally {
      setWorking(false)
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
            <div className="ss-label">{isPro ? 'SetSense Pro' : 'Free plan'}</div>
            <div className="ss-caption" style={{ opacity: 0.65, marginTop: 2, lineHeight: 1.45 }}>
              {isPro ? (
                <>
                  {license.plan === 'lifetime' ? 'Lifetime licence' : 'Monthly subscription'}
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
                      Renews / expires {formatDate(license.expiresAt)}
                    </div>
                  )}
                  {license.activatedAt && (
                    <div style={{ opacity: 0.6, marginTop: 2 }}>
                      Activated {formatDate(license.activatedAt)}
                    </div>
                  )}
                </>
              ) : (
                'Import, browse and build sets manually. Unlock suggestions, Set Architect, Recall and export with Pro.'
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
          Bound to this device.
        </div>
      )}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {isPro ? (
          <Button variant="secondary" onClick={() => void handleDeactivate()} disabled={working}>
            {working ? 'Removing…' : 'Deactivate on this device'}
          </Button>
        ) : (
          <Button
            variant="primary"
            icon={Sparkles}
            onClick={() => {
              closeModal()
              showUpgrade()
            }}
          >
            Upgrade to Pro
          </Button>
        )}
      </div>
    </div>
  )
}

export function SettingsModal(): React.JSX.Element {
  const { closeModal, showModal } = useUiStore()
  const setLearnModeEnabled = useUiStore((s) => s.setLearnModeEnabled)
  const keyNotation = useUiStore((s) => s.keyNotation)
  const setKeyNotation = useUiStore((s) => s.setKeyNotation)
  const startAutoDetectFlow = useLibraryStore((s) => s.startAutoDetectFlow)
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
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // Library source state
  const [lastImportSource, setLastImportSource] = useState<ImportSource | null>(null)
  const [lastImportPath, setLastImportPath] = useState<string | null>(null)
  const [lastImportAt, setLastImportAt] = useState<string | null>(null)
  const [autoDetectRekordbox, setAutoDetectRekordbox] = useState(true)

  useEffect(() => {
    if (typeof window.setsense === 'undefined') return
    window.setsense.getSettings().then((s) => {
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
      setLoaded(true)
    })
  }, [])

  async function handleSave(): Promise<void> {
    setSaving(true)
    try {
      await window.setsense.setSettings({
        targetHardware,
        defaultBpmMin: bpmLow,
        defaultBpmMax: bpmHigh,
        harmonicMixingDefault: harmonicMixing,
        learnModeEnabled: learnMode,
        autoDetectRekordbox,
        crashReportingEnabled
      })
    } catch (err) {
      toast.error('Could not save settings. Try again or restart the app.')
      console.error('[settings] save failed', err)
      setSaving(false)
      return
    }

    setLearnModeEnabled(learnMode)
    setSaving(false)
    closeModal()
  }

  return (
    <motion.div
      className="modal-overlay"
      variants={modalBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <FocusLock returnFocus>
        <motion.div
          className="modal glass-3 settings-modal"
          variants={modalPanel}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ maxWidth: 480, width: '100%' }}
        >
          {/* Header — pinned above scroll */}
          <div className="modal-header">
            <div className="ss-h2">Settings</div>
            <IconButton icon={X} aria-label="Close settings" onClick={closeModal} />
          </div>

          {/* Scrollable body */}
          <div className="settings-scroll-body">
            {loaded && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '0 0 8px' }}
              >
                {/* SetSense Pro — plan + activation */}
                <div
                  className="settings-section-header ss-caption"
                  style={{ opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 }}
                >
                  Plan
                </div>
                <LicenseSection />

                {/* Learn Mode */}
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
                        <div className="ss-label">Learn Mode</div>
                        <div className="ss-caption" style={{ opacity: 0.65, marginTop: 2 }}>
                          Adds in-line explanations + diagrams to every recommendation. Great for
                          picking up harmonic mixing, BPM transitions, and energy arcs.
                        </div>
                      </div>
                    </div>
                    <Toggle on={learnMode} onChange={setLearnMode} aria-label="Toggle Learn Mode" />
                  </div>
                  {learnMode && (
                    <button
                      type="button"
                      className="settings-link-btn"
                      style={{ marginTop: 10, marginLeft: 28 }}
                      onClick={() => useCoachmarkStore.getState().reset()}
                    >
                      Replay first-time tips
                    </button>
                  )}
                </div>

                {/* SetSense Intelligence — extended free-form understanding (Discover) */}
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
                        <div className="ss-label">Extended understanding</div>
                        <div className="ss-caption" style={{ opacity: 0.65, marginTop: 2 }}>
                          Understands unusual, free-form phrasing on top of the built-in search.
                          Runs fully on your Mac — private, offline, and built in (no download).
                          Turn off to skip loading it into memory.
                        </div>
                      </div>
                    </div>
                    <Toggle
                      on={memoryAi}
                      onChange={(v) => {
                        setMemoryAi(v)
                        if (typeof window.setsense !== 'undefined')
                          void window.setsense.recallAiEnable(v)
                      }}
                      aria-label="Toggle extended understanding"
                    />
                  </div>
                </div>

                {/* Key notation */}
                <div className="field-group">
                  <label className="ss-label" style={{ display: 'block', marginBottom: 8 }}>
                    Key notation
                  </label>
                  <SegmentedControl
                    options={['Camelot (9A)', 'Open Key (Am)']}
                    value={keyNotation === 'camelot' ? 'Camelot (9A)' : 'Open Key (Am)'}
                    onChange={(v) => setKeyNotation(v === 'Open Key (Am)' ? 'standard' : 'camelot')}
                  />
                  <div className="ss-caption" style={{ opacity: 0.55, marginTop: 6 }}>
                    Controls how keys are shown on track rows and key chips throughout the app.
                  </div>
                </div>

                {/* Target hardware */}
                <div className="field-group">
                  <label className="ss-label">
                    <LearnTooltip
                      explanation={{
                        summary: 'Default target hardware',
                        detail:
                          'Sets the Pioneer CDJ model used during export validation — controls allowed file formats, max bitrate, hot-cue count, and folder layout. Pick the model your booth uses.'
                      }}
                      iconLabel="What is target hardware?"
                    >
                      Default target hardware
                    </LearnTooltip>
                  </label>
                  <div style={{ marginTop: 8 }}>
                    <SegmentedControl
                      options={HARDWARE_OPTIONS}
                      value={targetHardware}
                      onChange={(v) => setTargetHardware(v as CDJModel)}
                    />
                  </div>
                </div>

                {/* Default BPM range */}
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
                          summary: 'Default BPM range',
                          detail:
                            'The tempo window Set Architect and Suggestions stay within. Narrower = more cohesive flow; wider = more candidate tracks. 8–10 BPM is a typical club range.'
                        }}
                        iconLabel="What is the BPM range?"
                      >
                        Default BPM range
                      </LearnTooltip>
                    </label>
                    <span className="ss-mono ss-caption" style={{ opacity: 0.7 }}>
                      {bpmLow}–{bpmHigh} BPM
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

                {/* YouTube API key — hidden from UI (YouTube Discover tab not in navigation) */}

                {/* Harmonic mixing default */}
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
                            summary: 'Harmonic mixing',
                            detail:
                              'When on, Set Architect prefers adjacent or same-letter Camelot keys, keeping the harmonic colour consistent and avoiding key clashes. Turn off if you intentionally want jarring key shifts.'
                          }}
                          iconLabel="What is harmonic mixing?"
                        >
                          Harmonic mixing
                        </LearnTooltip>
                      </div>
                      <div className="ss-caption" style={{ opacity: 0.6, marginTop: 2 }}>
                        On by default in Set Architect
                      </div>
                    </div>
                    <Toggle on={harmonicMixing} onChange={setHarmonicMixing} />
                  </div>
                </div>

                {/* Library source — Rekordbox auto-detect + re-sync */}
                <div
                  className="settings-section-header ss-caption"
                  style={{
                    opacity: 0.6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginTop: 8
                  }}
                >
                  Library source
                </div>

                <div className="field-group">
                  <div className="ss-label">Where SetSense reads your library from</div>
                  <div
                    className="ss-caption"
                    style={{ opacity: 0.65, marginTop: 4, lineHeight: 1.45 }}
                  >
                    {lastImportSource ? (
                      <>
                        {lastImportSource === 'rekordbox-db'
                          ? 'Read directly from Rekordbox database'
                          : 'Imported from Rekordbox XML export'}
                        {lastImportAt && (
                          <>
                            {' · last imported '}
                            <span className="ss-mono">
                              {new Date(lastImportAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
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
                      'No library imported yet.'
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
                        void startAutoDetectFlow()
                        closeModal()
                        showModal('import')
                      }}
                    >
                      {libraryStale ? 'Re-sync now' : 'Re-sync library'}
                    </Button>
                    {libraryStale && (
                      <span className="ss-caption" style={{ color: 'var(--accent)' }}>
                        Source updated — re-sync recommended.
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
                      <div className="ss-label">Auto-detect Rekordbox</div>
                      <div className="ss-caption" style={{ opacity: 0.6, marginTop: 2 }}>
                        On launch, look for Rekordbox on this Mac so import is one click.
                      </div>
                    </div>
                    <Toggle
                      on={autoDetectRekordbox}
                      onChange={setAutoDetectRekordbox}
                      aria-label="Toggle auto-detect Rekordbox"
                    />
                  </div>
                </div>

                {/* Privacy — crash reporting */}
                <div
                  className="settings-section-header ss-caption"
                  style={{
                    opacity: 0.6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginTop: 8
                  }}
                >
                  Privacy
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
                      <Shield
                        size={18}
                        strokeWidth={1.6}
                        style={{ marginTop: 2, opacity: 0.8, flexShrink: 0 }}
                        aria-hidden="true"
                      />
                      <div>
                        <div className="ss-label">Crash reporting</div>
                        <div
                          className="ss-caption"
                          style={{ opacity: 0.65, marginTop: 2, lineHeight: 1.5 }}
                        >
                          Opt in to send anonymous crash reports when the app unexpectedly quits.
                          Reports include only the error type, a redacted stack trace (filenames, no
                          paths), your OS version, and the app version.
                        </div>
                        <div
                          className="ss-caption"
                          style={{ opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}
                        >
                          Your library, track titles, file paths, and personal data are never
                          included. Off by default. Takes effect after restarting SetSense.
                        </div>
                      </div>
                    </div>
                    <Toggle
                      on={crashReportingEnabled}
                      onChange={setCrashReportingEnabled}
                      aria-label="Toggle crash reporting"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer — pinned below scroll */}
          <div className="modal-footer">
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || !loaded}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        </motion.div>
      </FocusLock>
    </motion.div>
  )
}
