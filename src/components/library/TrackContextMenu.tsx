import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import { Disc3, History, Play, Plus, Search } from 'lucide-react'
import type { Track } from '@/types'

interface TrackContextMenuProps {
  track: Track
  x: number
  y: number
  onClose: () => void
  onPreview: () => void
  onFindSimilar: () => void
  onAddToSet: () => void
  onEditCues: () => void
  onShowCombos: () => void
}

interface MenuItem {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  label: string
  action: () => void
  disabled?: boolean
}

export function TrackContextMenu({
  track,
  x,
  y,
  onClose,
  onPreview,
  onFindSimilar,
  onAddToSet,
  onEditCues,
  onShowCombos
}: TrackContextMenuProps): React.ReactPortal {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside or Escape
  useEffect(() => {
    function handleMouseDown(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // Clamp menu position so it never overflows the viewport
  const menuW = 200
  const menuH = 200
  const clampedX = Math.min(x, window.innerWidth - menuW - 8)
  const clampedY = Math.min(y, window.innerHeight - menuH - 8)

  const unavailable = track.missingFile === true || track.phantom === true

  const items: MenuItem[] = [
    {
      icon: Play,
      label: 'Preview',
      action: onPreview,
      disabled: unavailable
    },
    {
      icon: Search,
      label: 'Find similar tracks',
      action: onFindSimilar,
      disabled: unavailable
    },
    {
      icon: Plus,
      label: 'Add to set',
      action: onAddToSet
    },
    {
      icon: Disc3,
      label: 'Edit cue points',
      action: onEditCues,
      disabled: unavailable
    },
    {
      icon: History,
      label: 'What have I played after this?',
      action: onShowCombos
    }
  ]

  return createPortal(
    <div
      ref={menuRef}
      className="track-context-menu glass-2"
      role="menu"
      aria-label={`Actions for ${track.title}`}
      style={{ position: 'fixed', left: clampedX, top: clampedY, zIndex: 9999 }}
    >
      <div className="ctx-menu-header ss-caption">{track.title}</div>
      {items.map((item) => (
        <button
          key={item.label}
          role="menuitem"
          className="ctx-menu-item"
          disabled={item.disabled}
          onClick={() => {
            item.action()
            onClose()
          }}
        >
          <item.icon size={13} strokeWidth={1.5} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>,
    document.body
  )
}
