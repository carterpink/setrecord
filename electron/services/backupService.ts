/**
 * backupService.ts — Backendless backup & migration.
 *
 * Exports the DJ's entire SetRecord overlay (tags, lifecycle, ratings, cue edits,
 * sets, play sessions, smart crates) to a single portable `.setrecord` bundle, and
 * imports it on another machine by RE-LINKING to that machine's own library.
 *
 * Why re-link instead of copy: every `tracks` row stores an absolute `file_path`
 * that won't exist on the destination, and ids are per-machine UUIDs. So the
 * bundle carries stable identity keys (rekordbox_id+source, normalised
 * artist/title/duration, file basename) and the importer maps each bundle track
 * to a LOCAL track, then layers overlay data on top. The destination's own
 * file_paths are never touched — that invariant is the whole point.
 *
 * Architecture: the pure core (crypto envelope, manifest (de)serialisation,
 * re-link engine, conflict policy, `planImport`) has NO dependency on
 * better-sqlite3 or electron, so it is unit-testable in the plain-Node vitest
 * runner. Only the thin I/O shell (`exportBackup` / `inspectBackup` /
 * `importBackup`) touches the DB, via queries.ts accessors.
 */

import { writeFileSync, renameSync, readFileSync, existsSync, unlinkSync } from 'fs'
import { basename } from 'path'
import { hostname } from 'os'
import { randomUUID, randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import type Database from 'better-sqlite3'
import type { Track } from '../../src/types'
import { normalise } from '../algorithms/memory/libraryHealth'
import {
  getAllTracks,
  getAllSets,
  getSessions,
  getSessionTracks,
  getCrates,
  getDismissedDuplicateGroupKeys,
  getSchemaVersion,
  createCrate,
  dismissDuplicateGroup
} from '../db/queries'

// ───────── Versioning ─────────

/** Data-contract version of the bundle. Bump when the manifest shape changes. */
export const BUNDLE_VERSION = 1
const MAGIC = 'SETSENSE-BACKUP'
const ENVELOPE_FORMAT = 1

// ───────── Errors ─────────

export type BackupErrorCode =
  | 'not_a_backup'
  | 'unsupported_envelope'
  | 'passphrase_required'
  | 'bad_passphrase'
  | 'newer_app'
  | 'newer_schema'

export class BackupError extends Error {
  code: BackupErrorCode
  constructor(code: BackupErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'BackupError'
  }
}

// ───────── Manifest types ─────────

export interface ExportedTrack {
  /** Source id — a join token inside the bundle, NOT inserted into the dest DB. */
  id: string
  rekordboxId?: string
  source?: string
  title: string
  artist: string
  album?: string
  duration: number
  bpm: number
  /** Portable fallback match key. The full path is deliberately NOT exported. */
  fileBasename: string
  // ── overlay ──
  rating: number
  playCount: number
  lastPlayed?: string
  lifecycleState?: string
  lifecycleSource?: 'computed' | 'user'
  flaggedForGigAt?: string
  cuePoints: unknown[]
  hotCues: unknown[]
  loops: unknown[]
  beatgridOffset?: number
  tags: { category: string; value: string; source: string }[]
}

export interface ExportedSetTrack {
  trackId: string
  position: number
  energyOverride?: number
  notes?: string
  transitionScore?: unknown
  locked?: boolean
}

export interface ExportedSet {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  targetDuration?: number
  targetBpmMin?: number
  targetBpmMax?: number
  vibe?: string
  venue?: string
  slotTime?: string
  energyCurveType?: string
  targetHardware?: string
  safetyScore?: number
  architectSeed?: number
  algorithmVersion?: number
  tracks: ExportedSetTrack[]
}

export interface ExportedSessionTrack {
  trackId: string
  playOrder: number
  playedAt?: string
}

export interface ExportedSession {
  id: string
  name: string
  source: string
  performedAt?: string
  venue?: string
  venueSource?: string
  eventType?: string
  city?: string
  country?: string
  setSlot?: string
  duration?: number
  setId?: string
  createdAt: string
  tracks: ExportedSessionTrack[]
}

export interface ExportedCrate {
  id: string
  name: string
  rulesJson: string
  matchMode: string
  createdAt: string
}

/** Whitelisted, machine-agnostic preferences. Never carries paths or secrets. */
export type PortableSettings = Record<string, unknown>

export interface BackupCounts {
  tracks: number
  sets: number
  sessions: number
  tags: number
  crates: number
}

export interface BackupManifest {
  bundleVersion: number
  schemaVersion: number
  appVersion: string
  exportedAt: string
  sourceMachine: string
  counts: BackupCounts
  tracks: ExportedTrack[]
  sets: ExportedSet[]
  sessions: ExportedSession[]
  smartCrates: ExportedCrate[]
  dismissedDuplicateGroups: { normalisedKey: string }[]
  settings: PortableSettings
}

// ───────── Crypto envelope ─────────

interface EnvelopeHeader {
  kdf: 'scrypt' | 'none'
  cipher: 'aes-256-gcm' | 'none'
  compressed: boolean
  salt?: string
  iv?: string
  authTag?: string
  scrypt?: { N: number; r: number; p: number }
}

const SCRYPT = { N: 32768, r: 8, p: 1 } as const
// 128 * N * r ≈ 32 MiB for the params above; raise the ceiling so scrypt doesn't
// trip Node's default maxmem.
const SCRYPT_MAXMEM = 64 * 1024 * 1024

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT_MAXMEM
  })
}

