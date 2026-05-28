import { useMemo, useRef, useState } from 'react'
import { ChevronDown, ListMusic, Music2, PanelLeftClose, PanelLeftOpen, Folder } from 'lucide-react'
import clsx from 'clsx'
import type { Playlist } from '@/types'
import { useLibraryStore } from '@/stores/libraryStore'
import { useUiStore } from '@/stores/uiStore'
import {
  motion,
  AnimatePresence,
  slideUp,
  stagger,
} from '@/components/shared/Motion'

const SNAPPY = [0.32, 0.72, 0.12, 1] as const

const MIN_WIDTH = 140
const MAX_WIDTH = 360
const DEFAULT_WIDTH = 180

function getStoredWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH
  const raw = window.localStorage.getItem('setsense-playlist-sidebar-width')
  if (!raw) return DEFAULT_WIDTH
  const n = parseInt(raw, 10)
  return isNaN(n) ? DEFAULT_WIDTH : Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n))
}

// ───────── Tree builder ─────────

interface TreeNode {
  playlist: Playlist
  children: TreeNode[]
  count: number
}

function buildTree(playlists: Playlist[]): TreeNode[] {
  const byParent = new Map<string | null, Playlist[]>()
  for (const p of playlists) {
    const list = byParent.get(p.parentId) ?? []
    list.push(p)
    byParent.set(p.parentId, list)
  }

  function visit(parent: string | null): TreeNode[] {
    const kids = byParent.get(parent) ?? []
    return kids.map((playlist) => {
      const children = visit(playlist.id)
      let count: number
      if (children.length === 0) {
        count = playlist.trackIds.length
      } else {
        const seen = new Set<string>()
        for (const id of playlist.trackIds) seen.add(id)
        const walk = (n: TreeNode): void => {
          for (const id of n.playlist.trackIds) seen.add(id)
          n.children.forEach(walk)
        }
        children.forEach(walk)
        count = seen.size
      }
      return { playlist, children, count }
    })
  }

  return visit(null)
}

// ───────── PlaylistRow ─────────

interface RowProps {
  node: TreeNode
  depth: number
  expanded: Record<string, boolean>
  onToggle: (id: string) => void
}

