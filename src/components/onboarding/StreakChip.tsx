import { Flame } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useProgressStore } from '@/stores/progressStore'

/**
 * Quiet, display-only weekly streak. Shown only from two weeks on (a single week
 * isn't a streak). Deliberately has NO loss-aversion framing — no "don't break
 * it!" nags, no countdowns. DJs prep in weekly bursts, so the streak is measured
 * in active weeks, and it simply acknowledges a habit rather than pressuring one.
 */
export function StreakChip(): React.JSX.Element | null {
  const { t } = useTranslation('onboarding')
  const currentStreak = useProgressStore((s) => s.progress.currentStreak)
  if (currentStreak < 2) return null

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        padding: '4px 10px',
        borderRadius: 999,
        background: 'var(--surface-2)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-secondary)',
        fontSize: 12
      }}
    >
      <Flame size={12} strokeWidth={1.8} style={{ color: 'var(--accent)' }} aria-hidden="true" />
      {t('streak.weeksOfPrep', { count: currentStreak })}
    </span>
  )
}
