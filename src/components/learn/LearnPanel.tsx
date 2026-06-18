import { useTranslation } from 'react-i18next'
import { GraduationCap } from 'lucide-react'
import type { LearnExplanation } from '@/utils/learnMode/explanations'
import { HarmonicWheelDiagram } from './diagrams/HarmonicWheelDiagram'
import { BpmRampDiagram } from './diagrams/BpmRampDiagram'
import { EnergyCurveDiagram } from './diagrams/EnergyCurveDiagram'
import { TransitionRiskBreakdown } from './diagrams/TransitionRiskBreakdown'

interface LearnPanelProps {
  explanation: LearnExplanation
  /** Override the default "Learn Mode" header label. */
  headerLabel?: string
}

function DiagramRenderer({
  explanation
}: {
  explanation: LearnExplanation
}): React.JSX.Element | null {
  const d = explanation.diagram
  if (!d) return null
  switch (d.kind) {
    case 'harmonic-wheel':
      return <HarmonicWheelDiagram fromKey={d.fromKey} toKey={d.toKey} />
    case 'bpm-ramp':
      return <BpmRampDiagram fromBpm={d.fromBpm} toBpm={d.toBpm} />
    case 'energy-curve':
      return <EnergyCurveDiagram target={d.target} actual={d.actual} />
    case 'risk-breakdown':
      return <TransitionRiskBreakdown factors={d.factors} />
  }
}

/**
 * Inline expanded explanation panel for surfaces where a popover would be too small
 * (Set Architect post-build result, future deep-dive sections).
 */
export function LearnPanel({ explanation, headerLabel }: LearnPanelProps): React.JSX.Element {
  const { t } = useTranslation('learn')
  return (
    <div className="learn-card">
      <div className="learn-card-header">
        <GraduationCap size={14} strokeWidth={1.7} aria-hidden="true" />
        <span
          className="ss-caption"
          style={{ textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.7 }}
        >
          {headerLabel ?? t('panel.header')}
        </span>
      </div>
      <div className="learn-card-title">{explanation.summary}</div>
      <div className="learn-card-detail">{explanation.detail}</div>
      {explanation.diagram && <DiagramRenderer explanation={explanation} />}
    </div>
  )
}
