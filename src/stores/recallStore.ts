import { create } from 'zustand'
import type {
  RecallSection,
  GemResult,
  CrateWithCount,
  SmartCrate,
  Track,
  UncoverCard,
  UncoverSource,
  IdentitySnapshot,
  HealthReport,
  LifecycleCounts,
  ComboResult,
  RecallAiStatus,
  RecallAskResult,
  RecallConversation,
  RecallMessage,
  PlaySession,
  SessionTrack,
  SessionFilter,
  SessionMetadataPatch,
  BriefAnswer,
  SetRecording,
  SoundMirrorResult,
  VenueType
} from '@/types'
import { interpretTurn } from '@/utils/recallQuery'
import { useUiStore } from '@/stores/uiStore'

const IDENTITY_SHARE_SEEN_KEY = 'setrecord-identity-share-seen'
const IDENTITY_SHARE_TRACK_THRESHOLD = 20

const SECTION_KEY = 'setrecord-recall-section'
const CONVO_KEY = 'setrecord-recall-convos'
const MAX_CONVOS = 50

const UNCOVER_DISMISSED_KEY = 'setrecord-uncover-dismissed'
const UNCOVER_DISMISSED_CAP = 4000
const UNCOVER_DECK_CAP = 80

function loadUncoverDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(UNCOVER_DISMISSED_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveUncoverDismissed(ids: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    // Keep the most-recently-added ids; drop the oldest once over cap.
    const arr = Array.from(ids).slice(-UNCOVER_DISMISSED_CAP)
    window.localStorage.setItem(UNCOVER_DISMISSED_KEY, JSON.stringify(arr))
  } catch {
    /* quota — ignore */
  }
}

/** Fisher–Yates, returns a new array (never mutates input). */
function shuffle<T>(input: readonly T[]): T[] {
  const a = input.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Round-robin merge so the deck alternates sources instead of clumping. */
function interleave<T>(lists: T[][]): T[] {
  const out: T[] = []
  const max = Math.max(0, ...lists.map((l) => l.length))
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      if (i < list.length) out.push(list[i])
    }
  }
  return out
}

function monthsSince(iso?: string): number {
  if (!iso) return 0
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24 * 30.44)))
}

function heaterReason(t: Track): string {
  const parts = [`energy ${t.energy}`]
  if (t.playCount > 0) parts.push(`played ${t.playCount}×`)
  const m = monthsSince(t.lastPlayed)
  if (m > 0) parts.push(`dormant ${m} mo`)
  return parts.join(' · ')
}

function loadSection(): RecallSection {
  // The conversational chat moved to the Home tab; the Library workspace no
  // longer has a 'conversations' section, so map any legacy value to 'uncover'.
  if (typeof window === 'undefined') return 'uncover'
  const saved = window.localStorage.getItem(SECTION_KEY) as RecallSection | null
  if (!saved || saved === 'conversations') return 'uncover'
  return saved
}

function loadConversations(): RecallConversation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CONVO_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as RecallConversation[]) : []
  } catch {
    return []
  }
}

function saveConversations(convos: RecallConversation[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONVO_KEY, JSON.stringify(convos.slice(0, MAX_CONVOS)))
  } catch {
    /* quota — drop silently */
  }
}

const uid = (): string => crypto.randomUUID()

/** Map a one-shot engine result (gems/closers/health/…) into a chat message. */
function resultToMessage(res: RecallAskResult | null): RecallMessage {
  if (!res) return { id: uid(), role: 'assistant', text: 'I couldn’t reach the library engine.' }
  const base = { id: uid(), role: 'assistant' as const, text: res.narration }
  switch (res.kind) {
    case 'tracks':
      return { ...base, kind: 'tracks', trackIds: (res.tracks ?? []).map((t) => t.id) }
    case 'combos':
      return {
        ...base,
        kind: 'combos',
        combos: (res.combos ?? []).map((c) => ({ trackId: c.track.id, count: c.count }))
      }
    case 'sequences':
      return {
        ...base,
        kind: 'sequences',
        sequences: (res.sequences ?? []).map((sq) => ({
          trackIds: sq.tracks.map((t) => t.id),
          count: sq.count ?? 0
        }))
      }
    case 'stats':
      return { ...base, kind: 'stats', stats: res.stats ?? [] }
    default:
      return base
  }
}

/** The IPC bridge is absent in the renderer-only browser preview. */
function api(): Window['setrecord'] | undefined {
  return typeof window !== 'undefined' ? window.setrecord : undefined
}

