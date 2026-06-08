import { existsSync } from 'fs'
import type {
  Set as DJSet,
  CDJModel,
  Ecosystem,
  ExportTarget,
  ValidationResult,
  ValidationIssue
} from '../../src/types'

// Pioneer CDJ format support differs by era; Engine OS (Denon) plays everything
// SetRecord knows about, so its only hard block is an unidentifiable format.
const LEGACY_FORMATS = new Set(['mp3', 'aiff', 'wav'])
const CDJ3000_FORMATS = new Set(['mp3', 'aiff', 'wav', 'flac', 'm4a'])
const ENGINE_FORMATS = new Set(['mp3', 'aiff', 'wav', 'flac', 'm4a'])

function supportedFormats(target: ExportTarget): Set<string> {
  if (target.ecosystem === 'engine') return ENGINE_FORMATS
  return target.hardware === 'CDJ-3000' ? CDJ3000_FORMATS : LEGACY_FORMATS
}

/** Human label for the target, used in issue messages. */
function targetLabel(target: ExportTarget): string {
  return target.ecosystem === 'engine' ? 'Engine DJ' : (target.hardware ?? 'your CDJs')
}

/**
 * Validate a set for export to a given hardware ecosystem.
 *
 * The "no surprises at the gig" contract: a track the user doesn't actually have
 * a local file for — a phantom (Discover) track or a file that's gone missing —
 * is a BLOCKING error, never a warning, on every export path. You can't play a
 * track that isn't on the drive, so we refuse to export rather than hand the DJ
 * a set that silently drops tracks live.
 */
export function validateForTarget(set: DJSet, target: ExportTarget): ValidationResult {
  const issues: ValidationIssue[] = []
  const supported = supportedFormats(target)
  const label = targetLabel(target)

  for (const st of set.tracks) {
    const t = st.track

    // Non-owned track (phantom / Discover) — no local file exists. Blocking.
    if (t.phantom) {
      issues.push({
        trackId: t.id,
        trackTitle: t.title,
        type: 'missing_file',
        severity: 'blocking',
        message:
          'Not in your collection — this track has no local file. Buy or download it and import it into your library before exporting.'
      })
      continue
    }

    // Missing file on disk — blocking.
    if (t.missingFile || !existsSync(t.filePath)) {
      issues.push({
        trackId: t.id,
        trackTitle: t.title,
        type: 'missing_file',
        severity: 'blocking',
        message: `File not found on disk — relink it from the Recall tab (Library health) before exporting: ${t.filePath}`
      })
      continue
    }

    if (t.format === 'unknown') {
      issues.push({
        trackId: t.id,
        trackTitle: t.title,
        type: 'unsupported_format',
        severity: 'blocking',
        message: `Unrecognised audio format — ${label} may not play this file.`
      })
    } else if (!supported.has(t.format)) {
      issues.push({
        trackId: t.id,
        trackTitle: t.title,
        type: 'unsupported_format',
        severity: 'blocking',
        message: `${t.format.toUpperCase()} is not supported by ${label}. Use MP3, AIFF, or WAV.`
      })
    }

    if (t.format === 'mp3' && t.bitrate != null && t.bitrate > 320) {
      issues.push({
        trackId: t.id,
        trackTitle: t.title,
        type: 'bitrate',
        severity: 'warning',
        message: `Bitrate ${t.bitrate}kbps exceeds the 320kbps recommended maximum.`
      })
    }

    if (!t.bpm || t.bpm <= 0) {
      issues.push({
        trackId: t.id,
        trackTitle: t.title,
        type: 'no_bpm',
        severity: 'warning',
        message:
          target.ecosystem === 'engine'
            ? 'No BPM data — Engine will analyse it on load, but sync won’t work until then.'
            : 'No BPM data — beat-sync will not work on this track.'
      })
    }

    // Pioneer CDJs enforce a 99-minute track limit; Engine OS has no such cap.
    if (target.ecosystem === 'pioneer' && t.duration > 99 * 60) {
      issues.push({
        trackId: t.id,
        trackTitle: t.title,
        type: 'duration',
        severity: 'blocking',
        message: `Duration ${Math.floor(t.duration / 60)}m exceeds the 99-minute hardware limit.`
      })
    }

    if (t.hotCues.length > 8) {
      issues.push({
        trackId: t.id,
        trackTitle: t.title,
        type: 'hot_cues',
        severity: 'warning',
        message: `${t.hotCues.length} hot cues — only 8 are supported on ${label}, extras will be dropped.`
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
      cuePointCount: st.track.cuePoints.length
    }))

  return {
    score,
    issues,
    isExportReady: blocking === 0,
    cueSummary
  }
}

/** Backwards-compatible Pioneer/Rekordbox validation entry point. */
export function validateForHardware(set: DJSet, hardware: CDJModel): ValidationResult {
  return validateForTarget(set, { ecosystem: 'pioneer', hardware })
}

/** Convenience entry point for Engine/Denon export validation. */
export function validateForEcosystem(
  set: DJSet,
  ecosystem: Ecosystem,
  hardware?: CDJModel
): ValidationResult {
  return validateForTarget(set, { ecosystem, hardware })
}
