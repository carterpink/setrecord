import { useEffect, useRef, useState } from 'react'
import FocusLock from 'react-focus-lock'
import { X, Check, Sparkles, Heart, KeyRound, Loader2 } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { motion, modalBackdrop, modalPanel } from '@/components/shared/Motion'
import { useUiStore } from '@/stores/uiStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { PRO_FEATURES, PRO_BENEFITS, PRO_PRICING, TIP_AMOUNTS } from '@/utils/entitlements'
import type { LicenseActivationError } from '@/types'

const ACTIVATION_MESSAGES: Record<LicenseActivationError, string> = {
  malformed: 'That key doesn’t look right. Paste the full key from your confirmation email.',
  'bad-signature': 'This key couldn’t be verified. Check for a typo, or contact support.',
  expired: 'This key has expired. Renew your subscription to reactivate Pro.',
  'device-mismatch':
    'This key is already activated on another device. Deactivate it there first, or contact support to move your licence.',
  revoked:
    'This licence has been cancelled or refunded. If that’s a mistake, contact support and we’ll sort it out.',
  unknown: 'Something went wrong activating that key. Try again in a moment.'
}

export function UpgradeModal(): React.JSX.Element {
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

  const [keyInput, setKeyInput] = useState('')
  const [activating, setActivating] = useState(false)
  const [activationError, setActivationError] = useState<LicenseActivationError | null>(null)
  const [showKeyEntry, setShowKeyEntry] = useState(false)
  const autoActivatedRef = useRef(false)

  const feature = upgradeContext ? PRO_FEATURES[upgradeContext] : null

  const handleCheckout = (plan: 'subscription' | 'lifetime' | 'tip', tip?: number): void => {
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
    <motion.div
      className="modal-overlay"
      variants={modalBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={closeModal}
    >
      <FocusLock returnFocus>
        <motion.div
          className="modal glass-3 upgrade-modal"
          variants={modalPanel}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ maxWidth: 720 }}
          role="dialog"
          aria-modal="true"
          aria-label="Upgrade to SetSense Pro"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div className="upgrade-title">
              <Sparkles
                size={18}
                strokeWidth={1.7}
                className="upgrade-title-icon"
                aria-hidden="true"
              />
              <span className="ss-h2">SetSense Pro</span>
            </div>
            <IconButton icon={X} size="sm" aria-label="Close" onClick={closeModal} />
          </div>

          <div className="modal-body">
            {isPro && !onTrial ? (
              <div className="upgrade-success">
                <div className="upgrade-success-icon">
                  <Check size={28} strokeWidth={2.2} />
                </div>
                <h3 className="ss-h3">You’re on Pro</h3>
                <p
                  className="ss-body-sm"
                  style={{ color: 'var(--text-secondary)', textAlign: 'center' }}
                >
                  Everything’s unlocked — suggestions, Set Architect, Recall, Export and more.
                  Thanks for supporting SetSense.
                </p>
                <Button variant="primary" onClick={closeModal}>
                  Start mixing
                </Button>
              </div>
            ) : (
              <>
                {onTrial ? (
                  <div className="upgrade-context">
                    <strong>
                      You’re on a Pro trial —{' '}
                      {trialDaysRemaining === 1
                        ? '1 day left'
                        : `${trialDaysRemaining ?? 0} days left`}
                      .
                    </strong>{' '}
                    Upgrade any time to keep Suggestions, Set Architect, Recall and Export when the
                    trial ends.
                  </div>
                ) : (
                  feature && (
                    <div className="upgrade-context">
                      <strong>{feature.label}</strong> is a Pro feature — {feature.blurb}
                    </div>
                  )
                )}

                <div className="upgrade-plans">
                  <div className="upgrade-plan">
                    <div className="upgrade-plan-head">
                      <span className="ss-label">Monthly</span>
                    </div>
                    <div className="upgrade-plan-price">
                      <span className="upgrade-plan-amount">{PRO_PRICING.subscription.price}</span>
                      <span className="upgrade-plan-period">{PRO_PRICING.subscription.period}</span>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => handleCheckout('subscription')}
                      style={{ width: '100%' }}
                    >
                      Subscribe
                    </Button>
                  </div>

                  <div className="upgrade-plan upgrade-plan-featured">
                    <div className="upgrade-plan-badge">Best value</div>
                    <div className="upgrade-plan-head">
                      <span className="ss-label">Lifetime</span>
                    </div>
                    <div className="upgrade-plan-price">
                      <span className="upgrade-plan-amount">{PRO_PRICING.lifetime.price}</span>
                      <span className="upgrade-plan-period">{PRO_PRICING.lifetime.period}</span>
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => handleCheckout('lifetime')}
                      style={{ width: '100%' }}
                    >
                      Buy lifetime
                    </Button>
                  </div>
                </div>

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
                    <span className="ss-label">Support the developer</span>
                  </div>
                  <p className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                    SetSense is built by one DJ. A tip is optional and keeps it independent.
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
                  <p
                    className="ss-caption"
                    style={{ color: 'var(--text-tertiary)', marginBottom: 8 }}
                  >
                    After checkout, SetSense will activate automatically. If not, paste your key
                    here.
                  </p>
                  {showKeyEntry ? (
                    <div className="upgrade-key">
                      <label className="ss-label" htmlFor="license-key-input">
                        Already purchased? Paste your license key
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
                            'Activate'
                          )}
                        </Button>
                      </div>
                      {activationError && (
                        <p className="upgrade-key-error" role="alert">
                          {ACTIVATION_MESSAGES[activationError]}
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
                      Already purchased? Enter your key
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </FocusLock>
    </motion.div>
  )
}
