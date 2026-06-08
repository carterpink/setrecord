import { useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { APP_NAME } from '@/utils/constants'
import { Heart, Lightbulb, Bug, MessageSquare, Star, X, Check, Copy } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { Modal } from '@/components/shared/Modal'
import { useUiStore } from '@/stores/uiStore'

const CATEGORIES = [
  { id: 'Love', labelKey: 'feedback.cats.love', icon: Heart },
  { id: 'Idea', labelKey: 'feedback.cats.idea', icon: Lightbulb },
  { id: 'Bug', labelKey: 'feedback.cats.bug', icon: Bug },
  { id: 'Other', labelKey: 'feedback.cats.other', icon: MessageSquare }
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

const SUPPORT_EMAIL = 'carterpinkmusic@gmail.com'

export function FeedbackModal(): React.JSX.Element {
  const { t } = useTranslation('modals')
  const closeModal = useUiStore((s) => s.closeModal)

  const [category, setCategory] = useState<CategoryId>('Idea')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [copied, setCopied] = useState(false)
  // Bug reports default to attaching diagnostic logs; other categories never do.
  const [attachLogs, setAttachLogs] = useState(true)
  const [showWhatsIncluded, setShowWhatsIncluded] = useState(false)
  // Set after submit to drive the "logs opened in Finder" instruction.
  const [logsRevealed, setLogsRevealed] = useState(false)
  const [logsUnavailable, setLogsUnavailable] = useState(false)

  const submit = async (): Promise<void> => {
    if (!message.trim()) return
    const isBug = category === 'Bug'
    const meta =
      typeof navigator !== 'undefined' ? `Sent from ${APP_NAME} · ${navigator.platform}` : APP_NAME

    if (typeof window.setrecord !== 'undefined') {
      // For Bug reports we always attach the session id + version (so even an
      // un-attached report is correlatable to its Sentry issue).
      let diagnostics: { sid: string; version: string } | undefined
      if (isBug) {
        try {
          diagnostics = await window.setrecord.logSessionInfo()
        } catch {
          /* sid accessor unavailable — proceed without it */
        }
      }

      // If the user opted to attach logs (Bug only), build + reveal the bundle.
      // Failure here must NOT block sending the report.
      let revealed = false
      let unavailable = false
      if (isBug && attachLogs) {
        try {
          const res = await window.setrecord.exportLogs()
          if (res.success && res.path) {
            await window.setrecord.revealLogBundle(res.path)
            revealed = true
          } else {
            unavailable = true
          }
        } catch {
          unavailable = true
        }
      }
      setLogsRevealed(revealed)
      setLogsUnavailable(isBug && attachLogs && unavailable)

      await window.setrecord.submitFeedback({
        category,
        rating,
        message: message.trim(),
        email: email.trim() || undefined,
        meta,
        diagnostics
      })
    }
    setSent(true)
  }

  const copyMessage = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(
        `[${category}${rating ? ` ${rating}/5` : ''}] ${message.trim()}`
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <Modal onClose={closeModal} ariaLabel={t('feedback.title')} maxWidth={460}>
      <div className="modal-header">
        <div>
          <span className="ss-h2">{t('feedback.title')}</span>
          <span className="ss-caption" style={{ marginLeft: 10, color: 'var(--text-tertiary)' }}>
            {t('feedback.subtitle')}
          </span>
        </div>
        <IconButton icon={X} size="sm" aria-label={t('common.close')} onClick={closeModal} />
      </div>

      <div className="modal-body">
        {sent ? (
          <div className="feedback-sent">
            <div className="feedback-sent-icon">
              <Check size={26} strokeWidth={2} />
            </div>
            <h3 className="ss-h3">{t('feedback.thankYou')}</h3>
            <p
              className="ss-body-sm"
              style={{ color: 'var(--text-secondary)', textAlign: 'center' }}
            >
              <Trans
                t={t}
                i18nKey="feedback.sentBody"
                values={{ email: SUPPORT_EMAIL }}
                components={[<strong key="0" />]}
              />
            </p>
            {logsRevealed && (
              <p
                className="ss-body-sm"
                style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 6 }}
              >
                Your logs opened in Finder — drag the file into the email.
              </p>
            )}
            {logsUnavailable && (
              <p
                className="ss-caption"
                style={{ color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 6 }}
              >
                Logs couldn't be attached this time — your report still sent.
              </p>
            )}
            <div className="feedback-sent-actions">
              <button type="button" className="health-fix-btn" onClick={() => void copyMessage()}>
                {copied ? (
                  <Check size={13} strokeWidth={2} />
                ) : (
                  <Copy size={13} strokeWidth={1.7} />
                )}
                {copied ? t('feedback.copied') : t('feedback.copyMessage')}
              </button>
              <Button variant="primary" onClick={closeModal}>
                {t('common.done')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="feedback-cats">
              {CATEGORIES.map(({ id, labelKey, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`feedback-cat${category === id ? ' active' : ''}`}
                  onClick={() => setCategory(id)}
                >
                  <Icon size={18} strokeWidth={1.6} />
                  <span>{t(labelKey)}</span>
                </button>
              ))}
            </div>

            <div className="feedback-field">
              <span className="ss-label" id="feedback-rating-label">
                {t('feedback.ratingLabel')}
              </span>
              <div
                className="feedback-stars"
                role="group"
                aria-labelledby="feedback-rating-label"
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="feedback-star"
                    aria-label={t('feedback.starAria', { count: n })}
                    onMouseEnter={() => setHoverRating(n)}
                    onClick={() => setRating(n === rating ? 0 : n)}
                  >
                    <Star
                      size={22}
                      strokeWidth={1.6}
                      fill={(hoverRating || rating) >= n ? 'var(--accent)' : 'none'}
                      color={
                        (hoverRating || rating) >= n ? 'var(--accent)' : 'var(--text-tertiary)'
                      }
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="feedback-field">
              <label className="ss-label" htmlFor="feedback-message">
                {category === 'Bug' ? t('feedback.messageLabelBug') : t('feedback.messageLabel')}
              </label>
              <textarea
                id="feedback-message"
                className="feedback-textarea"
                rows={5}
                autoFocus
                placeholder={
                  category === 'Bug'
                    ? t('feedback.placeholderBug')
                    : category === 'Idea'
                      ? t('feedback.placeholderIdea', { app: APP_NAME })
                      : t('feedback.placeholderOther')
                }
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="feedback-field">
              <label className="ss-label" htmlFor="feedback-email">
                {t('feedback.emailLabel')}
              </label>
              <input
                id="feedback-email"
                className="feedback-input"
                type="email"
                placeholder={t('feedback.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {category === 'Bug' && (
              <div className="feedback-field">
                <label
                  className="ss-body-sm"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    cursor: 'pointer',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={attachLogs}
                    onChange={(e) => setAttachLogs(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>Attach diagnostic logs (helps me fix it faster)</span>
                </label>
                <button
                  type="button"
                  className="btn-link"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px 0 0 24px',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: '0.8em',
                    textAlign: 'left'
                  }}
                  aria-expanded={showWhatsIncluded}
                  onClick={() => setShowWhatsIncluded((v) => !v)}
                >
                  {showWhatsIncluded ? "What's included? ▲" : "What's included? ▼"}
                </button>
                {showWhatsIncluded && (
                  <p
                    className="ss-caption"
                    style={{ margin: '4px 0 0 24px', color: 'var(--text-tertiary)' }}
                  >
                    App logs with file paths and personal details removed.
                  </p>
                )}
              </div>
            )}

            <div className="arch-actions" style={{ marginTop: 4 }}>
              <button type="button" className="btn btn-ghost" onClick={closeModal}>
                {t('cancel', { ns: 'common' })}
              </button>
              <Button
                variant="primary"
                onClick={() => void submit()}
                disabled={!message.trim()}
                style={{ flex: 1 }}
              >
                {t('feedback.send')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
