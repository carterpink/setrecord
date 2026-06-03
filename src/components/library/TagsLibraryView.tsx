import { useEffect, useMemo } from 'react'
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
  const coverage = useTagStore((s) => s.coverage)
  const loading = useTagStore((s) => s.loadingCoverage)
  const retagging = useTagStore((s) => s.retagging)
  const progress = useTagStore((s) => s.progress)
  const loadCoverage = useTagStore((s) => s.loadCoverage)
  const retag = useTagStore((s) => s.retag)
  const isPro = useIsPro()
  const showUpgrade = useUiStore((s) => s.showUpgrade)

  useEffect(() => {
    void loadCoverage()
  }, [loadCoverage])

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
              ? 'Reading your tags…'
              : tagged === 0
                ? 'No tags yet'
                : `${tagged.toLocaleString()} of ${total.toLocaleString()} tracks tagged`}
          </div>
          <div className="ss-caption" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
            {tagged === 0
              ? 'Tags appear automatically as your library is analysed.'
              : `Vibe, Energy, Best for and more — ${pct}% covered.`}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void retag()}
          disabled={retagging}
          title="Re-tag the whole library"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw
            size={13}
            strokeWidth={1.7}
            style={retagging ? { animation: 'spin 1s linear infinite' } : undefined}
          />
          {retagging
            ? progress && progress.total > 0
              ? `Tagging ${progress.processed}/${progress.total}`
              : 'Tagging…'
            : 'Re-tag library'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={isPro ? onSendToRekordbox : () => showUpgrade('autoTagger')}
          title={
            isPro ? 'Write these tags into Rekordbox' : 'Sending tags to Rekordbox is a Pro feature'
          }
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Upload size={13} strokeWidth={1.7} />
          Send to Rekordbox
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
            {cat.tags.map((t) => {
              const n = countOf.get(`${cat.category}:${t.slug}`) ?? 0
              return (
                <span key={t.slug} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <TagChip
                    category={cat.category}
                    value={t.slug}
                    size="md"
                    muted={n === 0}
                    onClick={n > 0 ? () => onSelectTag(t.slug) : undefined}
                    title={
                      n > 0 ? `Browse ${n} tracks tagged ${t.label}` : `No tracks tagged ${t.label}`
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
