import { Chip } from '@/components/shared/Chip'
import { useDiscoverStore } from '@/stores/discoverStore'
import { DISCOVER_GENRES } from '@/data/discoverGenres'
import type { DiscoverFilters, DiscoverSortMode } from '@/types'

const DURATION_OPTIONS: Array<{ value: DiscoverFilters['durationBuckets'][number]; label: string }> = [
  { value: '<60', label: '<60m' },
  { value: '60-120', label: '60–120m' },
  { value: '120-180', label: '120–180m' },
  { value: '>180', label: '>180m' },
]

const SORT_OPTIONS: Array<{ value: DiscoverSortMode; label: string }> = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'newest', label: 'Newest' },
  { value: 'mostViewed', label: 'Most viewed' },
]

export function DiscoverFilters(): React.JSX.Element {
  const filters = useDiscoverStore((s) => s.filters)
  const setFilter = useDiscoverStore((s) => s.setFilter)
  const sortMode = useDiscoverStore((s) => s.sortMode)
  const setSortMode = useDiscoverStore((s) => s.setSortMode)

  function toggleGenre(g: string): void {
    const next = filters.genres.includes(g)
      ? filters.genres.filter((x) => x !== g)
      : [...filters.genres, g]
    setFilter('genres', next)
  }

  function toggleDuration(d: DiscoverFilters['durationBuckets'][number]): void {
    const next = filters.durationBuckets.includes(d)
      ? filters.durationBuckets.filter((x) => x !== d)
      : [...filters.durationBuckets, d]
    setFilter('durationBuckets', next)
  }

  return (
    <div className="discover-filters">
      <div className="discover-filters-group">
        <span className="discover-filters-label ss-caption">Genre</span>
        {DISCOVER_GENRES.map((g) => (
          <Chip key={g} selected={filters.genres.includes(g)} onClick={() => toggleGenre(g)}>
            {g}
          </Chip>
        ))}
      </div>
      <div className="discover-filters-group">
        <span className="discover-filters-label ss-caption">Duration</span>
        {DURATION_OPTIONS.map((d) => (
          <Chip
            key={d.value}
            selected={filters.durationBuckets.includes(d.value)}
            onClick={() => toggleDuration(d.value)}
          >
            {d.label}
          </Chip>
        ))}
      </div>
      <div className="discover-sort">
        <label htmlFor="discover-sort" className="discover-filters-label ss-caption">
          Sort
        </label>
        <select
          id="discover-sort"
          className="discover-sort-select glass-1"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as DiscoverSortMode)}
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
