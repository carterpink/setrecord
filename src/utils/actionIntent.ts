/**
 * actionIntent.ts — pure detector for export/import ACTIONS. These describe (and
 * in the app, trigger) a side-effecting flow; they always surface what will
 * happen rather than failing silently. Pure: returns the action description.
 */

export interface ActionResult {
  op: 'export_rekordbox' | 'export_csv' | 'export_engine' | 'import_folder' | 'backup'
  narration: string
  /** Folder path for import_folder. */
  path?: string
}

export function detectAction(raw: string): ActionResult | null {
  const q = raw.toLowerCase().trim()

  // import a folder
  const folder = raw.match(/import (?:the )?folder\s+(\S+)/i) || raw.match(/import\s+(\/[^\s?]+)/)
  if (folder)
    return {
      op: 'import_folder',
      path: folder[1],
      narration: `I'll import the folder ${folder[1]} — scanning for audio files, then I'll report how many were found and ask how to handle any duplicates before confirming the import.`
    }
  if (/\bimport (a |the )?folder\b|import.*new drops/.test(q))
    return {
      op: 'import_folder',
      narration: `I'll start a folder import, report the tracks found, and ask how to handle duplicates before confirming.`
    }

  // CSV export
  if (/\b(export|save|download).*(csv)|csv.*(export|of my)/.test(q))
    return {
      op: 'export_csv',
      narration:
        'I can export a CSV of your top 50 most-played tracks (title, artist, BPM, key, play count, last played), sorted by play count. Confirm and I’ll generate the file.'
    }

  // Rekordbox export
  if (/\bexport.*(to )?rekordbox|rekordbox export|send.*to rekordbox/.test(q))
    return {
      op: 'export_rekordbox',
      narration:
        'I’ll export this set to a Rekordbox-compatible collection so it shows up in Rekordbox. Confirm to run the export — I’ll show progress and confirm when it’s done.'
    }

  // Engine/USB export
  if (/\b(export|put|get).*(usb|cdj|engine dj|pioneer)/.test(q))
    return {
      op: 'export_engine',
      narration:
        'I’ll export a gig-ready Engine DJ USB (audio + database) for Pioneer CDJs. Format the USB as FAT32 or exFAT first. Confirm to run it. (Pro feature.)'
    }

  // Backup
  if (
    /\b(back ?up|export).*(library|collection|everything).*(backup)?|backup my (library|collection)/.test(
      q
    )
  )
    return {
      op: 'backup',
      narration:
        'I’ll export a full backup of your library — tracks, metadata, playlists and play history — encrypted by default. Choose a destination and confirm.'
    }

  return null
}
