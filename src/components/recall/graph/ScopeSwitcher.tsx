/**
 * ScopeSwitcher.tsx — how much of the library the lens covers.
 *   neighborhood — a readable cluster grown around one seed track (default)
 *   library      — the whole library collapsed into a genre galaxy (click to drill in)
 *   context      — just the tracks in your current Build set
 */

import { useTranslation } from 'react-i18next'
import { Orbit, Globe, Layers } from 'lucide-react'
import { useGraphStore } from '@/stores/graphStore'
import type { GraphScope } from '@/types'

const SCOPES: { id: GraphScope; icon: typeof Orbit }[] = [
  { id: 'neighborhood', icon: Orbit },
  { id: 'library', icon: Globe },
  { id: 'context', icon: Layers }
]

export function ScopeSwitcher(): React.JSX.Element {
  const { t } = useTranslation('recall')
  const scope = useGraphStore((s) => s.scope)
  const setScope = useGraphStore((s) => s.setScope)
  return (
    <div className="graph-scopes" role="tablist" aria-label={t('graph.scopeLabel')}>
      {SCOPES.map(({ id, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={scope === id}
          className={`graph-scope-btn${scope === id ? ' active' : ''}`}
          onClick={() => setScope(id)}
        >
          <Icon size={13} strokeWidth={1.8} />
          {t(`graph.scope.${id}`)}
        </button>
      ))}
    </div>
  )
}