interface RecallState {
  section: RecallSection
  setSection: (section: RecallSection) => void

  gems: GemResult[]
  gemsLoading: boolean
  loadGems: () => Promise<void>

  // Uncover — swipe-deck rediscovery of the user's own library
  uncoverDeck: UncoverCard[]
  uncoverLoading: boolean
  loadUncover: () => Promise<void>
  dismissUncover: (trackId: string) => void
  undismissUncover: (trackId: string) => void
  resetUncover: () => Promise<void>

  crates: CrateWithCount[]
  cratesLoading: boolean
  selectedCrate: { crate: CrateWithCount; tracks: Track[] } | null
  selectedCrateLoading: boolean
  loadCrates: () => Promise<void>
  selectCrate: (crate: CrateWithCount | null) => Promise<void>
  saveCrate: (crate: SmartCrate) => Promise<void>
  deleteCrate: (id: string) => Promise<void>
  previewCrate: (crate: SmartCrate) => Promise<Track[]>

  identity: IdentitySnapshot | null
  identityLoading: boolean
  loadIdentity: () => Promise<void>

  soundMirror: SoundMirrorResult | null
  soundMirrorLoading: boolean
  loadSoundMirror: () => Promise<void>

  health: HealthReport | null
  lifecycle: LifecycleCounts | null
  healthLoading: boolean
  loadHealth: () => Promise<void>
  dismissDuplicateGroup: (normalisedKey: string) => Promise<void>
  resolveDuplicateGroup: (normalisedKey: string, archiveIds: string[]) => Promise<void>

  comboTrack: Track | null
  combos: ComboResult[]
  combosLoading: boolean
  sequences: { trackIds: string[]; tracks: Track[]; count: number }[]
  deadEnds: ComboResult[]
  loadCombosFor: (track: Track) => Promise<void>
  loadSequences: () => Promise<void>
  loadDeadEnds: () => Promise<void>

  // Gigs — play-session metadata (venue / date / event-type / city / slot)
  gigs: PlaySession[]
  gigsLoading: boolean
  gigFilter: SessionFilter | null
  gigTracklist: {
    session: PlaySession
    tracks: SessionTrack[]
    recording: SetRecording | null
  } | null
  loadGigs: () => Promise<void>
  applyGigFilter: (filter: SessionFilter | null) => Promise<void>
  updateGig: (sessionId: string, patch: SessionMetadataPatch) => Promise<void>
  bulkAssignGigs: (filter: SessionFilter, patch: SessionMetadataPatch) => Promise<number>
  loadGigTracklist: (session: PlaySession) => Promise<void>
  clearGigTracklist: () => void
  // Pre-gig Brief (game plan) — surface-agnostic (driven from a Gigs row or a Venues card)
  activeBrief: BriefAnswer | null
  briefOpen: boolean
  briefLoading: boolean
  loadBrief: (venue: string, eventType?: VenueType) => Promise<void>
  clearBrief: () => void

  // Flag-for-gig loop
  flaggedTracks: Track[]
  loadFlagged: () => Promise<void>
  flagForGig: (trackIds: string[]) => Promise<void>
  resolveFlag: (trackId: string, outcome: 'tested' | 'archive' | 'keep') => Promise<void>

  // SetRecord Intelligence (conversational search)
  aiStatus: RecallAiStatus | null
  asking: boolean
  conversations: RecallConversation[]
  currentConversationId: string | null
  loadAiStatus: () => Promise<void>
  enableAi: () => Promise<void>
  subscribeAiProgress: () => () => void
  newConversation: () => void
  selectConversation: (id: string) => void
  deleteConversation: (id: string) => void
  ask: (question: string) => Promise<void>
}

