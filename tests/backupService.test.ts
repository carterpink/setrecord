/**
 * backupService.test.ts — the pure core of backendless backup & migration.
 *
 * better-sqlite3 can't load in the plain-Node vitest runner (it's compiled for
 * Electron's ABI), so we exercise the DB-free heart of the feature: the crypto
 * envelope, the re-link engine, the conflict policy, `planImport`, and the
 * file-based `inspectBackup`. The thin `applyPlan` SQL shell is covered by the
 * manual end-to-end check in the plan.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { makeTrack } from './fixtures'
import type { Track } from '../src/types'
import {
  BUNDLE_VERSION,
  encodeBundle,
  decodeBundle,
  bundleNeedsPassphrase,
  checkExportEncryption,
  buildLocalIndex,
  resolveMatch,
  computeOverlay,
  computeTagOps,
  planImport,
  inspectBackup,
  type ExportedTrack,
  type BackupManifest,
  type LocalContext
} from '../electron/services/backupService'

// ───────── helpers ─────────

function exp(over: Partial<ExportedTrack> = {}): ExportedTrack {
  return {
    id: over.id ?? `b-${Math.random().toString(36).slice(2, 8)}`,
    rekordboxId: over.rekordboxId,
    source: over.source,
    title: over.title ?? 'Track',
    artist: over.artist ?? 'Artist',
    album: over.album,
    duration: over.duration ?? 300,
    bpm: over.bpm ?? 124,
    fileBasename: over.fileBasename ?? 'track.mp3',
    rating: over.rating ?? 0,
    playCount: over.playCount ?? 0,
    lastPlayed: over.lastPlayed,
    lifecycleState: over.lifecycleState,
    lifecycleSource: over.lifecycleSource,
    flaggedForGigAt: over.flaggedForGigAt,
    cuePoints: over.cuePoints ?? [],
    hotCues: over.hotCues ?? [],
    loops: over.loops ?? [],
    beatgridOffset: over.beatgridOffset,
    tags: over.tags ?? []
  }
}

function emptyManifest(over: Partial<BackupManifest> = {}): BackupManifest {
  return {
    bundleVersion: BUNDLE_VERSION,
    schemaVersion: 19,
    appVersion: '0.1.0',
    exportedAt: '2026-06-03T00:00:00.000Z',
    sourceMachine: 'Machine-A',
    counts: { tracks: 0, sets: 0, sessions: 0, tags: 0, crates: 0 },
    tracks: [],
    sets: [],
    sessions: [],
    smartCrates: [],
    dismissedDuplicateGroups: [],
    settings: {},
    ...over
  }
}

function localContext(tracks: Track[], over: Partial<LocalContext> = {}): LocalContext {
  return {
    tracks,
    sessionKeys: over.sessionKeys ?? new Set(),
    crateNames: over.crateNames ?? new Set(),
    setNames: over.setNames ?? new Set(),
    dismissedKeys: over.dismissedKeys ?? new Set()
  }
}

// ───────── crypto envelope ─────────

describe('crypto envelope', () => {
  it('round-trips with a passphrase', () => {
    const m = emptyManifest({ tracks: [exp({ title: 'Boom' })] })
    const buf = encodeBundle(m, 'hunter2')
    expect(bundleNeedsPassphrase(buf)).toBe(true)
    const back = decodeBundle(buf, 'hunter2')
    expect(back.tracks[0].title).toBe('Boom')
  })

  it('rejects a wrong passphrase cleanly', () => {
    const buf = encodeBundle(emptyManifest(), 'right')
    expect(() => decodeBundle(buf, 'wrong')).toThrowError(/passphrase|damaged/i)
  })

  it('requires a passphrase when the bundle is encrypted', () => {
    const buf = encodeBundle(emptyManifest(), 'pw')
    expect(() => decodeBundle(buf)).toThrowError(/encrypted/i)
  })

  it('writes an unencrypted bundle when no passphrase is given', () => {
    const buf = encodeBundle(emptyManifest({ sourceMachine: 'X' }))
    expect(bundleNeedsPassphrase(buf)).toBe(false)
    expect(decodeBundle(buf).sourceMachine).toBe('X')
  })

  it('detects a non-backup file', () => {
    expect(() => decodeBundle(Buffer.from('not a backup at all'))).toThrowError(/not a SetRecord/i)
  })

  it('fails the auth tag when ciphertext is tampered', () => {
    const buf = encodeBundle(emptyManifest({ tracks: [exp()] }), 'pw')
    buf[buf.length - 1] ^= 0xff // flip a byte in the body
    expect(() => decodeBundle(buf, 'pw')).toThrowError(/passphrase|damaged/i)
  })
})

// ───────── export encryption policy ─────────

describe('checkExportEncryption (secure-by-default)', () => {
  it('allows an encrypted export when a passphrase is given', () => {
    expect(checkExportEncryption('hunter2', false)).toEqual({ ok: true })
    // A non-empty passphrase wins regardless of the opt-out flag.
    expect(checkExportEncryption('hunter2', undefined)).toEqual({ ok: true })
  })

  it('refuses a plaintext export by default (no passphrase, no opt-out)', () => {
    const r = checkExportEncryption(undefined, undefined)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('passphrase_required')
  })

  it('treats an empty-string passphrase as no passphrase', () => {
    const r = checkExportEncryption('', undefined)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('passphrase_required')
  })

  it('allows a plaintext export only on a deliberate opt-out', () => {
    expect(checkExportEncryption(undefined, true)).toEqual({ ok: true })
    expect(checkExportEncryption('', true)).toEqual({ ok: true })
  })
})

// ───────── re-link engine ─────────

describe('resolveMatch', () => {
  it('tier 1: rekordbox_id + source wins even with a different title', () => {
    const local = [
      makeTrack({ id: 'L1', rekordboxId: '42', source: 'rekordbox', title: 'Renamed' })
    ]
    const idx = buildLocalIndex(local)
    const r = resolveMatch(exp({ rekordboxId: '42', source: 'rekordbox', title: 'Original' }), idx)
    expect(r).toEqual({ localId: 'L1', outcome: 'matched', tier: 1 })
  })

  it('tier 2: normalised artist+title within duration tolerance', () => {
    const local = [
      makeTrack({ id: 'L1', artist: 'Daft Punk!', title: 'Around the World', duration: 300 })
    ]
    const idx = buildLocalIndex(local)
    const r = resolveMatch(
      exp({ artist: 'daft punk', title: 'around the world', duration: 301 }),
      idx
    )
    expect(r).toEqual({ localId: 'L1', outcome: 'matched', tier: 2 })
  })

  it('tier 2: out-of-tolerance duration does not match by name', () => {
    const local = [
      makeTrack({ id: 'L1', artist: 'A', title: 'B', duration: 300, filePath: '/x/z.mp3' })
    ]
    const idx = buildLocalIndex(local)
    const r = resolveMatch(
      exp({ artist: 'A', title: 'B', duration: 350, fileBasename: 'q.mp3' }),
      idx
    )
    expect(r.outcome).toBe('unmatched')
  })

  it('tier 2: two same-name candidates within tolerance are ambiguous', () => {
    const local = [
      makeTrack({ id: 'L1', artist: 'A', title: 'B', duration: 300, filePath: '/1.mp3' }),
      makeTrack({ id: 'L2', artist: 'A', title: 'B', duration: 301, filePath: '/2.mp3' })
    ]
    const idx = buildLocalIndex(local)
    const r = resolveMatch(exp({ artist: 'A', title: 'B', duration: 300 }), idx)
    expect(r.outcome).toBe('ambiguous')
    expect(r.tier).toBe(2)
  })

  it('tier 3: unique basename matches; collision is ambiguous', () => {
    const local = [
      makeTrack({ id: 'L1', artist: 'Z', title: 'Z', filePath: '/music/unique.mp3' }),
      makeTrack({ id: 'L2', artist: 'Y', title: 'Y', filePath: '/a/dup.mp3' }),
      makeTrack({ id: 'L3', artist: 'X', title: 'X', filePath: '/b/dup.mp3' })
    ]
    const idx = buildLocalIndex(local)
    expect(
      resolveMatch(exp({ artist: 'no', title: 'no', fileBasename: 'UNIQUE.mp3' }), idx)
    ).toMatchObject({ localId: 'L1', outcome: 'matched', tier: 3 })
    expect(
      resolveMatch(exp({ artist: 'no', title: 'no', fileBasename: 'dup.mp3' }), idx).outcome
    ).toBe('ambiguous')
  })

  it('never matches against phantom tracks', () => {
    const local = [makeTrack({ id: 'P', rekordboxId: '9', source: 'rekordbox', phantom: true })]
    const idx = buildLocalIndex(local)
    expect(resolveMatch(exp({ rekordboxId: '9', source: 'rekordbox' }), idx).outcome).toBe(
      'unmatched'
    )
  })
})

// ───────── conflict policy ─────────

describe('computeOverlay', () => {
  it('keeps a local rating, fills an unrated one from the bundle', () => {
    const kept = computeOverlay(makeTrack({ rating: 4 }), exp({ rating: 2 }))
    expect(kept.rating).toBe(4)
    const filled = computeOverlay(makeTrack({ rating: 0 }), exp({ rating: 2 }))
    expect(filled.rating).toBe(2)
  })

  it('takes the max play count and the later last-played', () => {
    const o = computeOverlay(
      makeTrack({ playCount: 3, lastPlayed: '2025-01-01T00:00:00Z' }),
      exp({ playCount: 7, lastPlayed: '2025-06-01T00:00:00Z' })
    )
    expect(o.playCount).toBe(7)
    expect(o.lastPlayed).toBe('2025-06-01T00:00:00Z')
  })

  it('applies bundle cues only when local cues are empty', () => {
    const cue = [{ position: 1000 }]
    const applied = computeOverlay(makeTrack({ cuePoints: [] }), exp({ cuePoints: cue }))
    expect(applied.cuePoints).toEqual(cue)
    const keptLocal = computeOverlay(
      makeTrack({ cuePoints: [{ position: 500 }] as never }),
      exp({ cuePoints: cue })
    )
    expect(keptLocal.cuePoints).toEqual([{ position: 500 }])
  })

  it('lets a bundle USER lifecycle override local computed, but never local user', () => {
    const overridden = computeOverlay(
      makeTrack({ lifecycleState: 'active', lifecycleSource: 'computed' }),
      exp({ lifecycleState: 'archive', lifecycleSource: 'user' })
    )
    expect(overridden.lifecycleState).toBe('archive')
    expect(overridden.lifecycleSource).toBe('user')

    const keptUser = computeOverlay(
      makeTrack({ lifecycleState: 'peak', lifecycleSource: 'user' }),
      exp({ lifecycleState: 'archive', lifecycleSource: 'user' })
    )
    expect(keptUser.lifecycleState).toBe('peak')
  })
})

describe('computeTagOps', () => {
  it('unions auto tags, skipping local duplicates', () => {
    const ops = computeTagOps(
      [{ category: 'mood', value: 'dark', source: 'auto' }],
      [
        { category: 'mood', value: 'dark', source: 'auto' }, // dup → skip
        { category: 'energy', value: 'peak', source: 'auto' } // new → insert
      ]
    )
    expect(ops.clearCategories).toEqual([])
    expect(ops.inserts).toEqual([{ category: 'energy', value: 'peak', source: 'auto' }])
  })

  it('a bundle user category overrides local auto (clears then inserts)', () => {
    const ops = computeTagOps(
      [{ category: 'mood', value: 'soft', source: 'auto' }],
      [{ category: 'mood', value: 'aggressive', source: 'user' }]
    )
    expect(ops.clearCategories).toEqual(['mood'])
    expect(ops.inserts).toEqual([{ category: 'mood', value: 'aggressive', source: 'user' }])
  })

  it('never overrides a local USER category', () => {
    const ops = computeTagOps(
      [{ category: 'mood', value: 'mine', source: 'user' }],
      [
        { category: 'mood', value: 'theirs', source: 'user' },
        { category: 'mood', value: 'auto-too', source: 'auto' }
      ]
    )
    expect(ops.clearCategories).toEqual([])
    expect(ops.inserts).toEqual([])
  })
})

// ───────── planImport (A → B) ─────────

/** Build A's exported tracks + B's local tracks sharing rekordbox ids. */
function twoMachines(n: number): { exported: ExportedTrack[]; local: Track[] } {
  const exported: ExportedTrack[] = []
  const local: Track[] = []
  for (let i = 0; i < n; i++) {
    const rb = `rb-${i}`
    exported.push(
      exp({ id: `A-${i}`, rekordboxId: rb, source: 'rekordbox', title: `T${i}`, artist: `Ar${i}` })
    )
    local.push(
      makeTrack({
        id: `B-${i}`,
        rekordboxId: rb,
        source: 'rekordbox',
        title: `T${i}`,
        artist: `Ar${i}`,
        filePath: `/Users/dj-b/Music/T${i}.mp3` // different path on machine B
      })
    )
  }
  return { exported, local }
}

