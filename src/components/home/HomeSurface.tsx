import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import {
  History,
  Layers,
  Clock,
  Disc3,
  Copy,
  Plus,
  X,
  Trash2,
  MessageSquare,
  Sparkles
} from 'lucide-react'
import { useHomeStore } from '@/stores/homeStore'
import { useRecallStore } from '@/stores/recallStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useUiStore } from '@/stores/uiStore'
import { useCanUse, useIsPro } from '@/stores/licenseStore'
import { useToastStore } from '@/stores/toastStore'
import { useVoiceCapture } from '@/hooks/useVoiceCapture'
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist'
import { CompletenessMeter } from '@/components/onboarding/CompletenessMeter'
import { StreakChip } from '@/components/onboarding/StreakChip'
import { Composer, type ComposerPhase } from './Composer'
import { HomeTurn } from './HomeTurn'

const PLACEHOLDER_KEYS = ['placeholders.talk', 'placeholders.build', 'placeholders.tonight']

function greetingParts(locale: string): { eyebrow: string; lineKey: string } {
  const d = new Date()
  const h = d.getHours()
  const day = d.toLocaleDateString(locale, { weekday: 'long' })
  const time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
  const lineKey =
    h >= 22 || h < 5
      ? 'greeting.lateOne'
      : h < 12
        ? 'greeting.morning'
        : h < 18
          ? 'greeting.afternoon'
          : 'greeting.evening'
  return { eyebrow: `${day} · ${time}`.toUpperCase(), lineKey }
}

