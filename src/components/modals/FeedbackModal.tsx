import { useState } from 'react'
import FocusLock from 'react-focus-lock'
import { Heart, Lightbulb, Bug, MessageSquare, Star, X, Check, Copy } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { motion, modalBackdrop, modalPanel } from '@/components/shared/Motion'
import { useUiStore } from '@/stores/uiStore'

const CATEGORIES = [
  { id: 'Love', label: 'Love it', icon: Heart },
  { id: 'Idea', label: 'Idea', icon: Lightbulb },
  { id: 'Bug', label: 'Bug', icon: Bug },
  { id: 'Other', label: 'Other', icon: MessageSquare }
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

const SUPPORT_EMAIL = 'carterpinkmusic@gmail.com'

export function FeedbackModal(): React.JSX.Element {
  const closeModal = useUiStore((s) => s.closeModal)

  const [category, setCategory] = useState<CategoryId>('Idea')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [copied, setCopied] = useState(false)

  const submit = async (): Promise<void> => {
    if (!message.trim()) return
    const meta =
      typeof navigator !== 'undefined' ? `Sent from SetSense · ${navigator.platform}` : 'SetSense'
    if (typeof window.setsense !== 'undefined') {
      await window.setsense.submitFeedback({
        category,
        rating,
        message: message.trim(),
        email: email.trim() || undefined,
        meta
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
          className="modal glass-3"
          variants={modalPanel}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ maxWidth: 460 }}
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div>
              <span className="ss-h2">Send feedback</span>
              <span
                className="ss-caption"
                style={{ marginLeft: 10, color: 'var(--text-tertiary)' }}
              >
                Shapes what we build next
              </span>
            </div>
            <IconButton icon={X} size="sm" aria-label="Close" onClick={closeModal} />
          </div>

          <div className="modal-body">
            {sent ? (
              <div className="feedback-sent">
                <div className="feedback-sent-icon">
                  <Check size={26} strokeWidth={2} />
                </div>
                <h3 className="ss-h3">Thank you</h3>
                <p
                  className="ss-body-sm"
                  style={{ color: 'var(--text-secondary)', textAlign: 'center' }}
                >
                  A pre-filled email just opened — hit send and it lands with us. If nothing opened,
                  email <strong>{SUPPORT_EMAIL}</strong> directly.
                </p>
                <div className="feedback-sent-actions">
                  <button
                    type="button"
                    className="health-fix-btn"
                    onClick={() => void copyMessage()}
                  >
                    {copied ? (
                      <Check size={13} strokeWidth={2} />
                    ) : (
                      <Copy size={13} strokeWidth={1.7} />
                    )}
                    {copied ? 'Copied' : 'Copy message'}
                  </button>
                  <Button variant="primary" onClick={closeModal}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="feedback-cats">
                  {CATEGORIES.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className={`feedback-cat${category === id ? ' active' : ''}`}
                      onClick={() => setCategory(id)}
                    >
                      <Icon size={18} strokeWidth={1.6} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                <div className="feedback-field">
                  <label className="ss-label">How’s it feeling?</label>
                  <div className="feedback-stars" onMouseLeave={() => setHoverRating(0)}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className="feedback-star"
                        aria-label={`${n} star${n === 1 ? '' : 's'}`}
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
                  <label className="ss-label">
                    {category === 'Bug' ? 'What went wrong?' : 'Tell us more'}
                  </label>
                  <textarea
                    className="feedback-textarea"
                    rows={5}
                    autoFocus
                    placeholder={
                      category === 'Bug'
                        ? 'What did you do, and what happened instead?'
                        : category === 'Idea'
                          ? 'What would make SetSense better for you?'
                          : 'Share anything — the good, the rough, the wishlist.'
                    }
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                <div className="feedback-field">
                  <label className="ss-label">Email (optional — so we can reply)</label>
                  <input
                    className="feedback-input"
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="arch-actions" style={{ marginTop: 4 }}>
                  <button type="button" className="btn btn-ghost" onClick={closeModal}>
                    Cancel
                  </button>
                  <Button
                    variant="primary"
                    onClick={() => void submit()}
                    disabled={!message.trim()}
                    style={{ flex: 1 }}
                  >
                    Send feedback
                  </Button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </FocusLock>
    </motion.div>
  )
}
