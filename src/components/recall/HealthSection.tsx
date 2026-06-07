import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
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

const LIFECYCLE_ORDER: { key: keyof LifecycleCounts; labelKey: string; tipKey: string }[] = [
  { key: 'new', labelKey: 'health.lifecycle.new', tipKey: 'health.lifecycle.newTip' },
  {
    key: 'untested',
    labelKey: 'health.lifecycle.untested',
    tipKey: 'health.lifecycle.untestedTip'
  },
  { key: 'testing', labelKey: 'health.lifecycle.testing', tipKey: 'health.lifecycle.testingTip' },
  { key: 'active', labelKey: 'health.lifecycle.active', tipKey: 'health.lifecycle.activeTip' },
  { key: 'peak', labelKey: 'health.lifecycle.peak', tipKey: 'health.lifecycle.peakTip' },
  {
    key: 'occasional',
    labelKey: 'health.lifecycle.occasional',
    tipKey: 'health.lifecycle.occasionalTip'
  },
  {
    key: 'forgotten',
    labelKey: 'health.lifecycle.forgotten',
    tipKey: 'health.lifecycle.forgottenTip'
  },
  { key: 'archive', labelKey: 'health.lifecycle.archive', tipKey: 'health.lifecycle.archiveTip' }
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
  const { t } = useTranslation('recall')
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
            placeholder={t('health.row.bpmPlaceholder')}
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
            <option value="">{t('health.row.keyPlaceholder')}</option>
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
          <Link2 size={13} strokeWidth={1.7} /> {t('health.row.relink')}
        </button>
      )}

      {kind === 'format' && <span className="health-fix-format">.{track.format}</span>}

      {kind === 'analysing' && (
        <span className="health-fix-format" title={t('health.row.pendingTitle')}>
          {t('health.row.pending')}
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
  breakdown,
  t
}: {
  breakdown: HealthScoreBreakdown
  t: TFunction
}): React.JSX.Element {
  const w = breakdown.weights
  const rows = [
    {
      label: t('health.score.missingFiles'),
      penalty: breakdown.missingFiles,
      rule: t('health.score.rulePerFile', { per: w.missingFilesPerTrack, cap: w.missingFilesCap })
    },
    {
      label: t('health.score.missingKey'),
      penalty: breakdown.missingKey,
      rule: t('health.score.rulePerFile', { per: w.missingKeyPerTrack, cap: w.missingKeyCap })
    },
    {
      label: t('health.score.missingBpm'),
      penalty: breakdown.missingBpm,
      rule: t('health.score.rulePerFile', { per: w.missingBpmPerTrack, cap: w.missingBpmCap })
    },
    {
      label: t('health.score.unsupportedFormats'),
      penalty: breakdown.unsupportedFormats,
      rule: t('health.score.rulePerFile', {
        per: w.unsupportedFormatsPerTrack,
        cap: w.unsupportedFormatsCap
      })
    },
    {
      label: t('health.score.duplicateGroups'),
      penalty: breakdown.duplicates,
      rule: t('health.score.rulePerGroup', { per: w.duplicatesPerGroup, cap: w.duplicatesCap })
    }
  ]
  return (
    <div className="health-score-explainer glass-2">
      <div className="health-score-explainer-head">
        <Info size={13} strokeWidth={1.7} />
        <span>{t('health.score.head')}</span>
      </div>
      <p className="health-score-explainer-intro">{t('health.score.intro')}</p>
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
  const { t } = useTranslation('recall')
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
          <ArchiveIcon size={13} strokeWidth={1.7} /> {t('health.dupe.keepArchive')}
        </button>
        <button type="button" className="health-dupe-btn ghost" onClick={onKeepAll}>
          <X size={13} strokeWidth={1.7} /> {t('health.dupe.notDuplicate')}
        </button>
      </div>
    </div>
  )
}