describe('planImport', () => {
  it('A→B happy path: ~100% match, contiguous set positions, B paths untouched', () => {
    const { exported, local } = twoMachines(4)
    const manifest = emptyManifest({
      tracks: exported,
      sets: [
        {
          id: 'set-A',
          name: 'Warmup',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
          tracks: exported.map((t, i) => ({ trackId: t.id, position: i }))
        }
      ]
    })
    const { plan, report } = planImport(manifest, localContext(local), { mode: 'merge' })

    expect(report.matched).toBe(4)
    expect(report.unmatched).toBe(0)
    expect(report.setsImported).toBe(1)
    // set children remapped to LOCAL ids, contiguous positions
    expect(plan.sets[0].trackIds).toEqual(['B-0', 'B-1', 'B-2', 'B-3'])
    // overlay ops target local ids only — never a foreign file_path
    expect(plan.overlays.map((o) => o.localId).sort()).toEqual(['B-0', 'B-1', 'B-2', 'B-3'])
  })

  it('drops unresolved set children, renumbers, and reports partial sets', () => {
    const { exported, local } = twoMachines(4)
    // Machine B is missing tracks 1 and 2 entirely.
    const partialLocal = local.filter((t) => t.id === 'B-0' || t.id === 'B-3')
    const manifest = emptyManifest({
      tracks: exported,
      sets: [
        {
          id: 'set-A',
          name: 'Set',
          createdAt: 'x',
          updatedAt: 'y',
          tracks: exported.map((t, i) => ({ trackId: t.id, position: i }))
        }
      ]
    })
    const { plan, report } = planImport(manifest, localContext(partialLocal), { mode: 'merge' })

    expect(report.matched).toBe(2)
    expect(report.unmatched).toBe(2)
    expect(report.setsImported).toBe(1)
    expect(report.setsPartial).toEqual([{ name: 'Set', dropped: 2 }])
    expect(plan.sets[0].trackIds).toEqual(['B-0', 'B-3']) // renumbered 0,1
  })

  it('skips a set whose tracks are all unresolved', () => {
    const { exported } = twoMachines(2)
    const manifest = emptyManifest({
      tracks: exported,
      sets: [
        {
          id: 's',
          name: 'Orphans',
          createdAt: 'x',
          updatedAt: 'y',
          tracks: exported.map((t, i) => ({ trackId: t.id, position: i }))
        }
      ]
    })
    const { plan, report } = planImport(manifest, localContext([]), { mode: 'restore' })
    expect(report.libraryEmpty).toBe(true)
    expect(report.setsImported).toBe(0)
    expect(report.setsSkipped).toBe(1)
    expect(plan.sets).toHaveLength(0)
  })

  it('dedupes sessions by (name, performedAt) and remaps set ids', () => {
    const { exported, local } = twoMachines(2)
    const manifest = emptyManifest({
      tracks: exported,
      sessions: [
        {
          id: 'sess-dup',
          name: 'Hi Ibiza',
          source: 'manual',
          performedAt: '2025-07-10T22:00:00Z',
          createdAt: 'x',
          tracks: [{ trackId: 'A-0', playOrder: 0 }]
        },
        {
          id: 'sess-new',
          name: 'New Gig',
          source: 'manual',
          performedAt: '2025-08-01T22:00:00Z',
          createdAt: 'y',
          tracks: exported.map((t, i) => ({ trackId: t.id, playOrder: i }))
        }
      ]
    })
    const ctx = localContext(local, {
      sessionKeys: new Set(['Hi Ibiza|2025-07-10T22:00:00Z'])
    })
    const { plan, report } = planImport(manifest, ctx, { mode: 'merge' })
    expect(report.sessionsSkipped).toBe(1)
    expect(report.sessionsImported).toBe(1)
    expect(plan.sessions[0].trackIds).toEqual(['B-0', 'B-1'])
  })

  it('renames a colliding set name and skips a colliding crate name', () => {
    const { exported, local } = twoMachines(1)
    const manifest = emptyManifest({
      tracks: exported,
      sets: [
        {
          id: 's',
          name: 'My Set',
          createdAt: 'x',
          updatedAt: 'y',
          tracks: [{ trackId: 'A-0', position: 0 }]
        }
      ],
      smartCrates: [{ id: 'c', name: 'Bangers', rulesJson: '[]', matchMode: 'all', createdAt: 'z' }]
    })
    const ctx = localContext(local, {
      setNames: new Set(['My Set']),
      crateNames: new Set(['Bangers'])
    })
    const { plan, report } = planImport(manifest, ctx, { mode: 'merge' })
    expect(plan.sets[0].name).toBe('My Set (imported)')
    expect(report.cratesImported).toBe(0)
    expect(plan.crates).toHaveLength(0)
  })

  it('only carries dismissed-duplicate keys that are new locally', () => {
    const manifest = emptyManifest({
      dismissedDuplicateGroups: [{ normalisedKey: 'a|x' }, { normalisedKey: 'b|y' }]
    })
    const ctx = localContext([], { dismissedKeys: new Set(['a|x']) })
    const { plan } = planImport(manifest, ctx, { mode: 'restore' })
    expect(plan.dismissedKeys).toEqual(['b|y'])
  })
})

