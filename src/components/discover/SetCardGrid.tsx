import { useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import type { Variants } from 'framer-motion'
import { motion, stagger } from '@/components/shared/Motion'
import { EmptyState } from '@/components/shared/EmptyState'
import { useDiscoverStore } from '@/stores/discoverStore'
import { SetCard } from './SetCard'

const containerVariants = stagger(0.04)
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.32, 0.72, 0.12, 1] as const },
  },
  exit: {},
}

export function SetCardGrid(): React.JSX.Element {
  const getVisibleSets = useDiscoverStore((s) => s.getVisibleSets)
  const activeTab = useDiscoverStore((s) => s.activeTab)
  const filters = useDiscoverStore((s) => s.filters)
  const sortMode = useDiscoverStore((s) => s.sortMode)
  const sets = useDiscoverStore((s) => s.sets)
  const isLoading = useDiscoverStore((s) => s.isLoading)
  const isLoadingMore = useDiscoverStore((s) => s.isLoadingMore)
  const hasMore = useDiscoverStore((s) => s.hasMore)
  const loadMoreSets = useDiscoverStore((s) => s.loadMoreSets)

  // Sentinel div at the bottom — IntersectionObserver triggers the next page load
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          void loadMoreSets()
        }
      },
      { rootMargin: '200px' },  // start loading 200px before the sentinel is visible
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, loadMoreSets])

  // Trigger re-derive when filters/sort/tab change
  void activeTab; void filters; void sortMode; void sets
  const visible = getVisibleSets()

  if (isLoading) {
    return (
      <div className="discover-loading ss-body-sm">
        <div className="discover-loading-spinner" />
        Loading sets…
      </div>
    )
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="No sets match"
        body="Try clearing filters or switching tab — there are more sets to discover."
      />
    )
  }

  return (
    <>
      <motion.div
        className="discover-grid"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {visible.map((s) => (
          <motion.div key={s.id} variants={itemVariants}>
            <SetCard set={s} />
          </motion.div>
        ))}
      </motion.div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="discover-sentinel" aria-hidden="true" />

      {isLoadingMore && (
        <div className="discover-load-more ss-body-sm">
          <div className="discover-loading-spinner" />
          Loading more…
        </div>
      )}
    </>
  )
}
