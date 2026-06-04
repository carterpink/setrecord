import { useTranslation } from 'react-i18next'
import {
  Sparkles,
  Telescope,
  Layers,
  Fingerprint,
  ArrowLeftRight,
  HeartPulse,
  Tag,
  MapPin
} from 'lucide-react'
import type { RecallSection } from '@/types'
import { useRecallStore } from '@/stores/recallStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useCanUse } from '@/stores/licenseStore'
import { ProLock } from '@/components/shared/ProGate'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { NoLibraryState } from '@/components/shared/NoLibraryState'
import { UncoverSection } from './UncoverSection'
import { RediscoverSection } from './RediscoverSection'
import { CratesSection } from './CratesSection'
import { IdentitySection } from './IdentitySection'
import { CombosSection } from './CombosSection'
import { GigsSection } from './GigsSection'
import { HealthSection } from './HealthSection'
import { TagsSection } from './TagsSection'

const NAV: { id: RecallSection; labelKey: string; icon: typeof Sparkles }[] = [
  { id: 'crates', labelKey: 'nav.crates', icon: Layers },
  { id: 'tags', labelKey: 'nav.tags', icon: Tag },
  { id: 'uncover', labelKey: 'nav.uncover', icon: Telescope },
  { id: 'rediscover', labelKey: 'nav.rediscover', icon: Sparkles },
  { id: 'combos', labelKey: 'nav.combos', icon: ArrowLeftRight },
  { id: 'gigs', labelKey: 'nav.gigs', icon: MapPin },
  { id: 'identity', labelKey: 'nav.identity', icon: Fingerprint },
  { id: 'health', labelKey: 'nav.health', icon: HeartPulse }
]

export function RecallPanel(): React.JSX.Element {
  const { t } = useTranslation('recall')
  const section = useRecallStore((s) => s.section)
  const setSection = useRecallStore((s) => s.setSection)
  const hasLibrary = useLibraryStore((s) => s.hasLibrary)
  const isPro = useCanUse('recall')
  const activeLabel = NAV.find((n) => n.id === section)
    ? t(NAV.find((n) => n.id === section)!.labelKey)
    : t('nav.fallback')

  // Pricing re-cut (2026-06): the memory surface is the free hook. Free tier now
  // gets the full "rear-view mirror" — Gigs history, Identity/Wrapped, Rediscover,
  // Uncover, Combos and the Health headline — so a DJ falls in love with seeing
  // their own world reflected back BEFORE any paywall. Only the forward-looking
  // "windshield" stays Pro: the Crates custom rule builder here, plus Set
  // Architect / Suggestions / Export / Cue editor (gated elsewhere in Build).
  // Health drill-down and Tags overrides self-gate inside their own sections.
  return (
    <div className="recall">
      <aside className="recall-nav glass-1">
        {NAV.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`recall-nav-item${section === id ? ' active' : ''}`}
            onClick={() => setSection(id)}
          >
            <Icon size={18} strokeWidth={1.5} />
            <span>{t(labelKey)}</span>
          </button>
        ))}
      </aside>

      <div className="recall-body">
        {/* Each section is isolated: a crash in one is caught here (keyed by
            section so it's a fresh boundary per view, with resetKeys as a
            belt-and-braces auto-reset on navigation). The nav above stays
            outside the boundary, so the user can always switch away. */}
        <ErrorBoundary key={section} label={activeLabel} variant="section" resetKeys={[section]}>
          {!hasLibrary ? (
            <div className="recall-scroll">
              <NoLibraryState body={t('panel.noLibrary')} />
            </div>
          ) : (
            <>
              {/* Only Crates' rule builder is Pro now; Tags browse is a free
                  taste (overrides + Rekordbox export self-gate inside Tags). */}
              {!isPro && section === 'crates' ? (
                <div className="recall-scroll">
                  <ProLock feature="smartCrates" />
                </div>
              ) : section === 'tags' ? (
                <TagsSection />
              ) : section === 'uncover' ? (
                <UncoverSection />
              ) : (
                <div className="recall-scroll">
                  {section === 'rediscover' && <RediscoverSection />}
                  {section === 'crates' && <CratesSection />}
                  {section === 'identity' && <IdentitySection />}
                  {section === 'combos' && <CombosSection />}
                  {section === 'gigs' && <GigsSection />}
                  {section === 'health' && <HealthSection />}
                </div>
              )}
            </>
          )}
        </ErrorBoundary>
      </div>
    </div>
  )
}
