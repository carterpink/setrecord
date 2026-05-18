import { useEffect, useRef } from 'react'
import { AlertTriangle, Key, RefreshCw, WifiOff } from 'lucide-react'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { useDiscoverStore } from '@/stores/discoverStore'
import { useUiStore } from '@/stores/uiStore'
import type { DiscoverTab } from '@/types'
import { DiscoverFilters } from './DiscoverFilters'
import { SetCardGrid } from './SetCardGrid'

const TABS: readonly DiscoverTab[] = ['following', 'explore']
const TAB_LABEL: Record<DiscoverTab, string> = {
  following: 'Following',
  explore: 'Explore',
}

const ERROR_ICON: Record<string, typeof AlertTriangle> = {
  no_key: Key,
  quota_exceeded: AlertTriangle,
  network: WifiOff,
}

export function DiscoverPanel(): React.JSX.Element {
  const loadSets = useDiscoverStore((s) => s.loadSets)
  const loadTasteProfile = useDiscoverStore((s) => s.loadTasteProfile)
  const tasteProfileLoaded = useDiscoverStore((s) => s.tasteProfileLoaded)
  const filterGenres = useDiscoverStore((s) => s.filters.genres)
  const activeTab = useDiscoverStore((s) => s.activeTab)
  const setActiveTab = useDiscoverStore((s) => s.setActiveTab)
  const errorCode = useDiscoverStore((s) => s.errorCode)
  const errorMessage = useDiscoverStore((s) => s.errorMessage)
  const isLoading = useDiscoverStore((s) => s.isLoading)
  const showModal = useUiStore((s) => s.showModal)
  const firstGenreEffect = useRef(true)

  // Mount: load taste profile first so the initial YouTube query uses real preferences,
  // then fetch the first page.
  useEffect(() => {
    void (async () => {
      await loadTasteProfile()
      await loadSets()
    })()
  }, [loadTasteProfile, loadSets])

  // Refetch (forceRefresh) when genre filter changes — debounced so rapid chip toggling
  // does not fire back-to-back YouTube requests. Skip the first run; mount handled it.
  useEffect(() => {
    if (!tasteProfileLoaded) return
    if (firstGenreEffect.current) {
      firstGenreEffect.current = false
      return
    }
    const handle = window.setTimeout(() => {
      void loadSets({ forceRefresh: true })
    }, 250)
    return () => window.clearTimeout(handle)
  }, [filterGenres, tasteProfileLoaded, loadSets])

  const ErrorIcon = errorCode ? (ERROR_ICON[errorCode] ?? AlertTriangle) : null

  return (
    <section className="discover-panel" aria-label="Discover">
      <header className="discover-header glass-1">
        <div className="discover-header-top">
          <h1 className="ss-h2">Discover</h1>
          <div className="discover-header-actions">
            <SegmentedControl
              options={TABS.map((t) => TAB_LABEL[t]) as readonly string[]}
              value={TAB_LABEL[activeTab]}
              onChange={(label) => {
                const next = TABS.find((t) => TAB_LABEL[t] === label)
                if (next) setActiveTab(next)
              }}
            />
            <button
              type="button"
              className="discover-refresh-btn"
              aria-label="Refresh sets"
              disabled={isLoading}
              onClick={() => void loadSets({ forceRefresh: true })}
              title="Refresh from YouTube"
            >
              <RefreshCw size={15} strokeWidth={1.7} className={isLoading ? 'discover-spin' : ''} />
            </button>
          </div>
        </div>
        <DiscoverFilters />
        {errorCode && errorMessage && (
          <div className={`discover-error-banner discover-error-${errorCode}`} role="alert">
            {ErrorIcon && <ErrorIcon size={14} strokeWidth={1.7} aria-hidden="true" />}
            <span className="ss-caption">{errorMessage}</span>
            {errorCode === 'no_key' && (
              <button
                type="button"
                className="discover-error-action"
                onClick={() => showModal('settings')}
              >
                Add API key
              </button>
            )}
          </div>
        )}
      </header>
      <div className="discover-body">
        <SetCardGrid />
      </div>
    </section>
  )
}
