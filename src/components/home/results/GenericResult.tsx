import { useTranslation } from 'react-i18next'
import { ArrowRight, ListPlus, Save } from 'lucide-react'
import type { Track } from '@/types'
import { RecallTrackLine } from '@/components/recall/RecallTrackLine'
import { useSetStore } from '@/stores/setStore'
import type { HomeResult } from '@/stores/homeStore'

/** Renders the non-bespoke result kinds (search hits, combos, sequences, stats, empty). */
export function GenericResult({
  result,
  query
}: {
  result: HomeResult
  query: string
}): React.JSX.Element | null {
  const { t } = useTranslation('home')
  const createSetFromTracks = useSetStore((s) => s.createSetFromTracks)
  const addTracksToCurrent = useSetStore((s) => s.addTracksToCurrent)

  if (result.kind === 'empty') {
    return <div className="answer-note">{result.note}</div>
  }

  if (result.kind === 'tracks') {
    const tracks: Track[] = result.tracks
    const name = query.slice(0, 48) || t('generic.libraryPicks')
    return (
      <div className="answer">
        <div className="res-head">
          <span className="res-title">{t('generic.tracksTitle', { count: tracks.length })}</span>
          <span className="res-meta">{result.narration}</span>
        </div>
        <div className="recall-conv-actions">
          <button
            type="button"
            className="recall-conv-save"
            onClick={() => createSetFromTracks(name, tracks)}
          >
            <Save size={13} strokeWidth={1.7} /> {t('generic.saveAsSet')}
          </button>
          <button
            type="button"
            className="recall-conv-save"
            onClick={() => addTracksToCurrent(tracks)}
          >
            <ListPlus size={13} strokeWidth={1.7} /> {t('generic.addToCurrentSet')}
          </button>
        </div>
        <div className="recall-list">
          {tracks.slice(0, 150).map((t) => (
            <RecallTrackLine key={t.id} track={t} />
          ))}
        </div>
      </div>
    )
  }

  if (result.kind === 'count') {
    return (
      <div className="answer">
        <div className="res-head">
          <span className="res-title">{t('generic.countTitle', { count: result.count })}</span>
          <span className="res-meta">{result.narration}</span>
        </div>
        {result.sample.length > 0 && (
          <div className="recall-list">
            {result.sample.map((t) => (
              <RecallTrackLine key={t.id} track={t} />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (result.kind === 'combos') {
    return (
      <div className="answer">
        <div className="res-head">
          <span className="res-meta">{result.narration}</span>
        </div>
        <div className="recall-list">
          {result.combos.map((c) => (
            <RecallTrackLine
              key={c.track.id}
              track={c.track}
              badge={<span className="recall-combo-count">{c.count}×</span>}
            />
          ))}
        </div>
      </div>
    )
  }

  if (result.kind === 'sequences') {
    return (
      <div className="answer">
        <div className="res-head">
          <span className="res-meta">{result.narration}</span>
        </div>
        <div className="recall-sequences">
          {result.sequences.map((seq, i) => (
            <div className="recall-sequence glass-2" key={i}>
              <span className="recall-sequence-tracks">
                {seq.tracks.map((t, j) => (
                  <span key={t.id} className="recall-sequence-item">
                    {t.title}
                    {j < seq.tracks.length - 1 && <ArrowRight size={12} strokeWidth={1.5} />}
                  </span>
                ))}
              </span>
              {seq.count > 0 && <span className="recall-combo-count">{seq.count}×</span>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // The bespoke kinds (forgotten/warmup/after/duplicates) are rendered by their
  // own components; GenericResult only handles the remaining 'stats' kind here.
  if (result.kind !== 'stats') return null
  return (
    <div className="answer">
      <div className="res-head">
        <span className="res-meta">{result.narration}</span>
      </div>
      <div className="stat-grid">
        {result.stats.map((s) => (
          <div className="stat-cell glass-2" key={s.label}>
            <span className="v">{s.value}</span>
            <span className="k">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
