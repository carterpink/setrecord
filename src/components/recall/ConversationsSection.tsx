import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, MessageSquare, ArrowRight, ListPlus, Save } from 'lucide-react'
import type { RecallMessage, Track } from '@/types'
import { useRecallStore } from '@/stores/recallStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSetStore } from '@/stores/setStore'
import { RecallTrackLine } from './RecallTrackLine'

const STARTER_KEYS = [
  'conversations.starters.0',
  'conversations.starters.1',
  'conversations.starters.2',
  'conversations.starters.3',
  'conversations.starters.4',
  'conversations.starters.5'
]

function ResultTracks({
  tracks,
  precedingQuery
}: {
  tracks: Track[]
  precedingQuery: string
}): React.JSX.Element | null {
  const { t } = useTranslation('recall')
  const createSetFromTracks = useSetStore((s) => s.createSetFromTracks)
  const addTracksToCurrent = useSetStore((s) => s.addTracksToCurrent)
  if (tracks.length === 0) return null
  const name = precedingQuery.slice(0, 48) || t('conversations.defaultSetName')
  return (
    <div className="recall-conv-result">
      <div className="recall-conv-actions">
        <span className="recall-conv-count">
          {t('conversations.trackCount', { count: tracks.length })}
        </span>
        <button
          type="button"
          className="recall-conv-save"
          onClick={() => createSetFromTracks(name, tracks)}
        >
          <Save size={13} strokeWidth={1.7} /> {t('conversations.saveAsSet')}
        </button>
        <button
          type="button"
          className="recall-conv-save"
          onClick={() => addTracksToCurrent(tracks)}
        >
          <ListPlus size={13} strokeWidth={1.7} /> {t('conversations.addToCurrentSet')}
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

function AssistantMessage({
  msg,
  trackMap,
  precedingQuery
}: {
  msg: RecallMessage
  trackMap: Map<string, Track>
  precedingQuery: string
}): React.JSX.Element {
  const { t } = useTranslation('recall')
  const hydrate = (ids: string[]): Track[] =>
    ids.map((id) => trackMap.get(id)).filter((t): t is Track => t !== undefined)

  return (
    <div className="recall-conv-msg assistant">
      <p className="recall-conv-narration">{msg.text}</p>

      {msg.kind === 'tracks' && (
        <ResultTracks tracks={hydrate(msg.trackIds ?? [])} precedingQuery={precedingQuery} />
      )}

      {msg.kind === 'combos' && (
        <div className="recall-list">
          {(msg.combos ?? []).map((c) => {
            const track = trackMap.get(c.trackId)
            return track ? (
              <RecallTrackLine
                key={c.trackId}
                track={track}
                badge={
                  <span className="recall-combo-count">
                    {t('conversations.count', { count: c.count })}
                  </span>
                }
              />
            ) : null
          })}
        </div>
      )}

      {msg.kind === 'sequences' && (
        <div className="recall-sequences">
          {(msg.sequences ?? []).map((seq, i) => (
            <div className="recall-sequence glass-2" key={i}>
              <span className="recall-sequence-tracks">
                {seq.trackIds.map((id, j) => {
                  const t = trackMap.get(id)
                  return (
                    <span key={id} className="recall-sequence-item">
                      {t?.title ?? '—'}
                      {j < seq.trackIds.length - 1 && <ArrowRight size={12} strokeWidth={1.5} />}
                    </span>
                  )
                })}
              </span>
              {seq.count > 0 && (
                <span className="recall-combo-count">
                  {t('conversations.count', { count: seq.count })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {msg.kind === 'stats' && (
        <div className="recall-health-grid">
          {(msg.stats ?? []).map((s) => (
            <div className="recall-health-stat glass-2" key={s.label}>
              <span className="recall-health-num">{s.value}</span>
              <span className="recall-health-cat">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ConversationsSection(): React.JSX.Element {
  const { t } = useTranslation('recall')
  const conversations = useRecallStore((s) => s.conversations)
  const currentId = useRecallStore((s) => s.currentConversationId)
  const asking = useRecallStore((s) => s.asking)
  const newConversation = useRecallStore((s) => s.newConversation)
  const selectConversation = useRecallStore((s) => s.selectConversation)
  const deleteConversation = useRecallStore((s) => s.deleteConversation)
  const ask = useRecallStore((s) => s.ask)
  const tracks = useLibraryStore((s) => s.tracks)

  const trackMap = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks])
  const conv = conversations.find((c) => c.id === currentId) ?? null

  const threadRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [conv?.messages.length, asking])

  return (
    <div className="recall-convos">
      <aside className="recall-convo-list glass-1">
        <button type="button" className="recall-convo-new" onClick={newConversation}>
          <Plus size={15} strokeWidth={1.7} /> {t('conversations.newConversation')}
        </button>
        <div className="recall-convo-items">
          {conversations.length === 0 && (
            <span className="recall-convo-empty">{t('conversations.empty')}</span>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              className={`recall-convo-item${c.id === currentId ? ' active' : ''}`}
              onClick={() => selectConversation(c.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  selectConversation(c.id)
                }
              }}
            >
              <MessageSquare size={14} strokeWidth={1.5} />
              <span className="recall-convo-title">{c.title}</span>
              <button
                type="button"
                className="recall-convo-del"
                aria-label={t('conversations.deleteAria')}
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

      <div className="recall-convo-thread" ref={threadRef}>
        {!conv || conv.messages.length === 0 ? (
          <div className="recall-convo-welcome">
            <MessageSquare size={28} strokeWidth={1.3} />
            <h3 className="ss-h3">{t('conversations.welcomeTitle')}</h3>
            <div className="recall-convo-starters">
              {STARTER_KEYS.map((key) => {
                const text = t(key)
                return (
                  <button
                    key={key}
                    type="button"
                    className="recall-convo-starter"
                    onClick={() => void ask(text)}
                  >
                    {text}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <>
            {conv.messages.map((m, i) =>
              m.role === 'user' ? (
                <div className="recall-conv-msg user" key={m.id}>
                  <span>{m.text}</span>
                </div>
              ) : (
                <AssistantMessage
                  key={m.id}
                  msg={m}
                  trackMap={trackMap}
                  precedingQuery={conv.messages[i - 1]?.text ?? conv.title}
                />
              )
            )}
            {asking && <div className="recall-conv-thinking">{t('conversations.thinking')}</div>}
          </>
        )}
      </div>
    </div>
  )
}
