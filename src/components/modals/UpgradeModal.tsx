import { useEffect, useRef, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { APP_NAME } from '@/utils/constants'
import {
  X,
  Check,
  Sparkles,
  Heart,
  KeyRound,
  Loader2,
  Music,
  ListMusic,
  CalendarDays
} from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { Modal } from '@/components/shared/Modal'
import { useUiStore } from '@/stores/uiStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSetStore } from '@/stores/setStore'
import { useRecallStore } from '@/stores/recallStore'
import { PRO_FEATURES, PRO_BENEFITS, PRO_PRICING, TIP_AMOUNTS } from '@/utils/entitlements'
import type { LicenseActivationError } from '@/types'

/** Selectable plans (tip is checkout-only, never a card). Annual is the default. */
type PlanChoice = 'monthly' | 'annual' | 'lifetime'

const ACTIVATION_MESSAGE_KEYS: Record<LicenseActivationError, string> = {
  malformed: 'upgrade.activationError.malformed',
  'bad-signature': 'upgrade.activationError.badSignature',
  expired: 'upgrade.activationError.expired',
  'device-mismatch': 'upgrade.activationError.deviceMismatch',
  revoked: 'upgrade.activationError.revoked',
  unknown: 'upgrade.activationError.unknown'
}

export function UpgradeModal(): React.JSX.Element {
  const { t } = useTranslation('modals')
  const closeModal = useUiStore((s) => s.closeModal)
  const upgradeContext = useUiStore((s) => s.upgradeContext)
  const pendingActivationKey = useUiStore((s) => s.pendingActivationKey)
  const clearPendingActivationKey = useUiStore((s) => s.clearPendingActivationKey)
  const checkout = useLicenseStore((s) => s.checkout)
  const activate = useLicenseStore((s) => s.activate)
  const isPro = useLicenseStore((s) => s.license.tier === 'pro')
  const licenseStatus = useLicenseStore((s) => s.license.status)
  const trialDaysRemaining = useLicenseStore((s) => s.license.trialDaysRemaining)
  // A trial unlocks everything (tier === 'pro') but should still see the upsell.
  const onTrial = licenseStatus === 'trial'
  const trialExpired = licenseStatus === 'trial-expired'

  // The user's own investment — shown back to them above the price. This is the
  // endowment lever (Nunes & Drèze) made loss-salient (Kahneman–Tversky): people
  // pay to keep what's already theirs far more readily than to acquire it. Every
  // number here is real (no fabrication); zero-value tiles are simply omitted.
  const trackCount = useLibraryStore((s) => s.tracks.length)
  const setCount = useSetStore((s) => s.savedSets.length)
  const gigCount = useRecallStore((s) => s.gigs.length)

  // Annual is pre-selected: defaults are chosen disproportionately (default bias),
  // and annual is also the centre-stage card and the best value vs the monthly decoy.
  const [plan, setPlan] = useState<PlanChoice>('annual')

  const [keyInput, setKeyInput] = useState('')
  const [activating, setActivating] = useState(false)
  const [activationError, setActivationError] = useState<LicenseActivationError | null>(null)
  const [showKeyEntry, setShowKeyEntry] = useState(false)
  const autoActivatedRef = useRef(false)

  const feature = upgradeContext ? PRO_FEATURES[upgradeContext] : null

  const valueTiles = [
    trackCount > 0 && {
      icon: Music,
      n: trackCount,
      label: t('upgrade.tile.tracks', { count: trackCount })
    },
    setCount > 0 && {
      icon: ListMusic,
      n: setCount,
      label: t('upgrade.tile.sets', { count: setCount })
    },
    gigCount > 0 && {
      icon: CalendarDays,
      n: gigCount,
      label: t('upgrade.tile.gigs', { count: gigCount })
    }
  ].filter(Boolean) as { icon: typeof Music; n: number; label: string }[]

  const ctaLabel =
    plan === 'lifetime'
      ? t('upgrade.ctaLifetime', { price: PRO_PRICING.lifetime.price })
      : plan === 'annual'
        ? t('upgrade.ctaAnnual', { price: PRO_PRICING.annual.price })
        : t('upgrade.ctaMonthly', { price: PRO_PRICING.monthly.price })

  const handleCheckout = (plan: 'monthly' | 'annual' | 'lifetime' | 'tip', tip?: number): void => {
    void checkout(plan, tip)
  }

  const handleActivate = async (rawKey?: string): Promise<void> => {
    const key = (rawKey ?? keyInput).trim()
    if (!key || activating) return
    setActivating(true)
    setActivationError(null)
    try {
      const result = await activate(key)
      if (!result.ok) {
        setActivationError(result.error ?? 'unknown')
        return
      }
      // Success — licenseStore now holds Pro; the modal flips to the confirmation view.
    } catch {
      setActivationError('unknown')
    } finally {
      setActivating(false)
    }
  }

  // A deep-link delivered a key: reveal the field, pre-fill it, and activate
  // automatically (once). The manual-paste UI stays as the fallback on error.
  useEffect(() => {
    if (!pendingActivationKey || autoActivatedRef.current) return
    autoActivatedRef.current = true
    setShowKeyEntry(true)
    setKeyInput(pendingActivationKey)
    void handleActivate(pendingActivationKey)
    clearPendingActivationKey()
    // handleActivate/clearPendingActivationKey are stable enough for a one-shot run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingActivationKey])

  return (
    <Modal
      onClose={closeModal}
      ariaLabel={t('upgrade.ariaLabel', { app: APP_NAME })}
      maxWidth={720}
      className="upgrade-modal"
      bloom={{ icon: 'sparkles', tone: 'lime' }}
    >
      <div className="modal-header">
        <div className="upgrade-title">
          <Sparkles size={18} strokeWidth={1.7} className="upgrade-title-icon" aria-hidden="true" />
          <span className="ss-h2">{t('upgrade.proTitle', { app: APP_NAME })}</span>
        </div>
        <IconButton icon={X} size="sm" aria-label={t('common.close')} onClick={closeModal} />
      </div>

      <div className="modal-body">
        {isPro && !onTrial ? (
          <div className="upgrade-success">
            <div className="upgrade-success-icon">
              <Check size={28} strokeWidth={2.2} />
            </div>
            <h3 className="ss-h3">{t('upgrade.successTitle')}</h3>
            <p
              className="ss-body-sm"
              style={{ color: 'var(--text-secondary)', textAlign: 'center' }}
            >
              {t('upgrade.successBody', { app: APP_NAME })}
            </p>
            <Button variant="primary" onClick={closeModal}>
              {t('upgrade.startMixing')}
            </Button>
          </div>
        ) : (
          <>
            {valueTiles.length > 0 && (
              <div className="upgrade-value" aria-label={t('upgrade.valueAria', { app: APP_NAME })}>
                {valueTiles.map((t) => (
                  <div key={t.label} className="upgrade-value-tile">
                    <t.icon size={15} strokeWidth={1.7} aria-hidden="true" />
                    <span className="upgrade-value-n">{t.n.toLocaleString()}</span>
                    <span className="upgrade-value-label">{t.label}</span>
                  </div>
                ))}
              </div>
            )}

            {onTrial ? (
              <div
                className={`upgrade-context${(trialDaysRemaining ?? 0) <= 2 ? ' upgrade-context-urgent' : ''}`}
              >
                <Trans
                  t={t}
                  i18nKey={
                    trialDaysRemaining === 1
                      ? 'upgrade.trialEndsTomorrow'
                      : 'upgrade.trialEndsInDays'
                  }
                  count={trialDaysRemaining ?? 0}
                  components={[<strong key="0" />]}
                />
              </div>
            ) : trialExpired ? (
              <div className="upgrade-context upgrade-context-urgent">
                <Trans t={t} i18nKey="upgrade.trialEnded" components={[<strong key="0" />]} />
              </div>
            ) : (
              feature && (
                <div className="upgrade-context">
                  <Trans
                    t={t}
                    i18nKey="upgrade.featureContext"
                    values={{ feature: feature.label, blurb: feature.blurb }}
                    components={[<strong key="0" />]}
                  />
                </div>
              )
            )}

            <div className="upgrade-plans" role="radiogroup" aria-label={t('upgrade.choosePlan')}>
              <button
                type="button"
                role="radio"
                aria-checked={plan === 'monthly'}
                className={`upgrade-plan${plan === 'monthly' ? ' is-selected' : ''}`}
                onClick={() => setPlan('monthly')}
              >
                <span className="ss-label">{t('upgrade.planMonthly')}</span>
                <div className="upgrade-plan-price">
                  <span className="upgrade-plan-amount">{PRO_PRICING.monthly.price}</span>
                  <span className="upgrade-plan-period">{PRO_PRICING.monthly.period}</span>
                </div>
                <span className="upgrade-plan-sub">{PRO_PRICING.monthly.sub}</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={plan === 'annual'}
                className={`upgrade-plan upgrade-plan-featured${plan === 'annual' ? ' is-selected' : ''}`}
                onClick={() => setPlan('annual')}
              >
                <span className="upgrade-plan-badge">{t('upgrade.recommended')}</span>
                <span className="ss-label">{t('upgrade.planAnnual')}</span>
                <div className="upgrade-plan-price">
                  <span className="upgrade-plan-amount">{PRO_PRICING.annual.price}</span>
                  <span className="upgrade-plan-period">{PRO_PRICING.annual.period}</span>
                </div>
                <span className="upgrade-plan-permonth">
                  {t('upgrade.billedYearly', { perMonth: PRO_PRICING.annual.perMonth })}
                </span>
                <span className="upgrade-plan-save">{PRO_PRICING.annual.save}</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={plan === 'lifetime'}
                className={`upgrade-plan${plan === 'lifetime' ? ' is-selected' : ''}`}
                onClick={() => setPlan('lifetime')}
              >
                <span className="ss-label">{t('upgrade.planLifetime')}</span>
                <div className="upgrade-plan-price">
                  <span className="upgrade-plan-amount">{PRO_PRICING.lifetime.price}</span>
                  <span className="upgrade-plan-period">{PRO_PRICING.lifetime.period}</span>
                </div>
                <span className="upgrade-plan-sub">{t('upgrade.lifetimeSub')}</span>
              </button>
            </div>

            <Button
              variant="primary"
              onClick={() => handleCheckout(plan)}
              style={{ width: '100%', marginBottom: 18 }}
            >
              {ctaLabel}
            </Button>

            <ul className="upgrade-benefits">
              {PRO_BENEFITS.map((b) => (
                <li key={b}>
                  <Check size={15} strokeWidth={2} aria-hidden="true" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="upgrade-tip">
              <div className="upgrade-tip-head">
                <Heart size={15} strokeWidth={1.7} aria-hidden="true" />
                <span className="ss-label">{t('upgrade.tipHead')}</span>
              </div>
              <p className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                {t('upgrade.tipBlurb', { app: APP_NAME })}
              </p>
              <div className="upgrade-tip-amounts">
                {TIP_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className="upgrade-tip-btn"
                    onClick={() => handleCheckout('tip', amount)}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>

            <div className="upgrade-restore">
              <p className="ss-caption" style={{ color: 'var(--text-tertiary)', marginBottom: 8 }}>
                {t('upgrade.restoreHint', { app: APP_NAME })}
              </p>
              {showKeyEntry ? (
                <div className="upgrade-key">
                  <label className="ss-label" htmlFor="license-key-input">
                    {t('upgrade.pasteKeyLabel')}
                  </label>
                  <div className="upgrade-key-row">
                    <input
                      id="license-key-input"
                      className="feedback-input"
                      type="text"
                      autoFocus
                      spellCheck={false}
                      autoCapitalize="off"
                      autoCorrect="off"
                      placeholder="SES1.…"
                      value={keyInput}
                      onChange={(e) => {
                        setKeyInput(e.target.value)
                        if (activationError) setActivationError(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleActivate()
                      }}
                    />
                    <Button
                      variant="primary"
                      onClick={() => void handleActivate()}
                      disabled={!keyInput.trim() || activating}
                    >
                      {activating ? (
                        <Loader2 size={16} className="spin" aria-hidden="true" />
                      ) : (
                        t('upgrade.activate')
                      )}
                    </Button>
                  </div>
                  {activationError && (
                    <p className="upgrade-key-error" role="alert">
                      {t(ACTIVATION_MESSAGE_KEYS[activationError])}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="upgrade-restore-link"
                  onClick={() => setShowKeyEntry(true)}
                >
                  <KeyRound size={14} strokeWidth={1.7} aria-hidden="true" />
                  {t('upgrade.enterKeyLink')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
