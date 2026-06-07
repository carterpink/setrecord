import { useTranslation } from 'react-i18next'
import type { TagCategory } from '@/types'
import { tagAccent, tagLabel } from '@/utils/tagging/taxonomy'

interface TagChipProps {
  category: TagCategory
  value: string
  /** Slightly larger chip for management surfaces. */
  size?: 'sm' | 'md'
  /** Renders a × that calls this; turns the chip into a removable token. */
  onRemove?: () => void
  /** Click handler (e.g. add this tag as a filter). */
  onClick?: () => void
  title?: string
  /** Dim + outline-only treatment, e.g. for an unselected option. */
  muted?: boolean
}

/**
 * A single plain-language tag pill, tinted by its category accent. The user
 * never sees the category slug or how the tag was computed — just the label.
 */
export function TagChip({
  category,
  value,
  size = 'sm',
  onRemove,
  onClick,
  title,
  muted
}: TagChipProps): React.JSX.Element {
  const { t } = useTranslation('library')
  const accent = tagAccent(category)
  const label = tagLabel(category, value)
  const pad = size === 'md' ? '4px 9px' : '3px 6px'
  const fontSize = size === 'md' ? 11 : 9.5

  return (
    <span
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation()
              onClick()
            }
          : undefined
      }
      title={title ?? label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize,
        lineHeight: 1,
        fontWeight: 600,
        padding: pad,
        borderRadius: 6,
        whiteSpace: 'nowrap',
        cursor: onClick ? 'pointer' : 'default',
        color: muted ? 'var(--text-secondary)' : accent,
        background: muted ? 'transparent' : `color-mix(in srgb, ${accent} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${accent} ${muted ? 22 : 32}%, transparent)`
      }}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          aria-label={t('tagChip.remove', { label })}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          style={{
            display: 'inline-flex',
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            padding: 0,
            margin: 0,
            opacity: 0.7,
            fontSize: fontSize + 2,
            lineHeight: 1
          }}
        >
          ×
        </button>
      )}
    </span>
  )
}