/**
 * Serialise a manifest into the `.setrecord` envelope. With a passphrase, the
 * gzipped JSON is encrypted with AES-256-GCM (key via scrypt). Without one, the
 * body is plaintext gzip — the caller is responsible for warning the user.
 */
export function encodeBundle(manifest: BackupManifest, passphrase?: string): Buffer {
  const gz = gzipSync(Buffer.from(JSON.stringify(manifest), 'utf8'))

  let header: EnvelopeHeader
  let body: Buffer
  if (passphrase && passphrase.length > 0) {
    const salt = randomBytes(16)
    const iv = randomBytes(12)
    const key = deriveKey(passphrase, salt)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    body = Buffer.concat([cipher.update(gz), cipher.final()])
    header = {
      kdf: 'scrypt',
      cipher: 'aes-256-gcm',
      compressed: true,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      scrypt: { ...SCRYPT }
    }
  } else {
    header = { kdf: 'none', cipher: 'none', compressed: true }
    body = gz
  }

  const headerBuf = Buffer.from(JSON.stringify(header), 'utf8')
  const magic = Buffer.from(MAGIC, 'ascii')
  const fmt = Buffer.from([ENVELOPE_FORMAT])
  const len = Buffer.alloc(4)
  len.writeUInt32BE(headerBuf.length, 0)
  return Buffer.concat([magic, fmt, len, headerBuf, body])
}

function readEnvelope(buf: Buffer): { header: EnvelopeHeader; body: Buffer } {
  if (buf.length < MAGIC.length + 5 || buf.subarray(0, MAGIC.length).toString('ascii') !== MAGIC) {
    throw new BackupError('not_a_backup', 'This file is not a SetRecord backup.')
  }
  if (buf[MAGIC.length] !== ENVELOPE_FORMAT) {
    throw new BackupError(
      'unsupported_envelope',
      'This backup uses a newer file format. Please update SetRecord.'
    )
  }
  const lenOffset = MAGIC.length + 1
  const headerLen = buf.readUInt32BE(lenOffset)
  const headerStart = lenOffset + 4
  const header = JSON.parse(
    buf.subarray(headerStart, headerStart + headerLen).toString('utf8')
  ) as EnvelopeHeader
  return { header, body: buf.subarray(headerStart + headerLen) }
}

/** True when the bundle is encrypted (a passphrase is needed to read it). */
export function bundleNeedsPassphrase(buf: Buffer): boolean {
  return readEnvelope(buf).header.cipher !== 'none'
}

/** Decode (and decrypt, if needed) a bundle back into its manifest. */
export function decodeBundle(buf: Buffer, passphrase?: string): BackupManifest {
  const { header, body } = readEnvelope(buf)
  let gz: Buffer
  if (header.cipher === 'aes-256-gcm') {
    if (!passphrase) {
      throw new BackupError(
        'passphrase_required',
        'This backup is encrypted. Enter its passphrase.'
      )
    }
    const salt = Buffer.from(header.salt ?? '', 'base64')
    const iv = Buffer.from(header.iv ?? '', 'base64')
    const authTag = Buffer.from(header.authTag ?? '', 'base64')
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv)
    decipher.setAuthTag(authTag)
    try {
      gz = Buffer.concat([decipher.update(body), decipher.final()])
    } catch {
      throw new BackupError('bad_passphrase', 'Wrong passphrase, or the file is damaged.')
    }
  } else {
    gz = body
  }
  const json = header.compressed ? gunzipSync(gz) : gz
  return JSON.parse(json.toString('utf8')) as BackupManifest
}

// ───────── Re-link engine (pure) ─────────

const DURATION_TOLERANCE_S = 2.0

function nameDurKey(artist: string, title: string): string {
  return `${normalise(artist)}|${normalise(title)}`
}

export interface LocalIndex {
  /** `${source}::${rekordboxId}` → localId (first wins on dup). */
  byRbId: Map<string, string>
  byNameDur: Map<string, { id: string; duration: number }[]>
  byBasename: Map<string, string[]>
}

