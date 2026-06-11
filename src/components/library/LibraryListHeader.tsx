import { useTranslation } from 'react-i18next'

const COLUMNS = [
  'artist',
  'title',
  'bpm',
  'key',
  'energy',
  'dateAdded',
  'playCount',
  'duration',
  'rating'
] as const

export type SortColumn = (typeof COLUMNS)[number]

interface Props {
  sortField: string
  sortDir: 'asc' | 'desc'
  onSort: (field: SortColumn) => void
}

/**
 * Click-to-sort column header strip shown above the (standard-density) library
 * list. Clicking the active column flips the direction; clicking another switches
 * to it. The sort dropdown in the toolbar stays as the compact-density fallback.
 */
export function LibraryListHeader({ sortField, sortDir, onSort }: Props): React.JSX.Element {
  const { t } = useTranslation('power')
  return (
    <div className="library-list-header" role="row">
      {COLUMNS.map((col) => {
        const active = sortField === col
        return (
          <button
            key={col}
            type="button"
            className={`library-list-header-col${active ? ' active' : ''}`}
            aria-pressed={active}
            title={active ? (sortDir === 'asc' ? 'Ascending' : 'Descending') : undefined}
            onClick={() => onSort(col)}
          >
            {t(`columns.${col}`)}
            {active && (
              <span className="library-list-header-caret">{sortDir === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
