import { Star, Music, Flame } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ClarityReason } from '@/types'

const ICONS: Record<ClarityReason['kind'], LucideIcon> = {
  'following-dj': Star,
  'plays-artist': Music,
  'matches-genre': Music,
  trending: Flame,
}

interface Props {
  clarity: ClarityReason
}

export function ClarityBadge({ clarity }: Props): React.JSX.Element {
  const Icon = ICONS[clarity.kind]
  return (
    <span
      className={`clarity-badge clarity-${clarity.kind} glass-1`}
      title={clarity.tooltip}
      role="img"
      aria-label={`${clarity.label} — ${clarity.tooltip}`}
    >
      <Icon size={12} strokeWidth={1.7} aria-hidden="true" />
      <span>{clarity.label}</span>
    </span>
  )
}
