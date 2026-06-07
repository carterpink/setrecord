import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  HardDrive,
  RefreshCw,
  Star,
  Check,
  MoreHorizontal,
  Zap,
  AlertTriangle,
  Trash2,
  Pencil,
  X,
  Usb
} from 'lucide-react'
import { motion, AnimatePresence } from '@/components/shared/Motion'
import { useUSBStore } from '@/stores/usbStore'
import { useToastStore } from '@/stores/toastStore'
import { analyseFilesystem, classifySpeed } from '@/utils/usbUtils'
import type { USBDevice, RememberedUSBDevice } from '@/types'

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

function formatRelativeDate(iso: string | undefined, t: TFunction<'shared'>): string {
  if (!iso) return t('usb.never')
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days === 0) return t('usb.today')
  if (days === 1) return t('usb.yesterday')
  if (days < 7) return t('usb.daysAgo', { count: days })
  if (days < 30) return t('usb.weeksAgo', { count: Math.floor(days / 7) })
  return t('usb.monthsAgo', { count: Math.floor(days / 30) })
}

function speedColor(mbps: number): string {
  const status = classifySpeed(mbps)
  if (status === 'optimal') return 'var(--semantic-success)'
  if (status === 'acceptable') return 'var(--semantic-warning)'
  return 'var(--semantic-danger)'
}

function filesystemColor(fs: string): string {
  const analysis = analyseFilesystem(fs)
  if (analysis.compatibility === 'optimal') return 'var(--semantic-success)'
  if (analysis.compatibility === 'compatible') return 'var(--text-secondary)'
  if (analysis.compatibility === 'limited') return 'var(--semantic-warning)'
  return 'var(--semantic-danger)'
}

// ─── Storage bar ─────────────────────────────────────────────────────────────

function StorageBar({ percentUsed }: { percentUsed: number }): React.JSX.Element {
  const color =
    percentUsed > 90
      ? 'var(--semantic-danger)'
      : percentUsed > 70
        ? 'var(--semantic-warning)'
        : 'var(--accent)'

  return (
    <div
      className="usb-storage-bar"
      role="progressbar"
      aria-valuenow={percentUsed}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="usb-storage-bar-fill"
        style={{ width: `${percentUsed}%`, background: color }}
      />
    </div>
  )
}

// ─── Rename input ─────────────────────────────────────────────────────────────

function RenameInput({
  device,
  onDone
}: {
  device: USBDevice
  onDone: () => void
}): React.JSX.Element {
  const { t } = useTranslation('shared')
  const [value, setValue] = useState(device.customName ?? device.label)
  const inputRef = useRef<HTMLInputElement>(null)
  const updatePrefs = useUSBStore((s) => s.updatePrefs)
  const { success } = useToastStore()

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  async function submit(): Promise<void> {
    const trimmed = value.trim()
    if (trimmed && trimmed !== (device.customName ?? device.label)) {
      await updatePrefs(device.id, { customName: trimmed })
      success(t('usb.renamedTo', { name: trimmed }))
    }
    onDone()
  }

  return (
    <div className="usb-rename-row">
      <input
        ref={inputRef}
        className="usb-rename-input"
        value={value}
        maxLength={48}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void submit()
          }
          if (e.key === 'Escape') onDone()
        }}
        aria-label={t('usb.renameAria')}
      />
      <button
        type="button"
        className="usb-rename-ok"
        onClick={() => void submit()}
        aria-label={t('usb.saveNameAria')}
      >
        <Check size={13} strokeWidth={2} />
      </button>
    </div>
  )
}

// ─── Device card — connected ──────────────────────────────────────────────────

