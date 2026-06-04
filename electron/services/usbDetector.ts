import { execFile } from 'child_process'
import { promisify } from 'util'
import { readdirSync, watch } from 'fs'
import { writeFile, readFile, unlink } from 'fs/promises'
import { join } from 'path'

import { lazyLogger } from './logging/lazyLogger'
import { redactPath } from './logging/redact'

const execFileAsync = promisify(execFile)

const log = lazyLogger('usb')

// ─── Types ────────────────────────────────────────────────────────────────────

export interface USBDevice {
  id: string // stable hash of mountPath
  mountPath: string // /Volumes/PIONEER
  label: string // volume label from OS
  totalBytes: number
  freeBytes: number
  usedBytes: number
  percentUsed: number
  filesystem: string // exFAT, FAT32, NTFS, APFS, etc.
  protocol: string // USB, USB 3.0, USB-C, etc.
  readSpeedMBps?: number
  writeSpeedMBps?: number
  speedTestedAt?: string
  speedConfidence: 'high' | 'medium' | 'low' | 'untested'
}

export type FilesystemCompatibility = 'optimal' | 'compatible' | 'limited' | 'warning'

export interface FilesystemAnalysis {
  compatibility: FilesystemCompatibility
  label: string
  details: string[]
  recommendation: string
}

export type SpeedStatus = 'optimal' | 'acceptable' | 'slow'

// ─── ID Utilities ─────────────────────────────────────────────────────────────

// Derive a stable session ID from mount path
function stableId(mountPath: string): string {
  let hash = 0
  for (let i = 0; i < mountPath.length; i++) {
    const char = mountPath.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return `usb_${Math.abs(hash).toString(36)}`
}

// ─── diskutil helpers (macOS) ─────────────────────────────────────────────────

function extractField(text: string, fieldName: string): string | null {
  const regex = new RegExp(`${fieldName}:\\s*(.+)`, 'i')
  const match = text.match(regex)
  return match ? match[1].trim() : null
}

interface DiskInfo {
  totalBytes: number
  freeBytes: number
  filesystem: string
  isRemovable: boolean
  protocol: string
}

async function getDiskInfo(mountPath: string): Promise<DiskInfo | null> {
  try {
    // df gives us byte counts fast
    const { stdout: dfOut } = await execFileAsync('df', ['-Pk', mountPath])
    const lines = dfOut.trim().split('\n')
    if (lines.length < 2) return null
    const parts = lines[1].split(/\s+/)
    const totalBytes = parseInt(parts[1], 10) * 1024
    const freeBytes = parseInt(parts[3], 10) * 1024

    // diskutil info gives filesystem type, removable status, protocol
    const { stdout: diskutilOut } = await execFileAsync('diskutil', ['info', mountPath])

    const filesystem =
      extractField(diskutilOut, 'File System Personality') ||
      extractField(diskutilOut, 'Name \\(User Visible\\)') ||
      extractField(diskutilOut, 'Type \\(Bundle\\)') ||
      'unknown'

    const removableStr = extractField(diskutilOut, 'Removable Media')
    const isRemovable = (removableStr ?? '').toLowerCase().includes('removable')

    const protocol = extractField(diskutilOut, 'Protocol') ?? 'unknown'

    return { totalBytes, freeBytes, filesystem, isRemovable, protocol }
  } catch {
    return null
  }
}

// ─── List USB Devices ─────────────────────────────────────────────────────────

export async function listUSBDevices(): Promise<USBDevice[]> {
  if (process.platform !== 'darwin') return []

  let volumeNames: string[]
  try {
    volumeNames = readdirSync('/Volumes')
  } catch {
    return []
  }

  const devices: USBDevice[] = []

  for (const name of volumeNames) {
    const mountPath = join('/Volumes', name)
    try {
      const info = await getDiskInfo(mountPath)
      if (!info) continue
      // Only include removable USB drives (not internal HDDs, not the macOS boot volume)
      if (!info.isRemovable) continue
      if (!info.protocol.toLowerCase().startsWith('usb')) continue

      devices.push({
        id: stableId(mountPath),
        mountPath,
        label: name,
        totalBytes: info.totalBytes,
        freeBytes: info.freeBytes,
        usedBytes: info.totalBytes - info.freeBytes,
        percentUsed:
          info.totalBytes > 0
            ? Math.round(((info.totalBytes - info.freeBytes) / info.totalBytes) * 100)
            : 0,
        filesystem: normaliseFilesystem(info.filesystem),
        protocol: info.protocol,
        speedConfidence: 'untested'
      })
    } catch {
      // Skip volumes we can't introspect
    }
  }

  return devices
}

function normaliseFilesystem(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('exfat')) return 'exFAT'
  if (lower.includes('fat32') || lower.includes('ms-dos')) return 'FAT32'
  if (lower.includes('ntfs')) return 'NTFS'
  if (lower.includes('apfs')) return 'APFS'
  if (lower.includes('hfs')) return 'HFS+'
  if (lower.includes('ext4') || lower.includes('ext3') || lower.includes('ext2'))
    return raw.toUpperCase()
  return raw
}