export function HealthSection(): React.JSX.Element {
  const { t } = useTranslation('recall')
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
        toast.info(t('health.analyseInProgress'))
        setAnalysing(null)
      }
    } catch (e) {
      toast.error(
        t('health.analyseError', {
          error: e instanceof Error ? e.message : t('health.errorUnknown')
        })
      )
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
        toast.success(t('health.rescanSuccess'))
      }, 800)
    } catch (e) {
      toast.error(
        t('health.rescanError', {
          error: e instanceof Error ? e.message : t('health.errorUnknown')
        })
      )
      setRescanning(false)
    }
  }

  if (loading && !health) {
    return (
      <div className="recall-section">
        <div className="recall-empty">{t('health.scanning')}</div>
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
        {
          id: 'missingFiles',
          label: t('health.cats.missingFiles'),
          ids: health.missingFileIds,
          kind: 'relink'
        },
        {
          id: 'missingKey',
          label: t('health.cats.missingKey'),
          ids: health.missingKeyIds,
          kind: 'key'
        },
        {
          id: 'missingBpm',
          label: t('health.cats.missingBpm'),
          ids: health.missingBpmIds,
          kind: 'bpm'
        },
        {
          id: 'unsupported',
          label: t('health.cats.unsupported'),
          ids: health.unsupportedFormatIds,
          kind: 'format'
        },
        {
          id: 'notAnalysed',
          label: t('health.cats.notAnalysed'),
          ids: health.notAnalysedIds,
          kind: 'analysing'
        }
      ]
    : []

  return (
    <div className="recall-section">
      <header className="recall-section-head">
        <h2 className="ss-h2">{t('health.title')}</h2>
        <p className="recall-section-sub">{t('health.subtitle')}</p>
      </header>

      {health && (
        <>
          <div className="recall-health-score-wrap">
            <div className="recall-health-score glass-2">
              <span className="recall-health-score-num">{health.healthScore}</span>
              <span className="recall-health-score-label">{t('health.scoreLabel')}</span>
              <button
                type="button"
                className="health-score-info-btn"
                aria-label={t('health.scoreInfoAria')}
                onClick={() => setShowExplainer((s) => !s)}
              >
                <Info size={14} strokeWidth={1.7} />
              </button>
            </div>
            {showExplainer && <ScoreExplainer breakdown={health.scoreBreakdown} t={t} />}
          </div>

          {!canDrillDown && (
            <ProLock feature="healthDrilldown" compact description={t('health.proDescription')} />
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
                  <span className="recall-health-cat">{t('health.cats.duplicateGroups')}</span>
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
                      <span className="health-detail-hint">{t('health.hints.notAnalysed')}</span>
                    )}
                    {(open === 'missingKey' || open === 'missingBpm') && (
                      <span className="health-detail-hint">{t('health.hints.keyBpm')}</span>
                    )}
                    {open === 'unsupported' && (
                      <span className="health-detail-hint">{t('health.hints.unsupported')}</span>
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
                            {t('health.analysing')}
                            {analysing.total > 0
                              ? t('health.analysingProgress', {
                                  processed: analysing.processed,
                                  total: analysing.total
                                })
                              : '…'}
                          </>
                        ) : (
                          <>
                            <Sparkles size={13} strokeWidth={1.7} />
                            {t('health.analyseAll')}
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
                            {t('health.rescanning')}
                          </>
                        ) : (
                          <>
                            <RefreshCw size={13} strokeWidth={1.7} />
                            {t('health.rescanAll')}
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
                    <span>{t('health.dupesTitle')}</span>
                    <span className="health-detail-hint">{t('health.dupesHint')}</span>
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
          <h3 className="ss-h3">{t('health.lifecycle.title')}</h3>
          <p className="recall-section-sub recall-lifecycle-sub">
            {t('health.lifecycle.subtitle')}
          </p>
          <div className="recall-lifecycle-bars">
            {LIFECYCLE_ORDER.map(({ key, labelKey, tipKey }) => (
              <div className="recall-lifecycle-row" key={key} title={t(tipKey)}>
                <span className="recall-lifecycle-label">{t(labelKey)}</span>
                <span className="recall-lifecycle-count">{lifecycle[key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
