import { useEffect, useMemo, useState } from 'react'
import {
  Wrench,
  Link2,
  Check,
  AlertCircle,
  Info,
  Sparkles,
  Archive as ArchiveIcon,
  X,
  RefreshCw,
  Loader2
} from 'lucide-react'
import type { LifecycleCounts, Track, HealthScoreBreakdown } from '@/types'
import { useRecallStore } from '@/stores/recallStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useToastStore } from '@/stores/toastStore'
import { useCanUse } from '@/stores/licenseStore'
import { ProLock } from '@/components/shared/ProGate'

const LIFECYCLE_ORDER: { key: keyof LifecycleCounts; label: string; tip?: string }[] = [
  { key: 'new', label: 'New', tip: 'Added in the last 30 days, never played live' },
  { key: 'untested', label: 'Untested', tip: 'Never played live — added more than 30 days ago' },
  { key: 'testing', label: 'Testing', tip: '1–3 plays' },
  { key: 'active', label: 'Active', tip: '4–9 plays, played recently' },
  { key: 'peak', label: 'Peak rotation', tip: '10+ plays, played within 90 days' },
  { key: 'occasional', label: 'Occasional', tip: 'Played 90–365 days ago' },
  { key: 'forgotten', label: 'Forgotten', tip: 'Last played 1–3 years ago' },
  { key: 'archive', label: 'Archive', tip: 'Last played more than 3 years ago, or you archived it' }
]

const CAMELOT_KEYS = Array.from({ length: 12 }, (_, i) => i + 1).flatMap((n) => [`${n}A`, `${n}B`])

type FixKind = 'relink' | 'key' | 'bpm' | 'format' | 'analysing'

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

      {kind === 'analysing' && (
        <span className="health-fix-format" title="Awaiting background analyser">
          pending
        </span>
      )}
    </div>
  )
}

/**
 * Stacked breakdown of how the health score was calculated, so the user can
 * see why a score isn't 100. Mirrors HEALTH_WEIGHTS verbatim.
 */
