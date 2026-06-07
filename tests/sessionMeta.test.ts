import { describe, it, expect } from 'vitest'
import { parseSessionMeta } from '../electron/services/rekordbox/sessionMeta'

describe('parseSessionMeta — venue from Rekordbox history-session names', () => {
  it('returns null for empty / nullish names', () => {
    expect(parseSessionMeta(null).venue).toBeNull()
    expect(parseSessionMeta(undefined).venue).toBeNull()
    expect(parseSessionMeta('   ').venue).toBeNull()
  })

  it('returns null for the bare "HISTORY <date>" default name', () => {
    expect(parseSessionMeta('HISTORY 2024-07-12').venue).toBeNull()
    expect(parseSessionMeta('history 2024-07-12').venue).toBeNull()
    expect(parseSessionMeta('HISTORY').venue).toBeNull()
  })

  it('extracts a venue and strips a trailing ISO date', () => {
    expect(parseSessionMeta('Hi Ibiza 2025-07-12').venue).toBe('Hi Ibiza')
  })

  it('extracts a venue with a dotted/slashed date in any position', () => {
    expect(parseSessionMeta('12.07.25 Fabric').venue).toBe('Fabric')
    expect(parseSessionMeta('Boiler Room 12/07').venue).toBe('Boiler Room')
  })

  it('keeps a clean venue name with no date', () => {
    expect(parseSessionMeta('Boiler Room').venue).toBe('Boiler Room')
  })

  it('strips a leading HISTORY label but keeps the venue', () => {
    expect(parseSessionMeta('HISTORY - Hi Ibiza 2025-07-12').venue).toBe('Hi Ibiza')
  })

  it('drops generic / numeric-only remnants', () => {
    expect(parseSessionMeta('Untitled session').venue).toBeNull()
    expect(parseSessionMeta('set').venue).toBeNull()
    expect(parseSessionMeta('2025-07-12').venue).toBeNull()
  })

  it('always flags derived venues as auto', () => {
    expect(parseSessionMeta('Hi Ibiza 2025-07-12').source).toBe('auto')
  })
})