export const useRecallStore = create<RecallState>((set, get) => ({
  section: loadSection(),
  setSection: (section) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(SECTION_KEY, section)
    set({ section })
  },

  gems: [],
  gemsLoading: false,
  loadGems: async () => {
    const s = api()
    if (!s) return
    set({ gemsLoading: true })
    try {
      set({ gems: await s.recallGems() })
    } finally {
      set({ gemsLoading: false })
    }
  },

  uncoverDeck: [],
  uncoverLoading: false,
  loadUncover: async () => {
    const s = api()
    if (!s) return
    set({ uncoverLoading: true })
    try {
      const [heaters, gems, untested, audition, flagged] = await Promise.all([
        s.recallEvaluateCrate('forgotten-heaters').catch(() => [] as Track[]),
        s.recallGems().catch(() => [] as GemResult[]),
        s.recallEvaluateCrate('never-tested-live').catch(() => [] as Track[]),
        s.recallEvaluateCrate('downloaded-worth-auditioning').catch(() => [] as Track[]),
        s.lifecycleGetFlagged().catch(() => [] as Track[])
      ])

      const dismissed = loadUncoverDismissed()
      const skip = new Set<string>([...dismissed, ...flagged.map((t) => t.id)])
      const seen = new Set<string>()

      const build = (track: Track, source: UncoverSource, reason: string): UncoverCard | null => {
        if (!track || seen.has(track.id) || skip.has(track.id)) return null
        if (track.missingFile === true && track.phantom !== true) return null
        seen.add(track.id)
        return { track, source, reason }
      }
      const collect = (cards: (UncoverCard | null)[]): UncoverCard[] =>
        cards.filter((c): c is UncoverCard => c !== null)

      // Build each source list independently (with its own shuffle), then
      // interleave so a deck never serves five "never tested" cards in a row.
      const heaterCards = collect(shuffle(heaters).map((t) => build(t, 'heater', heaterReason(t))))
      const gemCards = collect(shuffle(gems).map((g) => build(g.track, 'gem', g.reason)))
      const untestedCards = collect(
        shuffle(untested).map((t) => build(t, 'untested', 'Never played live — give it a shot'))
      )
      const auditionCards = collect(
        shuffle(audition).map((t) => build(t, 'audition', 'Downloaded but never auditioned'))
      )

      const deck = interleave([heaterCards, gemCards, untestedCards, auditionCards]).slice(
        0,
        UNCOVER_DECK_CAP
      )
      set({ uncoverDeck: deck })
    } finally {
      set({ uncoverLoading: false })
    }
  },
  dismissUncover: (trackId) => {
    const dismissed = loadUncoverDismissed()
    dismissed.add(trackId)
    saveUncoverDismissed(dismissed)
  },
  undismissUncover: (trackId) => {
    const dismissed = loadUncoverDismissed()
    if (dismissed.delete(trackId)) saveUncoverDismissed(dismissed)
  },
  resetUncover: async () => {
    saveUncoverDismissed(new Set())
    await get().loadUncover()
  },

  crates: [],
  cratesLoading: false,
  selectedCrate: null,
  selectedCrateLoading: false,
  loadCrates: async () => {
    const s = api()
    if (!s) return
    set({ cratesLoading: true })
    try {
      set({ crates: await s.recallCrates() })
    } catch {
      /* leave previous crates in place on failure */
    } finally {
      set({ cratesLoading: false })
    }
  },
  selectCrate: async (crate) => {
    const s = api()
    if (!crate || !s) {
      set({ selectedCrate: null })
      return
    }
    set({ selectedCrateLoading: true })
    try {
      const tracks = await s.recallEvaluateCrate(crate.id)
      set({ selectedCrate: { crate, tracks } })
    } catch {
      set({ selectedCrate: { crate, tracks: [] } })
    } finally {
      set({ selectedCrateLoading: false })
    }
  },
  saveCrate: async (crate) => {
    const s = api()
    if (!s) return
    try {
      await s.recallSaveCrate(crate)
      await get().loadCrates()
    } catch {
      /* swallow — UI keeps the builder open so the user can retry */
    }
  },
  deleteCrate: async (id) => {
    const s = api()
    if (!s) return
    try {
      await s.recallDeleteCrate(id)
      const { selectedCrate } = get()
      if (selectedCrate?.crate.id === id) set({ selectedCrate: null })
      await get().loadCrates()
    } catch {
      /* ignore */
    }
  },
  previewCrate: async (crate) => {
    const s = api()
    if (!s) return []
    return s.recallEvaluateCrate(crate)
  },

  identity: null,
  identityLoading: false,
  loadIdentity: async () => {
    const s = api()
    if (!s) return
    set({ identityLoading: true })
    try {
      const identity = await s.recallIdentity()
      set({ identity })
      if (
        identity &&
        identity.totalTracks >= IDENTITY_SHARE_TRACK_THRESHOLD &&
        typeof window !== 'undefined' &&
        !window.localStorage.getItem(IDENTITY_SHARE_SEEN_KEY)
      ) {
        window.localStorage.setItem(IDENTITY_SHARE_SEEN_KEY, '1')
        // Small delay so the Identity section renders before the modal appears
        setTimeout(() => useUiStore.getState().showModal('identityReady'), 900)
      }
    } finally {
      set({ identityLoading: false })
    }
  },

  soundMirror: null,
  soundMirrorLoading: false,
  loadSoundMirror: async () => {
    const s = api()
    if (!s) return
    set({ soundMirrorLoading: true })
    try {
      const soundMirror = await s.historySoundMirror()
      set({ soundMirror })
    } finally {
      set({ soundMirrorLoading: false })
    }
  },

  health: null,
  lifecycle: null,
  healthLoading: false,
  loadHealth: async () => {
    const s = api()
    if (!s) return
    set({ healthLoading: true })
    try {
      const [health, lifecycle] = await Promise.all([s.recallHealth(), s.recallLifecycle()])
      set({ health, lifecycle })
    } finally {
      set({ healthLoading: false })
    }
  },
  dismissDuplicateGroup: async (normalisedKey) => {
    const s = api()
    if (!s) return
    await s.recallDismissDuplicate(normalisedKey)
    await get().loadHealth()
  },
  resolveDuplicateGroup: async (normalisedKey, archiveIds) => {
    const s = api()
    if (!s) return
    await s.recallResolveDuplicateGroup(normalisedKey, archiveIds)
    await get().loadHealth()
  },

  comboTrack: null,
  combos: [],
  combosLoading: false,
  sequences: [],
  deadEnds: [],
  loadCombosFor: async (track) => {
    const s = api()
    if (!s) return
    set({ comboTrack: track, combosLoading: true })
    try {
      set({ combos: await s.recallCombos(track.id) })
    } finally {
      set({ combosLoading: false })
    }
  },
  loadSequences: async () => {
    const s = api()
    if (!s) return
    try {
      set({ sequences: await s.recallSequences() })
    } catch {
      /* ignore */
    }
  },
  loadDeadEnds: async () => {
    const s = api()
    if (!s) return
    try {
      set({ deadEnds: await s.recallDeadEnds() })
    } catch {
      /* ignore */
    }
  },

  gigs: [],
  gigsLoading: false,
  gigFilter: null,
  gigTracklist: null,
  loadGigs: async () => {
    const s = api()
    if (!s) return
    set({ gigsLoading: true })
    try {
      set({ gigs: await s.historyQuerySessions(get().gigFilter ?? {}) })
    } catch {
      set({ gigs: [] })
    } finally {
      set({ gigsLoading: false })
    }
  },
  applyGigFilter: async (filter) => {
    set({ gigFilter: filter, section: 'gigs', gigTracklist: null })
    if (typeof window !== 'undefined') window.localStorage.setItem(SECTION_KEY, 'gigs')
    await get().loadGigs()
  },
  updateGig: async (sessionId, patch) => {
    const s = api()
    if (!s) return
    await s.historyUpdateSession(sessionId, patch)
    await get().loadGigs()
  },
  bulkAssignGigs: async (filter, patch) => {
    const s = api()
    if (!s) return 0
    const n = await s.historyBulkAssign(filter, patch)
    await get().loadGigs()
    return n
  },
  loadGigTracklist: async (session) => {
    const s = api()
    if (!s) return
    try {
      const [tracks, recording] = await Promise.all([
        s.historySessionTracks(session.id),
        s.historyGetRecording?.(session.id) ?? Promise.resolve(null)
      ])
      set({ gigTracklist: { session, tracks, recording } })
    } catch {
      /* ignore */
    }
  },
  clearGigTracklist: () => set({ gigTracklist: null }),

  activeBrief: null,
  briefOpen: false,
  briefLoading: false,
  loadBrief: async (venue, eventType) => {
    const s = api()
    if (!s) return
    set({ briefOpen: true, briefLoading: true, activeBrief: null })
    try {
      const brief = await s.historyBrief(venue || '', eventType)
      set({ activeBrief: brief })
    } catch {
      set({ activeBrief: null })
    } finally {
      set({ briefLoading: false })
    }
  },
  clearBrief: () => set({ briefOpen: false, activeBrief: null, briefLoading: false }),

  flaggedTracks: [],
  loadFlagged: async () => {
    const s = api()
    if (!s) return
    try {
      set({ flaggedTracks: await s.lifecycleGetFlagged() })
    } catch {
      /* ignore */
    }
  },
  flagForGig: async (trackIds) => {
    const s = api()
    if (!s || trackIds.length === 0) return
    await s.lifecycleFlagForGig(trackIds)
    await get().loadFlagged()
    await get().loadCrates()
  },
  resolveFlag: async (trackId, outcome) => {
    const s = api()
    if (!s) return
    await s.lifecycleResolveGigFlag(trackId, outcome)
    await get().loadFlagged()
  },

  aiStatus: null,
  asking: false,
  conversations: loadConversations(),
  currentConversationId: loadConversations()[0]?.id ?? null,
  loadAiStatus: async () => {
    const s = api()
    if (!s) return
    try {
      set({ aiStatus: await s.recallAiStatus() })
    } catch {
      /* ignore */
    }
  },
  enableAi: async () => {
    const s = api()
    if (!s) return
    set({ aiStatus: await s.recallAiEnable(true) })
  },
  subscribeAiProgress: () => {
    const s = api()
    if (!s) return () => undefined
    return s.onRecallAiProgress((status) => set({ aiStatus: status }))
  },

  newConversation: () => set({ currentConversationId: null, section: 'conversations' }),

  selectConversation: (id) => set({ currentConversationId: id, section: 'conversations' }),

  deleteConversation: (id) => {
    set((state) => {
      const convos = state.conversations.filter((c) => c.id !== id)
      saveConversations(convos)
      const currentConversationId =
        state.currentConversationId === id ? (convos[0]?.id ?? null) : state.currentConversationId
      return { conversations: convos, currentConversationId }
    })
  },

  ask: async (question) => {
    const text = question.trim()
    if (!text) return
    const s = api()
    const now = new Date().toISOString()

    // Resolve (or create) the active conversation and append the user's turn.
    let convId = get().currentConversationId
    const existing = get().conversations.find((c) => c.id === convId) ?? null
    const prevParams = existing?.params ?? {}
    const userMsg: RecallMessage = { id: uid(), role: 'user', text }

    set((state) => {
      let conv = state.conversations.find((c) => c.id === convId)
      let conversations: RecallConversation[]
      if (!conv) {
        conv = {
          id: uid(),
          title: text.slice(0, 60),
          createdAt: now,
          updatedAt: now,
          messages: [userMsg],
          params: {}
        }
        convId = conv.id
        conversations = [conv, ...state.conversations]
      } else {
        const updated: RecallConversation = {
          ...conv,
          title: conv.messages.length === 0 ? text.slice(0, 60) : conv.title,
          messages: [...conv.messages, userMsg],
          updatedAt: now
        }
        conversations = state.conversations.map((c) => (c.id === conv!.id ? updated : c))
      }
      saveConversations(conversations)
      return {
        conversations,
        currentConversationId: convId,
        section: 'conversations',
        asking: true
      }
    })

    // Resolve the turn (deterministic; no model for the common cases).
    const turn = interpretTurn(text, prevParams)
    let assistant: RecallMessage
    let nextParams = prevParams
    try {
      if (turn.kind === 'search') {
        const tracks = s ? await s.recallSearch(turn.params) : []
        nextParams = turn.params
        assistant = {
          id: uid(),
          role: 'assistant',
          text: tracks.length
            ? turn.narration
            : 'Nothing in your library matches that — try widening the BPM range, dropping a filter, or a different genre.',
          kind: 'tracks',
          trackIds: tracks.map((t) => t.id)
        }
      } else if (turn.kind === 'sessions') {
        // Session-oriented query ("all sets in July 2025"): open the Gigs view
        // pre-filtered. The assistant message confirms; navigation happens after.
        const sessions = s ? await s.historyQuerySessions(turn.filter) : []
        assistant = {
          id: uid(),
          role: 'assistant',
          text: sessions.length
            ? `${turn.narration} (${sessions.length} ${sessions.length === 1 ? 'gig' : 'gigs'})`
            : 'No gigs match that yet — log a few sets or tag their venues in the Gigs view first.'
        }
        if (sessions.length) {
          // Defer the section switch so the assistant message renders first.
          setTimeout(() => void get().applyGigFilter(turn.filter), 0)
        }
      } else {
        const res = s ? await s.recallAiAsk(text) : null
        assistant = resultToMessage(res)
      }
    } catch {
      assistant = { id: uid(), role: 'assistant', text: 'Something went wrong with that search.' }
    }

    set((state) => {
      const conversations = state.conversations.map((c) =>
        c.id === convId
          ? {
              ...c,
              messages: [...c.messages, assistant],
              params: nextParams,
              updatedAt: new Date().toISOString()
            }
          : c
      )
      saveConversations(conversations)
      return { conversations, asking: false }
    })
  }
}))