function PlaylistRow({ node, depth, expanded, onToggle }: RowProps): React.JSX.Element {
  const { playlist, children, count } = node
  const selectedPlaylistId = useUiStore((s) => s.selectedPlaylistId)
  const setSelectedPlaylist = useUiStore((s) => s.setSelectedPlaylist)
  const isOpen = expanded[playlist.id] ?? depth < 1
  const isSelected = selectedPlaylistId === playlist.id
  const hasChildren = children.length > 0

  const handleClick = (): void => {
    if (playlist.isFolder && hasChildren) {
      onToggle(playlist.id)
    } else {
      setSelectedPlaylist(isSelected ? null : playlist.id)
    }
  }

  return (
    <>
      <div
        className={clsx('playlist-row', {
          'playlist-row-selected': isSelected,
          'playlist-row-folder': playlist.isFolder,
        })}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
      >
        {hasChildren ? (
          <motion.span
            animate={{ rotate: isOpen ? 0 : -90 }}
            transition={{ duration: 0.2, ease: SNAPPY }}
            style={{ display: 'flex', flexShrink: 0 }}
          >
            <ChevronDown size={12} />
          </motion.span>
        ) : (
          <span style={{ width: 12, flexShrink: 0 }} />
        )}
        {playlist.isFolder ? (
          <Folder size={13} strokeWidth={1.5} className="playlist-row-icon" />
        ) : (
          <Music2 size={13} strokeWidth={1.5} className="playlist-row-icon" />
        )}
        <span className="playlist-row-name" title={playlist.name}>{playlist.name}</span>
        <span className="playlist-row-count">{count}</span>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && hasChildren && (
          <motion.div
            key={`children-${playlist.id}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: SNAPPY }}
            style={{ overflow: 'hidden' }}
          >
            {children.map((child) => (
              <PlaylistRow
                key={child.playlist.id}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ───────── PlaylistSidebar ─────────

export function PlaylistSidebar(): React.JSX.Element | null {
  const playlists = useLibraryStore((s) => s.playlists)
  const tracks = useLibraryStore((s) => s.tracks)
  const selectedPlaylistId = useUiStore((s) => s.selectedPlaylistId)
  const setSelectedPlaylist = useUiStore((s) => s.setSelectedPlaylist)
  const collapsed = useUiStore((s) => s.playlistSidebarCollapsed)
  const togglePlaylistSidebar = useUiStore((s) => s.togglePlaylistSidebar)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [sidebarWidth, setSidebarWidth] = useState(getStoredWidth)

  // Ref for direct DOM manipulation during drag (avoids framer conflicts)
  const rootRef = useRef<HTMLDivElement>(null)

  const tree = useMemo(() => buildTree(playlists), [playlists])

  if (playlists.length === 0) return null

  // ── Drag-to-resize ──
  function handleResizerMouseDown(e: React.MouseEvent<HTMLDivElement>): void {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    // Kill CSS transition while dragging so there's no lag
    if (rootRef.current) rootRef.current.style.transition = 'none'
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMove(ev: MouseEvent): void {
      if (!rootRef.current) return
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + ev.clientX - startX))
      rootRef.current.style.width = `${newWidth}px`
    }

    function onUp(): void {
      const el = rootRef.current
      const newWidth = el
        ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(parseFloat(el.style.width || String(startWidth)))))
        : startWidth

      // Re-enable CSS transition for future collapse/expand
      if (el) el.style.transition = ''
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      setSidebarWidth(newWidth)
      window.localStorage.setItem('setsense-playlist-sidebar-width', String(newWidth))

      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Width: CSS transition handles collapse/expand; drag manipulates style directly.
  // We don't use framer's `animate` prop for width to avoid conflicts with drag.
  const currentWidth = collapsed ? 34 : sidebarWidth

  return (
    <div
      ref={rootRef}
      className="playlist-sidebar-root"
      style={{ width: currentWidth }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {collapsed ? (
          /* ── Collapsed rail ── */
          <motion.div
            key="collapsed"
            className="playlist-sidebar-collapsed-inner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <button
              className="playlist-sidebar-toggle"
              onClick={togglePlaylistSidebar}
              aria-label="Show playlists"
              title="Show playlists"
            >
              <PanelLeftOpen size={14} strokeWidth={1.5} />
            </button>
          </motion.div>
        ) : (
          /* ── Expanded sidebar ── */
          <motion.div
            key="expanded"
            className="playlist-sidebar-expanded-inner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, delay: 0.08 }}
          >
            {/* Header */}
            <div className="playlist-sidebar-header">
              <span
                className="ss-label"
                style={{
                  flex: 1,
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text-tertiary)',
                }}
              >
                Playlists
              </span>
              <button
                className="playlist-sidebar-toggle"
                onClick={togglePlaylistSidebar}
                aria-label="Hide playlists"
                title="Hide playlists"
              >
                <PanelLeftClose size={14} strokeWidth={1.5} />
              </button>
            </div>

            {/* Scrollable list */}
            <div className="playlist-sidebar-list">
              <motion.div initial="hidden" animate="visible" variants={stagger(0.025)}>
                {/* All Tracks pinned at top */}
                <motion.div variants={slideUp}>
                  <div
                    className={clsx('playlist-row', {
                      'playlist-row-selected': selectedPlaylistId === null,
                    })}
                    style={{ paddingLeft: 8 }}
                    onClick={() => setSelectedPlaylist(null)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedPlaylist(null)
                      }
                    }}
                  >
                    <span style={{ width: 12, flexShrink: 0 }} />
                    <ListMusic size={13} strokeWidth={1.5} className="playlist-row-icon" />
                    <span className="playlist-row-name">All Tracks</span>
                    <span className="playlist-row-count">{tracks.length}</span>
                  </div>
                </motion.div>

                {/* Playlist tree */}
                {tree.map((node) => (
                  <motion.div key={node.playlist.id} variants={slideUp}>
                    <PlaylistRow
                      node={node}
                      depth={0}
                      expanded={expanded}
                      onToggle={(id) =>
                        setExpanded((prev) => ({ ...prev, [id]: !(prev[id] ?? false) }))
                      }
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag handle — only visible when expanded */}
      {!collapsed && (
        <div
          className="playlist-sidebar-resizer"
          onMouseDown={handleResizerMouseDown}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
