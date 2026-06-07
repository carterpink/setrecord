/** Category 10 · Import & Export (138–145).
 *
 * Per REFERENCE.md: KNOW prompts target r.kind === 'knowledge'; ACTION prompts
 * target r.kind === 'action' (or r.needsConfirmation === true) — destructive /
 * write / export intents must never silently auto-act. BOTH prompts mix a
 * knowledge explanation with an actionable export. The curated KB and the
 * action/export engine don't exist at baseline, so every case here fails until
 * later phases — that's expected; the check encodes the TARGET.
 */
import type { EvalCase } from '../types'

export const cat10: EvalCase[] = [
  {
    id: '138',
    category: 'Import & Export',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: 'how do I import my Rekordbox library?',
    passWhen:
      "Returns clear step-by-step instructions: export XML from Rekordbox, then import via SetSense's import flow. Does not fabricate UI paths that do not exist.",
    check: (r) =>
      (r.kind === 'knowledge' && /xml/i.test(r.narration) && /import/i.test(r.narration)) ||
      'should give knowledge steps mentioning Rekordbox XML export + import flow'
  },
  {
    id: '139',
    category: 'Import & Export',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: 'can I import from Serato?',
    passWhen:
      'Confirms Serato import is supported. Explains where Serato library files are located on disk. Gives import steps.',
    check: (r) =>
      (r.kind === 'knowledge' &&
        /serato/i.test(r.narration) &&
        /(support|yes|can)/i.test(r.narration) &&
        /(_Serato_|library|folder|disk|location|where)/i.test(r.narration)) ||
      'should confirm Serato import is supported and where the files live'
  },
  {
    id: '140',
    category: 'Import & Export',
    complexity: 'Intermediate',
    type: 'ACTION',
    prompt: 'export this set to Rekordbox',
    passWhen:
      'Triggers or explains the export flow for Rekordbox compatibility. Confirms completion or shows progress. Does not silently fail.',
    check: (r) =>
      ((r.kind === 'action' || r.needsConfirmation === true) &&
        /rekordbox/i.test(r.narration) &&
        /export/i.test(r.narration)) ||
      'should be an action that triggers/explains a Rekordbox export'
  },
  {
    id: '141',
    category: 'Import & Export',
    complexity: 'Advanced',
    type: 'ACTION',
    prompt: 'export my top 50 most played tracks as a CSV',
    passWhen:
      'Generates a CSV with track name, artist, BPM, key, play_count, and last_played. Sorted by play_count descending. Top 50 only. File saved or download triggered.',
    check: (r) =>
      ((r.kind === 'action' || r.needsConfirmation === true) &&
        /csv/i.test(r.narration) &&
        /(most.?played|play.?count|top\s*50)/i.test(r.narration)) ||
      'should be a CSV export action referencing the most-played tracks'
  },
  {
    id: '142',
    category: 'Import & Export',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: 'can I get my playlists onto a USB for Pioneer CDJs?',
    passWhen:
      'Explains the Engine DJ export flow. Mentions USB formatting requirements (FAT32 or exFAT). Gives steps. Notes if this is a Pro-gated feature.',
    check: (r) =>
      (r.kind === 'knowledge' &&
        /engine\s*dj/i.test(r.narration) &&
        /usb/i.test(r.narration) &&
        /(fat32|exfat)/i.test(r.narration)) ||
      'should explain Engine DJ USB export + FAT32/exFAT formatting'
  },
  {
    id: '143',
    category: 'Import & Export',
    complexity: 'Intermediate',
    type: 'KNOW',
    prompt: 'why are my Rekordbox hot cues not importing?',
    passWhen:
      'Explains known compatibility limits (e.g., Rekordbox 7 cipher differences, schema changes). Suggests a workaround or honestly acknowledges the limitation without deflecting.',
    check: (r) =>
      (r.kind === 'knowledge' &&
        /rekordbox/i.test(r.narration) &&
        /(cipher|schema|version\s*7|rekordbox\s*7|encrypt)/i.test(r.narration)) ||
      'should explain Rekordbox 7 cipher/schema limits behind hot-cue import'
  },
  {
    id: '144',
    category: 'Import & Export',
    complexity: 'Intermediate',
    type: 'ACTION',
    prompt: 'import the folder /Music/New Drops',
    passWhen:
      'Initiates folder import for the specified path. Reports tracks found. Asks how to handle duplicates. Confirms import count on completion.',
    check: (r) =>
      ((r.kind === 'action' || r.needsConfirmation === true) &&
        /import/i.test(r.narration) &&
        /(\/Music\/New Drops|New Drops|folder)/i.test(r.narration)) ||
      'should initiate a folder import for /Music/New Drops'
  },
  {
    id: '145',
    category: 'Import & Export',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: 'export my entire library as a backup',
    passWhen:
      'Triggers or explains the backup flow. States what is included (tracks, metadata, playlists, history). Mentions encrypted backup option. Confirms destination.',
    check: (r) =>
      ((r.kind === 'knowledge' || r.kind === 'action' || r.needsConfirmation === true) &&
        /backup/i.test(r.narration) &&
        /(encrypt|password|secure)/i.test(r.narration)) ||
      'should describe the backup flow including the encrypted option'
  }
]