function DeviceCard({ device }: { device: USBDevice }): React.JSX.Element {
  const { t } = useTranslation('shared')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { renamingDeviceId, setRenamingDeviceId, testingSpeedIds, updatePrefs, runSpeedTest } =
    useUSBStore()
  const { success, error } = useToastStore()

  const isRenaming = renamingDeviceId === device.id
  const isTesting = testingSpeedIds.has(device.id)
  const displayName = device.customName ?? device.label
  const fsAnalysis = analyseFilesystem(device.filesystem)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handler(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  async function toggleFavorite(): Promise<void> {
    await updatePrefs(device.id, { isFavorite: !device.isFavorite })
  }

  async function toggleExportTarget(): Promise<void> {
    await updatePrefs(device.id, { isExportTarget: !device.isExportTarget })
    success(
      device.isExportTarget
        ? t('usb.removedFromTargets', { name: displayName })
        : t('usb.setAsTarget', { name: displayName })
    )
  }

  async function handleSpeedTest(): Promise<void> {
    setMenuOpen(false)
    try {
      await runSpeedTest(device.id, device.mountPath)
    } catch {
      error(t('usb.speedTestFailed'))
    }
  }

  return (
    <div
      className={`usb-device-card glass-1 ${device.isExportTarget ? 'usb-device-card--target' : ''}`}
    >
      {/* Header row */}
      <div className="usb-card-header">
        <div className="usb-card-name-row">
          <Usb
            size={13}
            strokeWidth={1.7}
            style={{ color: 'var(--accent)', flexShrink: 0 }}
            aria-hidden="true"
          />
          {isRenaming ? (
            <RenameInput device={device} onDone={() => setRenamingDeviceId(null)} />
          ) : (
            <span className="usb-card-name ss-body-sm">{displayName}</span>
          )}
        </div>
        <div className="usb-card-actions">
          {/* Favorite star */}
          <motion.button
            type="button"
            className={`usb-action-btn ${device.isFavorite ? 'usb-action-btn--active' : ''}`}
            aria-label={device.isFavorite ? t('usb.removeFavorite') : t('usb.addFavorite')}
            aria-pressed={device.isFavorite}
            whileTap={{ scale: 0.72 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            onClick={() => void toggleFavorite()}
          >
            <motion.span
              style={{ display: 'inline-flex' }}
              animate={
                device.isFavorite
                  ? { scale: [1, 1.5, 0.85, 1.15, 1], rotate: [0, -22, 14, -8, 0] }
                  : { scale: 1, rotate: 0 }
              }
              transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
            >
              <Star
                size={13}
                strokeWidth={1.7}
                fill={device.isFavorite ? 'currentColor' : 'none'}
              />
            </motion.span>
          </motion.button>
          {/* Export target */}
          <motion.button
            type="button"
            className={`usb-action-btn ${device.isExportTarget ? 'usb-action-btn--target' : ''}`}
            aria-label={device.isExportTarget ? t('usb.removeTarget') : t('usb.markTarget')}
            aria-pressed={device.isExportTarget}
            title={device.isExportTarget ? t('usb.defaultTarget') : t('usb.setTarget')}
            whileTap={{ scale: 0.72 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            onClick={() => void toggleExportTarget()}
          >
            <motion.span
              style={{ display: 'inline-flex' }}
              animate={device.isExportTarget ? { scale: [1, 1.45, 0.88, 1.12, 1] } : { scale: 1 }}
              transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
            >
              <Check size={13} strokeWidth={2} />
            </motion.span>
          </motion.button>
          {/* More menu */}
          <div className="usb-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="usb-action-btn"
              aria-label={t('usb.moreOptions')}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MoreHorizontal size={13} strokeWidth={1.7} />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  className="usb-menu glass-3"
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  role="menu"
                >
                  <button
                    type="button"
                    className="usb-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      setRenamingDeviceId(device.id)
                    }}
                  >
                    <Pencil size={12} strokeWidth={1.7} />
                    {t('usb.rename')}
                  </button>
                  <button
                    type="button"
                    className="usb-menu-item"
                    role="menuitem"
                    disabled={isTesting}
                    onClick={() => void handleSpeedTest()}
                  >
                    <Zap size={12} strokeWidth={1.7} />
                    {isTesting ? t('usb.testingSpeed') : t('usb.testSpeed')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Storage bar */}
      <StorageBar percentUsed={device.percentUsed} />
      <div className="usb-storage-label ss-caption">
        <span>{t('usb.free', { size: formatBytes(device.freeBytes) })}</span>
        <span>
          {t('usb.totalUsed', {
            total: formatBytes(device.totalBytes),
            percent: device.percentUsed
          })}
        </span>
      </div>

      {/* Metadata grid */}
      <div className="usb-meta-grid">
        <div className="usb-meta-item">
          <span className="usb-meta-label ss-caption">{t('usb.filesystem')}</span>
          <span
            className="usb-meta-value ss-caption"
            style={{ color: filesystemColor(device.filesystem) }}
            title={fsAnalysis.details.join(' · ')}
          >
            {device.filesystem}
          </span>
        </div>
        <div className="usb-meta-item">
          <span className="usb-meta-label ss-caption">{t('usb.speed')}</span>
          {isTesting ? (
            <span className="usb-meta-value ss-caption" style={{ color: 'var(--text-tertiary)' }}>
              {t('usb.testing')}
            </span>
          ) : device.readSpeedMBps ? (
            <span
              className="usb-meta-value ss-caption"
              style={{ color: speedColor(device.readSpeedMBps) }}
            >
              {t('usb.speedValue', { speed: device.readSpeedMBps })}
            </span>
          ) : (
            <button
              type="button"
              className="usb-test-speed-btn ss-caption"
              onClick={() => void handleSpeedTest()}
            >
              {t('usb.testSpeed')}
            </button>
          )}
        </div>
        {device.lastExport && (
          <div className="usb-meta-item">
            <span className="usb-meta-label ss-caption">{t('usb.lastExport')}</span>
            <span className="usb-meta-value ss-caption">
              {formatRelativeDate(device.lastExport, t)}
            </span>
          </div>
        )}
        {device.exportCount > 0 && (
          <div className="usb-meta-item">
            <span className="usb-meta-label ss-caption">{t('usb.exports')}</span>
            <span className="usb-meta-value ss-caption">{device.exportCount}</span>
          </div>
        )}
      </div>

      {/* Filesystem warning */}
      {(fsAnalysis.compatibility === 'limited' || fsAnalysis.compatibility === 'warning') && (
        <div className="usb-fs-warning">
          <AlertTriangle size={11} strokeWidth={1.7} style={{ flexShrink: 0 }} aria-hidden="true" />
          <span className="ss-caption">{fsAnalysis.recommendation}</span>
        </div>
      )}
    </div>
  )
}

// ─── Remembered device row ────────────────────────────────────────────────────

function RememberedRow({ device }: { device: RememberedUSBDevice }): React.JSX.Element {
  const { t } = useTranslation('shared')
  const forgetDevice = useUSBStore((s) => s.forgetDevice)
  const { info } = useToastStore()
  const displayName = device.customName ?? device.label

  return (
    <div className="usb-remembered-row">
      <div className="usb-remembered-info">
        <HardDrive
          size={12}
          strokeWidth={1.5}
          style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
          aria-hidden="true"
        />
        <span className="ss-body-sm" style={{ color: 'var(--text-secondary)' }}>
          {displayName}
        </span>
        <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
          · {formatRelativeDate(device.lastSeen, t)}
          {device.exportCount > 0
            ? ` · ${t('usb.exportsCount', { count: device.exportCount })}`
            : ''}
        </span>
      </div>
      <button
        type="button"
        className="usb-action-btn"
        aria-label={t('usb.forget', { name: displayName })}
        title={t('usb.forgetTooltip')}
        onClick={() => {
          void forgetDevice(device.id)
          info(t('usb.forgotten', { name: displayName }))
        }}
      >
        <Trash2 size={12} strokeWidth={1.7} />
      </button>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function USBDetectionPanel(): React.JSX.Element {
  const { t } = useTranslation('shared')
  const { connectedDevices, rememberedDevices, panelOpen, setPanelOpen, refreshDevices } =
    useUSBStore()
  const panelRef = useRef<HTMLDivElement>(null)
  const [refreshing, setRefreshing] = useState(false)
  const { error } = useToastStore()

  // Load initial data
  useEffect(() => {
    if (typeof window.setsense === 'undefined') return
    void refreshDevices()
  }, [refreshDevices])

  // Subscribe to OS mount/unmount events from main process
  useEffect(() => {
    if (typeof window.setsense === 'undefined') return
    const unsub = window.setsense.onUsbDevicesChanged((devices) => {
      useUSBStore.setState({ connectedDevices: devices })
    })
    return unsub
  }, [])

  // Close panel on outside click
  useEffect(() => {
    if (!panelOpen) return
    function handler(e: MouseEvent): void {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [panelOpen, setPanelOpen])

  async function handleRefresh(): Promise<void> {
    setRefreshing(true)
    try {
      await refreshDevices()
    } catch {
      error(t('usb.couldNotScan'))
    } finally {
      setRefreshing(false)
    }
  }

  // Past devices = remembered but not in connectedDevices
  const connectedIds = new Set(connectedDevices.map((d) => d.id))
  const pastDevices = rememberedDevices.filter((d) => !connectedIds.has(d.id))

  // Sort favorites first
  const sortedConnected = [...connectedDevices].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
    if (a.isExportTarget !== b.isExportTarget) return a.isExportTarget ? -1 : 1
    return 0
  })

  const connectedCount = connectedDevices.length

  return (
    <div className="usb-panel-wrap" ref={panelRef}>
      {/* Trigger button */}
      <button
        type="button"
        className={`usb-panel-trigger ${panelOpen ? 'usb-panel-trigger--open' : ''} ${connectedCount > 0 ? 'usb-panel-trigger--has-devices' : ''}`}
        aria-label={t('usb.trigger', { count: connectedCount })}
        aria-expanded={panelOpen}
        aria-haspopup="true"
        onClick={() => setPanelOpen(!panelOpen)}
        title={t('usb.tooltip')}
      >
        <HardDrive size={15} strokeWidth={1.7} />
        {connectedCount > 0 && (
          <span
            className="usb-badge"
            aria-label={t('usb.connectedBadge', { count: connectedCount })}
          >
            {connectedCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            className="usb-dropdown glass-3"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0.12, 1] }}
            role="dialog"
            aria-label={t('usb.drivesTitle')}
          >
            {/* Header */}
            <div className="usb-dropdown-header">
              <span className="ss-h3">{t('usb.drivesTitle')}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  type="button"
                  className={`usb-refresh-btn ${refreshing ? 'usb-refresh-btn--spinning' : ''}`}
                  aria-label={t('usb.refreshAria')}
                  title={t('usb.refresh')}
                  onClick={() => void handleRefresh()}
                  disabled={refreshing}
                >
                  <RefreshCw size={14} strokeWidth={1.7} />
                </button>
                <button
                  type="button"
                  className="usb-action-btn"
                  aria-label={t('usb.closeAria')}
                  onClick={() => setPanelOpen(false)}
                >
                  <X size={14} strokeWidth={1.7} />
                </button>
              </div>
            </div>

            {/* Connected devices */}
            <div className="usb-dropdown-body">
              {sortedConnected.length === 0 ? (
                <div className="usb-empty">
                  <HardDrive
                    size={20}
                    strokeWidth={1.3}
                    style={{ color: 'var(--text-tertiary)' }}
                    aria-hidden="true"
                  />
                  <span className="ss-body-sm" style={{ color: 'var(--text-tertiary)' }}>
                    {t('usb.noneDetected')}
                  </span>
                  <span
                    className="ss-caption"
                    style={{ color: 'var(--text-disabled)', textAlign: 'center' }}
                  >
                    {t('usb.plugInHint')}
                  </span>
                </div>
              ) : (
                sortedConnected.map((device) => <DeviceCard key={device.id} device={device} />)
              )}

              {/* Past (remembered) devices */}
              {pastDevices.length > 0 && (
                <div className="usb-past-section">
                  <p className="ss-caption usb-past-header">{t('usb.pastDrives')}</p>
                  {pastDevices.map((d) => (
                    <RememberedRow key={d.id} device={d} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
