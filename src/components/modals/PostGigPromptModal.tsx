import { useState } from 'react'
import FocusLock from 'react-focus-lock'
import { Check, X, FlaskConical, Archive } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { motion, modalBackdrop, modalPanel } from '@/components/shared/Motion'
import { useUiStore } from '@/stores/uiStore'
import { useRecallStore } from '@/stores/recallStore'

type Outcome = 'tested' | 'archive' | 'keep'

/**
 * Post-gig prompt — shown after the user marks a set as performed if any tracks
 * they had flagged for testing appeared in that set. For each row:
 *   Tested ✓   → lifecycle = 'active', clear flag
 *   Not yet    → keep flag, leave lifecycle alone
 *   Archive    → lifecycle = 'archive', clear flag
 *
 * Unanswered rows behave as "Not yet" on close.
 */
export function PostGigPromptModal(): React.JSX.Element | null {
  const closeModal = useUiStore((s) => s.closeModal)
  const data = useUiStore((s) => s.postGigPromptData)
  const resolveFlag = useRecallStore((s) => s.resolveFlag)
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({})

  if (!data) return null

  const setOutcome = (id: string, outcome: Outcome): void => {
    setOutcomes((m) => ({ ...m, [id]: outcome }))
  }

  const finish = async (): Promise<void> => {
    for (const track of data.tracks) {
      const outcome = outcomes[track.id]
      if (outcome && outcome !== 'keep') {
        await resolveFlag(track.id, outcome)
      }
    }
    closeModal()
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
          style={{ maxWidth: 520 }}
          role="dialog"
          aria-modal="true"
          aria-label="Post-gig review"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div>
              <span className="ss-h2">You tested {data.tracks.length} flagged tracks</span>
              <span
                className="ss-caption"
                style={{ marginLeft: 10, color: 'var(--text-tertiary)' }}
              >
                How did each one go?
              </span>
            </div>
            <IconButton icon={X} size="sm" aria-label="Close" onClick={closeModal} />
          </div>

          <div className="modal-body">
            <div className="post-gig-list">
              {data.tracks.map((track) => {
                const choice = outcomes[track.id]
                return (
                  <div key={track.id} className="post-gig-row">
                    <div className="post-gig-meta">
                      <div className="post-gig-title">{track.title}</div>
                      <div className="post-gig-artist">{track.artist}</div>
                    </div>
                    <div className="post-gig-actions">
                      <button
                        type="button"
                        className={`post-gig-pick${choice === 'tested' ? ' active tested' : ''}`}
                        onClick={() => setOutcome(track.id, 'tested')}
                      >
                        <Check size={13} strokeWidth={1.7} /> Tested
                      </button>
                      <button
                        type="button"
                        className={`post-gig-pick${choice === 'keep' ? ' active' : ''}`}
                        onClick={() => setOutcome(track.id, 'keep')}
                      >
                        <FlaskConical size={13} strokeWidth={1.7} /> Not yet
                      </button>
                      <button
                        type="button"
                        className={`post-gig-pick${choice === 'archive' ? ' active archive' : ''}`}
                        onClick={() => setOutcome(track.id, 'archive')}
                      >
                        <Archive size={13} strokeWidth={1.7} /> Archive
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="modal-footer">
            <Button variant="ghost" onClick={closeModal}>
              Skip for now
            </Button>
            <Button variant="primary" onClick={() => void finish()}>
              Save
            </Button>
          </div>
        </motion.div>
      </FocusLock>
    </motion.div>
  )
}
