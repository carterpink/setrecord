import { useEffect, useMemo, useState } from 'react'
import { Wrench, Link2, Check, AlertCircle } from 'lucide-react'
import type { LifecycleCounts, Track } from '@/types'
import { useRecallStore } from '@/stores/recallStore'
import { useLibraryStore } from '@/stores/libraryStore'

const LIFECYCLE_ORDER: { key: keyof LifecycleCounts; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'testing', label: 'Testing' },
  { key: 'active', label: 'Active' },
  { key: 'peak', label: 'Peak rotation' },
  { key: 'occasional', label: 'Occasional' },
  { key: 'forgotten', label: 'Forgotten' },
  { key: 'archive', label: 'Archive' },
  { key: 'untested', label: 'Untested' }
]

const CAMELOT_KEYS = Array.from({ length: 12 }, (_, i) => i + 1).flatMap((n) => [`${n}A`, `${n}B`])

type FixKind = 'relink' | 'key' | 'bpm' | 'format'

/** One offending track with the right inline fix for its issue. */
function HealthTrackRow({
  track,
  kind,
  onFixed
}: {
  track: Track
  kind: FixKind
  onFixed: () => void
}): React.JSX.Element {
  const updateTrackMeta = useLibraryStore((s) => s.updateTrackMeta)
  const relinkTrackFile = useLibraryStore((s) => s.relinkTrackFile)
  const [bpm, setBpm] = useState('')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)

  const saveBpm = async (): Promise<void> => {
    const v = Number(bpm)
    if (!Number.isFinite(v) || v <= 0) return
    setBusy(true)
    await updateTrackMeta(track.id, { bpm: v })
    onFixed()
  }
  const saveKey = async (): Promise<void> => {
    if (!key) return
    setBusy(true)
    await updateTrackMeta(track.id, { key })
    onFixed()
  }
  const relink = async (): Promise<void> => {
    setBusy(true)
    const fp = await relinkTrackFile(track.id)
    if (fp) onFixed()
    else setBusy(false)
  }

  return (
    <div className="health-fix-row">
      <div className="health-fix-meta">
        <span className="health-fix-title">{track.title}</span>
        <span className="health-fix-artist">{track.artist || '—'}</span>
      </div>

      {kind === 'bpm' && (
        <div className="health-fix-control">
          <input
            type="number"
            placeholder="BPM"
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void saveBpm()}
          />
          <button type="button" disabled={busy || bpm.trim() === ''} onClick={() => void saveBpm()}>
            <Check size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {kind === 'key' && (
        <div className="health-fix-control">
          <select value={key} onChange={(e) => setKey(e.target.value)}>
            <option value="">Key…</option>
            {CAMELOT_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <button type="button" disabled={busy || key === ''} onClick={() => void saveKey()}>
            <Check size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      {kind === 'relink' && (
        <button
          type="button"
          className="health-fix-btn"
          disabled={busy}
          onClick={() => void relink()}
        >
          <Link2 size={13} strokeWidth={1.7} /> Relink…
        </button>
      )}

      {kind === 'format' && <span className="health-fix-format">.{track.format}</span>}
    </div>
  )
}

export function HealthSection(): React.JSX.Element {
  const health = useRecallStore((s) => s.health)
  const lifecycle = useRecallStore((s) => s.lifecycle)
  const loading = useRecallStore((s) => s.healthLoading)
  const loadHealth = useRecallStore((s) => s.loadHealth)
  const tracks = useLibraryStore((s) => s.tracks)

  const [open, setOpen] = useState<string | null>(null)

  const trackMap = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks])

  useEffect(() => {
    void loadHealth()
  }, [loadHealth])

  if (loading && !health) {
    return (
      <div className="recall-section">
        <div className="recall-empty">Scanning your library…</div>
      </div>
    )
  }

  const hydrate = (ids: string[]): Track[] =>
    ids.map((id) => trackMap.get(id)).filter((t): t is Track => t !== undefined)

  const onFixed = (): void => {
    void loadHealth()
  }

  const CATS: { id: string; label: string; ids: string[]; kind: FixKind }[] = health
    ? [
        { id: 'missingFiles', label: 'Missing files', ids: health.missingFileIds, kind: 'relink' },
        { id: 'missingKey', label: 'Missing key', ids: health.missingKeyIds, kind: 'key' },
        { id: 'missingBpm', label: 'Missing BPM', ids: health.missingBpmIds, kind: 'bpm' },
        {
          id: 'unsupported',
          label: 'Unsupported format',
          ids: health.unsupportedFormatIds,
          kind: 'format'
        }
      ]
    : []

  return (
    <div className="recall-section">
      <header className="recall-section-head">
        <h2 className="ss-h2">Health</h2>
        <p className="recall-section-sub">
          Where the rot is — click a number to see the tracks and fix them in place.
        </p>
      </header>

      {health && (
        <>
          <div className="recall-health-score glass-2">
            <span className="recall-health-score-num">{health.healthScore}</span>
            <span className="recall-health-score-label">/ 100 library health</span>
          </div>

          <div className="recall-health-grid">
            {CATS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`recall-health-stat glass-2 health-stat-btn${open === cat.id ? ' active' : ''}`}
                disabled={cat.ids.length === 0}
                onClick={() => setOpen(open === cat.id ? null : cat.id)}
              >
                <span className="recall-health-num">{cat.ids.length}</span>
                <span className="recall-health-cat">{cat.label}</span>
              </button>
            ))}
            <button
              type="button"
              className={`recall-health-stat glass-2 health-stat-btn${open === 'dupes' ? ' active' : ''}`}
              disabled={health.duplicateGroups.length === 0}
              onClick={() => setOpen(open === 'dupes' ? null : 'dupes')}
            >
              <span className="recall-health-num">{health.duplicateGroups.length}</span>
              <span className="recall-health-cat">Duplicate groups</span>
            </button>
          </div>

          {/* Detail panel for the open category */}
          {open && open !== 'dupes' && (
            <div className="health-detail glass-2">
              <div className="health-detail-head">
                <Wrench size={14} strokeWidth={1.7} />
                <span>{CATS.find((c) => c.id === open)?.label}</span>
              </div>
              {hydrate(CATS.find((c) => c.id === open)?.ids ?? [])
                .slice(0, 200)
                .map((t) => (
                  <HealthTrackRow
                    key={t.id}
                    track={t}
                    kind={CATS.find((c) => c.id === open)!.kind}
                    onFixed={onFixed}
                  />
                ))}
            </div>
          )}

          {open === 'dupes' && (
            <div className="health-detail glass-2">
              <div className="health-detail-head">
                <AlertCircle size={14} strokeWidth={1.7} />
                <span>Duplicate groups — same artist + title</span>
              </div>
              {health.duplicateGroups.slice(0, 100).map((g, i) => (
                <div className="health-dupe-group" key={i}>
                  {hydrate(g.ids).map((t) => (
                    <div className="health-fix-row" key={t.id}>
                      <div className="health-fix-meta">
                        <span className="health-fix-title">{t.title}</span>
                        <span className="health-fix-artist">
                          {t.artist || '—'} · {t.format} · {Math.round(t.bpm)} BPM
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <p className="crate-tab-hint">
                Duplicates are flagged, not auto-removed — clean them up in Rekordbox to stay in
                sync.
              </p>
            </div>
          )}
        </>
      )}

      {lifecycle && (
        <div className="recall-lifecycle">
          <h3 className="ss-h3">Track lifecycle</h3>
          <div className="recall-lifecycle-bars">
            {LIFECYCLE_ORDER.map(({ key, label }) => (
              <div className="recall-lifecycle-row" key={key}>
                <span className="recall-lifecycle-label">{label}</span>
                <span className="recall-lifecycle-count">{lifecycle[key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
