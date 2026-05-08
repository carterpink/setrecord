import { useState, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Sparkles, ListMusic } from 'lucide-react'
import clsx from 'clsx'
import type { TimelineCurveView } from '@/types'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { Button } from '@/components/shared/Button'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { formatDuration } from '@/utils/format'
import { EnergyCurveGraph } from './EnergyCurveGraph'
import { TimelineTrackCard } from './TimelineTrackCard'

const VIEWS: readonly TimelineCurveView[] = ['Energy', 'BPM'] as const

export function TimelinePanel(): React.JSX.Element {
  const [view, setView] = useState<TimelineCurveView>('Energy')
  const nameRef = useRef<HTMLInputElement>(null)

  const { currentSet, selectedTrackId, setSelectedTrack, removeTrack, renameCurrentSet, createSet } =
    useSetStore()
  const showModal = useUiStore((s) => s.showModal)

  const { setNodeRef, isOver } = useDroppable({ id: 'timeline-droppable' })

  const tracks = currentSet?.tracks ?? []
  const setTrackIds = tracks.map((st) => st.id)



  const totalSeconds = tracks.reduce((s, st) => s + st.track.duration, 0)
  const bpmValues = tracks.map((st) => st.track.bpm)
  const bpmMin = bpmValues.length ? Math.min(...bpmValues) : 0
  const bpmMax = bpmValues.length ? Math.max(...bpmValues) : 0

  const selectedSetTrack = tracks.find((st) => st.id === selectedTrackId)
  const selectedPosition = selectedSetTrack ? selectedSetTrack.position + 1 : null

  const isEmpty = !currentSet || tracks.length === 0

  function handleNameBlur(e: React.FocusEvent<HTMLInputElement>) {
    const v = e.currentTarget.value.trim()
    if (v) renameCurrentSet(v)
    else if (nameRef.current && currentSet) nameRef.current.value = currentSet.name
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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
            <div className="ss-caption">
              {formatDuration(totalSeconds)} · {tracks.length} track{tracks.length !== 1 ? 's' : ''}
              {bpmValues.length > 0 ? ` · ${Math.round(bpmMin)}–${Math.round(bpmMax)} BPM` : ''}
            </div>
          ) : (
            <div className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>No set loaded</div>
          )}
        </div>
        <SegmentedControl options={VIEWS} value={view} onChange={setView} />
      </div>

      <EnergyCurveGraph
        tracks={tracks}
        selectedPosition={selectedPosition}
        viewMode={view === 'BPM' ? 'bpm' : 'energy'}
        energyCurveType={currentSet?.energyCurveType}
      />

      <div
        ref={setNodeRef}
        className={clsx('tl-list', isOver && 'drop-over')}
      >
        {isEmpty ? (
          <div className="tl-empty">
            <ListMusic size={32} strokeWidth={1} style={{ color: 'var(--text-tertiary)' }} />
            <div>
              <div className="ss-body-sm" style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>
                Add tracks from your library or let Set Architect build your set
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" onClick={() => createSet()}>
                New set
              </Button>
              <Button variant="ghost" onClick={() => showModal('architect')}>
                <Sparkles size={13} strokeWidth={1.5} style={{ marginRight: 4 }} />
                Set Architect
              </Button>
            </div>
          </div>
        ) : (
          <>
            <SortableContext items={setTrackIds} strategy={verticalListSortingStrategy}>
              {tracks.map((st) => (
                <TimelineTrackCard
                  key={st.id}
                  setTrack={st}
                  isSelected={selectedTrackId === st.id}
                  onSelect={() => setSelectedTrack(st.id)}
                  onRemove={() => removeTrack(st.id)}
                />
              ))}
            </SortableContext>
          </>
        )}
      </div>
    </div>
  )
}
