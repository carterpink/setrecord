import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { useRecallStore } from '@/stores/recallStore'
import { RecallTrackLine } from './RecallTrackLine'

export function RediscoverSection(): React.JSX.Element {
  const gems = useRecallStore((s) => s.gems)
  const loading = useRecallStore((s) => s.gemsLoading)
  const loadGems = useRecallStore((s) => s.loadGems)

  useEffect(() => {
    void loadGems()
  }, [loadGems])

  return (
    <div className="recall-section">
      <header className="recall-section-head">
        <h2 className="ss-h2">Rediscover</h2>
        <p className="recall-section-sub">
          Tracks you used to play, gathering dust. Pull one back into rotation.
        </p>
      </header>

      {loading && <div className="recall-empty">Digging through your crates…</div>}

      {!loading && gems.length === 0 && (
        <div className="recall-empty">
          <Sparkles size={20} strokeWidth={1.5} />
          <span>No forgotten gems yet — play history grows this over time.</span>
        </div>
      )}

      <div className="recall-list">
        {gems.map((gem) => (
          <RecallTrackLine key={gem.track.id} track={gem.track} note={gem.reason} />
        ))}
      </div>
    </div>
  )
}
