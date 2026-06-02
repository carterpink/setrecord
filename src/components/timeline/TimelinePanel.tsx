import { useState, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Sparkles, ListMusic, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'
import type { TimelineCurveView } from '@/types'
import { useToastStore } from '@/stores/toastStore'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { Button } from '@/components/shared/Button'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { useSuggestions } from '@/hooks/useSuggestions'
import { formatDuration } from '@/utils/format'
import { EnergyCurveGraph } from './EnergyCurveGraph'
import { LearnTooltip } from '@/components/learn/LearnTooltip'
import { explainEnergyCurveView } from '@/utils/learnMode/explanations'
import { GhostTrackCard } from './GhostTrackCard'
import { TimelineTrackCard } from './TimelineTrackCard'

const VIEWS: readonly TimelineCurveView[] = ['Energy', 'BPM'] as const

function SaveStatusBadge({
  status,
  onRetry
}: {
  status: 'idle' | 'saving' | 'unsaved' | 'error'
  onRetry: () => void
}): React.JSX.Element | null {
  if (status === 'idle') return null
  if (status === 'saving') {
    return (
      <span style={{ opacity: 0.55, fontVariantNumeric: 'tabular-nums' }} aria-live="polite">
        Saving…
      </span>
    )
  }
  if (status === 'unsaved') {
    return (
      <span style={{ opacity: 0.55 }} aria-live="polite">
        Unsaved changes
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onRetry}
      aria-label="Retry save"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 6,
        background: 'rgba(220, 38, 38, 0.12)',
        color: 'var(--semantic-danger)',
        border: '1px solid rgba(220, 38, 38, 0.35)',
        cursor: 'pointer',
        font: 'inherit'
      }}
    >
      <AlertTriangle size={12} strokeWidth={1.8} aria-hidden="true" />
      <span>Save failed</span>
      <RefreshCw size={11} strokeWidth={1.8} aria-hidden="true" style={{ marginLeft: 2 }} />
    </button>
  )
}

