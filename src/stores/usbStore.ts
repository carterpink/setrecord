import { create } from 'zustand'
import type { USBDevice, RememberedUSBDevice } from '@/types'

interface USBStore {
  // Currently connected devices (live, merged with DB prefs)
  connectedDevices: USBDevice[]
  // Past devices from DB — not currently mounted
  rememberedDevices: RememberedUSBDevice[]
  // Panel open/closed state
  panelOpen: boolean
  // IDs currently running a speed test
  testingSpeedIds: Set<string>
  // Device whose rename input is shown
  renamingDeviceId: string | null

  // Setters
  setConnectedDevices: (devices: USBDevice[]) => void
  setRememberedDevices: (devices: RememberedUSBDevice[]) => void
  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
  setRenamingDeviceId: (id: string | null) => void

  // Actions — call IPC then patch local state
  refreshDevices: () => Promise<void>
  loadRemembered: () => Promise<void>
  runSpeedTest: (id: string, mountPath: string) => Promise<void>
  updatePrefs: (
    id: string,
    prefs: { customName?: string | null; isFavorite?: boolean; isExportTarget?: boolean }
  ) => Promise<void>
  forgetDevice: (id: string) => Promise<void>
  copyToUSB: (
    srcPath: string,
    mountPath: string,
    filename: string,
    deviceId: string
  ) => Promise<{ success: boolean; destPath?: string; error?: string }>
}

export const useUSBStore = create<USBStore>((set) => ({
  connectedDevices: [],
  rememberedDevices: [],
  panelOpen: false,
  testingSpeedIds: new Set(),
  renamingDeviceId: null,

  setConnectedDevices: (devices) => set({ connectedDevices: devices }),
  setRememberedDevices: (devices) => set({ rememberedDevices: devices }),
  setPanelOpen: (open) => set({ panelOpen: open }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setRenamingDeviceId: (id) => set({ renamingDeviceId: id }),

  refreshDevices: async () => {
    if (typeof window.setsense === 'undefined') return
    const [devices, remembered] = await Promise.all([
      window.setsense.usbList(),
      window.setsense.usbGetRemembered()
    ])
    set({ connectedDevices: devices, rememberedDevices: remembered })
  },

  loadRemembered: async () => {
    if (typeof window.setsense === 'undefined') return
    const remembered = await window.setsense.usbGetRemembered()
    set({ rememberedDevices: remembered })
  },

  runSpeedTest: async (id, mountPath) => {
    if (typeof window.setsense === 'undefined') return
    set((s) => ({ testingSpeedIds: new Set([...s.testingSpeedIds, id]) }))
    try {
      const result = await window.setsense.usbTestSpeed(mountPath)
      if (result) {
        await window.setsense.usbUpdatePrefs(id, {
          readSpeedMBps: result.readMBps,
          writeSpeedMBps: result.writeMBps,
          speedTestedAt: new Date().toISOString()
        })
        // Patch local connected device
        set((s) => ({
          connectedDevices: s.connectedDevices.map((d) =>
            d.id === id
              ? {
                  ...d,
                  readSpeedMBps: result.readMBps,
                  writeSpeedMBps: result.writeMBps,
                  speedTestedAt: new Date().toISOString(),
                  speedConfidence: 'high' as const
                }
              : d
          )
        }))
      }
    } finally {
      set((s) => {
        const next = new Set(s.testingSpeedIds)
        next.delete(id)
        return { testingSpeedIds: next }
      })
    }
  },

  updatePrefs: async (id, prefs) => {
    if (typeof window.setsense === 'undefined') return
    await window.setsense.usbUpdatePrefs(id, prefs)
    // Convert null customName to undefined for the USBDevice type
    const patch = {
      ...prefs,
      customName: prefs.customName === null ? undefined : prefs.customName
    }
    set((s) => ({
      connectedDevices: s.connectedDevices.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      rememberedDevices: s.rememberedDevices.map((d) => (d.id === id ? { ...d, ...patch } : d))
    }))
  },

  forgetDevice: async (id) => {
    if (typeof window.setsense === 'undefined') return
    await window.setsense.usbForget(id)
    set((s) => ({
      rememberedDevices: s.rememberedDevices.filter((d) => d.id !== id)
    }))
  },

  copyToUSB: async (srcPath, mountPath, filename, deviceId) => {
    if (typeof window.setsense === 'undefined') return { success: false, error: 'Not available' }
    const result = await window.setsense.usbCopyToUSB(srcPath, mountPath, filename)
    if (result.success) {
      // Increment export count in DB
      await window.setsense.usbRecordExport(deviceId)
      set((s) => ({
        connectedDevices: s.connectedDevices.map((d) =>
          d.id === deviceId
            ? {
                ...d,
                exportCount: d.exportCount + 1,
                lastExport: new Date().toISOString()
              }
            : d
        )
      }))
    }
    return result
  }
}))
