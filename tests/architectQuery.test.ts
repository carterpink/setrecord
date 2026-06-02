import { describe, it, expect } from 'vitest'
import { parseArchitectQuery } from '../src/utils/architectQuery'

describe('parseArchitectQuery', () => {
  it('parses a full brief', () => {
    const { params } = parseArchitectQuery('2-hour peak club set, 126-130, build the energy')
    expect(params.targetDuration).toBe(120)
    expect(params.venueType).toBe('club')
    expect(params.bpmMin).toBe(126)
    expect(params.bpmMax).toBe(130)
    expect(params.energyCurveType).toBe('rise')
    expect(params.followEnergyCurve).toBe(true)
  })

  it('parses minutes (singular) + warmup + around-BPM', () => {
    const { params } = parseArchitectQuery('90 minute warmup set around 122 bpm')
    expect(params.targetDuration).toBe(90)
    expect(params.vibe).toBe('warmup')
    expect(params.slotTime).toBe('early')
    expect(params.bpmMin).toBe(118)
    expect(params.bpmMax).toBe(126)
  })

  it('maps festival + peak slot', () => {
    const { params } = parseArchitectQuery('peak festival set 128-132')
    expect(params.venueType).toBe('festival')
    expect(params.vibe).toBe('festival')
    expect(params.slotTime).toBe('peak')
    expect(params.bpmMin).toBe(128)
  })

  it('detects harmonic mixing and energy sustain', () => {
    const { params } = parseArchitectQuery('keep it high and mix in key')
    expect(params.energyCurveType).toBe('peak-sustain')
    expect(params.harmonicMixing).toBe(true)
  })

  it('returns empty params + summary for an unparseable brief', () => {
    const { params, summary } = parseArchitectQuery('hello there')
    expect(Object.keys(params)).toHaveLength(0)
    expect(summary).toBe('')
  })
})
