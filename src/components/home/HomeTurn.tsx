import { ArrowRight } from 'lucide-react'
import { useRecallStore } from '@/stores/recallStore'
import type { HomeTurn as HomeTurnT } from '@/stores/homeStore'
import type { HomeFilters } from '@/utils/homeQuery'
import { Interpret } from './Interpret'
import { ForgottenResult } from './results/ForgottenResult'
import { WarmupResult } from './results/WarmupResult'
import { AfterResult } from './results/AfterResult'
import { DuplicatesResult } from './results/DuplicatesResult'
import { GenericResult } from './results/GenericResult'

interface HomeTurnProps {
  turn: HomeTurnT
  onRerun: (turnId: string, filters: HomeFilters) => void
  onFollow: (query: string) => void
}

function ResultBody({ turn }: { turn: HomeTurnT }): React.JSX.Element | null {
  const r = turn.result
  if (!r) return null
  switch (r.kind) {
    case 'forgotten':
      return <ForgottenResult tracks={r.tracks} requested={r.requested} />
    case 'warmup':
      return (
        <WarmupResult
          setTracks={r.setTracks}
          params={r.params}
          startBpm={r.startBpm}
          targetBpm={r.targetBpm}
          name={r.name}
        />
      )
    case 'after':
      return <AfterResult source={r.source} candidates={r.candidates} harmonic={r.harmonic} />
    case 'duplicates':
      return <DuplicatesResult groups={r.groups} />
    default:
      return <GenericResult result={r} query={turn.query} />
  }
}

export function HomeTurn({ turn, onRerun, onFollow }: HomeTurnProps): React.JSX.Element {
  const aiStatus = useRecallStore((s) => s.aiStatus)

  if (turn.pending) {
    const warming =
      turn.usesModel && (aiStatus?.state === 'downloading' || aiStatus?.state === 'loading')
    return (
      <div className="turn">
        <div className="user-line">{turn.query}</div>
        <div className="thinking-line" role="status" aria-live="polite" aria-atomic="true">
          <span className="thinking-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          {warming
            ? 'Getting ready — this happens once, then it’s instant.'
            : 'Reading your library…'}
        </div>
      </div>
    )
  }

  return (
    <div className="turn">
      <div className="user-line">{turn.query}</div>
      <div className="answer" role="region" aria-label="Answer">
        {/* Concise SR announcement that the answer is ready — avoids reading the whole list aloud */}
        <span className="sr-only" role="status" aria-live="polite">
          {turn.summary ? `Results ready: ${turn.summary}` : 'Results ready'}
        </span>
        <Interpret key={turn.summary} filters={turn.filters} onRerun={(f) => onRerun(turn.id, f)} />
        <ResultBody turn={turn} />
        {turn.followups.length > 0 && (
          <div className="followups">
            {turn.followups.map((fu, i) => (
              <button type="button" className="followup" key={i} onClick={() => onFollow(fu)}>
                <ArrowRight size={14} strokeWidth={1.6} />
                {fu}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
