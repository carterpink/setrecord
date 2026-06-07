import { useEffect, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { ArrowRight, Search, Sparkles, Lock } from 'lucide-react'
import { useRecallStore } from '@/stores/recallStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useUiStore } from '@/stores/uiStore'

// Rotating example prompts — cycle while the box is idle to hint at what's
// possible and make the feature feel deep.
const EXAMPLE_COUNT = 24

export function RecallAsk(): React.JSX.Element {
  const { t } = useTranslation('recall')
  const ask = useRecallStore((s) => s.ask)
  const asking = useRecallStore((s) => s.asking)
  const libraryCount = useLibraryStore((s) => s.tracks.length)
  const showModal = useUiStore((s) => s.showModal)

  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)
  const [exampleIdx, setExampleIdx] = useState(0)

  useEffect(() => {
    if (focused || q) return
    const timer = setInterval(() => setExampleIdx((i) => (i + 1) % EXAMPLE_COUNT), 3400)
    return () => clearInterval(timer)
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
            aria-label={t('ask.inputAria')}
          />
          {showGhost && (
            <span className="recall-ask-ghost" key={exampleIdx} aria-hidden="true">
              <Trans
                t={t}
                i18nKey="ask.ghost"
                values={{ example: t(`ask.examples.${exampleIdx}`) }}
                components={[<em key="0" />]}
              />
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
          <span className="recall-ask-searching">{t('ask.searching')}</span>
        ) : (
          <span className="recall-ask-ready">
            <Sparkles size={12} strokeWidth={1.5} /> {t('ask.ready')}
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
            {t('ask.importCta')}
          </button>
          {t('ask.importSuffix')}
        </div>
      ) : (
        <div className="recall-ask-privacy" title={t('ask.privacyTitle')}>
          <Lock size={11} strokeWidth={1.7} />
          {t('ask.searchingCount', { count: libraryCount })}
        </div>
      )}
    </div>
  )
}
