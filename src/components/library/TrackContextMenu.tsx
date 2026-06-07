import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Disc3, History, Play, Plus, Search, Tag } from 'lucide-react'
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
  onEditTags: () => void
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
  onShowCombos,
  onEditTags
}: TrackContextMenuProps): React.ReactPortal {
  const { t } = useTranslation('library')
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

  // Move focus into the menu on open so keyboard users land on the first action.
  useEffect(() => {
    const first = menuRef.current?.querySelector<HTMLButtonElement>(
      '[role="menuitem"]:not(:disabled)'
    )
    first?.focus()
  }, [])

  // Roving arrow-key navigation between enabled menu items (WCAG 2.1.1).
  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const buttons = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []
    )
    if (buttons.length === 0) return
    const idx = buttons.indexOf(document.activeElement as HTMLButtonElement)
    let next = idx
    if (e.key === 'ArrowDown') next = idx < buttons.length - 1 ? idx + 1 : 0
    else if (e.key === 'ArrowUp') next = idx > 0 ? idx - 1 : buttons.length - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = buttons.length - 1
    buttons[next]?.focus()
  }

  // Clamp menu position so it never overflows the viewport
  const menuW = 200
  const menuH = 200
  const clampedX = Math.min(x, window.innerWidth - menuW - 8)
  const clampedY = Math.min(y, window.innerHeight - menuH - 8)

  const unavailable = track.missingFile === true || track.phantom === true

  const items: MenuItem[] = [
    {
      icon: Play,
      label: t('contextMenu.preview'),
      action: onPreview,
      disabled: unavailable
    },
    {
      icon: Search,
      label: t('contextMenu.findSimilar'),
      action: onFindSimilar,
      disabled: unavailable
    },
    {
      icon: Plus,
      label: t('contextMenu.addToSet'),
      action: onAddToSet
    },
    {
      icon: Disc3,
      label: t('contextMenu.editCues'),
      action: onEditCues,
      disabled: unavailable
    },
    {
      icon: History,
      label: t('contextMenu.playedAfter'),
      action: onShowCombos
    },
    {
      icon: Tag,
      label: t('contextMenu.editTags'),
      action: onEditTags
    }
  ]

  return createPortal(
    <div
      ref={menuRef}
      className="track-context-menu glass-2"
      role="menu"
      aria-label={t('contextMenu.actionsAria', { title: track.title })}
      style={{ position: 'fixed', left: clampedX, top: clampedY, zIndex: 9999 }}
      onKeyDown={onMenuKeyDown}
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
