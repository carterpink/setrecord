import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { History, Plus, X, Trash2, MessageSquare, Sparkles } from 'lucide-react'
import { useHomeStore } from '@/stores/homeStore'
import { useRecallStore } from '@/stores/recallStore'
import { useUiStore } from '@/stores/uiStore'
import { useCanUse, useIsPro } from '@/stores/licenseStore'
import { useToastStore } from '@/stores/toastStore'
import { useVoiceCapture } from '@/hooks/useVoiceCapture'
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist'
import { CompletenessMeter } from '@/components/onboarding/CompletenessMeter'
import { Composer, type ComposerPhase } from './Composer'
import { HomeTurn } from './HomeTurn'
import BloomCycle from '@/components/atmosphere/BloomCycle'
import { BriefPanel } from '@/components/recall/BriefPanel'
import { AnimatePresence } from '@/components/shared/Motion'
import type { VenueType } from '@/types'

// ─── Cycling example queries ─────────────────────────────────────────────────

const EXAMPLE_POOL = [
  // gig recall
  'What did I play at fabric last month',
  'What did I close with in Ibiza',
  'What was my opener at Village Underground',
  "Show me my set from New Year's Eve",
  'What did I peak with at Corsica Studios',
  'What did I play at Printworks',
  'What tracks came up most in my last three gigs',
  'What did I warm up with at that warehouse rave',
  'Show me everything I played in Berlin last summer',
  'What did I peak with at my last festival gig',
  'What was the last track I played at Bar 25',
  'What did I open with at the residency show',
  'What tracks did I repeat across multiple gigs this year',
  'Which closing tracks have I used more than once',
  // unplayed / forgotten
  "Show me tracks I haven't played in 6 months",
  "Find 10 songs I've owned for a year but never played",
  "What's collecting dust in my library",
  'Tracks I keep skipping over',
  'Gems I keep forgetting about',
  'Music I bought in 2023 and never touched',
  'What have I ignored for over a year',
  'Find forgotten tools I picked up on Bandcamp',
  'Which tracks have I owned forever but never played live',
  'Stuff I added after a long session and never came back to',
  "Show me everything I haven't played in 12 months",
  'Tracks that have been sitting unplayed the longest',
  'What did I prep for a gig but never actually use',
  // key / harmony
  "What's my most-played key",
  'Find tracks in 4A that match this energy',
  "Show me everything in A minor I haven't played recently",
  'Tracks that mix well out of Camelot 8B',
  'Harmonic options for after a big drop',
  'What keys do I use least',
  'Give me five tracks that sit in 11A or 11B',
  'Find me something that bridges from minor to major',
  "What's my most-played Camelot key at closing time",
  'Show me all my 6A tracks sorted by play count',
  "Tracks in 9B I haven't touched since last year",
  'Key of the month — what am I overplaying',
  // BPM
  'Find slow openers under 120 bpm',
  'Show me peak-time stuff between 130 and 135',
  "What's around 128 that I haven't played recently",
  'My fastest tracks above 145',
  'Something that ramps from 124 to 130 naturally',
  'Tracks sitting between 125 and 127 I keep overlooking',
  'Slowest things in my techno folder',
  'Find me four tracks that bridge 120 to 132',
  'Stuff hovering around 140 I rarely play',
  'Give me openable tracks under 118',
  "What's my average BPM across the last month of gigs",
  // set building
  'Build me a 90-minute opening set',
  'Draft a peak-time hour for a warehouse rave',
  'Put together a closing set for a festival',
  'Give me a 30-minute warmup that ramps from 122 to 128',
  'Build a sunrise set that starts mellow and lifts slowly',
  'Draft me a 45-minute deep house warm-up',
  'Put together a one-hour club set that peaks at the 40-minute mark',
  'Build something for a rooftop afternoon — not too heavy',
  'Give me a tight 20-minute closing run',
  "Draft an opening hour I've never played before",
  'Build me something weird that still works at 3am',
  'Plan a two-hour journey from deep to peak',
  'Build a vinyl-only set from my tagged records',
  'Draft a summer pool-party set around 125 bpm',
  // artist / track follow
  'What do I play after Objekt',
  'Songs that work after a Burial edit',
  'Tracks that bridge from acid to techno',
  'What follows something hard and distorted well',
  'Give me three paths out of that Actress track',
  'What do I play to shift from techno into house',
  'What comes after a big euphoric moment',
  'How do I transition out of minimal into something meaty',
  "What's a good follow after Aphex Twin at 3am",
  'Tracks that sit well after ambient acid',
  'What do I play before dropping into peak time',
  'What follows a classic Detroit techno cut',
  // stats / insights
  'What are my five most played tracks all time',
  'Which artist do I play the most',
  'Show me how my BPM has shifted across gigs this year',
  'What genres have I been leaning into recently',
  'Which labels appear most in my library',
  'How many tracks do I have in each key',
  "What's the average rating in my techno folder",
  'Which month was I most active as a DJ this year',
  'Show me how my taste has changed since 2022',
  'Which tracks have the highest play count but lowest rating',
  'What labels have I ignored for more than six months',
  "What's my most-played track at closing time specifically",
  'Give me a breakdown of my BPM habits per venue',
  "What's the ratio of new to classic in my recent sets",
  // mood / energy
  'Give me five deep hypnotic tracks I rarely reach for',
  'Anthems I keep saving for the right moment',
  'Stuff I always play when the room is cooking',
  'Moody closers for a 4am moment',
  'The most euphoric thing in my library right now',
  "My most reliable floor filler that isn't obvious",
  'Weird stuff that somehow always works',
  'The most emotional track I own and never play enough',
  'Something that sounds expensive without being well-known',
  'Understated peak-time tools people always Shazam',
  'Tracks with the most tension before the breakdown',
  'Give me something hauntingly beautiful for after hours',
  // cleanup / curation
  'Find duplicates in my techno folder',
  "Tracks I keep rating low — maybe it's time to cull",
  'Show me my lowest-rated tracks I still play somehow',
  'Find tracks with missing BPM data',
  'Clean up my untagged tracks from last year',
  'Which imported tracks are missing album art',
  'Find everything tagged TODO that I never came back to',
  "Show me tracks I've never listened to all the way through",
  'What were my regret buys — low play count, low rating',
  // time-based recall
  'What was I playing this time last year',
  'Show me my summer 2024 rotation',
  'What tracks defined my sets in the autumn',
  'What did I play the most in January',
  'What new music made it into rotation fastest last year',
  'Which tracks did I add but never play at gigs',
  'Show me everything I played in July',
  // genre / vibe deep cuts
  'Show me all tracks tagged dark',
  'What house tracks am I sleeping on',
  "Find me a slow industrial opener that isn't too cold",
  'Tracks under five minutes I never play because they feel too short',
  'Find me something to strip the room back without losing them',
  'Tracks that have gotten better with age in my library',
  'Show me my ambient tracks sorted by play count',
  "Which breakbeat tracks haven't I touched since I bought them",
  'Find everything I tagged experimental last year',
  "What electro do I have that I haven't touched",
  'Show me my longest tracks — ten minutes or more',
  "Tracks I've played at every single gig",
  'What has the most perfect intro for a slow opening',
  "Tracks I'd consider perfect but have only played once",
  'Show me my most consistent closers',
  'Find me five tracks that always get a reaction',
  'Show me tracks tagged peak time but with low play count',
  "What's the most obscure thing in my library",
  "Find records I've had since before 2020",
  'Tracks that sound amazing but are too niche to trust a crowd with',
  'What would a perfect 3-hour set look like from my library',
  'Find tracks that are in my collection twice on different labels',
  'Show me everything released in 2024 that I own',
  'Which artists do I have only one track from but play it constantly',
  'Find everything with a spoken word sample',
  'What would I regret losing if my drive died tomorrow',
  "Show me the tracks I've been building toward but never played",
  "Tracks I've played more than twenty times",
  'Find music that sounds like 3am but opens a set',
  'Show me everything I rate 5 stars but play infrequently',
  "What's my most-played track in the last 30 days",
  'What did I play the night before a big gig to warm up at home',
  'Show me B-sides I keep overlooking',
  "What's my most-played track that I'm not sick of yet",
  'Find tools that work at 130 and also at 135',
  'What are my most played three tracks at peak time',
  'Show me tracks from labels I follow released this year',
  "What's the shortest track I've played at a gig",
  'Give me something playable at the very end when the lights come on',
  "Show me my biggest crowd pleasers I've been avoiding lately",
  'Find everything I tagged save for the right moment',
  "Show me tracks I've listened to privately but never played out",
  "Give me five opener candidates I haven't tried yet",
  'What do I play at 2am when the energy needs to shift',
  'Find me three tracks that close a set with dignity',
  "Show me stuff I've collected but never actually played back",
  'Which tracks have I played only once and never returned to',
  'Find long-format tracks over eight minutes I could stretch a moment with',
  'What were my most experimental gig choices this year',
  'Show me everything I tagged as tools versus anthems',
  'What tracks would work for a 30-minute sunrise warm-down',
  'Find me five tracks that sound like pressure building',
  'What did I peak with most consistently last quarter',
  "Show me deep house tools under 124 bpm I haven't played in three months",
  "What's my go-to when a room is smaller than expected",
  'Find forgotten edits and bootlegs I never got round to playing',
  'Show me the most recent track I added to my library',
  'What did I use to play at this time of night a year ago',
  'Find me something percussive that gives dancers a breather',
  'What tracks have I been sitting on for over two years',
  'Show me stuff under six minutes that works as a peak tool',
  'Show me the tracks with the most playful energy in my library',
  "What's in my prep folder that I still haven't prepped",
  "Find something from a sub-genre I haven't touched in ages",
  'Which tracks have I played in multiple completely different genres',
  'Show me everything I have from a single year — say 2019',
  "What's the narrowest BPM range I played in a single set",
  "Find the track I've prepared most often but played least",
  'Show me tracks that are essentially just rhythm — no melody',
  'What do I always play in the first 20 minutes',
  'Find me something cinematic without being film music',
  'What do I have that would work in a Panorama Bar context',
  'Show me everything below 4 stars I still somehow play',
  "What's a safe way to bring a jazz crowd into house music",
  'Show me all my tracks from one specific artist by play count',
  'What did I add to my library this month',
  'Find me a transition track that works in both directions',
  'Tracks that have a natural build I can layer over',
  "What's the oldest track in my library I still play regularly",
  'Find tracks where the outro could work as an intro',
  'What did I play between 1am and 2am most often',
  "Show me everything I've double-bought by accident",
  "What are the strangest things I've ever played in a club",
  "Find me five openers that don't sound like openers",
  'Show me my techno tracks rated 4 stars or above',
  "What's the most recently released track I've played more than five times",
  'Find me something to play when the crowd needs a reset',
  'Show me all my tracks with a BPM in the 118 to 122 range',
  'What have I never played before midnight'
] as const

