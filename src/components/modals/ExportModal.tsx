import { useEffect, useRef, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { APP_NAME } from '@/utils/constants'
import { launchProfile } from '@/config/launchProfile'
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  HardDrive,
  ListMusic,
  Loader,
  X
} from 'lucide-react'
import type { BeatportConfidence, BeatportRow, CDJModel, ValidationResult } from '@/types'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { motion, AnimatePresence } from '@/components/shared/Motion'
import { Modal } from '@/components/shared/Modal'
import { buildBeatportRows, rescoreRow } from '@/utils/beatportMatch'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { useUSBStore } from '@/stores/usbStore'
import { useToastStore } from '@/stores/toastStore'

type ExportPhase =
  | 'chooseFormat'
  | 'idle'
  | 'engineUsbPicker'
  | 'validating'
  | 'issues'
  | 'exporting'
  | 'done'
  | 'beatportReview'
  | 'beatportExporting'
  | 'beatportDone'

type ExportTargetKind = 'pioneer' | 'engine'

interface EngineProgress {
  processed: number
  total: number
  phase: 'copying' | 'writing' | 'done'
}

const CONFIDENCE_META: Record<BeatportConfidence, { labelKey: string; color: string }> = {
  high: { labelKey: 'export.beatport.confidenceHigh', color: 'var(--semantic-ok)' },
  medium: { labelKey: 'export.beatport.confidenceMedium', color: 'var(--semantic-warning)' },
  low: { labelKey: 'export.beatport.confidenceLow', color: 'var(--semantic-danger)' }
}

function BpInput({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (v: string) => void
}): React.JSX.Element {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span className="ss-caption" style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ss-body-sm"
        style={{
          background: 'var(--glass-1-bg)',
          border: '1px solid var(--glass-border, rgba(255,255,255,0.12))',
          borderRadius: 6,
          padding: '4px 8px',
          color: 'var(--text-primary)',
          width: '100%'
        }}
      />
    </label>
  )
}

function ConfidenceChip({ confidence }: { confidence: BeatportConfidence }): React.JSX.Element {
  const { t } = useTranslation('modals')
  const meta = CONFIDENCE_META[confidence]
  return (
    <span
      className="ss-caption"
      style={{
        flexShrink: 0,
        color: meta.color,
        border: `1px solid ${meta.color}`,
        borderRadius: 999,
        padding: '1px 8px',
        fontSize: 10,
        whiteSpace: 'nowrap'
      }}
    >
      {t(meta.labelKey)}
    </span>
  )
}

const CDJ_MODELS: readonly CDJModel[] = [
  'CDJ-2000NXS2',
  'CDJ-3000',
  'XDJ-RX3',
  'XDJ-XZ',
  'CDJ-2000'
]

interface ExportModalProps {
  validateOnly?: boolean
}

