import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { useRecallStore } from '@/stores/recallStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { NoLibraryState } from '@/components/shared/NoLibraryState'
import { RecallTrackLine } from './RecallTrackLine'

export function RediscoverSection(): React.JSX.Element {
  const { t } = useTranslation('recall')
  const gems = useRecallStore((s) => s.gems)
  const loading = useRecallStore((s) => s.gemsLoading)
  const loadGems = useRecallStore((s) => s.loadGems)
  const trackCount = useLibraryStore((s) => s.tracks.length)

  useEffect(() => {
    void loadGems()
  }, [loadGems])

  if (trackCount === 0) {
    return (
      <div className="recall-section">
        <header className="recall-section-head">
          <h2 className="ss-h2">{t('rediscover.title')}</h2>
          <p className="recall-section-sub">{t('rediscover.subtitle')}</p>
        </header>
        <NoLibraryState
          icon={Sparkles}
          title={t('rediscover.noLibraryTitle')}
          body={t('rediscover.noLibraryBody')}
        />
      </div>
    )
  }

  return (
    <div className="recall-section">
      <header className="recall-section-head">
        <h2 className="ss-h2">{t('rediscover.title')}</h2>
        <p className="recall-section-sub">{t('rediscover.subtitle')}</p>
      </header>

      {loading && <div className="recall-empty">{t('rediscover.digging')}</div>}

      {!loading && gems.length === 0 && (
        <div className="recall-empty">
          <Sparkles size={20} strokeWidth={1.5} />
          <span>{t('rediscover.empty')}</span>
        </div>
      )}

      <div className="recall-list">
        {gems.map((gem) => (
          <RecallTrackLine key={gem.track.id} track={gem.track} note={gem.reason} />
        ))}
      </div>
    </div>
  )
}
