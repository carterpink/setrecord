/**
 * Guards the v1 launch profile — the deliberate feature-gate set for launch.
 *
 * If one of these flips, a feature the cut/hide audit said to gate would ship
 * "loud" by accident. Defaults must match between the renderer profile
 * (src/config) and the main-process mirror (electron/config). Override at
 * build/runtime via VITE_FEAT_* / SETRECORD_FEAT_*; these assert the baked-in
 * defaults with no env overrides present.
 */
import { describe, it, expect } from 'vitest'
import { launchProfile as renderer } from '../src/config/launchProfile'
import { launchProfile as main } from '../electron/config/launchProfile'

describe('v1 launch profile — renderer defaults', () => {
  it('hides the risk surfaces and keeps Engine export', () => {
    expect(renderer.collab).toBe(false)
    expect(renderer.rekordboxNativeTagWrite).toBe(false)
    expect(renderer.reactionCapture).toBe(false)
    expect(renderer.engineImport).toBe(false)
    expect(renderer.engineExport).toBe(true)
    expect(renderer.beatportExport).toBe(false)
    expect(renderer.liveHudBeta).toBe(true)
  })
})

describe('v1 launch profile — main-process mirror stays in sync', () => {
  it('matches the renderer defaults for every shared flag', () => {
    expect(main.rekordboxNativeTagWrite).toBe(renderer.rekordboxNativeTagWrite)
    expect(main.reactionCapture).toBe(renderer.reactionCapture)
    expect(main.engineImport).toBe(renderer.engineImport)
    expect(main.engineExport).toBe(renderer.engineExport)
  })
})