// ───────── inspectBackup (file-based, no DB) ─────────

describe('inspectBackup', () => {
  let dir: string
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'ss-backup-'))
  })
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function write(name: string, m: BackupManifest, pass?: string): string {
    const p = join(dir, name)
    writeFileSync(p, encodeBundle(m, pass))
    return p
  }

  it('reports counts and suggests merge vs restore', () => {
    const p = write(
      'plain.setrecord',
      emptyManifest({ counts: { tracks: 10, sets: 2, sessions: 1, tags: 5, crates: 0 } })
    )
    const merge = inspectBackup(p, { localSchemaVersion: 19, localTrackCount: 500 })
    expect(merge.ok).toBe(true)
    expect(merge.counts?.tracks).toBe(10)
    expect(merge.suggestedMode).toBe('merge')

    const restore = inspectBackup(p, { localSchemaVersion: 19, localTrackCount: 0 })
    expect(restore.suggestedMode).toBe('restore')
  })

  it('flags an encrypted bundle as needing a passphrase', () => {
    const p = write('enc.setrecord', emptyManifest(), 'secret')
    const r = inspectBackup(p, { localSchemaVersion: 19, localTrackCount: 0 })
    expect(r.ok).toBe(false)
    expect(r.needsPassphrase).toBe(true)
  })

  it('refuses a backup from a newer schema', () => {
    const p = write('future.setrecord', emptyManifest({ schemaVersion: 99 }))
    const r = inspectBackup(p, { localSchemaVersion: 19, localTrackCount: 0 })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/newer version/i)
  })

  it('refuses a backup from a newer bundle version', () => {
    const p = write('futureb.setrecord', emptyManifest({ bundleVersion: BUNDLE_VERSION + 1 }))
    const r = inspectBackup(p, { localSchemaVersion: 19, localTrackCount: 0 })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/newer version/i)
  })
})
