import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { X, Lock } from 'lucide-react'
import type { TagCategory, Track } from '@/types'
import { allCategories } from '@/utils/tagging/taxonomy'
import { useLibraryStore } from '@/stores/libraryStore'
import { useIsPro } from '@/stores/licenseStore'
import { useUiStore } from '@/stores/uiStore'
import { TagChip } from './TagChip'

interface TagEditorPopoverProps {
  track: Track
  onClose: () => void
}

/**
 * Edit a track's tags by hand. Plain-language pickers per category; single-select
 * categories swap, multi-select toggle up to their cap. Saving any category marks
 * it user-owned so re-tagging won't overwrite it. Pro-gated.
 */
export function TagEditorPopover({ track, onClose }: TagEditorPopoverProps): React.ReactPortal {
  const isPro = useIsPro()
  const showUpgrade = useUiStore((s) => s.showUpgrade)
  const setTrackTags = useLibraryStore((s) => s.setTrackTags)
  const resetTrackTagsToAuto = useLibraryStore((s) => s.resetTrackTagsToAuto)
  // Track the live row so edits reflect immediately after the round-trip.
  const live = useLibraryStore((s) => s.tracks.find((t) => t.id === track.id)) ?? track

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function valuesFor(category: TagCategory): string[] {
    return (live.tags ?? []).filter((t) => t.category === category).map((t) => t.value)
  }

  function toggle(category: TagCategory, slug: string, multi: boolean, max: number): void {
    if (!isPro) {
      showUpgrade('autoTagger')
      return
    }
    const current = valuesFor(category)
    let next: string[]
    if (multi) {
      next = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug].slice(-max)
    } else {
      next = current.includes(slug) ? [] : [slug]
    }
    void setTrackTags(track.id, category, next)
  }

  return createPortal(
    <div
      className="combos-overlay"
      role="dialog"
      aria-label={`Edit tags for ${track.title}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="combos-popover glass-3"
        style={{ width: 380, maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div className="combos-header">
          <div>
            <div
              className="ss-label"
              style={{
                color: 'var(--text-tertiary)',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.08em'
              }}
            >
              Tags
            </div>
            <div className="ss-body-sm" style={{ fontWeight: 500 }}>
              {track.title}
            </div>
          </div>
          <button className="smart-filter-dismiss" onClick={onClose} aria-label="Close">
            <X size={12} strokeWidth={2} />
          </button>
        </div>

        {!isPro && (
          <button
            type="button"
            onClick={() => showUpgrade('autoTagger')}
            className="ss-caption"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              padding: '8px 10px',
              margin: '4px 0 10px',
              borderRadius: 8,
              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
              background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
              color: 'var(--accent)',
              cursor: 'pointer'
            }}
          >
            <Lock size={12} strokeWidth={1.7} />
            Editing tags is a Pro feature — upgrade to customise.
          </button>
        )}

        {allCategories().map((cat) => {
          const selected = valuesFor(cat.category)
          return (
            <div key={cat.category} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6
                }}
              >
                <span
                  className="ss-label"
                  style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-tertiary)'
                  }}
                >
                  {cat.label}
                </span>
                {isPro && selected.length > 0 && (
                  <button
                    type="button"
                    className="ss-caption"
                    onClick={() => void resetTrackTagsToAuto(track.id, cat.category)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      fontSize: 10
                    }}
                  >
                    Reset to auto
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {cat.tags.map((t) => {
                  const on = selected.includes(t.slug)
                  return (
                    <TagChip
                      key={t.slug}
                      category={cat.category}
                      value={t.slug}
                      muted={!on}
                      onClick={() => toggle(cat.category, t.slug, cat.multi, cat.maxValues)}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>,
    document.body
  )
}