export function buildLocalIndex(localTracks: Track[]): LocalIndex {
  const byRbId = new Map<string, string>()
  const byNameDur = new Map<string, { id: string; duration: number }[]>()
  const byBasename = new Map<string, string[]>()

  for (const t of localTracks) {
    // Phantom (Discover) tracks have sentinel paths and no real file — never a match target.
    if (t.phantom) continue

    if (t.rekordboxId && t.source) {
      const k = `${t.source}::${t.rekordboxId}`
      if (!byRbId.has(k)) byRbId.set(k, t.id)
    }

    const nk = nameDurKey(t.artist, t.title)
    const arr = byNameDur.get(nk)
    if (arr) arr.push({ id: t.id, duration: t.duration })
    else byNameDur.set(nk, [{ id: t.id, duration: t.duration }])

    const base = basename(t.filePath || '').toLowerCase()
    if (base) {
      const b = byBasename.get(base)
      if (b) b.push(t.id)
      else byBasename.set(base, [t.id])
    }
  }

  return { byRbId, byNameDur, byBasename }
}

export type MatchOutcome = 'matched' | 'ambiguous' | 'unmatched'
export interface MatchResult {
  localId: string | null
  outcome: MatchOutcome
  tier: 1 | 2 | 3 | null
}

/** Resolve one exported track to a local track id by stable-identity precedence. */
export function resolveMatch(bt: ExportedTrack, idx: LocalIndex): MatchResult {
  // Tier 1 — rekordbox_id + source. Highest confidence.
  if (bt.rekordboxId && bt.source) {
    const id = idx.byRbId.get(`${bt.source}::${bt.rekordboxId}`)
    if (id) return { localId: id, outcome: 'matched', tier: 1 }
  }

  // Tier 2 — normalised artist+title, duration within tolerance.
  const cands = idx.byNameDur.get(nameDurKey(bt.artist, bt.title))
  if (cands && cands.length > 0) {
    let pool = cands
    if (bt.duration > 0) {
      const withDur = cands.filter((c) => c.duration > 0)
      if (withDur.length > 0) {
        pool = withDur.filter((c) => Math.abs(c.duration - bt.duration) <= DURATION_TOLERANCE_S)
      }
    }
    const ids = [...new Set(pool.map((c) => c.id))]
    if (ids.length === 1) return { localId: ids[0], outcome: 'matched', tier: 2 }
    if (ids.length > 1) return { localId: null, outcome: 'ambiguous', tier: 2 }
    // 0 survivors (all out of tolerance) → fall through to tier 3
  }

  // Tier 3 — file basename. Lowest confidence; collisions are ambiguous.
  const base = bt.fileBasename?.toLowerCase()
  if (base) {
    const ids = idx.byBasename.get(base)
    if (ids && ids.length === 1) return { localId: ids[0], outcome: 'matched', tier: 3 }
    if (ids && ids.length > 1) return { localId: null, outcome: 'ambiguous', tier: 3 }
  }

  return { localId: null, outcome: 'unmatched', tier: null }
}

// ───────── Conflict policy (pure) ─────────

export interface OverlayUpdate {
  rating: number
  playCount: number
  lastPlayed: string | null
  cuePoints: unknown[]
  hotCues: unknown[]
  loops: unknown[]
  beatgridOffset: number
  lifecycleState: string | null
  lifecycleSource: 'computed' | 'user'
  flaggedForGigAt: string | null
}

const isEmptyArr = (a: unknown[] | undefined): boolean => !a || a.length === 0
const laterIso = (a?: string | null, b?: string | null): string | null => {
  if (!a) return b ?? null
  if (!b) return a
  return a >= b ? a : b
}

/**
 * Merge one bundle track's overlay onto the local track. Policy: additive, never
 * clobber local hand-work; max-wins only for monotonic counters. Pure so the
 * exact rules are unit-tested without a DB.
 */
export function computeOverlay(local: Track, bt: ExportedTrack): OverlayUpdate {
  const localUserLifecycle = local.lifecycleSource === 'user'
  const bundleUserLifecycle = bt.lifecycleSource === 'user'
  const takeBundleLifecycle = bundleUserLifecycle && !localUserLifecycle

  return {
    // Bundle wins only if local is unrated.
    rating: local.rating && local.rating > 0 ? local.rating : (bt.rating ?? 0),
    // Monotonic — merging two play histories adds up to the larger count.
    playCount: Math.max(local.playCount ?? 0, bt.playCount ?? 0),
    lastPlayed: laterIso(local.lastPlayed, bt.lastPlayed),
    // Cues/loops are hand-crafted — bundle wins only when local is empty.
    cuePoints: isEmptyArr(local.cuePoints) ? (bt.cuePoints ?? []) : (local.cuePoints ?? []),
    hotCues: isEmptyArr(local.hotCues) ? (bt.hotCues ?? []) : (local.hotCues ?? []),
    loops: isEmptyArr(local.loops) ? (bt.loops ?? []) : (local.loops ?? []),
    beatgridOffset:
      local.beatgridOffset && local.beatgridOffset !== 0
        ? local.beatgridOffset
        : (bt.beatgridOffset ?? 0),
    lifecycleState: takeBundleLifecycle
      ? (bt.lifecycleState ?? null)
      : (local.lifecycleState ?? null),
    lifecycleSource: takeBundleLifecycle ? 'user' : (local.lifecycleSource ?? 'computed'),
    flaggedForGigAt: local.flaggedForGigAt ? local.flaggedForGigAt : (bt.flaggedForGigAt ?? null)
  }
}

