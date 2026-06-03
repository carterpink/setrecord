import { useEffect, useRef, useState } from 'react'
import { APP_NAME } from '@/utils/constants'
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

const CONFIDENCE_META: Record<BeatportConfidence, { label: string; color: string }> = {
  high: { label: 'Match ready', color: 'var(--semantic-ok)' },
  medium: { label: 'Likely', color: 'var(--semantic-warning)' },
  low: { label: 'Needs fix', color: 'var(--semantic-danger)' }
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
      {meta.label}
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
    if (typeof window.setsense === 'undefined') return
    window.setsense
      .getSettings()
      .then((s) => {
        if (s.targetHardware) setHardware(s.targetHardware)
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
      await window.setsense.saveSet(currentSet)
      const result = await window.setsense.validateForExport(
        currentSet.id,
        hardware,
        target === 'engine' ? 'engine' : 'pioneer'
      )
      if (!result) {
        setExportError('Validation failed — set not found.')
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
      setExportError(err instanceof Error ? err.message : 'Validation failed.')
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
      setExportError('That USB drive is no longer connected.')
      setPhase('engineUsbPicker')
      return
    }

    setPhase('exporting')
    setEngineProgress({ processed: 0, total: currentSet.tracks.length, phase: 'copying' })
    const unsubscribe = window.setsense.onEngineExportProgress((p) => setEngineProgress(p))
    try {
      const result = await window.setsense.exportSetToEngineUsb(currentSet.id, device.mountPath)
      if (result?.success) {
        setExportedPath(result.filePath ?? device.mountPath)
        setExportedTrackCount(result.trackCount ?? null)
        setPhase('done')
      } else {
        setExportError(
          result?.error === 'pro_required'
            ? 'Exporting is a SetSense Pro feature.'
            : (result?.error ?? 'Export failed.')
        )
        setPhase('issues')
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.')
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
        window.setsense.exportSet(currentSet.id, hardware) as Promise<{
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
        setExportError(result.error ?? 'Export failed.')
        setPhase('issues')
      }
    } catch (err) {
      if (signal.aborted) return
      setExportError(err instanceof Error ? err.message : 'Export failed.')
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
        window.setsense.exportBeatportCsv(currentSet.name, bpRows),
        new Promise<void>((r) => setTimeout(r, 800))
      ])
      if (result?.success && result.filePath) {
        setExportedPath(result.filePath)
        setExportedTrackCount(result.trackCount ?? bpRows.length)
        setPhase('beatportDone')
      } else {
        setExportError(
          result?.error === 'pro_required'
            ? 'Exporting is a SetSense Pro feature.'
            : (result?.error ?? 'Export failed.')
        )
        setPhase('beatportReview')
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.')
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
        toastSuccess(`Copied to ${device.customName ?? device.label}`)
      } else {
        toastError(result.error ?? 'Copy failed')
      }
    } catch {
      toastError('Could not copy to USB')
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
    'Checking file existence…',
    'Checking format compatibility…',
    'Checking BPM data…',
    'Checking key data…',
    'Finalising…'
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
    ? 'Validate set'
    : isBeatportPhase
      ? 'Export to Beatport'
      : 'Export set'
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
        <IconButton icon={X} size="sm" aria-label="Close" onClick={closeModal} />
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
                    No set loaded. Build or load a set first.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p className="ss-body-sm" style={{ color: 'var(--text-secondary)', margin: 0 }}>
                      Choose what to export. Either option writes a brand-new file you pick the
                      location for — your existing library is never modified.
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
                          Rekordbox XML
                        </span>
                        <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                          An <code>.xml</code> you import into Rekordbox or copy to a USB drive.
                          Carries cue points, hot cues, BPM and key for all{' '}
                          {currentSet.tracks.length} track
                          {currentSet.tracks.length !== 1 ? 's' : ''}.
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
                          Engine DJ USB (Denon)
                        </span>
                        <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                          Writes a gig-ready Engine Library straight to a USB drive — copies the
                          audio and builds the database so it plays plug-and-play on Denon gear.
                          Denon re-analyses beatgrids on load.
                        </span>
                      </div>
                    </button>

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
                          Beatport playlist (CSV)
                        </span>
                        <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                          A <code>.csv</code> ready for Beatport&rsquo;s playlist import (or
                          Soundiiz / TuneMyMusic). {APP_NAME} matches each track by ISRC, title and
                          artist, then flags anything that needs a quick manual fix.
                        </span>
                      </div>
                    </button>
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
                    No set loaded. Build or load a set first.
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
                        Creates a Rekordbox-compatible XML file you can import back into Rekordbox
                        or copy directly to a USB drive.
                      </p>
                      <p className="ss-caption" style={{ color: 'var(--semantic-ok)', margin: 0 }}>
                        Your existing Rekordbox library is not modified.
                      </p>
                    </div>
                    <div className="arch-field">
                      <label className="ss-label">Target hardware</label>
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
                      {APP_NAME} will check all {currentSet.tracks.length} track
                      {currentSet.tracks.length !== 1 ? 's' : ''} are compatible before exporting.
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
                  Choose the USB drive to write your Engine Library to. {APP_NAME} copies your{' '}
                  {currentSet?.tracks.length ?? 0} track
                  {currentSet?.tracks.length !== 1 ? 's' : ''} onto the drive — make sure it has
                  enough free space.
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
                      No USB drive detected. Plug one in and it&rsquo;ll appear here.
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
                    Safety score
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
                      Blocking issues — must fix to export
                    </p>
                    {blockingIssues.some((i) => i.type === 'missing_file') && (
                      <p
                        className="ss-caption"
                        style={{ color: 'var(--text-tertiary)', marginBottom: 10 }}
                      >
                        Every track must be linked to a real local file before export — a CDJ
                        can&rsquo;t play a track that isn&rsquo;t on the drive. Buy or download
                        phantom tracks and import them, or relink missing files from the Recall
                        tab&rsquo;s Library health section.
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
                      Warnings — will export with caveats
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
                        Cue points included in export
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
                                  ? `${entry.hotCueCount} hot cue${entry.hotCueCount !== 1 ? 's' : ''}`
                                  : '',
                                entry.cuePointCount > 0
                                  ? `${entry.cuePointCount} memory cue${entry.cuePointCount !== 1 ? 's' : ''}`
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
                      ? 'Writing Engine database…'
                      : 'Copying tracks to USB…'
                    : 'Writing Rekordbox XML…'}
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
                    {engineProgress.processed} of {engineProgress.total} track
                    {engineProgress.total !== 1 ? 's' : ''}
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
                    {target === 'engine'
                      ? 'Engine library written to USB'
                      : 'Set exported successfully'}
                  </span>
                  {exportedTrackCount != null && (
                    <span
                      className="ss-caption"
                      style={{ color: 'var(--text-tertiary)', display: 'block', marginTop: 4 }}
                    >
                      {exportedTrackCount} track{exportedTrackCount !== 1 ? 's' : ''} included
                    </span>
                  )}
                </div>
                <div className="stat-row glass-1" style={{ width: '100%', padding: '10px 14px' }}>
                  <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                    Saved to
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
                  {target === 'engine'
                    ? 'Eject the drive and plug it into your Denon gear, or import it into Engine DJ. Beatgrids are analysed on load. Your library is not modified.'
                    : 'Import this file into Rekordbox, or copy it to a USB drive using the buttons below. Your existing Rekordbox library is not modified.'}
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
                      Copy to USB drive
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {connectedDevices.map((device) => (
                        <button
                          key={device.id}
                          type="button"
                          className="usb-copy-btn glass-1"
                          disabled={copyingToUSBId === device.id}
                          onClick={() => void handleCopyToUSB(device)}
                          aria-label={`Copy to ${device.customName ?? device.label}`}
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
                              'Copying…'
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
                                Copy
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
                    {bpCounts.high} match-ready · {bpCounts.medium} likely · {bpCounts.low} need
                    fixing
                  </span>
                  <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                    Rows with an ISRC match exactly. For the rest, tidy the title/artist or add an
                    ISRC below — edits only change the CSV, never your library.
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
                              label="Title"
                              value={row.title}
                              onChange={(v) => updateBpRow(i, { title: v })}
                            />
                            <BpInput
                              label="Artist"
                              value={row.artist}
                              onChange={(v) => updateBpRow(i, { artist: v })}
                            />
                            <BpInput
                              label="Mix"
                              value={row.mix ?? ''}
                              onChange={(v) => updateBpRow(i, { mix: v })}
                            />
                            <BpInput
                              label="ISRC"
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
                            Look up on Beatport
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
                  Writing Beatport CSV…
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
                    Beatport playlist exported
                  </span>
                  {exportedTrackCount != null && (
                    <span
                      className="ss-caption"
                      style={{ color: 'var(--text-tertiary)', display: 'block', marginTop: 4 }}
                    >
                      {exportedTrackCount} track{exportedTrackCount !== 1 ? 's' : ''} included
                    </span>
                  )}
                </div>
                <div className="stat-row glass-1" style={{ width: '100%', padding: '10px 14px' }}>
                  <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                    Saved to
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
