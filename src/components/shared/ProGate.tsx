import { Lock, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useUiStore } from '@/stores/uiStore'
import { useTrialInfo } from '@/stores/licenseStore'
import type { ProFeature } from '@/utils/entitlements'
import { PRO_FEATURES } from '@/utils/entitlements'

/** Small chartreuse "PRO" pill — flags a locked control without hiding it. */
export function ProBadge({ className }: { className?: string }): React.JSX.Element {
  return (
    <span className={`pro-badge${className ? ` ${className}` : ''}`}>
      <Sparkles size={10} strokeWidth={2} aria-hidden="true" />
      PRO
    </span>
  )
}

interface ProLockProps {
  feature: ProFeature
  /** Headline override; defaults to the feature's metadata label. */
  title?: string
  /** Sub-line override; defaults to the feature's metadata blurb. */
  description?: string
  /** Compact variant for tight panels (smaller padding, no big icon). */
  compact?: boolean
  children?: ReactNode
}

/**
 * Full-panel locked state shown in place of a Pro-only surface for free users.
 * Clicking through opens the contextual UpgradeModal for this feature.
 */
export function ProLock({
  feature,
  title,
  description,
  compact,
  children
}: ProLockProps): React.JSX.Element {
  const { t } = useTranslation('shared')
  const showUpgrade = useUiStore((s) => s.showUpgrade)
  const { expired: trialExpired } = useTrialInfo()
  const meta = PRO_FEATURES[feature]

  return (
    <div className={`pro-lock${compact ? ' pro-lock-compact' : ''}`}>
      {!compact && (
        <div className="pro-lock-icon" aria-hidden="true">
          <Lock size={22} strokeWidth={1.6} />
        </div>
      )}
      <h3 className="pro-lock-title">
        {title ?? meta.label}
        <ProBadge />
      </h3>
      <p className="pro-lock-desc">
        {trialExpired
          ? t('proGate.trialEndedPrefix', { description: description ?? meta.blurb })
          : (description ?? meta.blurb)}
      </p>
      {children}
      <button type="button" className="pro-lock-cta" onClick={() => showUpgrade(feature)}>
        <Sparkles size={14} strokeWidth={1.8} aria-hidden="true" />
        {trialExpired ? t('proGate.keepPro') : t('proGate.unlock')}
      </button>
    </div>
  )
}
