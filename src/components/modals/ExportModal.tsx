import { useEffect, useRef, useState } from 'react'
import FocusLock from 'react-focus-lock'
import { AlertTriangle, CheckCircle, Copy, Download, HardDrive, Loader, X } from 'lucide-react'
import type { CDJModel, ValidationResult } from '@/types'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { motion, AnimatePresence, modalBackdrop, modalPanel } from '@/components/shared/Motion'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { useUSBStore } from '@/stores/usbStore'
import { useToastStore } from '@/stores/toastStore'

type ExportPhase = 'idle' | 'validating' | 'issues' | 'exporting' | 'done'

const CDJ_MODELS: readonly CDJModel[] = [
  'CDJ-2000NXS2',
  'CDJ-3000',
  'XDJ-RX3',
  'XDJ-XZ',
  'CDJ-2000',
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

  const [phase, setPhase] = useState<ExportPhase>('idle')
  const [hardware, setHardware] = useState<CDJModel>('CDJ-2000NXS2')
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [exportedPath, setExportedPath] = useState<string | null>(null)
  const [exportedTrackCount, setExportedTrackCount] = useState<number | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [copyingToUSBId, setCopyingToUSBId] = useState<string | null>(null)
  const [validationStep, setValidationStep] = useState(0)

  // Pre-populate hardware from saved settings
  useEffect(() => {
    if (typeof window.setsense === 'undefined') return
    window.setsense.getSettings().then((s) => {
      if (s.targetHardware) setHardware(s.targetHardware)
    }).catch(() => {})
  }, [])

  async function handleValidate() {
    if (!currentSet) return
    setPhase('validating')
    setValidationResult(null)
    setExportError(null)

    try {
      // Flush any pending auto-save so the set is guaranteed to be in SQLite
      await window.setsense.saveSet(currentSet)
      const result = await window.setsense.validateForExport(currentSet.id, hardware)
      if (!result) {
        setExportError('Validation failed — set not found.')
        setPhase('idle')
        return
      }

      setValidationResult(result)

      // Patch in-memory store so TopBar updates immediately
      useSetStore.setState((s) => ({
        currentSet: s.currentSet
          ? { ...s.currentSet, safetyScore: result.score, targetHardware: hardware }
          : null,
      }))

      if (!validateOnly && result.issues.length === 0) {
        // No issues — skip straight to export
        await runExport()
      } else {
        setPhase('issues')
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Validation failed.')
      setPhase('idle')
    }
  }

  async function runExport() {
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
        new Promise<void>((r) => setTimeout(r, 1000)),
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

  async function handleCopyToUSB(device: typeof connectedDevices[number]) {
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
    'Finalising…',
  ]
  useEffect(() => {
    if (phase !== 'validating') { setValidationStep(0); return }
    const timers = VALIDATION_STEPS.map((_, i) =>
      setTimeout(() => setValidationStep(i), i * 700)
    )
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

  return (
    <motion.div
      className="modal-overlay"
      variants={modalBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={closeModal}
    >
      <FocusLock returnFocus>
      <motion.div
        className="modal glass-3"
        variants={modalPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{ maxWidth: 480 }}
        role="dialog"
        aria-modal="true"
        aria-label={validateOnly ? 'Validate set' : 'Export set'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <span className="ss-h2">{validateOnly ? 'Validate set' : 'Export set'}</span>
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
          {/* ── Idle ── */}
          {phase === 'idle' && (
            <>
              {!currentSet ? (
                <p className="ss-body" style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px 0' }}>
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
                      gap: 4,
                    }}
                  >
                    <p className="ss-body-sm" style={{ color: 'var(--text-primary)', margin: 0 }}>
                      Creates a Rekordbox-compatible XML file you can import back into Rekordbox or copy directly to a USB drive.
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
                  <p className="ss-caption" style={{ color: 'var(--text-tertiary)', marginTop: 8 }}>
                    SetSense will check all {currentSet.tracks.length} track{currentSet.tracks.length !== 1 ? 's' : ''} are compatible before exporting.
                  </p>
                  {exportError && (
                    <p className="ss-caption" style={{ color: 'var(--semantic-danger)', marginTop: 12 }}>
                      {exportError}
                    </p>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Validating ── */}
          {phase === 'validating' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: 16 }}>
              <Loader size={28} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                {VALIDATION_STEPS.map((step, i) => (
                  <div
                    key={step}
                    className="ss-caption"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: i < validationStep
                        ? 'var(--semantic-ok)'
                        : i === validationStep
                          ? 'var(--text-primary)'
                          : 'var(--text-tertiary)',
                      transition: 'color 300ms',
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
                          : 'var(--semantic-danger)',
                  }}
                >
                  {validationResult.score}%
                </span>
              </div>

              {blockingIssues.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p className="ss-label" style={{ color: 'var(--semantic-danger)', marginBottom: 8 }}>
                    Blocking issues — must fix to export
                  </p>
                  {blockingIssues.map((issue, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                      <AlertTriangle size={14} style={{ color: 'var(--semantic-danger)', flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <span className="ss-body-sm" style={{ color: 'var(--text-primary)', display: 'block' }}>
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
                  <p className="ss-label" style={{ color: 'var(--semantic-warning)', marginBottom: 8 }}>
                    Warnings — will export with caveats
                  </p>
                  {warningIssues.map((issue, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                      <AlertTriangle size={14} style={{ color: 'var(--semantic-warning)', flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <span className="ss-body-sm" style={{ color: 'var(--text-primary)', display: 'block' }}>
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
              {validationResult.cueSummary && validationResult.cueSummary.some((e) => e.hotCueCount + e.cuePointCount > 0) && (
                <div style={{ marginBottom: 16 }}>
                  <p className="ss-label" style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
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
                          marginBottom: 4,
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
                            marginRight: 12,
                          }}
                        >
                          {entry.trackTitle}
                        </span>
                        <span className="ss-caption" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                          {[
                            entry.hotCueCount > 0 ? `${entry.hotCueCount} hot cue${entry.hotCueCount !== 1 ? 's' : ''}` : '',
                            entry.cuePointCount > 0 ? `${entry.cuePointCount} memory cue${entry.cuePointCount !== 1 ? 's' : ''}` : '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {exportError && (
                <p className="ss-caption" style={{ color: 'var(--semantic-danger)', marginBottom: 12 }}>
                  {exportError}
                </p>
              )}
            </>
          )}

          {/* ── Exporting ── */}
          {phase === 'exporting' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: 16 }}>
              <span className="ss-body" style={{ color: 'var(--text-secondary)' }}>
                Writing Rekordbox XML…
              </span>
              <div
                style={{
                  width: '100%',
                  height: 4,
                  borderRadius: 2,
                  background: 'var(--glass-1-bg)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    borderRadius: 2,
                    background: 'var(--accent)',
                    width: `${progress}%`,
                    transition: 'width 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {phase === 'done' && exportedPath && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 16 }}>
              <CheckCircle size={32} style={{ color: 'var(--semantic-ok)' }} />
              <div style={{ textAlign: 'center' }}>
                <span className="ss-body" style={{ color: 'var(--text-primary)', display: 'block' }}>
                  Set exported successfully
                </span>
                {exportedTrackCount != null && (
                  <span className="ss-caption" style={{ color: 'var(--text-tertiary)', display: 'block', marginTop: 4 }}>
                    {exportedTrackCount} track{exportedTrackCount !== 1 ? 's' : ''} included
                  </span>
                )}
              </div>
              <div
                className="stat-row glass-1"
                style={{ width: '100%', padding: '10px 14px' }}
              >
                <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>Saved to</span>
                <span
                  className="ss-mono"
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 11,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 280,
                    direction: 'rtl',
                  }}
                >
                  {exportedPath}
                </span>
              </div>
              <p className="ss-caption" style={{ color: 'var(--text-tertiary)', textAlign: 'center', margin: 0 }}>
                Import this file into Rekordbox, or copy it to a USB drive using the buttons below.
                Your existing Rekordbox library is not modified.
              </p>

              {/* USB copy shortcuts */}
              {connectedDevices.length > 0 && (
                <div style={{ width: '100%' }}>
                  <p className="ss-caption" style={{ color: 'var(--text-tertiary)', marginBottom: 8, textAlign: 'left' }}>
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
                        <HardDrive size={13} strokeWidth={1.7} style={{ color: device.isExportTarget ? 'var(--accent)' : 'var(--text-tertiary)' }} aria-hidden="true" />
                        <span className="ss-body-sm">{device.customName ?? device.label}</span>
                        <span className="ss-caption" style={{ color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                          {copyingToUSBId === device.id ? 'Copying…' : (
                            <>
                              <Copy size={11} strokeWidth={1.7} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} aria-hidden="true" />
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
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {phase === 'idle' && (
            <>
              <Button variant="secondary" onClick={closeModal}>Cancel</Button>
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
          {phase === 'exporting' && (
            <Button
              variant="secondary"
              onClick={() => { abortRef.current?.abort(); closeModal() }}
            >
              Cancel
            </Button>
          )}
          {phase === 'issues' && (
            <>
              {validateOnly ? (
                <Button variant="primary" onClick={closeModal}>Done</Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => { setPhase('idle'); setExportError(null) }}>
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    icon={Download}
                    onClick={runExport}
                    disabled={blockingIssues.length > 0}
                  >
                    {blockingIssues.length > 0 ? 'Fix issues to export' : 'Export anyway'}
                  </Button>
                </>
              )}
            </>
          )}
          {phase === 'done' && (
            <Button variant="primary" onClick={closeModal}>Done</Button>
          )}
        </div>
      </motion.div>
      </FocusLock>
    </motion.div>
  )
}
