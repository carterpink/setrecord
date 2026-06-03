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

const NAV: { id: RecallSection; label: string; icon: typeof Sparkles }[] = [
  { id: 'crates', label: 'Crates', icon: Layers },
  { id: 'tags', label: 'Tags', icon: Tag },
  { id: 'uncover', label: 'Uncover', icon: Telescope },
  { id: 'rediscover', label: 'Rediscover', icon: Sparkles },
  { id: 'combos', label: 'Combos', icon: ArrowLeftRight },
  { id: 'gigs', label: 'Gigs', icon: MapPin },
  { id: 'identity', label: 'Identity', icon: Fingerprint },
  { id: 'health', label: 'Health', icon: HeartPulse }
]

export function RecallPanel(): React.JSX.Element {
  const section = useRecallStore((s) => s.section)
  const setSection = useRecallStore((s) => s.setSection)
  const hasLibrary = useLibraryStore((s) => s.hasLibrary)
  const isPro = useCanUse('recall')
  const activeLabel = NAV.find((n) => n.id === section)?.label ?? 'Recall'

  // Free tier keeps the Library Health headline (see PRD §16); everything else
  // in the Recall tab — NL search, Rediscover, Crates, Identity, Combos,
  // drill-down — is Pro. HealthSection self-gates its drill-down.
  return (
    <div className="recall">
      <aside className="recall-nav glass-1">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`recall-nav-item${section === id ? ' active' : ''}`}
            onClick={() => setSection(id)}
          >
            <Icon size={18} strokeWidth={1.5} />
            <span>{label}</span>
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
              <NoLibraryState body="Recall reads your whole collection — rediscovering forgotten gems, mapping your sound, and tracing the transitions you reach for. Import your library to bring it to life." />
            </div>
          ) : (
            <>
              {/* Tags are a free taste (view + browse); overrides + Rekordbox
                  export self-gate to Pro inside the Tags surface. */}
              {!isPro && section !== 'health' && section !== 'tags' ? (
                <div className="recall-scroll">
                  <ProLock feature="recall" />
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