type ExamplePool = typeof EXAMPLE_POOL

function randDelay(): number {
  return 2500 + Math.random() * 4500
}

function useExampleCycle(pool: ExamplePool, startIdx: number): string {
  const [idx, setIdx] = useState(() => startIdx % pool.length)

  useEffect(() => {
    let id: ReturnType<typeof setTimeout>
    const tick = (): void => {
      setIdx((i) => (i + 1) % pool.length)
      id = setTimeout(tick, randDelay())
    }
    id = setTimeout(tick, randDelay())
    return () => clearTimeout(id)
  }, [pool.length])

  return pool[idx]
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const gigs = useRecallStore((s) => s.gigs)
  const loadGigs = useRecallStore((s) => s.loadGigs)
  const activeBrief = useRecallStore((s) => s.activeBrief)
  const briefOpen = useRecallStore((s) => s.briefOpen)
  const briefLoading = useRecallStore((s) => s.briefLoading)
  const clearBrief = useRecallStore((s) => s.clearBrief)
  const setSection = useRecallStore((s) => s.setSection)
  const setMode = useUiStore((s) => s.setMode)

  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const placeholder = useExampleCycle(EXAMPLE_POOL, 0)

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

  // Top venues for the "heading to a gig?" nudge (front-door discoverability).
  const topVenues = useMemo(() => {
    const m = new Map<string, { venue: string; count: number; eventType?: VenueType }>()
    for (const g of gigs) {
      const v = g.venue?.trim()
      if (!v) continue
      const k = v.toLowerCase()
      const cur = m.get(k) ?? { venue: v, count: 0, eventType: g.eventType }
      cur.count += 1
      if (!cur.eventType && g.eventType) cur.eventType = g.eventType
      m.set(k, cur)
    }
    return Array.from(m.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
  }, [gigs])

  const goToVenues = (): void => {
    setMode('Library')
    setSection('venues')
  }

  // Load gig history so the venue nudge can populate.
  useEffect(() => {
    void loadGigs()
  }, [loadGigs])

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
      placeholder={placeholder}
    />
  )

  return (
    <div className="home">
      <div className="home-aurora" aria-hidden="true" />
      {/* Grit: an ambient grain-bloom backdrop that cycles through memory-system
          icon shapes (brain, sparkles, waypoints…). Each breathes and crossfades
          into the next; the tone tracks the tab's accent (--bloom-tone), not a
          hardcoded colour. Interactive — the light pools toward the pointer. */}
      <BloomCycle className="home-bloom" interactive seed={11} />
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
            </div>
            <div className="composer-dock idle">
              {voiceSetup}
              {composer}
            </div>
            {topVenues.length > 0 && (
              <button
                type="button"
                onClick={goToVenues}
                style={{
                  marginTop: 12,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  opacity: 0.55,
                  fontSize: 12,
                  letterSpacing: '0.04em'
                }}
              >
                Heading to a gig? →
              </button>
            )}
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

      <AnimatePresence>
        {briefOpen && (
          <BriefPanel brief={activeBrief} loading={briefLoading} onClose={clearBrief} />
        )}
      </AnimatePresence>
    </div>
  )
}