export function ExportModal({ validateOnly = false }: ExportModalProps): React.JSX.Element {
  const { t } = useTranslation('modals')
  const { closeModal } = useUiStore()
  const currentSet = useSetStore((s) => s.currentSet)
  const connectedDevices = useUSBStore((s) => s.connectedDevices)
  const copyToUSB = useUSBStore((s) => s.copyToUSB)
  const { success: toastSuccess, error: toastError } = useToastStore()

  const abortRef = useRef<AbortController | null>(null)

  const [phase, setPhase] = useState<ExportPhase>(validateOnly ? 'idle' : 'chooseFormat')
  const [hardware, setHardware] = useState<CDJModel>('CDJ-2000NXS2')
  const [bpRows, setBpRows] = useState<BeatportRow[]>([])
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [exportedPath, setExportedPath] = useState<string | null>(null)
  const [exportedTrackCount, setExportedTrackCount] = useState<number | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [copyingToUSBId, setCopyingToUSBId] = useState<string | null>(null)
  const [validationStep, setValidationStep] = useState(0)
  // Which hardware ecosystem this export is headed to, and (for Engine) the USB target.
  const [target, setTarget] = useState<ExportTargetKind>('pioneer')
  const [selectedUsbId, setSelectedUsbId] = useState<string | null>(null)
  const [engineProgress, setEngineProgress] = useState<EngineProgress | null>(null)

  // Pre-populate hardware from saved settings
  useEffect(() => {
    if (typeof window.setrecord === 'undefined') return
    window.setrecord
      .getSettings()
      .then((s) => {
        if (s.targetHardware) setHardware(s.targetHardware)
        // Pre-select the ecosystem from the user's default export format.
        if (s.defaultExportFormat === 'engine') setTarget('engine')
      })
      .catch(() => {})
  }, [])

  async function handleValidate(): Promise<void> {
    if (!currentSet) return
    setPhase('validating')
    setValidationResult(null)
    setExportError(null)

    try {
      // Flush any pending auto-save so the set is guaranteed to be in SQLite
      await window.setrecord.saveSet(currentSet)
      const result = await window.setrecord.validateForExport(
        currentSet.id,
        hardware,
        target === 'engine' ? 'engine' : 'pioneer'
      )
      if (!result) {
        setExportError(t('export.error.validationNotFound'))
        setPhase(target === 'engine' ? 'engineUsbPicker' : 'idle')
        return
      }

      setValidationResult(result)

      // Patch in-memory store so TopBar updates immediately
      useSetStore.setState((s) => ({
        currentSet: s.currentSet
          ? { ...s.currentSet, safetyScore: result.score, targetHardware: hardware }
          : null
      }))

      if (!validateOnly && result.issues.length === 0) {
        // No issues — skip straight to export
        await runActiveExport()
      } else {
        setPhase('issues')
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t('export.error.validationFailed'))
      setPhase(target === 'engine' ? 'engineUsbPicker' : 'idle')
    }
  }

  /** Run whichever export the chosen ecosystem needs. */
  async function runActiveExport(): Promise<void> {
    if (target === 'engine') {
      await runEngineExport()
    } else {
      await runExport()
    }
  }

  async function runEngineExport(): Promise<void> {
    if (!currentSet || !selectedUsbId) return
    const device = connectedDevices.find((d) => d.id === selectedUsbId)
    if (!device) {
      setExportError(t('export.error.usbDisconnected'))
      setPhase('engineUsbPicker')
      return
    }

    setPhase('exporting')
    setEngineProgress({ processed: 0, total: currentSet.tracks.length, phase: 'copying' })
    const unsubscribe = window.setrecord.onEngineExportProgress((p) => setEngineProgress(p))
    try {
      const result = await window.setrecord.exportSetToEngineUsb(currentSet.id, device.mountPath)
      if (result?.success) {
        setExportedPath(result.filePath ?? device.mountPath)
        setExportedTrackCount(result.trackCount ?? null)
        setPhase('done')
      } else {
        setExportError(
          result?.error === 'pro_required'
            ? t('export.error.proRequired')
            : (result?.error ?? t('export.error.exportFailed'))
        )
        setPhase('issues')
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t('export.error.exportFailed'))
      setPhase('issues')
    } finally {
      unsubscribe()
    }
  }

  async function runExport(): Promise<void> {
    if (!currentSet) return

    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller

    setPhase('exporting')
    setProgress(0)

    try {
      const [result] = await Promise.all([
        window.setrecord.exportSet(currentSet.id, hardware) as Promise<{
          success: boolean
          filePath?: string
          trackCount?: number
          error?: string
        }>,
        new Promise<void>((r) => setTimeout(r, 1000))
      ])

      if (signal.aborted) return

      if (result?.success && result.filePath) {
        setExportedPath(result.filePath)
        setExportedTrackCount(result.trackCount ?? null)
        setPhase('done')
      } else if (result && !result.success) {
        setExportError(result.error ?? t('export.error.exportFailed'))
        setPhase('issues')
      }
    } catch (err) {
      if (signal.aborted) return
      setExportError(err instanceof Error ? err.message : t('export.error.exportFailed'))
      setPhase('issues')
    } finally {
      abortRef.current = null
    }
  }

  function handleSelectBeatport(): void {
    if (!currentSet) return
    setBpRows(buildBeatportRows(currentSet))
    setExportError(null)
    setPhase('beatportReview')
  }

  function updateBpRow(index: number, patch: Partial<BeatportRow>): void {
    setBpRows((rows) => rows.map((r, i) => (i === index ? rescoreRow({ ...r, ...patch }) : r)))
  }

  async function runBeatportExport(): Promise<void> {
    if (!currentSet || bpRows.length === 0) return
    setPhase('beatportExporting')
    setExportError(null)
    try {
      const [result] = await Promise.all([
        window.setrecord.exportBeatportCsv(currentSet.name, bpRows),
        new Promise<void>((r) => setTimeout(r, 800))
      ])
      if (result?.success && result.filePath) {
        setExportedPath(result.filePath)
        setExportedTrackCount(result.trackCount ?? bpRows.length)
        setPhase('beatportDone')
      } else {
        setExportError(
          result?.error === 'pro_required'
            ? t('export.error.proRequired')
            : (result?.error ?? t('export.error.exportFailed'))
        )
        setPhase('beatportReview')
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t('export.error.exportFailed'))
      setPhase('beatportReview')
    }
  }

  async function handleCopyToUSB(device: (typeof connectedDevices)[number]): Promise<void> {
    if (!exportedPath) return
    setCopyingToUSBId(device.id)
    const filename = exportedPath.split('/').pop() ?? 'export.xml'
    try {
      const result = await copyToUSB(exportedPath, device.mountPath, filename, device.id)
      if (result.success) {
        toastSuccess(t('export.toast.copied', { name: device.customName ?? device.label }))
      } else {
        toastError(result.error ?? t('export.toast.copyFailed'))
      }
    } catch {
      toastError(t('export.toast.copyError'))
    } finally {
      setCopyingToUSBId(null)
    }
  }

  // Abort any in-flight export on unmount to prevent setState-after-unmount warnings
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // Step-by-step progress text during validation
  const VALIDATION_STEPS = [
    t('export.validation.step1'),
    t('export.validation.step2'),
    t('export.validation.step3'),
    t('export.validation.step4'),
    t('export.validation.step5')
  ]
  // Drives the stepped "Checking…" labels. Resetting the step to 0 when leaving
  // the validating phase is an intentional UI reset, not a render cascade.
  useEffect(() => {
    if (phase !== 'validating') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValidationStep(0)
      return
    }
    const timers = VALIDATION_STEPS.map((_, i) => setTimeout(() => setValidationStep(i), i * 700))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Trigger progress bar animation after entering exporting phase
  useEffect(() => {
    if (phase !== 'exporting') return
    const id = setTimeout(() => setProgress(100), 50)
    return () => clearTimeout(id)
  }, [phase])

  const blockingIssues = validationResult?.issues.filter((i) => i.severity === 'blocking') ?? []
  const warningIssues = validationResult?.issues.filter((i) => i.severity === 'warning') ?? []
  const isBeatportPhase = phase.startsWith('beatport')
  const headerTitle = validateOnly
    ? t('export.headerValidate')
    : isBeatportPhase
      ? t('export.headerBeatport')
      : t('export.headerExport')
  const bpCounts = {
    high: bpRows.filter((r) => r.confidence === 'high').length,
    medium: bpRows.filter((r) => r.confidence === 'medium').length,
    low: bpRows.filter((r) => r.confidence === 'low').length
  }

  return (
    <Modal onClose={closeModal} ariaLabel={headerTitle} maxWidth={isBeatportPhase ? 580 : 480}>
      {/* Header */}
      <div className="modal-header">
        <span className="ss-h2">{headerTitle}</span>
        <IconButton icon={X} size="sm" aria-label={t('common.close')} onClick={closeModal} />
      </div>

      <div className="modal-body">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* ── Choose format ── */}
            {phase === 'chooseFormat' && (
              <>
                {!currentSet ? (
                  <p
                    className="ss-body"
                    style={{
                      color: 'var(--text-secondary)',
                      textAlign: 'center',
                      padding: '32px 0'
                    }}
                  >
                    {t('export.noSet')}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p className="ss-body-sm" style={{ color: 'var(--text-secondary)', margin: 0 }}>
                      {t('export.chooseIntro')}
                    </p>

                    <button
                      type="button"
                      className="glass-1 format-card"
                      onClick={() => {
                        setExportError(null)
                        setTarget('pioneer')
                        setPhase('idle')
                      }}
                      style={{
                        display: 'flex',
                        gap: 12,
                        textAlign: 'left',
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        alignItems: 'flex-start'
                      }}
                    >
                      <Download
                        size={20}
                        style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}
                        aria-hidden="true"
                      />
                      <div>
                        <span
                          className="ss-body-sm"
                          style={{
                            color: 'var(--text-primary)',
                            display: 'block',
                            fontWeight: 600
                          }}
                        >
                          {t('export.cardXmlTitle')}
                        </span>
                        <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                          <Trans
                            t={t}
                            i18nKey="export.cardXmlBody"
                            count={currentSet.tracks.length}
                            components={[<code key="0" />]}
                          />
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="glass-1 format-card"
                      onClick={() => {
                        setExportError(null)
                        setTarget('engine')
                        setSelectedUsbId(
                          connectedDevices.find((d) => d.isExportTarget)?.id ??
                            connectedDevices[0]?.id ??
                            null
                        )
                        setPhase('engineUsbPicker')
                      }}
                      style={{
                        display: 'flex',
                        gap: 12,
                        textAlign: 'left',
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        alignItems: 'flex-start'
                      }}
                    >
                      <HardDrive
                        size={20}
                        style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}
                        aria-hidden="true"
                      />
                      <div>
                        <span
                          className="ss-body-sm"
                          style={{
                            color: 'var(--text-primary)',
                            display: 'block',
                            fontWeight: 600
                          }}
                        >
                          {t('export.cardEngineTitle')}
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              color: 'var(--accent)',
                              border:
                                '1px solid color-mix(in srgb, var(--accent) 45%, transparent)',
                              borderRadius: 4,
                              padding: '1px 5px',
                              verticalAlign: 'middle'
                            }}
                          >
                            Beta
                          </span>
                        </span>
                        <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                          {t('export.cardEngineBody')}
                        </span>
                      </div>
                    </button>

                    {launchProfile.beatportExport && (
                      <button
                        type="button"
                        className="glass-1 format-card"
                        onClick={handleSelectBeatport}
                        style={{
                          display: 'flex',
                          gap: 12,
                          textAlign: 'left',
                          padding: '14px',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          alignItems: 'flex-start'
                        }}
                      >
                        <ListMusic
                          size={20}
                          style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}
                          aria-hidden="true"
                        />
                        <div>
                          <span
                            className="ss-body-sm"
                            style={{
                              color: 'var(--text-primary)',
                              display: 'block',
                              fontWeight: 600
                            }}
                          >
                            {t('export.cardBeatportTitle')}
                          </span>
                          <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                            <Trans
                              t={t}
                              i18nKey="export.cardBeatportBody"
                              values={{ app: APP_NAME }}
                              components={[<code key="0" />]}
                            />
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── Idle ── */}
            {phase === 'idle' && (
              <>
                {!currentSet ? (
                  <p
                    className="ss-body"
                    style={{
                      color: 'var(--text-secondary)',
                      textAlign: 'center',
                      padding: '32px 0'
                    }}
                  >
                    {t('export.noSet')}
                  </p>
                ) : (
                  <>
                    <div
                      className="glass-1"
                      style={{
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 14px',
                        marginBottom: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}
                    >
                      <p className="ss-body-sm" style={{ color: 'var(--text-primary)', margin: 0 }}>
                        {t('export.idleBody')}
                      </p>
                      <p className="ss-caption" style={{ color: 'var(--semantic-ok)', margin: 0 }}>
                        {t('export.idleNotModified')}
                      </p>
                    </div>
                    <div className="arch-field">
                      <label className="ss-label">{t('export.targetHardware')}</label>
                      <SegmentedControl
                        options={CDJ_MODELS}
                        value={hardware}
                        onChange={(v) => setHardware(v as CDJModel)}
                      />
                    </div>
                    <p
                      className="ss-caption"
                      style={{ color: 'var(--text-tertiary)', marginTop: 8 }}
                    >
                      {t('export.willCheck', {
                        app: APP_NAME,
                        count: currentSet.tracks.length
                      })}
                    </p>
                    {exportError && (
                      <p
                        className="ss-caption"
                        role="alert"
                        style={{ color: 'var(--semantic-danger)', marginTop: 12 }}
                      >
                        {exportError}
                      </p>
                    )}
                  </>
                )}
              </>
            )}

            {/* ── Engine DJ USB picker ── */}
            {phase === 'engineUsbPicker' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p className="ss-body-sm" style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  {t('export.usbPickerBody', {
                    app: APP_NAME,
                    count: currentSet?.tracks.length ?? 0
                  })}
                </p>
                {connectedDevices.length === 0 ? (
                  <div
                    className="glass-1"
                    style={{
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      textAlign: 'center',
                      color: 'var(--text-tertiary)'
                    }}
                  >
                    <HardDrive
                      size={22}
                      style={{ marginBottom: 8, opacity: 0.6 }}
                      aria-hidden="true"
                    />
                    <p className="ss-caption" style={{ margin: 0 }}>
                      {t('export.noUsb')}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {connectedDevices.map((device) => (
                      <button
                        key={device.id}
                        type="button"
                        className="usb-copy-btn glass-1"
                        onClick={() => setSelectedUsbId(device.id)}
                        aria-pressed={selectedUsbId === device.id}
                        style={{
                          outline:
                            selectedUsbId === device.id
                              ? '1.5px solid var(--accent)'
                              : '1.5px solid transparent'
                        }}
                      >
                        <HardDrive
                          size={14}
                          strokeWidth={1.7}
                          style={{
                            color:
                              selectedUsbId === device.id ? 'var(--accent)' : 'var(--text-tertiary)'
                          }}
                          aria-hidden="true"
                        />
                        <span className="ss-body-sm">{device.customName ?? device.label}</span>
                        {selectedUsbId === device.id && (
                          <CheckCircle
                            size={14}
                            style={{ color: 'var(--accent)', marginLeft: 'auto' }}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {exportError && (
                  <p
                    className="ss-caption"
                    role="alert"
                    style={{ color: 'var(--semantic-danger)' }}
                  >
                    {exportError}
                  </p>
                )}
              </div>
            )}

            {/* ── Validating ── */}
            {phase === 'validating' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '32px 0',
                  gap: 16
                }}
              >
                <Loader
                  size={28}
                  style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                  {VALIDATION_STEPS.map((step, i) => (
                    <div
                      key={step}
                      className="ss-caption"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        color:
                          i < validationStep
                            ? 'var(--semantic-ok)'
                            : i === validationStep
                              ? 'var(--text-primary)'
                              : 'var(--text-tertiary)',
                        transition: 'color 300ms'
                      }}
                    >
                      <span style={{ fontSize: 10, width: 10, textAlign: 'center' }}>
                        {i < validationStep ? '✓' : i === validationStep ? '›' : '·'}
                      </span>
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Issues ── */}
            {phase === 'issues' && validationResult && (
              <>
                <div
                  className="stat-row glass-1"
                  style={{ marginBottom: 16, padding: '10px 14px' }}
                >
                  <span className="ss-body-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('export.safetyScore')}
                  </span>
                  <span
                    className="ss-mono"
                    style={{
                      color:
                        validationResult.score >= 80
                          ? 'var(--semantic-ok)'
                          : validationResult.score >= 50
                            ? 'var(--semantic-warning)'
                            : 'var(--semantic-danger)'
                    }}
                  >
                    {validationResult.score}%
                  </span>
                </div>

                {blockingIssues.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p
                      className="ss-label"
                      style={{ color: 'var(--semantic-danger)', marginBottom: 8 }}
                    >
                      {t('export.blockingTitle')}
                    </p>
                    {blockingIssues.some((i) => i.type === 'missing_file') && (
                      <p
                        className="ss-caption"
                        style={{ color: 'var(--text-tertiary)', marginBottom: 10 }}
                      >
                        {t('export.missingFileHint')}
                      </p>
                    )}
                    {blockingIssues.map((issue, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          gap: 8,
                          marginBottom: 6,
                          alignItems: 'flex-start'
                        }}
                      >
                        <AlertTriangle
                          size={14}
                          style={{
                            color: 'var(--semantic-danger)',
                            flexShrink: 0,
                            marginTop: 2
                          }}
                        />
                        <div>
                          <span
                            className="ss-body-sm"
                            style={{ color: 'var(--text-primary)', display: 'block' }}
                          >
                            {issue.trackTitle}
                          </span>
                          <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                            {issue.message}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {warningIssues.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p
                      className="ss-label"
                      style={{ color: 'var(--semantic-warning)', marginBottom: 8 }}
                    >
                      {t('export.warningsTitle')}
                    </p>
                    {warningIssues.map((issue, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          gap: 8,
                          marginBottom: 6,
                          alignItems: 'flex-start'
                        }}
                      >
                        <AlertTriangle
                          size={14}
                          style={{
                            color: 'var(--semantic-warning)',
                            flexShrink: 0,
                            marginTop: 2
                          }}
                        />
                        <div>
                          <span
                            className="ss-body-sm"
                            style={{ color: 'var(--text-primary)', display: 'block' }}
                          >
                            {issue.trackTitle}
                          </span>
                          <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                            {issue.message}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cue point export summary */}
                {validationResult.cueSummary &&
                  validationResult.cueSummary.some((e) => e.hotCueCount + e.cuePointCount > 0) && (
                    <div style={{ marginBottom: 16 }}>
                      <p
                        className="ss-label"
                        style={{ color: 'var(--text-secondary)', marginBottom: 8 }}
                      >
                        {t('export.cuePointsIncluded')}
                      </p>
                      {validationResult.cueSummary
                        .filter((e) => e.hotCueCount + e.cuePointCount > 0)
                        .map((entry, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 4
                            }}
                          >
                            <span
                              className="ss-body-sm"
                              style={{
                                color: 'var(--text-primary)',
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginRight: 12
                              }}
                            >
                              {entry.trackTitle}
                            </span>
                            <span
                              className="ss-caption"
                              style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
                            >
                              {[
                                entry.hotCueCount > 0
                                  ? t('export.hotCueCount', { count: entry.hotCueCount })
                                  : '',
                                entry.cuePointCount > 0
                                  ? t('export.memoryCueCount', { count: entry.cuePointCount })
                                  : ''
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}

                {exportError && (
                  <p
                    className="ss-caption"
                    role="alert"
                    style={{ color: 'var(--semantic-danger)', marginBottom: 12 }}
                  >
                    {exportError}
                  </p>
                )}
              </>
            )}

            {/* ── Exporting ── */}
            {phase === 'exporting' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '32px 0',
                  gap: 16
                }}
              >
                <span className="ss-body" style={{ color: 'var(--text-secondary)' }}>
                  {target === 'engine'
                    ? engineProgress?.phase === 'writing'
                      ? t('export.writingEngineDb')
                      : t('export.copyingToUsb')
                    : t('export.writingXml')}
                </span>
                <div
                  style={{
                    width: '100%',
                    height: 4,
                    borderRadius: 2,
                    background: 'var(--glass-1-bg)',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 2,
                      background: 'var(--accent)',
                      width:
                        target === 'engine'
                          ? `${engineProgress && engineProgress.total > 0 ? Math.round((engineProgress.processed / engineProgress.total) * 100) : 0}%`
                          : `${progress}%`,
                      transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                </div>
                {target === 'engine' && engineProgress && (
                  <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                    {t('export.progressTracks', {
                      processed: engineProgress.processed,
                      count: engineProgress.total
                    })}
                  </span>
                )}
              </div>
            )}

            {/* ── Done ── */}
            {phase === 'done' && exportedPath && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '24px 0',
                  gap: 16
                }}
              >
                <CheckCircle size={32} style={{ color: 'var(--semantic-ok)' }} />
                <div style={{ textAlign: 'center' }}>
                  <span
                    className="ss-body"
                    style={{ color: 'var(--text-primary)', display: 'block' }}
                  >
                    {target === 'engine' ? t('export.doneEngine') : t('export.doneXml')}
                  </span>
                  {exportedTrackCount != null && (
                    <span
                      className="ss-caption"
                      style={{ color: 'var(--text-tertiary)', display: 'block', marginTop: 4 }}
                    >
                      {t('export.tracksIncluded', { count: exportedTrackCount })}
                    </span>
                  )}
                </div>
                <div className="stat-row glass-1" style={{ width: '100%', padding: '10px 14px' }}>
                  <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                    {t('export.savedTo')}
                  </span>
                  <span
                    className="ss-mono"
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: 11,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 280,
                      direction: 'rtl'
                    }}
                  >
                    {exportedPath}
                  </span>
                </div>
                <p
                  className="ss-caption"
                  style={{ color: 'var(--text-tertiary)', textAlign: 'center', margin: 0 }}
                >
                  {target === 'engine' ? t('export.doneHintEngine') : t('export.doneHintXml')}
                </p>

                {/* USB copy shortcuts — Pioneer only; the Engine export already wrote to the drive. */}
                {target !== 'engine' && connectedDevices.length > 0 && (
                  <div style={{ width: '100%' }}>
                    <p
                      className="ss-caption"
                      style={{
                        color: 'var(--text-tertiary)',
                        marginBottom: 8,
                        textAlign: 'left'
                      }}
                    >
                      {t('export.copyToUsbHeader')}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {connectedDevices.map((device) => (
                        <button
                          key={device.id}
                          type="button"
                          className="usb-copy-btn glass-1"
                          disabled={copyingToUSBId === device.id}
                          onClick={() => void handleCopyToUSB(device)}
                          aria-label={t('export.copyToAria', {
                            name: device.customName ?? device.label
                          })}
                        >
                          <HardDrive
                            size={13}
                            strokeWidth={1.7}
                            style={{
                              color: device.isExportTarget
                                ? 'var(--accent)'
                                : 'var(--text-tertiary)'
                            }}
                            aria-hidden="true"
                          />
                          <span className="ss-body-sm">{device.customName ?? device.label}</span>
                          <span
                            className="ss-caption"
                            style={{ color: 'var(--text-tertiary)', marginLeft: 'auto' }}
                          >
                            {copyingToUSBId === device.id ? (
                              t('export.copying')
                            ) : (
                              <>
                                <Copy
                                  size={11}
                                  strokeWidth={1.7}
                                  style={{
                                    display: 'inline',
                                    verticalAlign: 'middle',
                                    marginRight: 3
                                  }}
                                  aria-hidden="true"
                                />
                                {t('export.copy')}
                              </>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* ── Beatport review / manual fix ── */}
            {phase === 'beatportReview' && (
              <>
                <div
                  className="glass-1"
                  style={{
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    marginBottom: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                  }}
                >
                  <span className="ss-body-sm" style={{ color: 'var(--text-primary)' }}>
                    {t('export.beatport.counts', {
                      high: bpCounts.high,
                      medium: bpCounts.medium,
                      low: bpCounts.low
                    })}
                  </span>
                  <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                    {t('export.beatport.reviewHint')}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    maxHeight: 320,
                    overflowY: 'auto'
                  }}
                >
                  {bpRows.map((row, i) => (
                    <div
                      key={row.trackId}
                      className="glass-1"
                      style={{
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          className="ss-mono"
                          style={{ color: 'var(--text-tertiary)', fontSize: 11, width: 18 }}
                        >
                          {row.position}
                        </span>
                        <span
                          className="ss-body-sm"
                          style={{
                            flex: 1,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {row.artist ? `${row.artist} — ${row.title}` : row.title}
                          {row.mix ? ` (${row.mix})` : ''}
                        </span>
                        <ConfidenceChip confidence={row.confidence} />
                      </div>

                      {row.confidence === 'high' ? (
                        <span
                          className="ss-caption"
                          style={{ color: 'var(--text-tertiary)', paddingLeft: 26 }}
                        >
                          ISRC {row.isrc}
                        </span>
                      ) : (
                        <div
                          style={{
                            paddingLeft: 26,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6
                          }}
                        >
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: 6
                            }}
                          >
                            <BpInput
                              label={t('export.beatport.fieldTitle')}
                              value={row.title}
                              onChange={(v) => updateBpRow(i, { title: v })}
                            />
                            <BpInput
                              label={t('export.beatport.fieldArtist')}
                              value={row.artist}
                              onChange={(v) => updateBpRow(i, { artist: v })}
                            />
                            <BpInput
                              label={t('export.beatport.fieldMix')}
                              value={row.mix ?? ''}
                              onChange={(v) => updateBpRow(i, { mix: v })}
                            />
                            <BpInput
                              label={t('export.beatport.fieldIsrc')}
                              value={row.isrc ?? ''}
                              onChange={(v) => updateBpRow(i, { isrc: v })}
                            />
                          </div>
                          {row.reasons[0] && (
                            <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                              {row.reasons[0]}
                            </span>
                          )}
                          <a
                            href={row.searchUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ss-caption"
                            style={{
                              color: 'var(--accent)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              textDecoration: 'none'
                            }}
                          >
                            {t('export.beatport.lookUp')}
                            <ExternalLink size={11} aria-hidden="true" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {exportError && (
                  <p
                    className="ss-caption"
                    role="alert"
                    style={{ color: 'var(--semantic-danger)', marginTop: 12 }}
                  >
                    {exportError}
                  </p>
                )}
              </>
            )}

            {/* ── Beatport exporting ── */}
            {phase === 'beatportExporting' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '32px 0',
                  gap: 16
                }}
              >
                <Loader
                  size={28}
                  style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }}
                />
                <span className="ss-body" style={{ color: 'var(--text-secondary)' }}>
                  {t('export.beatport.writing')}
                </span>
              </div>
            )}

            {/* ── Beatport done ── */}
            {phase === 'beatportDone' && exportedPath && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '24px 0',
                  gap: 16
                }}
              >
                <CheckCircle size={32} style={{ color: 'var(--semantic-ok)' }} />
                <div style={{ textAlign: 'center' }}>
                  <span
                    className="ss-body"
                    style={{ color: 'var(--text-primary)', display: 'block' }}
                  >
                    {t('export.beatport.doneTitle')}
                  </span>
                  {exportedTrackCount != null && (
                    <span
                      className="ss-caption"
                      style={{ color: 'var(--text-tertiary)', display: 'block', marginTop: 4 }}
                    >
                      {t('export.tracksIncluded', { count: exportedTrackCount })}
                    </span>
                  )}
                </div>
                <div className="stat-row glass-1" style={{ width: '100%', padding: '10px 14px' }}>
                  <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                    {t('export.savedTo')}
                  </span>
                  <span
                    className="ss-mono"
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: 11,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 320,
                      direction: 'rtl'
                    }}
                  >
                    {exportedPath}
                  </span>
                </div>
                <p
                  className="ss-caption"
                  style={{ color: 'var(--text-tertiary)', textAlign: 'center', margin: 0 }}
                >
                  <FileSpreadsheet
                    size={12}
                    style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}
                    aria-hidden="true"
                  />
                  Import this CSV at beatport.com, or via Soundiiz / TuneMyMusic — they resolve each
                  row to Beatport&rsquo;s catalog. Your library was not changed.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="modal-footer">
        {phase === 'chooseFormat' && (
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
        )}
        {phase === 'idle' && (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                if (validateOnly) {
                  closeModal()
                } else {
                  setExportError(null)
                  setPhase('chooseFormat')
                }
              }}
            >
              {validateOnly ? 'Cancel' : 'Back'}
            </Button>
            <Button
              variant="primary"
              icon={Download}
              onClick={handleValidate}
              disabled={!currentSet}
            >
              {validateOnly ? 'Validate' : 'Validate & export'}
            </Button>
          </>
        )}
        {phase === 'engineUsbPicker' && (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setExportError(null)
                setPhase('chooseFormat')
              }}
            >
              Back
            </Button>
            <Button
              variant="primary"
              icon={Download}
              onClick={handleValidate}
              disabled={!currentSet || !selectedUsbId}
            >
              Validate &amp; export
            </Button>
          </>
        )}
        {phase === 'exporting' && (
          <Button
            variant="secondary"
            onClick={() => {
              abortRef.current?.abort()
              closeModal()
            }}
          >
            Cancel
          </Button>
        )}
        {phase === 'issues' && (
          <>
            {validateOnly ? (
              <Button variant="primary" onClick={closeModal}>
                Done
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPhase(target === 'engine' ? 'engineUsbPicker' : 'idle')
                    setExportError(null)
                  }}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  icon={Download}
                  onClick={runActiveExport}
                  disabled={blockingIssues.length > 0}
                >
                  {blockingIssues.length > 0
                    ? 'Fix issues to export'
                    : target === 'engine'
                      ? 'Export to USB'
                      : 'Export anyway'}
                </Button>
              </>
            )}
          </>
        )}
        {phase === 'done' && (
          <Button variant="primary" onClick={closeModal}>
            Done
          </Button>
        )}
        {phase === 'beatportReview' && (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setExportError(null)
                setPhase('chooseFormat')
              }}
            >
              Back
            </Button>
            <Button
              variant="primary"
              icon={Download}
              onClick={runBeatportExport}
              disabled={bpRows.length === 0}
            >
              Export CSV
            </Button>
          </>
        )}
        {phase === 'beatportExporting' && (
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
        )}
        {phase === 'beatportDone' && (
          <Button variant="primary" onClick={closeModal}>
            Done
          </Button>
        )}
      </div>
    </Modal>
  )
}