// ─── Watch for Mount / Unmount ────────────────────────────────────────────────

export function watchUSBDevices(onChange: (devices: USBDevice[]) => void): () => void {
  if (process.platform !== 'darwin') return () => {}

  let debounce: ReturnType<typeof setTimeout> | null = null

  let watcher: ReturnType<typeof watch> | null = null
  try {
    watcher = watch('/Volumes', () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        listUSBDevices()
          .then(onChange)
          .catch((err) => log.error('watch callback error', err))
      }, 400)
    })
  } catch (err) {
    log.error('could not watch /Volumes', err)
  }

  return () => {
    watcher?.close()
    if (debounce) clearTimeout(debounce)
  }
}

// ─── Speed Test ───────────────────────────────────────────────────────────────

const SPEED_TEST_SIZE = 10 * 1024 * 1024 // 10 MB

export async function testUSBSpeed(
  mountPath: string
): Promise<{ readMBps: number; writeMBps: number } | null> {
  const testPath = join(mountPath, '.setsense_speedtest_tmp')
  // Pre-allocate buffer (zeros are fine; we're measuring IO not CPU)
  const data = Buffer.allocUnsafe(SPEED_TEST_SIZE)

  try {
    const writeStart = Date.now()
    await writeFile(testPath, data)
    const writeMs = Math.max(Date.now() - writeStart, 1)

    const readStart = Date.now()
    await readFile(testPath)
    const readMs = Math.max(Date.now() - readStart, 1)

    await unlink(testPath).catch(() => {})

    const sizeMB = SPEED_TEST_SIZE / (1024 * 1024)
    return {
      writeMBps: Math.round((sizeMB / (writeMs / 1000)) * 10) / 10,
      readMBps: Math.round((sizeMB / (readMs / 1000)) * 10) / 10
    }
  } catch (err) {
    log.error('speed test failed', err, { mountPath: redactPath(mountPath) })
    await unlink(testPath).catch(() => {})
    return null
  }
}

// ─── Speed / Filesystem Analysis ──────────────────────────────────────────────

export function classifySpeed(readMBps: number): SpeedStatus {
  if (readMBps >= 50) return 'optimal'
  if (readMBps >= 20) return 'acceptable'
  return 'slow'
}

export function speedConfidenceFromAge(testedAt: string | undefined): USBDevice['speedConfidence'] {
  if (!testedAt) return 'untested'
  const ageMs = Date.now() - new Date(testedAt).getTime()
  const ageH = ageMs / (1000 * 60 * 60)
  if (ageH < 24) return 'high'
  if (ageH < 24 * 7) return 'medium'
  return 'low'
}

export function analyseFilesystem(filesystem: string): FilesystemAnalysis {
  const fs = filesystem.toLowerCase()

  if (fs === 'exfat') {
    return {
      compatibility: 'optimal',
      label: 'exFAT — Optimal',
      details: ['Universal (Mac, Windows, Linux)', 'Supports files >4GB', 'Best for DJ export'],
      recommendation: 'Ideal'
    }
  }
  if (fs === 'fat32') {
    return {
      compatibility: 'limited',
      label: 'FAT32 — Limited',
      details: ['Max file size: 4 GB', 'Slower on large exports', 'Maximum device compat'],
      recommendation: 'Only for small sets'
    }
  }
  if (fs === 'ntfs') {
    return {
      compatibility: 'compatible',
      label: 'NTFS — Compatible',
      details: ['Windows native', 'Mac read-only without Bootcamp', 'Good for Windows exports'],
      recommendation: 'exFAT is more portable'
    }
  }
  if (fs === 'apfs' || fs === 'hfs+') {
    return {
      compatibility: 'warning',
      label: `${filesystem} — Not recommended`,
      details: ['Mac-only filesystem', 'Not compatible with CDJ players'],
      recommendation: 'Reformat to exFAT'
    }
  }
  return {
    compatibility: 'compatible',
    label: filesystem,
    details: ['Compatibility unknown'],
    recommendation: 'Verify with your CDJ'
  }
}

// ─── Copy to USB ──────────────────────────────────────────────────────────────

export async function copyFileToUSB(
  srcPath: string,
  mountPath: string,
  filename: string
): Promise<{ success: boolean; destPath?: string; error?: string }> {
  const { copyFile, mkdir } = await import('fs/promises')
  const destPath = join(mountPath, filename)
  try {
    await copyFile(srcPath, destPath)
    return { success: true, destPath }
  } catch (err) {
    // Some CDJ setups expect a PIONEER sub-folder; try that as a fallback
    try {
      const pioneerDir = join(mountPath, 'PIONEER')
      await mkdir(pioneerDir, { recursive: true })
      const destAlt = join(pioneerDir, filename)
      await copyFile(srcPath, destAlt)
      return { success: true, destPath: destAlt }
    } catch {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Copy failed'
      }
    }
  }
}
