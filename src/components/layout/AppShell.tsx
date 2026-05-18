import { useEffect, useRef, useState } from 'react'
import { usePreviewAudio } from '@/hooks/usePreviewAudio'
import { useKeyboard } from '@/hooks/useKeyboard'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent
} from '@dnd-kit/core'
import type { Track, SetTrack } from '@/types'
import { LibraryPanel } from '@/components/library/LibraryPanel'
import { CuePointEditor } from '@/components/modals/CuePointEditor'
import { ExportModal } from '@/components/modals/ExportModal'
import { ImportModal } from '@/components/modals/ImportModal'
import { SetArchitectModal } from '@/components/modals/SetArchitectModal'
import { SettingsModal } from '@/components/modals/SettingsModal'
import { OnboardingModal } from '@/components/modals/OnboardingModal'
import { SetDetailsModal } from '@/components/modals/SetDetailsModal'
import { BulkImportConfirmModal } from '@/components/modals/BulkImportConfirmModal'
import { DiscoverPanel } from '@/components/discover/DiscoverPanel'
import { SuggestionsPanel } from '@/components/suggestions/SuggestionsPanel'
import { TimelinePanel } from '@/components/timeline/TimelinePanel'
import { DragPreviewCard } from '@/components/timeline/DragPreviewCard'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { ToastContainer } from '@/components/shared/ToastContainer'
import { AnimatePresence } from 'framer-motion'
import { BottomDock } from './BottomDock'
import { TopBar } from './TopBar'

type ActiveDrag =
  | { source: 'library'; track: Track }
  | { source: 'timeline'; setTrack: SetTrack }
  | null

export function AppShell(): React.JSX.Element {
  const { openModal, onboardingVisible, showOnboarding, lightMode, setEnergyAnalysis, mode, hydrateFromSettings } = useUiStore()
  const { loadLibrary, applyFileStatusChanges, patchTrackEnergy } = useLibraryStore()
  const { loadSets, addTrack, reorderTracks } = useSetStore()
  const themeHasMounted = useRef(false)

  usePreviewAudio()
  useKeyboard()

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', lightMode ? 'light' : 'dark')
    if (!themeHasMounted.current) {
      themeHasMounted.current = true
      return
    }
    root.classList.add('theme-transitioning')
    const t = setTimeout(() => root.classList.remove('theme-transitioning'), 650)
    return () => clearTimeout(t)
  }, [lightMode])

  // Subscribe to background file-health push events from main process
  useEffect(() => {
    // Guard for browser-only preview where IPC bridge is absent
    if (typeof window.setsense === 'undefined') return
    const unsub = window.setsense.onFileStatusUpdate(applyFileStatusChanges)
    return unsub
  }, [applyFileStatusChanges])

  // Hydrate Learn Mode + Pro flag from persisted AppSettings on boot
  useEffect(() => {
    if (typeof window.setsense === 'undefined') return
    void window.setsense.getSettings().then((s) =>
      hydrateFromSettings({ learnModeEnabled: s.learnModeEnabled, isPro: s.isPro }),
    )
  }, [hydrateFromSettings])

  // Subscribe to background energy-analysis events from main process
  useEffect(() => {
    if (typeof window.setsense === 'undefined') return
    const unsubProgress = window.setsense.onEnergyProgress((p) => {
      setEnergyAnalysis(p.phase === 'done' ? null : { processed: p.processed, total: p.total })
    })
    const unsubUpdate = window.setsense.onEnergyUpdate((u) => {
      patchTrackEnergy(u.trackId, u.energy, u.source)
    })
    return () => {
      unsubProgress()
      unsubUpdate()
    }
  }, [patchTrackEnergy, setEnergyAnalysis])
  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null)
  const [dockVisible, setDockVisible] = useState(false)
  const dockHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>): void {
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
    loadLibrary().then(() => {
      const { hasLibrary } = useLibraryStore.getState()
      if (!hasLibrary) showOnboarding()
    })
    loadSets()
  }, [loadLibrary, loadSets, showOnboarding])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  )

  function handleDragStart(event: DragStartEvent): void {
    const data = event.active.data.current as ActiveDrag
    setActiveDrag(data)
  }

  function handleDragEnd(event: DragEndEvent): void {
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
        {mode === 'Prepare' ? (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="app-grid">
              <ErrorBoundary label="library">
                <LibraryPanel />
              </ErrorBoundary>
              <ErrorBoundary label="timeline">
                <TimelinePanel />
              </ErrorBoundary>
              <ErrorBoundary label="suggestions">
                <SuggestionsPanel />
              </ErrorBoundary>
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
        ) : (
          <ErrorBoundary label="discover">
            <DiscoverPanel />
          </ErrorBoundary>
        )}
        <BottomDock visible={dockVisible} />
      </div>
      <AnimatePresence mode="wait">
        {openModal === 'import' && <ImportModal key="import" />}
        {openModal === 'architect' && <SetArchitectModal key="architect" />}
        {openModal === 'cueEditor' && <CuePointEditor key="cueEditor" />}
        {openModal === 'validate' && <ExportModal key="validate" validateOnly />}
        {openModal === 'export' && <ExportModal key="export" />}
        {openModal === 'settings' && <SettingsModal key="settings" />}
        {openModal === 'setDetails' && <SetDetailsModal key="setDetails" />}
        {openModal === 'bulkImportConfirm' && <BulkImportConfirmModal key="bulkImportConfirm" />}
        {onboardingVisible && <OnboardingModal key="onboarding" />}
      </AnimatePresence>
      <ToastContainer />
    </>
  )
}
