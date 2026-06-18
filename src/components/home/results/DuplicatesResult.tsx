import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, CircleCheck } from 'lucide-react'
import type { DupeGroupView } from '@/stores/homeStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useToastStore } from '@/stores/toastStore'

interface DuplicatesResultProps {
  groups: DupeGroupView[]
}

const MAX_SHOWN = 3

export function DuplicatesResult({ groups }: DuplicatesResultProps): React.JSX.Element {
  const { t } = useTranslation('home')
  const [cleared, setCleared] = useState<Set<string>>(new Set())

  const remaining = groups.filter((g) => !cleared.has(g.normalisedKey))
  const shown = remaining.slice(0, MAX_SHOWN)
  const more = Math.max(0, remaining.length - shown.length)

  async function clearGroup(g: DupeGroupView): Promise<void> {
    const s = typeof window !== 'undefined' ? window.setrecord : undefined
    if (!s) return
    try {
      await s.recallResolveDuplicateGroup(
        g.normalisedKey,
        g.drop.map((t) => t.id)
      )
      setCleared((prev) => new Set(prev).add(g.normalisedKey))
      void useLibraryStore.getState().loadLibrary()
    } catch {
      useToastStore.getState().push({ kind: 'error', message: t('duplicates.clearGroupError') })
    }
  }

  async function clearAll(): Promise<void> {
    const s = typeof window !== 'undefined' ? window.setrecord : undefined
    if (!s) return
    const keys = remaining.map((g) => g.normalisedKey)
    try {
      await Promise.all(
        remaining.map((g) =>
          s.recallResolveDuplicateGroup(
            g.normalisedKey,
            g.drop.map((t) => t.id)
          )
        )
      )
      setCleared((prev) => {
        const next = new Set(prev)
        keys.forEach((k) => next.add(k))
        return next
      })
      void useLibraryStore.getState().loadLibrary()
      useToastStore
        .getState()
        .push({ kind: 'success', message: t('duplicates.clearedToast', { count: keys.length }) })
    } catch {
      useToastStore.getState().push({ kind: 'error', message: t('duplicates.clearAllError') })
    }
  }

  if (remaining.length === 0) {
    return <div className="answer-note">{t('duplicates.allClear')}</div>
  }

  return (
    <div className="answer">
      <div className="res-head">
        <span className="res-title">{t('duplicates.title', { count: remaining.length })}</span>
        <span className="res-meta">{t('duplicates.meta')}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown.map((g) => (
          <div className="dup-group glass-1" key={g.normalisedKey}>
            <div className="dup-pair">
              <div className="dup-keep">
                <span className="dup-tag keep">{t('duplicates.keep')}</span>
                <div className="track-meta">
                  <div className="t">
                    {g.keep.title} — {g.keep.artist}
                  </div>
                  <div className="a" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {[
                      g.keep.bitrate ? t('duplicates.kbps', { count: g.keep.bitrate }) : null,
                      g.keep.format?.toUpperCase()
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              </div>
              <span className="dup-reason">{g.reason}</span>
            </div>
            {g.drop.map((d) => (
              <div className="dup-pair" key={d.id}>
                <div className="dup-keep">
                  <span className="dup-tag drop">{t('duplicates.drop')}</span>
                  <div className="track-meta">
                    <div className="a" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      {[
                        d.bitrate ? t('duplicates.kbps', { count: d.bitrate }) : null,
                        d.format?.toUpperCase()
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="row-add"
                title={t('duplicates.removeLower')}
                aria-label={t('duplicates.removeLower')}
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                onClick={() => void clearGroup(g)}
              >
                <Trash2 size={15} strokeWidth={1.7} />
              </button>
            </div>
          </div>
        ))}
        <div className="build-head" style={{ marginTop: 2 }}>
          <span className="res-meta">
            {more > 0 ? t('duplicates.moreGrouped', { count: more }) : t('duplicates.thatsAll')}
          </span>
          <button type="button" className="btn btn-primary" onClick={() => void clearAll()}>
            <CircleCheck size={15} strokeWidth={1.7} />
            {t('duplicates.clearAll', { count: remaining.length })}
          </button>
        </div>
      </div>
    </div>
  )
}
