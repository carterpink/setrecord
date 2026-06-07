import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X, FlaskConical, Archive } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { Modal } from '@/components/shared/Modal'
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
  const { t } = useTranslation('modals')
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
    <Modal onClose={closeModal} ariaLabel={t('postGig.ariaLabel')} maxWidth={520}>
      <div className="modal-header">
        <div>
          <span className="ss-h2">{t('postGig.title', { count: data.tracks.length })}</span>
          <span className="ss-caption" style={{ marginLeft: 10, color: 'var(--text-tertiary)' }}>
            {t('postGig.subtitle')}
          </span>
        </div>
        <IconButton icon={X} size="sm" aria-label={t('common.close')} onClick={closeModal} />
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
                    <Check size={13} strokeWidth={1.7} /> {t('postGig.tested')}
                  </button>
                  <button
                    type="button"
                    className={`post-gig-pick${choice === 'keep' ? ' active' : ''}`}
                    onClick={() => setOutcome(track.id, 'keep')}
                  >
                    <FlaskConical size={13} strokeWidth={1.7} /> {t('postGig.notYet')}
                  </button>
                  <button
                    type="button"
                    className={`post-gig-pick${choice === 'archive' ? ' active archive' : ''}`}
                    onClick={() => setOutcome(track.id, 'archive')}
                  >
                    <Archive size={13} strokeWidth={1.7} /> {t('postGig.archive')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="modal-footer">
        <Button variant="ghost" onClick={closeModal}>
          {t('common.skipForNow')}
        </Button>
        <Button variant="primary" onClick={() => void finish()}>
          {t('common.save')}
        </Button>
      </div>
    </Modal>
  )
}
