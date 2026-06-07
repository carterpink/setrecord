import { useEffect, useMemo, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Search, ArrowRight, Ban } from 'lucide-react'
import type { Track } from '@/types'
import { useRecallStore } from '@/stores/recallStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { NoLibraryState } from '@/components/shared/NoLibraryState'
import { RecallTrackLine } from './RecallTrackLine'

export function CombosSection(): React.JSX.Element {
  const { t } = useTranslation('recall')
  const tracks = useLibraryStore((s) => s.tracks)
  const comboTrack = useRecallStore((s) => s.comboTrack)
  const combos = useRecallStore((s) => s.combos)
  const loading = useRecallStore((s) => s.combosLoading)
  const sequences = useRecallStore((s) => s.sequences)
  const deadEnds = useRecallStore((s) => s.deadEnds)
  const loadCombosFor = useRecallStore((s) => s.loadCombosFor)
  const loadSequences = useRecallStore((s) => s.loadSequences)
  const loadDeadEnds = useRecallStore((s) => s.loadDeadEnds)
  const [query, setQuery] = useState('')

  useEffect(() => {
    void loadSequences()
    void loadDeadEnds()
  }, [loadSequences, loadDeadEnds])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return tracks.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(q)).slice(0, 8)
  }, [query, tracks])

  const pick = (t: Track): void => {
    setQuery('')
    void loadCombosFor(t)
  }

  if (tracks.length === 0) {
    return (
      <div className="recall-section">
        <header className="recall-section-head">
          <h2 className="ss-h2">{t('combos.title')}</h2>
          <p className="recall-section-sub">{t('combos.subtitle')}</p>
        </header>
        <NoLibraryState body={t('combos.emptyBody')} />
      </div>
    )
  }

  return (
    <div className="recall-section">
      <header className="recall-section-head">
        <h2 className="ss-h2">{t('combos.title')}</h2>
        <p className="recall-section-sub">{t('combos.subtitle')}</p>
      </header>

      <div className="recall-combo-search">
        <Search size={16} strokeWidth={1.5} />
        <input
          placeholder={t('combos.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {matches.length > 0 && (
          <div className="recall-combo-matches glass-2">
            {matches.map((t) => (
              <button key={t.id} type="button" onClick={() => pick(t)}>
                <span>{t.title}</span>
                <span className="recall-combo-match-artist">{t.artist}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {comboTrack && (
        <div className="recall-combo-result">
          <div className="recall-combo-from">
            <ArrowRight size={16} strokeWidth={1.5} />
            <Trans
              t={t}
              i18nKey="combos.after"
              values={{ title: comboTrack.title }}
              components={[<strong key="0" />]}
            />
          </div>
          {loading && <div className="recall-empty">{t('combos.tracing')}</div>}
          {!loading && combos.length === 0 && (
            <div className="recall-empty">{t('combos.noTransitions')}</div>
          )}
          <div className="recall-list">
            {combos.map((c) => (
              <RecallTrackLine
                key={c.track.id}
                track={c.track}
                compact
                badge={
                  <span className="recall-combo-count">
                    {t('combos.count', { count: c.count })}
                  </span>
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="recall-sequences">
        <h3 className="ss-h3">{t('combos.sequencesTitle')}</h3>
        <p className="recall-section-sub">{t('combos.sequencesSubtitle')}</p>
        {sequences.length === 0 && <div className="recall-empty">{t('combos.sequencesEmpty')}</div>}
        {sequences.map((seq, i) => (
          <div className="recall-sequence glass-2" key={i}>
            <span className="recall-sequence-tracks">
              {seq.tracks.map((t, j) => (
                <span
                  key={t.id}
                  className="recall-sequence-item"
                  title={`${t.title} — ${t.artist}`}
                >
                  {t.title}
                  {j < seq.tracks.length - 1 && <ArrowRight size={12} strokeWidth={1.5} />}
                </span>
              ))}
            </span>
            <span className="recall-combo-count">{t('combos.count', { count: seq.count })}</span>
          </div>
        ))}
      </div>

      <div className="recall-deadends">
        <h3 className="ss-h3">
          <Ban size={14} strokeWidth={1.5} style={{ marginRight: 6, verticalAlign: -2 }} />
          {t('combos.deadEndsTitle')}
        </h3>
        <p className="recall-section-sub">{t('combos.deadEndsSubtitle')}</p>
        {deadEnds.length === 0 ? (
          <div className="recall-empty">{t('combos.deadEndsEmpty')}</div>
        ) : (
          <div className="recall-list">
            {deadEnds.slice(0, 10).map((d) => (
              <RecallTrackLine
                key={d.track.id}
                track={d.track}
                compact
                badge={
                  <span className="recall-combo-count">
                    {t('combos.ended', { count: d.count })}
                  </span>
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
