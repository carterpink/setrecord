import type { USBFilesystemCompatibility, USBSpeedStatus } from '@/types'

export interface FilesystemAnalysis {
  compatibility: USBFilesystemCompatibility
  label: string
  details: string[]
  recommendation: string
}

export function analyseFilesystem(filesystem: string): FilesystemAnalysis {
  const fs = filesystem.toLowerCase()

  if (fs === 'exfat') {
    return {
      compatibility: 'optimal',
      label: 'exFAT — Optimal',
      details: ['Universal (Mac, Windows, Linux)', 'Supports files >4 GB', 'Best for DJ export'],
      recommendation: 'Ideal',
    }
  }
  if (fs === 'fat32') {
    return {
      compatibility: 'limited',
      label: 'FAT32 — Limited',
      details: ['Max file size: 4 GB', 'Slower on large exports', 'Maximum device compatibility'],
      recommendation: 'Only for small sets',
    }
  }
  if (fs === 'ntfs') {
    return {
      compatibility: 'compatible',
      label: 'NTFS — Compatible',
      details: ['Windows native', 'Mac read-only without Bootcamp', 'Good for Windows exports'],
      recommendation: 'exFAT is more portable',
    }
  }
  if (fs === 'apfs' || fs === 'hfs+') {
    return {
      compatibility: 'warning',
      label: `${filesystem} — Not recommended`,
      details: ['Mac-only filesystem', 'Not compatible with CDJ players'],
      recommendation: 'Reformat to exFAT',
    }
  }
  return {
    compatibility: 'compatible',
    label: filesystem,
    details: ['Compatibility unknown'],
    recommendation: 'Verify with your CDJ',
  }
}

export function classifySpeed(readMBps: number): USBSpeedStatus {
  if (readMBps >= 50) return 'optimal'
  if (readMBps >= 20) return 'acceptable'
  return 'slow'
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}
