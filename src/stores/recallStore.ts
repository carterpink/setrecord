import { create } from 'zustand'
import type {
  RecallSection,
  GemResult,
  CrateWithCount,
  SmartCrate,
  Track,
  IdentitySnapshot,
  HealthReport,
  LifecycleCounts,
  ComboResult,
  RecallAiStatus,
  RecallAskResult,
  RecallConversation,
  RecallMessage
} from '@/types'
import { interpretTurn } from '@/utils/recallQuery'

const SECTION_KEY = 'setsense-recall-section'
const CONVO_KEY = 'setsense-recall-convos'
const MAX_CONVOS = 50

function loadSection(): RecallSection {
  if (typeof window === 'undefined') return 'conversations'
  const saved = window.localStorage.getItem(SECTION_KEY) as RecallSection | null
  return saved ?? 'conversations'
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
function api(): Window['setsense'] | undefined {
  return typeof window !== 'undefined' ? window.setsense : undefined
}

interface RecallState {
  section: RecallSection
  setSection: (section: RecallSection) => void

  gems: GemResult[]
  gemsLoading: boolean
  loadGems: () => Promise<void>

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

  // Flag-for-gig loop
  flaggedTracks: Track[]
  loadFlagged: () => Promise<void>
  flagForGig: (trackIds: string[]) => Promise<void>
  resolveFlag: (trackId: string, outcome: 'tested' | 'archive' | 'keep') => Promise<void>

  // SetSense Intelligence (conversational search)
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
      set({ identity: await s.recallIdentity() })
    } finally {
      set({ identityLoading: false })
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
