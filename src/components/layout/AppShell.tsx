import { useEffect, useRef, useState } from 'react'
import { usePreviewAudio } from '@/hooks/usePreviewAudio'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { Track, SetTrack } from '@/types'
import { LibraryPanel } from '@/components/library/LibraryPanel'
import { ComingSoonModal } from '@/components/modals/ComingSoonModal'
import { CuePointEditor } from '@/components/modals/CuePointEditor'
import { ImportModal } from '@/components/modals/ImportModal'
import { SetArchitectModal } from '@/components/modals/SetArchitectModal'
import { SuggestionsPanel } from '@/components/suggestions/SuggestionsPanel'
import { TimelinePanel } from '@/components/timeline/TimelinePanel'
import { DragPreviewCard } from '@/components/timeline/DragPreviewCard'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { BottomDock } from './BottomDock'
import { TopBar } from './TopBar'

type ActiveDrag =
  | { source: 'library'; track: Track }
  | { source: 'timeline'; setTrack: SetTrack }
  | null

export function AppShell(): React.JSX.Element {
  const openModal = useUiStore((s) => s.openModal)
  const loadLibrary = useLibraryStore((s) => s.loadLibrary)
  const { loadSets, addTrack, reorderTracks } = useSetStore()

  usePreviewAudio()
  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null)
  const [dockVisible, setDockVisible] = useState(false)
  const dockHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const fromBottom = window.innerHeight - e.clientY
    // Show dock when cursor is within 140px of the bottom of the Electron window
    if (fromBottom < 140) {
      if (dockHideTimer.current !== null) {
        clearTimeout(dockHideTimer.current)
        dockHideTimer.current = null
      }
      setDockVisible(true)
    } else if (dockVisible) {
      // Hysteresis: only start the hide timer if we're more than 160px away
      if (fromBottom > 160 && dockHideTimer.current === null) {
        dockHideTimer.current = setTimeout(() => {
          setDockVisible(false)
          dockHideTimer.current = null
        }, 500)
      }
    }
  }

  useEffect(() => {
    loadLibrary()
    loadSets()
  }, [loadLibrary, loadSets])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as ActiveDrag
    setActiveDrag(data)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null)
    const { active, over } = event
    if (!over) return

    const data = active.data.current as { source: string; track?: Track; setTrack?: SetTrack }

    if (data?.source === 'library' && data.track) {
      const overId = over.id as string
      const overSource = (over.data.current as { source?: string })?.source
      if (overId === 'timeline-droppable' || overSource === 'timeline') {
        addTrack(data.track)
      }
    } else if (data?.source === 'timeline' && active.id !== over.id) {
      reorderTracks(active.id as string, over.id as string)
    }
  }

  return (
    <>
      <div className="aurora" aria-hidden="true" />
      <div className="app" onMouseMove={handleMouseMove}>
        <TopBar />
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="app-grid">
            <LibraryPanel />
            <TimelinePanel />
            <SuggestionsPanel />
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDrag ? (
              activeDrag.source === 'library' ? (
                <DragPreviewCard source="library" track={activeDrag.track} />
              ) : (
                <DragPreviewCard source="timeline" setTrack={activeDrag.setTrack} />
              )
            ) : null}
          </DragOverlay>
        </DndContext>
        <BottomDock visible={dockVisible} />
      </div>
      {openModal === 'import' && <ImportModal />}
      {openModal === 'architect' && <SetArchitectModal />}
      {openModal === 'cueEditor' && <CuePointEditor />}
      {openModal === 'validate' && <ComingSoonModal feature="Set validation" phase={7} />}
      {openModal === 'export' && <ComingSoonModal feature="Export" phase={7} />}
    </>
  )
}
