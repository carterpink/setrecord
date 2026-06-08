/**
 * GraphSection.tsx — the Constellation: a full-bleed force-directed map of the
 * DJ's library seen through a Past / Present / Future temporal lens.
 *
 * Phase 1: PAST — transitions you've actually mixed (free, the rear-view hook).
 * Phase 2: FUTURE — feasible transitions from compatibility; DIFF — the ones
 * you've never tried (the discovery engine). Future/Diff are the Pro windshield.
 */

import { Suspense, lazy, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Waypoints, History, Radio, Sparkles, GitCompareArrows, Route } from 'lucide-react'
import { useGraphStore } from '@/stores/graphStore'
import { useSetStore } from '@/stores/setStore'
import { useLiveStore } from '@/stores/liveStore'
import { useCanUse } from '@/stores/licenseStore'
import { ProLock } from '@/components/shared/ProGate'
import type { GraphMode } from '@/types'
import { FilmGrain } from './FilmGrain'
import { GraphLegend } from './GraphLegend'
import { TimeScrubber } from './TimeScrubber'
import { ScopeSwitcher } from './ScopeSwitcher'
import { PathBuilder } from './PathBuilder'
import { GraphSearch } from './GraphSearch'
import './graph.css'

// Keep react-force-graph-2d (and its d3 deps) out of the initial bundle.
const ForceGraphCanvas = lazy(() =>
  import('./ForceGraphCanvas').then((m) => ({ default: m.ForceGraphCanvas }))
)

// Temporal order: where you've been → where you are → where you could go.
const MODES: { id: GraphMode; icon: typeof History }[] = [
  { id: 'past', icon: History },
  { id: 'present', icon: Radio },
  { id: 'future', icon: Sparkles },
  { id: 'diff', icon: GitCompareArrows }
]

/** Future and Diff are the forward-looking Pro lenses; Past stays free. */
const PRO_MODES: GraphMode[] = ['future', 'diff']

export function GraphSection(): React.JSX.Element {
  const { t } = useTranslation('recall')
  const isPro = useCanUse('graph')
  const mode = useGraphStore((s) => s.mode)
  const data = useGraphStore((s) => s.data)
  const loading = useGraphStore((s) => s.loading)
  const error = useGraphStore((s) => s.error)
  const scope = useGraphStore((s) => s.scope)
  const selectedId = useGraphStore((s) => s.selectedId)
  const seedTrackId = useGraphStore((s) => s.seedTrackId)
  const setMode = useGraphStore((s) => s.setMode)
  const select = useGraphStore((s) => s.select)
  const focusTrack = useGraphStore((s) => s.focusTrack)
  const expandCluster = useGraphStore((s) => s.expandCluster)
  const loadGraph = useGraphStore((s) => s.loadGraph)
  const pathMode = useGraphStore((s) => s.pathMode)
  const path = useGraphStore((s) => s.path)
  const togglePathMode = useGraphStore((s) => s.togglePathMode)
  const togglePathNode = useGraphStore((s) => s.togglePathNode)

  const locked = !isPro && PRO_MODES.includes(mode)

  // Present is reactive to the working set / live session; Past/Future key off
  // the lens + scope. Re-centring (focusTrack) loads itself, so seedTrackId is
  // intentionally absent — it avoids a reload loop when we adopt an auto seed.
  const timeWindow = useGraphStore((s) => s.timeWindow)
  const setSig = useSetStore((s) => (s.currentSet?.tracks ?? []).map((t) => t.trackId).join(','))
  const liveSig = useLiveStore((s) => (s.isLive ? (s.current?.id ?? 'live') : ''))
  const loadKey =
    mode === 'present'
      ? `present:${setSig}:${liveSig}`
      : `${mode}:${scope}:${timeWindow?.after ?? ''}:${scope === 'context' ? setSig : ''}`
  useEffect(() => {
    if (!locked) void loadGraph()
  }, [loadKey, locked, loadGraph])

  const trackCount = useMemo(
    () => (data?.nodes ?? []).filter((n) => n.kind === 'track').length,
    [data]
  )
  const clusterCount = useMemo(
    () => (data?.nodes ?? []).filter((n) => n.kind === 'cluster').length,
    [data]
  )
  const seedTitle = useMemo(() => {
    const node = data?.nodes.find((n) => n.id === (seedTrackId ?? ''))
    return node && node.kind === 'track' ? node.title : null
  }, [data, seedTrackId])

  const hasGraph = !locked && data != null && data.nodes.length > 0
  const isEmpty = !locked && !loading && !error && data != null && data.nodes.length === 0

  return (
    <div className="graph-section">
      <Suspense fallback={null}>
        {hasGraph && (
          <ForceGraphCanvas
            data={data}
            selectedId={selectedId}
            onSelect={select}
            onFocusTrack={focusTrack}
            onExpandCluster={expandCluster}
            pathMode={pathMode}
            pathIds={path}
            onPathToggle={togglePathNode}
          />
        )}
      </Suspense>

      {hasGraph && <FilmGrain />}
      {hasGraph && <GraphLegend mode={mode} />}
      {hasGraph && mode === 'past' && scope === 'neighborhood' && !pathMode && <TimeScrubber />}
      {hasGraph && pathMode && <PathBuilder />}

      <div className="graph-hud">
        <div className="graph-hud-left">
          <div className="graph-title">
            <h3>{t('graph.title')}</h3>
            <span>{t(`graph.tagline.${mode}`)}</span>
          </div>
          {!locked && <GraphSearch />}
        </div>
        <div className="graph-controls">
          <div className="graph-modes" role="tablist" aria-label={t('graph.lensLabel')}>
            {MODES.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                className={`graph-mode-btn${mode === id ? ' active' : ''}`}
                onClick={() => setMode(id)}
              >
                <Icon size={15} strokeWidth={1.8} />
                {t(`graph.mode.${id}`)}
              </button>
            ))}
          </div>
          {mode !== 'present' && <ScopeSwitcher />}
          {mode !== 'present' && (
            <button
              type="button"
              className={`graph-path-toggle${pathMode ? ' active' : ''}`}
              onClick={togglePathMode}
            >
              <Route size={13} strokeWidth={1.8} />
              {t('graph.path.toggle')}
            </button>
          )}
        </div>
      </div>

      {locked && (
        <div className="graph-lock">
          <ProLock
            feature="graph"
            title={t(`graph.lock.${mode}.title`)}
            description={t(`graph.lock.${mode}.body`)}
          />
        </div>
      )}

      {(loading || error || isEmpty) && (
        <div className="graph-overlay">
          {loading && <p>{t('graph.loading')}</p>}
          {error && <p>{t('graph.error')}</p>}
          {isEmpty && (
            <>
              <Waypoints size={28} strokeWidth={1.5} color="var(--text-tertiary)" />
              <h4>{t(`graph.empty.${mode}.title`)}</h4>
              <p>{t(`graph.empty.${mode}.body`)}</p>
            </>
          )}
        </div>
      )}

      {hasGraph && (
        <div className="graph-footer">
          <span className="graph-dot" />
          {clusterCount > 0 ? (
            <span>{t('graph.genreCount', { count: clusterCount })}</span>
          ) : seedTitle ? (
            <span>
              {t('graph.centeredOn')} <strong>{seedTitle}</strong> ·{' '}
              {t('graph.trackCount', { count: trackCount })}
            </span>
          ) : (
            <span>{t('graph.trackCount', { count: trackCount })}</span>
          )}
        </div>
      )}
    </div>
  )
}