export interface TagOps {
  /** Categories to wipe before insert (bundle user tags overriding local auto). */
  clearCategories: string[]
  inserts: { category: string; value: string; source: string }[]
}

const tagPair = (category: string, value: string): string => `${category}|${value}`

/**
 * Tag merge policy: union of tags; a bundle `user` category overrides local
 * `auto` for that category, but never overrides a local `user` category (don't
 * lose local hand-work).
 */
export function computeTagOps(
  localTags: { category: string; value: string; source: string }[],
  bundleTags: ExportedTrack['tags']
): TagOps {
  const localUserCats = new Set<string>(
    localTags.filter((t) => t.source === 'user').map((t) => t.category)
  )
  const localPairs = new Set(localTags.map((t) => tagPair(t.category, t.value)))
  const bundleUserCats = new Set<string>(
    bundleTags.filter((t) => t.source === 'user').map((t) => t.category)
  )

  const clearCategories: string[] = []
  const inserts: { category: string; value: string; source: string }[] = []

  // Bundle user categories override local auto (skip those locally user-owned).
  for (const cat of bundleUserCats) {
    if (localUserCats.has(cat)) continue
    clearCategories.push(cat)
    for (const t of bundleTags) {
      if (t.category === cat && t.source === 'user') {
        inserts.push({ category: cat, value: t.value, source: 'user' })
      }
    }
  }

  // Bundle auto tags: union, skipping handled / locally-owned categories & dups.
  for (const t of bundleTags) {
    if (t.source === 'user') continue
    if (bundleUserCats.has(t.category)) continue
    if (localUserCats.has(t.category)) continue
    if (localPairs.has(tagPair(t.category, t.value))) continue
    inserts.push({ category: t.category, value: t.value, source: t.source })
  }

  return { clearCategories, inserts }
}

// ───────── Import planning (pure) ─────────

export interface LocalContext {
  tracks: Track[]
  /** `${name}|${performedAt ?? ''}` for each existing session (dedupe key). */
  sessionKeys: Set<string>
  crateNames: Set<string>
  setNames: Set<string>
  dismissedKeys: Set<string>
}

export interface TrackOverlayOp {
  localId: string
  overlay: OverlayUpdate
  tags: TagOps
}
export interface SetInsertOp {
  id: string
  set: ExportedSet
  name: string
  trackIds: string[]
  childMeta: Omit<ExportedSetTrack, 'trackId' | 'position'>[]
}
export interface SessionInsertOp {
  id: string
  session: ExportedSession
  /** Remapped local set id, if the referenced set was imported. */
  setId: string | null
  trackIds: string[]
  playedAt: (string | null)[]
}
export interface CrateInsertOp {
  id: string
  crate: ExportedCrate
}

export interface ImportPlan {
  overlays: TrackOverlayOp[]
  sets: SetInsertOp[]
  sessions: SessionInsertOp[]
  crates: CrateInsertOp[]
  dismissedKeys: string[]
  settings: PortableSettings
}

export interface RelinkReport {
  mode: 'restore' | 'merge'
  libraryEmpty: boolean
  matched: number
  ambiguous: number
  unmatched: number
  tagsApplied: number
  setsImported: number
  setsSkipped: number
  setsPartial: { name: string; dropped: number }[]
  sessionsImported: number
  sessionsSkipped: number
  cratesImported: number
  unmatchedSamples: { artist: string; title: string }[]
}

const MAX_UNMATCHED_SAMPLES = 20

const sessionKeyOf = (name: string, performedAt?: string | null): string =>
  `${name}|${performedAt ?? ''}`

/**
 * Build the full import plan + report PURELY from the decoded manifest and a
 * snapshot of the local library. No DB access, no side effects — this is the
 * unit-tested heart of the importer. `applyPlan` just executes the result.
 */
