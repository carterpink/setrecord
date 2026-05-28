import {
  Sparkles,
  Layers,
  Fingerprint,
  ArrowLeftRight,
  HeartPulse,
  MessageSquare
} from 'lucide-react'
import type { RecallSection } from '@/types'
import { useRecallStore } from '@/stores/recallStore'
import { RediscoverSection } from './RediscoverSection'
import { CratesSection } from './CratesSection'
import { IdentitySection } from './IdentitySection'
import { CombosSection } from './CombosSection'
import { HealthSection } from './HealthSection'
import { ConversationsSection } from './ConversationsSection'
import { RecallAsk } from './RecallAsk'

const NAV: { id: RecallSection; label: string; icon: typeof Sparkles }[] = [
  { id: 'conversations', label: 'Conversations', icon: MessageSquare },
  { id: 'rediscover', label: 'Rediscover', icon: Sparkles },
  { id: 'crates', label: 'Crates', icon: Layers },
  { id: 'identity', label: 'Identity', icon: Fingerprint },
  { id: 'combos', label: 'Combos', icon: ArrowLeftRight },
  { id: 'health', label: 'Health', icon: HeartPulse }
]

export function RecallPanel(): React.JSX.Element {
  const section = useRecallStore((s) => s.section)
  const setSection = useRecallStore((s) => s.setSection)

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
        <RecallAsk />
        {section === 'conversations' ? (
          <ConversationsSection />
        ) : (
          <div className="recall-scroll">
            {section === 'rediscover' && <RediscoverSection />}
            {section === 'crates' && <CratesSection />}
            {section === 'identity' && <IdentitySection />}
            {section === 'combos' && <CombosSection />}
            {section === 'health' && <HealthSection />}
          </div>
        )}
      </div>
    </div>
  )
}
