import { describe, it, expect, beforeEach } from 'vitest'
import { useSelectionStore } from '../src/stores/selectionStore'

const reset = (): void =>
  useSelectionStore.setState({ selectedIds: new Set(), anchorId: null, orderedIds: [] })

describe('selectionStore', () => {
  beforeEach(reset)

  it('toggles ids and tracks the anchor', () => {
    const s = useSelectionStore.getState()
    s.toggle('a')
    expect(useSelectionStore.getState().isSelected('a')).toBe(true)
    expect(useSelectionStore.getState().anchorId).toBe('a')
    useSelectionStore.getState().toggle('a')
    expect(useSelectionStore.getState().isSelected('a')).toBe(false)
  })

  it('selectOnly replaces the whole selection', () => {
    const s = useSelectionStore.getState()
    s.toggle('a')
    s.toggle('b')
    useSelectionStore.getState().selectOnly('c')
    expect([...useSelectionStore.getState().selectedIds]).toEqual(['c'])
  })

  it('selectRange selects the inclusive range from the ordered list', () => {
    useSelectionStore.setState({ orderedIds: ['a', 'b', 'c', 'd', 'e'] })
    useSelectionStore.getState().selectRange('b', 'd')
    expect([...useSelectionStore.getState().selectedIds].sort()).toEqual(['b', 'c', 'd'])
  })

  it('selectRange works regardless of direction and is additive', () => {
    useSelectionStore.setState({ orderedIds: ['a', 'b', 'c', 'd'], selectedIds: new Set(['a']) })
    useSelectionStore.getState().selectRange('d', 'b')
    expect([...useSelectionStore.getState().selectedIds].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('selectAll selects every ordered id', () => {
    useSelectionStore.setState({ orderedIds: ['a', 'b', 'c'] })
    useSelectionStore.getState().selectAll()
    expect(useSelectionStore.getState().selectedIds.size).toBe(3)
  })

  it('clear empties the selection and anchor', () => {
    const s = useSelectionStore.getState()
    s.toggle('a')
    useSelectionStore.getState().clear()
    expect(useSelectionStore.getState().selectedIds.size).toBe(0)
    expect(useSelectionStore.getState().anchorId).toBeNull()
  })

  it('retain drops ids that no longer exist', () => {
    useSelectionStore.setState({ selectedIds: new Set(['a', 'b', 'c']) })
    useSelectionStore.getState().retain(new Set(['b', 'c', 'z']))
    expect([...useSelectionStore.getState().selectedIds].sort()).toEqual(['b', 'c'])
  })
})
