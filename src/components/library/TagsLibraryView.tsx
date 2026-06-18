import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, RefreshCw, Upload } from 'lucide-react'
import { useTagStore } from '@/stores/tagStore'
import { useIsPro } from '@/stores/licenseStore'
import { useUiStore } from '@/stores/uiStore'
import { allCategories } from '@/utils/tagging/taxonomy'
import { TagChip } from './tags/TagChip'

interface TagsLibraryViewProps {
  /** Browse all tracks carrying a tag — sets a library filter + jumps to Library. */
  onSelectTag: (slug: string) => void
  /** Open the "Send tags to Rekordbox" flow. */
  onSendToRekordbox: () => void
}

/**
 * The Tags bar. A calm, plain-language home for the auto-tagger: how much of the
 * library is tagged, a one-click re-tag, a faceted browser over every tag, and
 * the one-click "Send to Rekordbox" hand-off. No mention of how tags are computed.
 */
export function TagsLibraryView({
  onSelectTag,
  onSendToRekordbox
}: TagsLibraryViewProps): React.JSX.Element {
  const { t, i18n } = useTranslation('library')
  const coverage = useTagStore((s) => s.coverage)
  const loading = useTagStore((s) => s.loadingCoverage)
  const retagging = useTagStore((s) => s.retagging)
  const progress = useTagStore((s) => s.progress)
  const loadCoverage = useTagStore((s) => s.loadCoverage)
  const retag = useTagStore((s) => s.retag)
  const isPro = useIsPro()
  const showUpgrade = useUiStore((s) => s.showUpgrade)
  // Auto-tagging can be disabled in Settings → Library; gate the retag action.
  const [autoTaggingEnabled, setAutoTaggingEnabled] = useState(true)

  useEffect(() => {
    void loadCoverage()
  }, [loadCoverage])

  useEffect(() => {
    if (typeof window.setrecord === 'undefined') return
    window.setrecord
      .getSettings()
      .then((s) => setAutoTaggingEnabled(s.autoTaggingEnabled ?? true))
      .catch(() => {})
  }, [])

  // value → track count, for the facet badges.
  const countOf = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of coverage?.counts ?? []) m.set(`${c.category}:${c.value}`, c.count)
    return m
  }, [coverage])

  const total = coverage?.totalTracks ?? 0
  const tagged = coverage?.taggedTracks ?? 0
  const pct = total > 0 ? Math.round((tagged / total) * 100) : 0

  return (
    <div className="track-list" style={{ overflowY: 'auto', flex: 1, padding: 14 }}>
      {/* Header: coverage + actions */}
      <div
        className="glass-2"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: 14,
          borderRadius: 12,
          marginBottom: 16
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'color-mix(in srgb, var(--accent) 16%, transparent)',
            color: 'var(--accent)',
            flexShrink: 0
          }}
        >
          <Sparkles size={18} strokeWidth={1.6} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ss-body-sm" style={{ fontWeight: 600 }}>
            {loading && !coverage
              ? t('tags.readingTags')
              : tagged === 0
                ? t('tags.noTagsYet')
                : t('tags.coverage', {
                    tagged: tagged.toLocaleString(i18n.language),
                    total: total.toLocaleString(i18n.language)
                  })}
          </div>
          <div className="ss-caption" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
            {tagged === 0 ? t('tags.noTagsCaption') : t('tags.coverageCaption', { pct })}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void retag()}
          disabled={retagging || !autoTaggingEnabled}
          title={t('tags.retagTitle')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw
            size={13}
            strokeWidth={1.7}
            style={retagging ? { animation: 'spin 1s linear infinite' } : undefined}
          />
          {retagging
            ? progress && progress.total > 0
              ? t('tags.tagging', { processed: progress.processed, total: progress.total })
              : t('tags.taggingShort')
            : t('tags.retag')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={isPro ? onSendToRekordbox : () => showUpgrade('autoTagger')}
          title={isPro ? t('tags.sendTitlePro') : t('tags.sendTitleFree')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Upload size={13} strokeWidth={1.7} />
          {t('tags.sendToRekordbox')}
        </button>
      </div>

      {/* Faceted browser */}
      {allCategories().map((cat) => (
        <div key={cat.category} style={{ marginBottom: 18 }}>
          <div
            className="ss-label"
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-tertiary)',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 3,
                background: cat.accent,
                display: 'inline-block'
              }}
            />
            {cat.label}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cat.tags.map((tag) => {
              const n = countOf.get(`${cat.category}:${tag.slug}`) ?? 0
              return (
                <span
                  key={tag.slug}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <TagChip
                    category={cat.category}
                    value={tag.slug}
                    size="md"
                    muted={n === 0}
                    onClick={n > 0 ? () => onSelectTag(tag.slug) : undefined}
                    title={
                      n > 0
                        ? t('tags.browseTagged', { count: n, label: tag.label })
                        : t('tags.noTracksTagged', { label: tag.label })
                    }
                  />
                  {n > 0 && (
                    <span
                      className="ss-caption"
                      style={{ color: 'var(--text-tertiary)', fontSize: 10 }}
                    >
                      {n}
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