export function planImport(
  manifest: BackupManifest,
  local: LocalContext,
  opts: { mode: 'restore' | 'merge' }
): { plan: ImportPlan; report: RelinkReport } {
  const idx = buildLocalIndex(local.tracks)
  const localById = new Map(local.tracks.map((t) => [t.id, t]))

  const remap = new Map<string, string>() // bundle trackId → local trackId
  const overlays: TrackOverlayOp[] = []
  const report: RelinkReport = {
    mode: opts.mode,
    libraryEmpty: local.tracks.length === 0,
    matched: 0,
    ambiguous: 0,
    unmatched: 0,
    tagsApplied: 0,
    setsImported: 0,
    setsSkipped: 0,
    setsPartial: [],
    sessionsImported: 0,
    sessionsSkipped: 0,
    cratesImported: 0,
    unmatchedSamples: []
  }

  for (const bt of manifest.tracks) {
    const m = resolveMatch(bt, idx)
    if (m.outcome === 'matched' && m.localId) {
      remap.set(bt.id, m.localId)
      report.matched++
      const localTrack = localById.get(m.localId)
      if (localTrack) {
        const overlay = computeOverlay(localTrack, bt)
        const tags = computeTagOps(localTrack.tags ?? [], bt.tags ?? [])
        report.tagsApplied += tags.inserts.length
        overlays.push({ localId: m.localId, overlay, tags })
      }
    } else if (m.outcome === 'ambiguous') {
      report.ambiguous++
    } else {
      report.unmatched++
      if (report.unmatchedSamples.length < MAX_UNMATCHED_SAMPLES) {
        report.unmatchedSamples.push({ artist: bt.artist, title: bt.title })
      }
    }
  }

  // Sets — drop unresolved children, renumber contiguously, skip if emptied.
  const setRemap = new Map<string, string>() // bundle setId → local setId
  const sets: SetInsertOp[] = []
  for (const s of manifest.sets) {
    const trackIds: string[] = []
    const childMeta: Omit<ExportedSetTrack, 'trackId' | 'position'>[] = []
    let dropped = 0
    for (const child of s.tracks) {
      const localId = remap.get(child.trackId)
      if (!localId) {
        dropped++
        continue
      }
      trackIds.push(localId)
      childMeta.push({
        energyOverride: child.energyOverride,
        notes: child.notes,
        transitionScore: child.transitionScore,
        locked: child.locked
      })
    }
    if (trackIds.length === 0) {
      report.setsSkipped++
      continue
    }
    if (dropped > 0) report.setsPartial.push({ name: s.name, dropped })
    const newId = randomUUID()
    setRemap.set(s.id, newId)
    const name = local.setNames.has(s.name) ? `${s.name} (imported)` : s.name
    sets.push({ id: newId, set: s, name, trackIds, childMeta })
    report.setsImported++
  }

  // Sessions — dedupe by (name, performedAt); drop unresolved children; skip empty.
  const sessions: SessionInsertOp[] = []
  for (const sess of manifest.sessions) {
    if (local.sessionKeys.has(sessionKeyOf(sess.name, sess.performedAt))) {
      report.sessionsSkipped++
      continue
    }
    const trackIds: string[] = []
    const playedAt: (string | null)[] = []
    for (const child of sess.tracks) {
      const localId = remap.get(child.trackId)
      if (!localId) continue
      trackIds.push(localId)
      playedAt.push(child.playedAt ?? sess.performedAt ?? null)
    }
    if (trackIds.length === 0) {
      report.sessionsSkipped++
      continue
    }
    sessions.push({
      id: randomUUID(),
      session: sess,
      setId: sess.setId ? (setRemap.get(sess.setId) ?? null) : null,
      trackIds,
      playedAt
    })
    report.sessionsImported++
  }

  // Crates — additive, skip on name collision (rules are track-agnostic).
  const crates: CrateInsertOp[] = []
  for (const c of manifest.smartCrates) {
    if (local.crateNames.has(c.name)) continue
    crates.push({ id: randomUUID(), crate: c })
    report.cratesImported++
  }

  const dismissedKeys = manifest.dismissedDuplicateGroups
    .map((d) => d.normalisedKey)
    .filter((k) => !local.dismissedKeys.has(k))

  return {
    plan: { overlays, sets, sessions, crates, dismissedKeys, settings: manifest.settings ?? {} },
    report
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// I/O SHELL (DB-touching — not exercised in the plain-Node test runner)
// ─────────────────────────────────────────────────────────────────────────────

// ───────── Export ─────────

function trackToExported(t: Track): ExportedTrack {
  return {
    id: t.id,
    rekordboxId: t.rekordboxId,
    source: t.source,
    title: t.title,
    artist: t.artist,
    album: t.album,
    duration: t.duration,
    bpm: t.bpm,
    fileBasename: basename(t.filePath || ''),
    rating: t.rating ?? 0,
    playCount: t.playCount ?? 0,
    lastPlayed: t.lastPlayed,
    lifecycleState: t.lifecycleState ?? undefined,
    lifecycleSource: t.lifecycleSource ?? undefined,
    flaggedForGigAt: t.flaggedForGigAt,
    cuePoints: t.cuePoints ?? [],
    hotCues: t.hotCues ?? [],
    loops: t.loops ?? [],
    beatgridOffset: t.beatgridOffset,
    tags: (t.tags ?? []).map((tag) => ({
      category: tag.category,
      value: tag.value,
      source: tag.source
    }))
  }
}

/** Read the whole overlay from the DB into a portable manifest. */
export function buildManifest(
  db: Database.Database,
  meta: { appVersion: string; settings: PortableSettings }
): BackupManifest {
  // Skip phantom (Discover) tracks — they have no real file to re-link.
  const tracks = getAllTracks(db).filter((t) => !t.phantom)
  const exportedTracks = tracks.map(trackToExported)

  const sets: ExportedSet[] = getAllSets(db).map((s) => ({
    id: s.id,
    name: s.name,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    targetDuration: s.targetDuration,
    targetBpmMin: s.targetBpmMin,
    targetBpmMax: s.targetBpmMax,
    vibe: s.vibe,
    venue: s.venue,
    slotTime: s.slotTime,
    energyCurveType: s.energyCurveType,
    targetHardware: s.targetHardware,
    safetyScore: s.safetyScore,
    architectSeed: s.architectSeed,
    algorithmVersion: s.algorithmVersion,
    tracks: s.tracks
      .filter((st) => !st.track.phantom)
      .map((st) => ({
        trackId: st.trackId,
        position: st.position,
        energyOverride: st.energyOverride,
        notes: st.notes,
        transitionScore: st.transitionScore,
        locked: st.locked
      }))
  }))

  const sessions: ExportedSession[] = getSessions(db).map((sess) => {
    const sessionTracks = getSessionTracks(db, sess.id)
    return {
      id: sess.id,
      name: sess.name,
      source: sess.source,
      performedAt: sess.performedAt,
      venue: sess.venue,
      venueSource: sess.venueSource,
      eventType: sess.eventType,
      city: sess.city,
      country: sess.country,
      setSlot: sess.setSlot,
      duration: sess.duration,
      setId: sess.setId,
      createdAt: sess.createdAt,
      tracks: sessionTracks
        .filter((st) => !st.track.phantom)
        .map((st) => ({ trackId: st.trackId, playOrder: st.playOrder, playedAt: st.playedAt }))
    }
  })

  const smartCrates: ExportedCrate[] = getCrates(db).map((c) => ({
    id: c.id,
    name: c.name,
    rulesJson: c.rulesJson,
    matchMode: c.matchMode,
    createdAt: c.createdAt
  }))

  const dismissedDuplicateGroups = [...getDismissedDuplicateGroupKeys(db)].map((k) => ({
    normalisedKey: k
  }))

  const tagCount = exportedTracks.reduce((n, t) => n + t.tags.length, 0)

  return {
    bundleVersion: BUNDLE_VERSION,
    schemaVersion: getSchemaVersion(db),
    appVersion: meta.appVersion,
    exportedAt: new Date().toISOString(),
    sourceMachine: hostname(),
    counts: {
      tracks: exportedTracks.length,
      sets: sets.length,
      sessions: sessions.length,
      tags: tagCount,
      crates: smartCrates.length
    },
    tracks: exportedTracks,
    sets,
    sessions,
    smartCrates,
    dismissedDuplicateGroups,
    settings: meta.settings ?? {}
  }
}

export interface ExportResult {
  success: boolean
  filePath?: string
  counts?: BackupCounts
  error?: string
  /** Set when the export was refused before writing (e.g. unencrypted, no opt-in). */
  code?: BackupErrorCode
}

/**
 * Security policy for the WRITE path: a `.setrecord` bundle carries the DJ's gig
 * history (venues, cities, dates), play counts, tags and whole library overlay —
 * exactly the kind of file that leaves the machine (USB stick, email, cloud
 * sync). So encryption is the DEFAULT: we refuse to write a plaintext bundle
 * unless the caller has made a deliberate, informed opt-out (`allowUnencrypted`).
 *
 * Kept pure (no DB, no I/O) so the policy itself is unit-tested. The passphrase
 * is the user's own key — it travels with them, so this never introduces a
 * machine-bound "lose the key, lose the data" failure mode the way DB-at-rest
 * encryption would.
 */
export function checkExportEncryption(
  passphrase: string | undefined,
  allowUnencrypted: boolean | undefined
): { ok: true } | { ok: false; code: BackupErrorCode; message: string } {
  if (passphrase && passphrase.length > 0) return { ok: true }
  if (allowUnencrypted) return { ok: true }
  return {
    ok: false,
    code: 'passphrase_required',
    message: 'Set a passphrase to encrypt this backup, or explicitly confirm an unencrypted export.'
  }
}

export function exportBackup(
  db: Database.Database,
  filePath: string,
  opts: {
    passphrase?: string
    /** Deliberate, user-confirmed opt-out of encryption. Without it, a backup
     *  with no passphrase is refused rather than silently written in plaintext. */
    allowUnencrypted?: boolean
    appVersion: string
    settings: PortableSettings
  }
): ExportResult {
  const policy = checkExportEncryption(opts.passphrase, opts.allowUnencrypted)
  if (!policy.ok) {
    return { success: false, error: policy.message, code: policy.code }
  }
  try {
    const manifest = buildManifest(db, { appVersion: opts.appVersion, settings: opts.settings })
    const buf = encodeBundle(manifest, opts.passphrase)
    const tmp = `${filePath}.tmp`
    try {
      writeFileSync(tmp, buf)
      renameSync(tmp, filePath)
    } catch (writeErr) {
      try {
        if (existsSync(tmp)) unlinkSync(tmp)
      } catch {
        /* best-effort cleanup */
      }
      throw writeErr
    }
    return { success: true, filePath, counts: manifest.counts }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ───────── Inspect ─────────

export interface InspectResult {
  ok: boolean
  needsPassphrase?: boolean
  schemaVersion?: number
  bundleVersion?: number
  counts?: BackupCounts
  sourceMachine?: string
  exportedAt?: string
  /** Suggested import mode for the destination. */
  suggestedMode?: 'restore' | 'merge'
  error?: string
}

/** Peek a bundle's header/counts and compatibility WITHOUT applying anything. */
export function inspectBackup(
  filePath: string,
  opts: { passphrase?: string; localSchemaVersion: number; localTrackCount: number }
): InspectResult {
  let buf: Buffer
  try {
    buf = readFileSync(filePath)
  } catch {
    return { ok: false, error: 'Could not read the file.' }
  }

  try {
    if (bundleNeedsPassphrase(buf) && !opts.passphrase) {
      return { ok: false, needsPassphrase: true }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not a SetRecord backup.' }
  }

  let manifest: BackupManifest
  try {
    manifest = decodeBundle(buf, opts.passphrase)
  } catch (err) {
    if (
      err instanceof BackupError &&
      (err.code === 'bad_passphrase' || err.code === 'passphrase_required')
    ) {
      return { ok: false, needsPassphrase: true, error: err.message }
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Could not read backup.' }
  }

  if (manifest.bundleVersion > BUNDLE_VERSION) {
    return {
      ok: false,
      error: 'This backup was made by a newer version of SetRecord. Please update.'
    }
  }
  if (manifest.schemaVersion > opts.localSchemaVersion) {
    return {
      ok: false,
      error: 'This backup was made by a newer version of SetRecord. Please update.'
    }
  }

  return {
    ok: true,
    needsPassphrase: false,
    schemaVersion: manifest.schemaVersion,
    bundleVersion: manifest.bundleVersion,
    counts: manifest.counts,
    sourceMachine: manifest.sourceMachine,
    exportedAt: manifest.exportedAt,
    suggestedMode: opts.localTrackCount === 0 ? 'restore' : 'merge'
  }
}

// ───────── Import ─────────

function buildLocalContext(db: Database.Database): LocalContext {
  const tracks = getAllTracks(db)
  const sessions = getSessions(db)
  const crates = getCrates(db)
  const sets = getAllSets(db)
  return {
    tracks,
    sessionKeys: new Set(sessions.map((s) => sessionKeyOf(s.name, s.performedAt))),
    crateNames: new Set(crates.map((c) => c.name)),
    setNames: new Set(sets.map((s) => s.name)),
    dismissedKeys: getDismissedDuplicateGroupKeys(db)
  }
}

/** Execute a planned import in a single transaction (all-or-nothing). */
export function applyPlan(db: Database.Database, plan: ImportPlan): void {
  const now = new Date().toISOString()

  const updOverlay = db.prepare(`
    UPDATE tracks SET
      rating = @rating,
      play_count = @playCount,
      last_played = @lastPlayed,
      cue_points = @cuePoints,
      hot_cues = @hotCues,
      loops = @loops,
      beatgrid_offset = @beatgridOffset,
      lifecycle_state = @lifecycleState,
      lifecycle_source = @lifecycleSource,
      flagged_for_gig_at = @flaggedForGigAt
    WHERE id = @id
  `)
  const delTagCat = db.prepare('DELETE FROM track_tags WHERE track_id = ? AND category = ?')
  const insTag = db.prepare(
    'INSERT OR REPLACE INTO track_tags (track_id, category, value, source, updated_at) VALUES (?, ?, ?, ?, ?)'
  )
  const insSet = db.prepare(`
    INSERT INTO sets (id, name, created_at, updated_at, target_duration, target_bpm_min,
      target_bpm_max, vibe, venue, slot_time, energy_curve_type, target_hardware, safety_score,
      architect_seed, algorithm_version)
    VALUES (@id, @name, @createdAt, @updatedAt, @targetDuration, @targetBpmMin,
      @targetBpmMax, @vibe, @venue, @slotTime, @energyCurveType, @targetHardware, @safetyScore,
      @architectSeed, @algorithmVersion)
  `)
  const insSetTrack = db.prepare(`
    INSERT INTO set_tracks (id, set_id, track_id, position, energy_override, notes, transition_score, locked)
    VALUES (@id, @setId, @trackId, @position, @energyOverride, @notes, @transitionScore, @locked)
  `)
  const insSession = db.prepare(`
    INSERT INTO play_sessions (id, name, source, performed_at, venue, duration, set_id, created_at,
      event_type, city, country, set_slot, venue_source)
    VALUES (@id, @name, @source, @performedAt, @venue, @duration, @setId, @createdAt,
      @eventType, @city, @country, @setSlot, @venueSource)
  `)
  const insSessionTrack = db.prepare(`
    INSERT INTO session_tracks (id, session_id, track_id, play_order, played_at)
    VALUES (@id, @sessionId, @trackId, @playOrder, @playedAt)
  `)

  const tx = db.transaction(() => {
    for (const op of plan.overlays) {
      updOverlay.run({
        id: op.localId,
        rating: op.overlay.rating,
        playCount: op.overlay.playCount,
        lastPlayed: op.overlay.lastPlayed,
        cuePoints: JSON.stringify(op.overlay.cuePoints),
        hotCues: JSON.stringify(op.overlay.hotCues),
        loops: JSON.stringify(op.overlay.loops),
        beatgridOffset: op.overlay.beatgridOffset,
        lifecycleState: op.overlay.lifecycleState,
        lifecycleSource: op.overlay.lifecycleSource,
        flaggedForGigAt: op.overlay.flaggedForGigAt
      })
      for (const cat of op.tags.clearCategories) delTagCat.run(op.localId, cat)
      for (const t of op.tags.inserts) insTag.run(op.localId, t.category, t.value, t.source, now)
    }

    for (const op of plan.sets) {
      insSet.run({
        id: op.id,
        name: op.name,
        createdAt: op.set.createdAt,
        updatedAt: op.set.updatedAt,
        targetDuration: op.set.targetDuration ?? null,
        targetBpmMin: op.set.targetBpmMin ?? null,
        targetBpmMax: op.set.targetBpmMax ?? null,
        vibe: op.set.vibe ?? null,
        venue: op.set.venue ?? null,
        slotTime: op.set.slotTime ?? null,
        energyCurveType: op.set.energyCurveType ?? null,
        targetHardware: op.set.targetHardware ?? 'CDJ-2000NXS2',
        safetyScore: op.set.safetyScore ?? null,
        architectSeed: op.set.architectSeed ?? null,
        algorithmVersion: op.set.algorithmVersion ?? null
      })
      op.trackIds.forEach((tid, i) => {
        const meta = op.childMeta[i]
        insSetTrack.run({
          id: randomUUID(),
          setId: op.id,
          trackId: tid,
          position: i,
          energyOverride: meta.energyOverride ?? null,
          notes: meta.notes ?? null,
          transitionScore: meta.transitionScore ? JSON.stringify(meta.transitionScore) : '{}',
          locked: meta.locked ? 1 : 0
        })
      })
    }

    for (const op of plan.sessions) {
      insSession.run({
        id: op.id,
        name: op.session.name,
        source: op.session.source,
        performedAt: op.session.performedAt ?? null,
        venue: op.session.venue ?? null,
        duration: op.session.duration ?? null,
        setId: op.setId,
        createdAt: op.session.createdAt ?? now,
        eventType: op.session.eventType ?? null,
        city: op.session.city ?? null,
        country: op.session.country ?? null,
        setSlot: op.session.setSlot ?? null,
        venueSource: op.session.venueSource ?? 'user'
      })
      op.trackIds.forEach((tid, i) => {
        insSessionTrack.run({
          id: randomUUID(),
          sessionId: op.id,
          trackId: tid,
          playOrder: i,
          playedAt: op.playedAt[i]
        })
      })
    }

    for (const op of plan.crates) {
      createCrate(db, {
        id: op.id,
        name: op.crate.name,
        rulesJson: op.crate.rulesJson,
        matchMode: (op.crate.matchMode as 'all' | 'any') ?? 'all',
        createdAt: op.crate.createdAt ?? now
      })
    }

    for (const key of plan.dismissedKeys) dismissDuplicateGroup(db, key)
  })
  tx()
}

export interface ImportResult {
  success: boolean
  report?: RelinkReport
  /** Whitelisted settings to fill-in at the settings layer (caller applies). */
  settings?: PortableSettings
  error?: string
}

export function importBackup(
  db: Database.Database,
  filePath: string,
  opts: { mode: 'restore' | 'merge'; passphrase?: string }
): ImportResult {
  let buf: Buffer
  try {
    buf = readFileSync(filePath)
  } catch {
    return { success: false, error: 'Could not read the file.' }
  }

  let manifest: BackupManifest
  try {
    manifest = decodeBundle(buf, opts.passphrase)
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not read backup.' }
  }

  // Schema guard — refuse a bundle from a newer app we can't fully understand.
  const localSchema = getSchemaVersion(db)
  if (manifest.bundleVersion > BUNDLE_VERSION || manifest.schemaVersion > localSchema) {
    return {
      success: false,
      error: 'This backup was made by a newer version of SetRecord. Please update.'
    }
  }

  try {
    const local = buildLocalContext(db)
    const { plan, report } = planImport(manifest, local, { mode: opts.mode })
    applyPlan(db, plan)
    return { success: true, report, settings: plan.settings }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
