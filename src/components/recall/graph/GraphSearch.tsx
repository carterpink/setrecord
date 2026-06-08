/**
 * GraphSearch.tsx — find any track and jump to it. Typing filters the library;
 * hovering a result highlights that node (if it's on screen), clicking re-centres
 * the constellation on it. The fast way to navigate a big graph.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { useLibraryStore } from '@/stores/libraryStore'
import { useGraphStore } from '@/stores/graphStore'

const MAX_RESULTS = 8

export function GraphSearch(): React.JSX.Element {
  const { t } = useTranslation('recall')
  const tracks = useLibraryStore((s) => s.tracks)
  const focusTrack = useGraphStore((s) => s.focusTrack)
  const select = useGraphStore((s) => s.select)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (query.length < 2) return []
    const scored: { id: string; title: string; artist: string; idx: number }[] = []
    for (const tr of tracks) {
      if (tr.phantom === true) continue
      const idx = `${tr.title} ${tr.artist}`.toLowerCase().indexOf(query)
      if (idx >= 0) scored.push({ id: tr.id, title: tr.title, artist: tr.artist, idx })
    }
    scored.sort((a, b) => a.idx - b.idx)
    return scored.slice(0, MAX_RESULTS)
  }, [q, tracks])

  const pick = (id: string): void => {
    void focusTrack(id)
    setQ('')
    setOpen(false)
  }

  return (
    <div className="graph-search">
      <Search size={14} strokeWidth={1.8} />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={t('graph.search.placeholder')}
        aria-label={t('graph.search.placeholder')}
      />
      {open && results.length > 0 && (
        <ul className="graph-search-results">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseEnter={() => select(r.id)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(r.id)}
              >
                <span className="gs-title">{r.title}</span>
                <span className="gs-artist">{r.artist}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
