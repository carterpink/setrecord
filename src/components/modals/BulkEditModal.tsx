import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/shared/Modal'
import { useSelectionStore } from '@/stores/selectionStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useUiStore } from '@/stores/uiStore'
import { useToastStore } from '@/stores/toastStore'
import { allCategories } from '@/utils/tagging/taxonomy'
import type { TagCategory } from '@/types'

const CAMELOT_KEYS = [
  '1A',
  '2A',
  '3A',
  '4A',
  '5A',
  '6A',
  '7A',
  '8A',
  '9A',
  '10A',
  '11A',
  '12A',
  '1B',
  '2B',
  '3B',
  '4B',
  '5B',
  '6B',
  '7B',
  '8B',
  '9B',
  '10B',
  '11B',
  '12B'
]

type Tab = 'tags' | 'energy' | 'meta'
type TagMode = 'add' | 'remove' | 'replace'

export function BulkEditModal(): React.JSX.Element {
  const { t } = useTranslation('power')
  const closeModal = useUiStore((s) => s.closeModal)
  const selectedIds = useSelectionStore((s) => s.selectedIds)
  const clearSelection = useSelectionStore((s) => s.clear)
  const ids = useMemo(() => [...selectedIds], [selectedIds])
  const count = ids.length
  const toast = useToastStore.getState()

  const [tab, setTab] = useState<Tab>('tags')
  const [busy, setBusy] = useState(false)

  // Tags tab state
  const categories = allCategories()
  const [category, setCategory] = useState<TagCategory>(categories[0]?.category ?? 'vibe')
  const [tagSlugs, setTagSlugs] = useState<string[]>([])
  const [tagMode, setTagMode] = useState<TagMode>('add')
  const activeCat = categories.find((c) => c.category === category)

  // Energy tab state
  const [energy, setEnergy] = useState<number | null>(null)

  // Metadata tab state
  const [bpm, setBpm] = useState('')
  const [key, setKey] = useState('')
  const [genre, setGenre] = useState('')
  const [rating, setRating] = useState('')
  const [comment, setComment] = useState('')

  function finish(messageKey: string): void {
    toast.success(t(messageKey, { count }))
    clearSelection()
    closeModal()
  }

  async function applyTags(): Promise<void> {
    if (tagSlugs.length === 0 && tagMode !== 'replace') return
    setBusy(true)
    const ok = await useLibraryStore.getState().bulkSetTags(ids, category, tagSlugs, tagMode)
    setBusy(false)
    if (ok) finish('bulkEdit.applied')
    else useUiStore.getState().showUpgrade('bulkEdit')
  }
  async function applyEnergy(): Promise<void> {
    if (energy == null) return
    setBusy(true)
    const ok = await useLibraryStore.getState().bulkSetEnergy(ids, energy)
    setBusy(false)
    if (ok) finish('bulkEdit.applied')
    else useUiStore.getState().showUpgrade('bulkEdit')
  }
  async function applyMeta(): Promise<void> {
    const patch: {
      bpm?: number
      key?: string
      genre?: string
      rating?: number
      comment?: string
    } = {}
    if (bpm.trim() && !Number.isNaN(Number(bpm))) patch.bpm = Number(bpm)
    if (key) patch.key = key
    if (genre.trim()) patch.genre = genre.trim()
    if (rating.trim() && !Number.isNaN(Number(rating))) patch.rating = Number(rating)
    if (comment.trim()) patch.comment = comment.trim()
    if (Object.keys(patch).length === 0) return
    setBusy(true)
    const ok = await useLibraryStore.getState().bulkUpdateMeta(ids, patch)
    setBusy(false)
    if (ok) finish('bulkEdit.applied')
    else useUiStore.getState().showUpgrade('bulkEdit')
  }

  return (
    <Modal
      onClose={closeModal}
      labelledById="bulk-edit-title"
      maxWidth={460}
      bloom={{ icon: 'tag', tone: 'lime' }}
    >
      <h2 id="bulk-edit-title" className="modal-title">
        {t('bulkEdit.title', { count })}
      </h2>
      <p className="modal-subtitle">{t('bulkEdit.subtitle')}</p>

      <div className="bulk-edit-tabs" role="tablist">
        {(['tags', 'energy', 'meta'] as Tab[]).map((tb) => (
          <button
            key={tb}
            type="button"
            role="tab"
            aria-selected={tab === tb}
            className={`bulk-edit-tab${tab === tb ? ' active' : ''}`}
            onClick={() => setTab(tb)}
          >
            {t(
              tb === 'tags'
                ? 'bulkEdit.tabTags'
                : tb === 'energy'
                  ? 'bulkEdit.tabEnergy'
                  : 'bulkEdit.tabMeta'
            )}
          </button>
        ))}
      </div>

      {tab === 'tags' && (
        <div className="bulk-edit-body">
          <label className="bulk-edit-field">
            <span>{t('bulkEdit.tagCategory')}</span>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as TagCategory)
                setTagSlugs([])
              }}
            >
              {categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div className="bulk-edit-chips">
            {activeCat?.tags.map((tag) => {
              const on = tagSlugs.includes(tag.slug)
              return (
                <button
                  key={tag.slug}
                  type="button"
                  className={`bulk-edit-chip${on ? ' active' : ''}`}
                  onClick={() =>
                    setTagSlugs((prev) =>
                      on ? prev.filter((s) => s !== tag.slug) : [...prev, tag.slug]
                    )
                  }
                >
                  {tag.label}
                </button>
              )
            })}
          </div>
          <div className="bulk-edit-modes">
            {(['add', 'remove', 'replace'] as TagMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`bulk-edit-mode${tagMode === m ? ' active' : ''}`}
                onClick={() => setTagMode(m)}
              >
                {t(
                  m === 'add'
                    ? 'bulkEdit.tagAdd'
                    : m === 'remove'
                      ? 'bulkEdit.tagRemove'
                      : 'bulkEdit.tagReplace'
                )}
              </button>
            ))}
          </div>
          <BulkActions
            onCancel={closeModal}
            onApply={() => void applyTags()}
            busy={busy}
            count={count}
            t={t}
          />
        </div>
      )}

      {tab === 'energy' && (
        <div className="bulk-edit-body">
          <span className="bulk-edit-label">{t('bulkEdit.energyLabel')}</span>
          <div className="bulk-edit-energy">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`bulk-edit-energy-btn${energy === n ? ' active' : ''}`}
                onClick={() => setEnergy(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <BulkActions
            onCancel={closeModal}
            onApply={() => void applyEnergy()}
            busy={busy || energy == null}
            count={count}
            t={t}
          />
        </div>
      )}

      {tab === 'meta' && (
        <div className="bulk-edit-body">
          <span className="bulk-edit-hint">{t('bulkEdit.leaveBlank')}</span>
          <div className="bulk-edit-grid">
            <label className="bulk-edit-field">
              <span>{t('bulkEdit.bpm')}</span>
              <input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} />
            </label>
            <label className="bulk-edit-field">
              <span>{t('bulkEdit.key')}</span>
              <select value={key} onChange={(e) => setKey(e.target.value)}>
                <option value="">—</option>
                {CAMELOT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="bulk-edit-field">
              <span>{t('bulkEdit.genre')}</span>
              <input type="text" value={genre} onChange={(e) => setGenre(e.target.value)} />
            </label>
            <label className="bulk-edit-field">
              <span>{t('bulkEdit.rating')}</span>
              <select value={rating} onChange={(e) => setRating(e.target.value)}>
                <option value="">—</option>
                {[0, 1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="bulk-edit-field">
            <span>{t('bulkEdit.comment')}</span>
            <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <BulkActions
            onCancel={closeModal}
            onApply={() => void applyMeta()}
            busy={busy}
            count={count}
            t={t}
          />
        </div>
      )}
    </Modal>
  )
}

function BulkActions({
  onCancel,
  onApply,
  busy,
  count,
  t
}: {
  onCancel: () => void
  onApply: () => void
  busy: boolean
  count: number
  t: (k: string, o?: Record<string, unknown>) => string
}): React.JSX.Element {
  return (
    <div className="bulk-edit-actions">
      <button type="button" className="btn-ghost" onClick={onCancel}>
        {t('bulkEdit.cancel')}
      </button>
      <button type="button" className="btn-primary" disabled={busy} onClick={onApply}>
        {t('bulkEdit.apply', { count })}
      </button>
    </div>
  )
}