function ScoreExplainer({
  breakdown
}: {
  breakdown: HealthScoreBreakdown
}): React.JSX.Element {
  const w = breakdown.weights
  const rows = [
    {
      label: 'Missing files',
      penalty: breakdown.missingFiles,
      rule: `−${w.missingFilesPerTrack} per file, capped at −${w.missingFilesCap}`
    },
    {
      label: 'Missing key',
      penalty: breakdown.missingKey,
      rule: `−${w.missingKeyPerTrack} per file, capped at −${w.missingKeyCap}`
    },
    {
      label: 'Missing BPM',
      penalty: breakdown.missingBpm,
      rule: `−${w.missingBpmPerTrack} per file, capped at −${w.missingBpmCap}`
    },
    {
      label: 'Unsupported formats',
      penalty: breakdown.unsupportedFormats,
      rule: `−${w.unsupportedFormatsPerTrack} per file, capped at −${w.unsupportedFormatsCap}`
    },
    {
      label: 'Duplicate groups',
      penalty: breakdown.duplicates,
      rule: `−${w.duplicatesPerGroup} per group, capped at −${w.duplicatesCap}`
    }
  ]
  return (
    <div className="health-score-explainer glass-2">
      <div className="health-score-explainer-head">
        <Info size={13} strokeWidth={1.7} />
        <span>How this score is calculated</span>
      </div>
      <p className="health-score-explainer-intro">
        Missing files hit the hardest because at gig time a missing file just won&apos;t play.
      </p>
      <ul className="health-score-explainer-rows">
        {rows.map((r) => (
          <li key={r.label}>
            <span className="hse-label">{r.label}</span>
            <span className="hse-rule">{r.rule}</span>
            <span className="hse-penalty" data-active={r.penalty > 0}>
              {r.penalty > 0 ? `−${r.penalty}` : '0'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One duplicate group with batch-resolve actions. */
function DuplicateGroupCard({
  group,
  tracks,
  onKeepAll,
  onArchiveOthers
}: {
  group: { ids: string[]; normalisedKey: string }
  tracks: Track[]
  onKeepAll: () => void
  onArchiveOthers: (keepId: string) => void
}): React.JSX.Element {
  // Highest-bitrate / longest-duration track is the sensible default to keep,
  // but defer the choice to the user.
  const [keepId, setKeepId] = useState<string>(tracks[0]?.id ?? '')

  return (
    <div className="health-dupe-group">
      <div className="health-dupe-group-rows">
        {tracks.map((t) => (
          <label
            key={t.id}
            className={`health-fix-row health-dupe-pick${keepId === t.id ? ' is-keep' : ''}`}
          >
            <input
              type="radio"
              name={`dupe-${group.normalisedKey}`}
              checked={keepId === t.id}
              onChange={() => setKeepId(t.id)}
            />
            <div className="health-fix-meta">
              <span className="health-fix-title">{t.title}</span>
              <span className="health-fix-artist">
                {t.artist || '—'} · {t.format} · {Math.round(t.bpm)} BPM
                {t.bitrate ? ` · ${t.bitrate}kbps` : ''}
                {t.duration ? ` · ${Math.round(t.duration / 60)}m` : ''}
              </span>
            </div>
          </label>
        ))}
      </div>
      <div className="health-dupe-actions">
        <button
          type="button"
          className="health-dupe-btn"
          onClick={() => onArchiveOthers(keepId)}
          disabled={!keepId || tracks.length < 2}
        >
          <ArchiveIcon size={13} strokeWidth={1.7} /> Keep selected, archive the rest
        </button>
        <button type="button" className="health-dupe-btn ghost" onClick={onKeepAll}>
          <X size={13} strokeWidth={1.7} /> Not a duplicate
        </button>
      </div>
    </div>
  )
}

export function HealthSection(): React.JSX.Element {
  const health = useRecallStore((s) => s.health)
  const lifecycle = useRecallStore((s) => s.lifecycle)
  const loading = useRecallStore((s) => s.healthLoading)
  const loadHealth = useRecallStore((s) => s.loadHealth)
  const dismissDuplicateGroup = useRecallStore((s) => s.dismissDuplicateGroup)
  const resolveDuplicateGroup = useRecallStore((s) => s.resolveDuplicateGroup)
  const tracks = useLibraryStore((s) => s.tracks)
  const toast = useToastStore()
  const canDrillDown = useCanUse('healthDrilldown')

  const [open, setOpen] = useState<string | null>(null)
  const [showExplainer, setShowExplainer] = useState(false)
  const [analysing, setAnalysing] = useState<{ processed: number; total: number } | null>(null)
  const [rescanning, setRescanning] = useState(false)

  const trackMap = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks])

  useEffect(() => {
    void loadHealth()
  }, [loadHealth])

  // Stream energy-analysis progress while the user is on this panel so the
  // "Analyse all" button reflects the work happening in the main process.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.setsense) return
    const unsub = window.setsense.onEnergyProgress?.((p) => {
      if (p.phase === 'done') {
        setAnalysing(null)
        void loadHealth()
      } else {
        setAnalysing({ processed: p.processed, total: p.total })
      }
    })
    return () => {
      unsub?.()
    }
  }, [loadHealth])

  const triggerAnalyseAll = async (): Promise<void> => {
    if (analysing) return
    setAnalysing({ processed: 0, total: 0 })
    try {
      const res = await window.setsense.analyseEnergy()
      if (!res.running) {
        // Either nothing to do or already running; either way show feedback.
        toast.info('Analysis already in progress or nothing pending')
        setAnalysing(null)
      }
    } catch (e) {
      toast.error('Could not start analyser: ' + (e instanceof Error ? e.message : 'unknown'))
      setAnalysing(null)
    }
  }

  const triggerRescanFiles = async (): Promise<void> => {
    if (rescanning) return
    setRescanning(true)
    try {
      await window.setsense.triggerHealthCheck()
      // Health-check is fire-and-forget; allow a beat for the DB to settle then reload.
      setTimeout(() => {
        void loadHealth()
        setRescanning(false)
        toast.success('Re-scanned file paths — Missing files updated')
      }, 800)
    } catch (e) {
      toast.error('Could not re-scan: ' + (e instanceof Error ? e.message : 'unknown'))
      setRescanning(false)
    }
  }

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
        },
        {
          id: 'notAnalysed',
          label: 'Not yet analysed',
          ids: health.notAnalysedIds,
          kind: 'analysing'
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
          <div className="recall-health-score-wrap">
            <div className="recall-health-score glass-2">
              <span className="recall-health-score-num">{health.healthScore}</span>
              <span className="recall-health-score-label">/ 100 library health</span>
              <button
                type="button"
                className="health-score-info-btn"
                aria-label="How is this calculated?"
                onClick={() => setShowExplainer((s) => !s)}
              >
                <Info size={14} strokeWidth={1.7} />
              </button>
            </div>
            {showExplainer && <ScoreExplainer breakdown={health.scoreBreakdown} />}
          </div>

          {!canDrillDown && (
            <ProLock
              feature="healthDrilldown"
              compact
              description="See exactly which tracks are missing files, key, BPM or are duplicated — and fix them in place."
            />
          )}

          {canDrillDown && (
          <>
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

          {open && open !== 'dupes' && (
            <div className="health-detail glass-2">
              <div className="health-detail-head">
                {open === 'notAnalysed' ? (
                  <Sparkles size={14} strokeWidth={1.7} />
                ) : (
                  <Wrench size={14} strokeWidth={1.7} />
                )}
                <span>{CATS.find((c) => c.id === open)?.label}</span>
                {open === 'notAnalysed' && (
                  <span className="health-detail-hint">
                    Background analyser writes energy from the audio file — no Rekordbox needed.
                  </span>
                )}
                {(open === 'missingKey' || open === 'missingBpm') && (
                  <span className="health-detail-hint">
                    Key/BPM come from Rekordbox. Set them inline below or fix them upstream.
                  </span>
                )}
                {open === 'unsupported' && (
                  <span className="health-detail-hint">
                    CDJs reject these formats — convert to AIFF/WAV/FLAC in Rekordbox.
                  </span>
                )}

                {/* Auto-analyse / re-scan buttons in the table header. */}
                {open === 'notAnalysed' && (
                  <button
                    type="button"
                    className="health-header-btn"
                    disabled={!!analysing}
                    onClick={() => void triggerAnalyseAll()}
                  >
                    {analysing ? (
                      <>
                        <Loader2 size={13} strokeWidth={1.7} className="health-spin" />
                        Analysing
                        {analysing.total > 0
                          ? ` ${analysing.processed}/${analysing.total}`
                          : '…'}
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} strokeWidth={1.7} />
                        Analyse all
                      </>
                    )}
                  </button>
                )}
                {open === 'missingFiles' && (
                  <button
                    type="button"
                    className="health-header-btn"
                    disabled={rescanning}
                    onClick={() => void triggerRescanFiles()}
                  >
                    {rescanning ? (
                      <>
                        <Loader2 size={13} strokeWidth={1.7} className="health-spin" />
                        Re-scanning
                      </>
                    ) : (
                      <>
                        <RefreshCw size={13} strokeWidth={1.7} />
                        Re-scan all
                      </>
                    )}
                  </button>
                )}
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
                <span className="health-detail-hint">
                  Pick one to keep — the rest move to your Archive lifecycle state.
                </span>
              </div>
              {health.duplicateGroups.slice(0, 100).map((g) => {
                const groupTracks = hydrate(g.ids)
                if (groupTracks.length < 2) return null
                return (
                  <DuplicateGroupCard
                    key={g.normalisedKey}
                    group={g}
                    tracks={groupTracks}
                    onKeepAll={() => void dismissDuplicateGroup(g.normalisedKey)}
                    onArchiveOthers={(keepId) =>
                      void resolveDuplicateGroup(
                        g.normalisedKey,
                        groupTracks.filter((t) => t.id !== keepId).map((t) => t.id)
                      )
                    }
                  />
                )
              })}
            </div>
          )}
          </>
          )}
        </>
      )}

      {canDrillDown && lifecycle && (
        <div className="recall-lifecycle">
          <h3 className="ss-h3">Track lifecycle</h3>
          <p className="recall-section-sub recall-lifecycle-sub">
            How tracks move through your library. &ldquo;Untested&rdquo; means never played live —
            that&apos;s separate from &ldquo;Not yet analysed&rdquo; above.
          </p>
          <div className="recall-lifecycle-bars">
            {LIFECYCLE_ORDER.map(({ key, label, tip }) => (
              <div className="recall-lifecycle-row" key={key} title={tip ?? ''}>
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
