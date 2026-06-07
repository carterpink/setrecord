/**
 * csvExport.ts — write a set of {@link BeatportRow}s to a Beatport-import-ready
 * CSV. Pure formatting + an atomic write; the rows arrive already resolved (and
 * possibly user-corrected) from the renderer, so this stays dumb and offline.
 *
 * Column order follows what Beatport's importer and the common third-party
 * importers (Soundiiz, TuneMyMusic) expect. Nothing here touches the library.
 */

import { existsSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import type { BeatportRow, ExportResult } from '../../../src/types'

const HEADER = [
  'Track Title',
  'Mix',
  'Artist',
  'Remixers',
  'Label',
  'Catalog Number',
  'ISRC',
  'BPM',
  'Key',
  'Genre',
  'Length',
  'Beatport Search'
] as const

/** RFC-4180 field escaping: quote anything containing a comma, quote or newline. */
function csvField(value: string | number | undefined | null): string {
  if (value == null) return ''
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Seconds → "m:ss" (Beatport "Length" column). */
function formatLength(seconds: number): string {
  const total = Math.max(0, Math.round(seconds || 0))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Pure: serialise rows to a full CSV document (CRLF line endings). */
export function buildCsv(rows: BeatportRow[]): string {
  const lines = [HEADER.join(',')]
  for (const r of rows) {
    lines.push(
      [
        csvField(r.title),
        csvField(r.mix),
        csvField(r.artist),
        csvField(r.remixers),
        csvField(r.label),
        csvField(r.catalog),
        csvField(r.isrc),
        csvField(r.bpm ? r.bpm.toFixed(2) : ''),
        csvField(r.key),
        csvField(r.genre),
        csvField(formatLength(r.duration)),
        csvField(r.searchUrl)
      ].join(',')
    )
  }
  return lines.join('\r\n') + '\r\n'
}

/** Write the CSV atomically (temp file → rename), mirroring exportService.ts. */
export async function exportBeatportCsv(
  rows: BeatportRow[],
  filePath: string
): Promise<ExportResult> {
  try {
    const csv = buildCsv(rows)
    const tmpPath = `${filePath}.setsense-tmp`
    try {
      writeFileSync(tmpPath, csv, 'utf-8')
      renameSync(tmpPath, filePath)
    } catch (writeErr) {
      try {
        if (existsSync(tmpPath)) unlinkSync(tmpPath)
      } catch {
        /* best-effort cleanup */
      }
      throw writeErr
    }
    return { success: true, filePath, trackCount: rows.length }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