export function TimelinePanel(): React.JSX.Element {
  const [view, setView] = useState<TimelineCurveView>('Energy')
  const nameRef = useRef<HTMLInputElement>(null)

  const {
    currentSet,
    selectedTrackId,
    setSelectedTrack,
    removeTrack,
    renameCurrentSet,
    createSet,
    addTrackAfterSelected
  } = useSetStore()
  const saveStatus = useSetStore((s) => s.saveStatus)
  const retrySave = useSetStore((s) => s.retrySave)
  const showModal = useUiStore((s) => s.showModal)
  const showPostGigPrompt = useUiStore((s) => s.showPostGigPrompt)
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus)
  const toast = useToastStore.getState()
  const [marking, setMarking] = useState(false)

  async function handleMarkPerformed(): Promise<void> {
    if (!currentSet || tracks.length < 2 || !window.setsense) return
    setMarking(true)
    try {
      const sessionId = await window.setsense.historyMarkPerformed(currentSet.id)
      if (!sessionId) {
        toast.error('Could not mark this set as performed.')
        return
      }
      const flagged = await window.setsense.lifecycleFlaggedInSession(sessionId)
      if (flagged.length > 0) {
        showPostGigPrompt({ sessionId, setName: currentSet.name, tracks: flagged })
      } else {
        toast.success(`Logged “${currentSet.name}” as performed.`)
      }
    } catch {
      toast.error('Something went wrong marking the set performed.')
    } finally {
      setMarking(false)
    }
  }

  const { setNodeRef, isOver } = useDroppable({ id: 'timeline-droppable' })

  const tracks = currentSet?.tracks ?? []
  const setTrackIds = tracks.map((st) => st.id)

  const totalSeconds = tracks.reduce((s, st) => s + st.track.duration, 0)
  const bpmValues = tracks.map((st) => st.track.bpm)
  const bpmMin = bpmValues.length ? Math.min(...bpmValues) : 0
  const bpmMax = bpmValues.length ? Math.max(...bpmValues) : 0
  const bpmAvg = bpmValues.length
    ? Math.round(bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length)
    : 0

  // Ghost track: top suggestion for the currently selected track
  const selectedSetTrack = tracks.find((st) => st.id === selectedTrackId)
  const ghostTrackId =
    selectedSetTrack?.trackId ?? (tracks.length > 0 ? tracks[tracks.length - 1].trackId : null)
  const currentTrackIds = tracks.map((st) => st.trackId)
  const { suggestions: ghostSuggestions } = useSuggestions(
    ghostTrackId,
    currentSet?.id ?? null,
    1,
    currentTrackIds
  )
  const topSuggestion = ghostSuggestions[0] ?? null

  const selectedPosition = selectedSetTrack ? selectedSetTrack.position + 1 : null

  const isEmpty = !currentSet || tracks.length === 0

  function handleNameBlur(e: React.FocusEvent<HTMLInputElement>): void {
    const v = e.currentTarget.value.trim()
    if (v) renameCurrentSet(v)
    else if (nameRef.current && currentSet) nameRef.current.value = currentSet.name
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') e.currentTarget.blur()
    if (e.key === 'Escape') {
      if (nameRef.current && currentSet) nameRef.current.value = currentSet.name
      nameRef.current?.blur()
    }
  }

  return (
    <div className="panel glass-1">
      <div className="tl-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            ref={nameRef}
            className="tl-name-input"
            defaultValue={currentSet?.name ?? ''}
            key={currentSet?.id}
            placeholder="Set name"
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
          />
          {currentSet ? (
            <div className="ss-caption" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>
                {formatDuration(totalSeconds)} · {tracks.length} track
                {tracks.length !== 1 ? 's' : ''}
                {bpmValues.length > 1
                  ? ` · avg ${bpmAvg} BPM (${Math.round(bpmMin)}–${Math.round(bpmMax)})`
                  : bpmValues.length === 1
                    ? ` · ${Math.round(bpmValues[0])} BPM`
                    : ''}
              </span>
              <SaveStatusBadge status={saveStatus} onRetry={retrySave} />
            </div>
          ) : (
            <div className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
              No set loaded
            </div>
          )}
        </div>
        {currentSet && tracks.length >= 2 && (
          <Button
            variant="ghost"
            onClick={() => void handleMarkPerformed()}
            disabled={marking}
            title="Log this set as performed at a gig"
          >
            <CheckCircle2 size={13} strokeWidth={1.5} style={{ marginRight: 4 }} />
            {marking ? 'Logging…' : 'Mark as performed'}
          </Button>
        )}
        <LearnTooltip explanation={explainEnergyCurveView()} iconLabel="What does this graph show?">
          <SegmentedControl options={VIEWS} value={view} onChange={setView} />
        </LearnTooltip>
      </div>

      <EnergyCurveGraph
        tracks={tracks}
        selectedPosition={selectedPosition}
        viewMode={view === 'BPM' ? 'bpm' : 'energy'}
        energyCurveType={currentSet?.energyCurveType}
      />

      <div ref={setNodeRef} className={clsx('tl-list', isOver && 'drop-over')}>
        {isEmpty ? (
          <div className="tl-empty">
            <ListMusic size={32} strokeWidth={1} style={{ color: 'var(--text-tertiary)' }} />
            <div>
              <div
                className="ss-body-sm"
                style={{ color: 'var(--text-secondary)', marginBottom: 4 }}
              >
                Your set is empty. Add tracks from your library or let Set Architect build your set.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="primary"
                onClick={() => {
                  createSet()
                  requestSearchFocus()
                }}
              >
                Browse library
              </Button>
              <Button variant="ghost" onClick={() => showModal('architect')}>
                <Sparkles size={13} strokeWidth={1.5} style={{ marginRight: 4 }} />
                Build with Set Architect
              </Button>
            </div>
          </div>
        ) : (
          <>
            <SortableContext items={setTrackIds} strategy={verticalListSortingStrategy}>
              {tracks.map((st, idx) => (
                <TimelineTrackCard
                  key={st.id}
                  setTrack={st}
                  previousTrack={idx > 0 ? tracks[idx - 1].track : undefined}
                  isSelected={selectedTrackId === st.id}
                  onSelect={() => {
                    setSelectedTrack(st.id)
                    useUiStore.getState().setSelectedLibraryTrack(null)
                  }}
                  onRemove={() => removeTrack(st.id)}
                />
              ))}
            </SortableContext>
            {topSuggestion && (
              <GhostTrackCard
                suggestion={topSuggestion}
                onAdd={() => addTrackAfterSelected(topSuggestion.track)}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
