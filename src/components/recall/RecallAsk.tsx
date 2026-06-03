import { useEffect, useState } from 'react'
import { ArrowRight, Search, Sparkles, Lock } from 'lucide-react'
import { useRecallStore } from '@/stores/recallStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useUiStore } from '@/stores/uiStore'

// Rotating example prompts — cycle while the box is idle to hint at what's
// possible and make the feature feel deep.
const EXAMPLES = [
  '15 UK garage tracks I play the most',
  '10 peak-hour tech house bangers',
  'deep house around 122 bpm',
  'melodic techno 124–128 bpm',
  'my forgotten gems',
  'tracks I’ve never tested live',
  'highest-rated drum & bass',
  'chilled warmup tracks',
  'hard techno over 135 bpm',
  'my most common transitions',
  'groovy house 123 bpm, never played',
  'my best closers',
  'afro house 120–124 bpm',
  'surprise me with 8 bangers',
  'amapiano around 112 bpm',
  'my go-to openers',
  'overplayed tracks to retire',
  'newest deep house I added',
  'uk garage 130 bpm',
  'what I open sets with',
  'songs I played at Hi Ibiza',
  'all sets in July 2025',
  'tech house I played in 2025',
  'my festival sets'
]

export function RecallAsk(): React.JSX.Element {
  const ask = useRecallStore((s) => s.ask)
  const asking = useRecallStore((s) => s.asking)
  const libraryCount = useLibraryStore((s) => s.tracks.length)
  const showModal = useUiStore((s) => s.showModal)

  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)
  const [exampleIdx, setExampleIdx] = useState(0)

  useEffect(() => {
    if (focused || q) return
    const t = setInterval(() => setExampleIdx((i) => (i + 1) % EXAMPLES.length), 3400)
    return () => clearInterval(t)
  }, [focused, q])

  const showGhost = !focused && q === '' && !asking

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!q.trim()) return
    void ask(q)
    setQ('')
  }

  return (
    <div className="recall-ask-wrap">
      <form className={`recall-ask-input glass-2${asking ? ' busy' : ''}`} onSubmit={submit}>
        <Search size={16} strokeWidth={1.5} />
        <div className="recall-ask-field">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="Ask your library"
          />
          {showGhost && (
            <span className="recall-ask-ghost" key={exampleIdx} aria-hidden="true">
              ask your library… <em>{EXAMPLES[exampleIdx]}</em>
            </span>
          )}
        </div>
        <button type="submit" className="recall-ask-go" disabled={asking || q.trim() === ''}>
          {asking ? (
            <span className="recall-ask-spinner" />
          ) : (
            <ArrowRight size={16} strokeWidth={1.5} />
          )}
        </button>
        {asking && <div className="recall-ask-beam" aria-hidden="true" />}
      </form>

      <div className="recall-ask-statusline" role="status" aria-live="polite" aria-atomic="true">
        {asking ? (
          <span className="recall-ask-searching">Searching your library…</span>
        ) : (
          <span className="recall-ask-ready">
            <Sparkles size={12} strokeWidth={1.5} /> Ask your library in plain English, then keep
            refining
          </span>
        )}
      </div>

      {libraryCount === 0 ? (
        <div className="recall-ask-privacy">
          <Lock size={11} strokeWidth={1.7} />
          <button
            type="button"
            onClick={() => showModal('import')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              padding: 0,
              font: 'inherit'
            }}
          >
            Import your library
          </button>
          &nbsp;to start asking — nothing ever leaves your Mac.
        </div>
      ) : (
        <div className="recall-ask-privacy" title="All Recall search runs locally — no API calls.">
          <Lock size={11} strokeWidth={1.7} />
          Searching your library of {libraryCount.toLocaleString()} tracks — nothing leaves your
          Mac.
        </div>
      )}
    </div>
  )
}
