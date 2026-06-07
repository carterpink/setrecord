import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { Track } from '@/types'
import { formatBpm } from '@/utils/format'
import { KeyChip } from '@/components/shared/KeyChip'
import { usePlaybackStore } from '@/stores/playbackStore'
import type { AfterCandidate } from '@/stores/homeStore'

interface AfterResultProps {
  source: Track | null
  candidates: AfterCandidate[]
  harmonic: boolean
}

interface Chip {
  text: string
  accent?: boolean
}

function chipsFor(source: Track, track: Track, count: number, best: boolean, t: TFunction): Chip[] {
  const chips: Chip[] = []
  if (track.key && source.key && track.key === source.key)
    chips.push({ text: t('after.chips.sameKey'), accent: best })
  const delta = Math.round((track.bpm ?? 0) - (source.bpm ?? 0))
  if (delta !== 0)
    chips.push({ text: t('after.chips.bpmDelta', { delta: `${delta > 0 ? '+' : ''}${delta}` }) })
  const e = (track.energy ?? 0) - (source.energy ?? 0)
  chips.push({
    text: e > 1 ? t('after.chips.lifts') : e < -1 ? t('after.chips.eases') : t('after.chips.holds')
  })
  if (count > 0) chips.push({ text: t('after.chips.doneThis', { count }) })
  return chips
}

export function AfterResult({ source, candidates, harmonic }: AfterResultProps): React.JSX.Element {
  const { t } = useTranslation('home')
  const startPreview = usePlaybackStore((s) => s.startPreview)
  if (!source) return <div className="answer-note">{t('after.notFound')}</div>

  const n = candidates.length
  const title =
    n === 1
      ? t('after.titleOne', { title: source.title })
      : t('after.titleOther', { count: n, title: source.title })

  return (
    <div className="answer">
      <div className="res-head">
        <span className="res-title">{title}</span>
        <span className="res-meta">
          {harmonic ? t('after.harmonicFrom') : t('after.fromSets')}
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {source.key || '—'} · {formatBpm(source.bpm)}
          </span>
        </span>
      </div>
      <div className="sugg-stack">
        {candidates.map((c, i) => {
          const best = i === 0
          return (
            <div
              className={`sugg-card ${best ? 'glass-3 best' : 'glass-2'}`}
              key={c.track.id}
              role="button"
              tabIndex={0}
              onClick={() => startPreview(c.track)}
            >
              {best && <span className="best-badge">{t('after.bestMatch')}</span>}
              <div className="sugg-row" style={{ marginTop: best ? 6 : 0 }}>
                <div>
                  <div className="sugg-title">{c.track.title}</div>
                  <div className="sugg-artist">{c.track.artist}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="sugg-mono">{formatBpm(c.track.bpm)}</div>
                  {c.track.key && (
                    <div style={{ marginTop: 4 }}>
                      <KeyChip>{c.track.key}</KeyChip>
                    </div>
                  )}
                </div>
              </div>
              <div className="reason-chips">
                {chipsFor(source, c.track, c.count, best, t).map((chip, j) => (
                  <span key={j} className={`reason-chip${chip.accent ? ' accent' : ''}`}>
                    {chip.text}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