function HistoryDrawer({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation('home')
  const conversations = useHomeStore((s) => s.conversations)
  const currentId = useHomeStore((s) => s.currentId)
  const selectConversation = useHomeStore((s) => s.selectConversation)
  const deleteConversation = useHomeStore((s) => s.deleteConversation)
  const newConversation = useHomeStore((s) => s.newConversation)
  const isPro = useIsPro()
  const showUpgrade = useUiStore((s) => s.showUpgrade)

  return (
    <>
      <div className="home-history-backdrop" onClick={onClose} />
      <aside className="home-history glass-2">
        <div className="home-history-head">
          <h3>{t('history.title')}</h3>
          <button
            type="button"
            className="home-history-del"
            aria-label={t('history.closeAria')}
            onClick={onClose}
          >
            <X size={16} strokeWidth={1.7} />
          </button>
        </div>
        <button
          type="button"
          className="home-history-new"
          onClick={() => {
            newConversation()
            onClose()
          }}
        >
          <Plus size={15} strokeWidth={1.7} /> {t('history.newConversation')}
        </button>
        <div className="home-history-items">
          {!isPro && (
            <button
              type="button"
              className="home-history-upsell"
              onClick={() => {
                showUpgrade('recall')
                onClose()
              }}
            >
              <Sparkles size={14} strokeWidth={1.7} />
              <span>
                <Trans t={t} i18nKey="history.upsell" components={[<strong key="0" />]} />
              </span>
            </button>
          )}
          {conversations.length === 0 && (
            <span className="home-history-empty">{t('history.empty')}</span>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              className={`home-history-item${c.id === currentId ? ' active' : ''}`}
              onClick={() => {
                void selectConversation(c.id)
                onClose()
              }}
            >
              <MessageSquare size={14} strokeWidth={1.5} />
              <span className="home-history-title">{c.title}</span>
              <button
                type="button"
                className="home-history-del"
                aria-label={t('history.deleteAria')}
                onClick={(e) => {
                  e.stopPropagation()
                  deleteConversation(c.id)
                }}
              >
                <Trash2 size={13} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}

export function HomeSurface(): React.JSX.Element {
  const { t, i18n } = useTranslation('home')
  const turns = useHomeStore((s) => s.turns)
  const run = useHomeStore((s) => s.run)
  const rerun = useHomeStore((s) => s.rerun)
  const loadAiStatus = useRecallStore((s) => s.loadAiStatus)
  const subscribeAiProgress = useRecallStore((s) => s.subscribeAiProgress)
  const showUpgrade = useUiStore((s) => s.showUpgrade)
  const voiceInputEnabled = useUiStore((s) => s.voiceInputEnabled)
  const canUse = useCanUse('recall')
  const tracks = useLibraryStore((s) => s.tracks)

  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [phIdx] = useState(() => Math.floor(Math.random() * PLACEHOLDER_KEYS.length))

  const scrollRef = useRef<HTMLDivElement>(null)
  const greet = useMemo(() => greetingParts(i18n.language), [i18n.language])

  const voice = useVoiceCapture({
    onInterim: (text) => setValue(text),
    onResult: (text) => submit(text),
    onError: (message) => useToastStore.getState().push({ kind: 'info', message })
  })

  const pending = turns.some((t) => t.pending)
  const active = turns.length > 0
  const phase: ComposerPhase = voice.listening ? 'listening' : pending ? 'thinking' : 'idle'

  // A real track name makes the "what do I play after…" example land.
  const sampleTitle = useMemo(() => {
    const mostPlayed = [...tracks].sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))[0]
    return mostPlayed?.title ?? tracks[0]?.title ?? 'this'
  }, [tracks])

  const examples = useMemo(
    () => [
      { icon: Clock, text: t('examples.forgotten') },
      { icon: Layers, text: t('examples.warmup') },
      { icon: Disc3, text: t('examples.after', { title: sampleTitle }) },
      { icon: Copy, text: t('examples.duplicates') }
    ],
    [sampleTitle, t]
  )

  // Load + subscribe to model status so the "happens once" framing can appear.
  useEffect(() => {
    void loadAiStatus()
    const unsub = subscribeAiProgress()
    return unsub
  }, [loadAiStatus, subscribeAiProgress])

  // Autoscroll the thread on new content.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [turns])

  function submit(text: string): void {
    const q = text.trim()
    if (!q) return
    // Asking is a free, unlimited taste — never walled. The upgrade reason lives
    // at the capture moment instead (saving the conversation, exporting/keeping a
    // built set), so the front door always demos the magic. See homeStore.persist.
    setValue('')
    void run(q)
  }

  function onMicToggle(): void {
    if (voice.listening) {
      void voice.stop()
    } else if (voice.available) {
      void voice.start()
    } else {
      useToastStore.getState().push({ kind: 'info', message: t('voice.unavailable') })
    }
  }

  // One-time on-device voice setup feedback (download / load), or a friendly
  // error if it couldn't start. Silent once the model is ready.
  const voiceSetup = (() => {
    const st = voice.status
    if (!st) return null
    if (st.state === 'downloading') {
      const pct = Math.round((st.progress ?? 0) * 100)
      return (
        <div className="voice-setup">
          <span className="voice-setup-spinner" />
          {t('voice.settingUp', { pct })}
        </div>
      )
    }
    if (st.state === 'loading') {
      return (
        <div className="voice-setup">
          <span className="voice-setup-spinner" />
          {t('voice.starting')}
        </div>
      )
    }
    if (st.state === 'error' && st.error) {
      return <div className="voice-setup error">{st.error}</div>
    }
    return null
  })()

  const composer = (
    <Composer
      phase={phase}
      value={value}
      onChange={setValue}
      onSubmit={() => submit(value)}
      onMicToggle={onMicToggle}
      showMic={voiceInputEnabled}
      level={voice.listening ? voice.level : undefined}
      compact={active}
      focused={focused}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={t(PLACEHOLDER_KEYS[phIdx])}
    />
  )

  return (
    <div className="home">
      <div className="home-aurora" aria-hidden="true" />
      <div className="home-vignette" aria-hidden="true" />

      <div className="home-top">
        <div className="home-top-right">
          <button type="button" className="workspace-link" onClick={() => setHistoryOpen(true)}>
            <History size={15} strokeWidth={1.6} />
            {t('topBar.history')}
          </button>
        </div>
      </div>

      <div className="stage">
        {!active ? (
          <div className="greet-wrap">
            <div className="greeting">
              <div className="eyebrow">{greet.eyebrow}</div>
              <h1>{t(greet.lineKey)}</h1>
              <div className="sub">{t('greeting.sub')}</div>
              <StreakChip />
            </div>
            <div className="composer-dock idle">
              {voiceSetup}
              {composer}
            </div>
            <div className="examples">
              {examples.map((ex, i) => {
                const Icon = ex.icon
                return (
                  <button type="button" className="example" key={i} onClick={() => submit(ex.text)}>
                    <Icon size={15} strokeWidth={1.6} />
                    {ex.text}
                  </button>
                )
              })}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                width: '100%',
                marginTop: 24
              }}
            >
              <OnboardingChecklist />
              <CompletenessMeter />
            </div>
          </div>
        ) : (
          <>
            <div className="thread-scroll" ref={scrollRef}>
              <div className="thread">
                {turns.map((t) => (
                  <HomeTurn key={t.id} turn={t} onRerun={rerun} onFollow={submit} />
                ))}
              </div>
            </div>
            {!canUse && turns.some((t) => !t.pending) && (
              <button type="button" className="home-edge-bar" onClick={() => showUpgrade('recall')}>
                <Sparkles size={14} strokeWidth={1.7} />
                <span>
                  <Trans t={t} i18nKey="edgeBar.proPitch" components={[<strong key="0" />]} />
                </span>
              </button>
            )}
            <div className="composer-dock">
              {voiceSetup}
              {composer}
            </div>
          </>
        )}
      </div>

      {historyOpen && <HistoryDrawer onClose={() => setHistoryOpen(false)} />}
    </div>
  )
}
