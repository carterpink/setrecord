import { existsSync } from 'fs'
import type { Set as DJSet, CDJModel, ValidationResult, ValidationIssue } from '../../src/types'

const LEGACY_FORMATS = new Set(['mp3', 'aiff', 'wav'])
const CDJ3000_FORMATS = new Set(['mp3', 'aiff', 'wav', 'flac', 'm4a'])

export function validateForHardware(set: DJSet, hardware: CDJModel): ValidationResult {
  const issues: ValidationIssue[] = []
  const supported = hardware === 'CDJ-3000' ? CDJ3000_FORMATS : LEGACY_FORMATS

  for (const st of set.tracks) {
    const t = st.track

    // Phantom tracks (from Discover) get a warning, not blocking. They have no
    // real file — the rest of the per-format / per-bitrate checks are skipped
    // since there's nothing to check.
    if (t.phantom) {
      issues.push({
        trackId: t.id,
        trackTitle: t.title,
        type: 'missing_file',
        severity: 'warning',
        message: 'Not in your library yet — buy or download this track before exporting.',
      })
      continue
    }

    if (!existsSync(t.filePath)) {
      issues.push({
        trackId: t.id,
        trackTitle: t.title,
        type: 'missing_file',
        severity: 'blocking',
        message: `File not found on disk: ${t.filePath}`,
      })
    }

    if (t.format !== 'unknown' && !supported.has(t.format)) {
      issues.push({
        trackId: t.id,
        trackTitle: t.title,
        type: 'unsupported_format',
        severity: 'blocking',
        message: `${t.format.toUpperCase()} is not supported by ${hardware}. Use MP3, AIFF, or WAV.`,
      })
    }

    if (t.format === 'mp3' && t.bitrate != null && t.bitrate > 320) {
      issues.push({
        trackId: t.id,
        trackTitle: t.title,
        type: 'bitrate',
        severity: 'warning',
        message: `Bitrate ${t.bitrate}kbps exceeds the 320kbps recommended maximum.`,
      })
    }

    if (!t.bpm || t.bpm <= 0) {
      issues.push({
        trackId: t.id,
        trackTitle: t.title,
        type: 'no_bpm',
        severity: 'warning',
        message: 'No BPM data — beat-sync will not work on this track.',
      })
    }

    if (t.duration > 99 * 60) {
      issues.push({
        trackId: t.id,
        trackTitle: t.title,
        type: 'duration',
        severity: 'blocking',
        message: `Duration ${Math.floor(t.duration / 60)}m exceeds the 99-minute hardware limit.`,
      })
    }

    if (t.hotCues.length > 8) {
      issues.push({
        trackId: t.id,
        trackTitle: t.title,
        type: 'hot_cues',
        severity: 'warning',
        message: `${t.hotCues.length} hot cues — only 8 are supported on ${hardware}, extras will be dropped.`,
      })
    }
  }

  const blocking = issues.filter((i) => i.severity === 'blocking').length
  const warnings = issues.filter((i) => i.severity === 'warning').length
  const score = Math.max(0, 100 - blocking * 20 - warnings * 5)

  const cueSummary = set.tracks
    .filter((st) => !st.track.phantom)
    .map((st) => ({
      trackTitle: st.track.title,
      hotCueCount: st.track.hotCues.length,
      cuePointCount: st.track.cuePoints.length,
    }))

  return {
    score,
    issues,
    isExportReady: blocking === 0,
    cueSummary,
  }
}
