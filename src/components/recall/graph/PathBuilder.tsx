/**
 * PathBuilder.tsx — "walk a path to build a set". With path mode on, every track
 * you click joins an ordered path; from here you can auto-route the smoothest
 * chain between your first and last pick, then save it as a new set or append it
 * to the one you're building.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Route, Plus, Save, Trash2, X } from 'lucide-react'
import { useGraphStore } from '@/stores/graphStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSetStore } from '@/stores/setStore'
import type { Track } from '@/types'
import { findPath } from './pathfind'

export function PathBuilder(): React.JSX.Element {
  const { t } = useTranslation('recall')
  const path = useGraphStore((s) => s.path)
  const data = useGraphStore((s) => s.data)
  const togglePathNode = useGraphStore((s) => s.togglePathNode)
  const setPath = useGraphStore((s) => s.setPath)
  const clearPath = useGraphStore((s) => s.clearPath)
  const togglePathMode = useGraphStore((s) => s.togglePathMode)
  const tracks = useLibraryStore((s) => s.tracks)
  const createSetFromTracks = useSetStore((s) => s.createSetFromTracks)
  const addTracksToCurrent = useSetStore((s) => s.addTracksToCurrent)

  const byId = useMemo(() => new Map(tracks.map((tr) => [tr.id, tr])), [tracks])
  const titleFor = (id: string): string => {
    const node = data?.nodes.find((n) => n.id === id)
    return byId.get(id)?.title ?? (node && node.kind === 'track' ? node.title : id)
  }
  const resolved = path.map((id) => byId.get(id)).filter((tr): tr is Track => Boolean(tr))

  const route = (): void => {
    if (path.length < 2 || !data) return
    const r = findPath(data.edges, path[0], path[path.length - 1])
    if (r.length) setPath(r)
  }
  const saveNew = (): void => {
    if (resolved.length) {
      createSetFromTracks(t('graph.path.setName'), resolved)
      clearPath()
    }
  }
  const addCurrent = (): void => {
    if (resolved.length) {
      addTracksToCurrent(resolved)
      clearPath()
    }
  }

  return (
    <div className="graph-path">
      <div className="graph-path-head">
        <Route size={14} strokeWidth={1.8} />
        <strong>{t('graph.path.title')}</strong>
        <span className="graph-path-count">{path.length}</span>
        <button
          type="button"
          className="graph-path-close"
          onClick={togglePathMode}
          aria-label={t('graph.path.exit')}
        >
          <X size={14} />
        </button>
      </div>

      {path.length === 0 ? (
        <p className="graph-path-hint">{t('graph.path.hint')}</p>
      ) : (
        <div className="graph-path-chips">
          {path.map((id, i) => (
            <button
              key={id}
              type="button"
              className="graph-path-chip"
              onClick={() => togglePathNode(id)}
              title={t('graph.path.remove')}
            >
              <span className="graph-path-num">{i + 1}</span>
              {titleFor(id)}
              <X size={11} />
            </button>
          ))}
        </div>
      )}

      <div className="graph-path-actions">
        <button type="button" onClick={route} disabled={path.length < 2}>
          <Route size={13} /> {t('graph.path.route')}
        </button>
        <button type="button" onClick={addCurrent} disabled={resolved.length === 0}>
          <Plus size={13} /> {t('graph.path.add')}
        </button>
        <button
          type="button"
          className="primary"
          onClick={saveNew}
          disabled={resolved.length === 0}
        >
          <Save size={13} /> {t('graph.path.save')}
        </button>
        <button
          type="button"
          onClick={clearPath}
          disabled={path.length === 0}
          aria-label={t('graph.path.clear')}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
