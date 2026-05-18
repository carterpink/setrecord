import ElectronStore from 'electron-store'
import type { CDJModel } from '../../src/types'

export interface AppSettings {
  targetHardware: CDJModel
  defaultBpmMin: number
  defaultBpmMax: number
  harmonicMixingDefault: boolean
  youtubeApiKey: string
  favouriteArtists: string[]
  favouriteGenres: string[]
  followedDJs: string[]
  learnModeEnabled: boolean
  isPro: boolean
  hasSeenProficiencyAsk: boolean
}

const DEFAULTS: AppSettings = {
  targetHardware: 'CDJ-2000NXS2',
  defaultBpmMin: 120,
  defaultBpmMax: 132,
  harmonicMixingDefault: true,
  youtubeApiKey: '',
  favouriteArtists: [],
  favouriteGenres: [],
  followedDJs: [],
  learnModeEnabled: false,
  isPro: true,
  hasSeenProficiencyAsk: false,
}

const store = new ElectronStore<AppSettings>({
  name: 'preferences',
  defaults: DEFAULTS,
})

export function getSettings(): AppSettings {
  return {
    targetHardware: store.get('targetHardware'),
    defaultBpmMin: store.get('defaultBpmMin'),
    defaultBpmMax: store.get('defaultBpmMax'),
    harmonicMixingDefault: store.get('harmonicMixingDefault'),
    youtubeApiKey: store.get('youtubeApiKey'),
    favouriteArtists: store.get('favouriteArtists') ?? [],
    favouriteGenres: store.get('favouriteGenres') ?? [],
    followedDJs: store.get('followedDJs') ?? [],
    learnModeEnabled: store.get('learnModeEnabled') ?? false,
    isPro: store.get('isPro') ?? true,
    hasSeenProficiencyAsk: store.get('hasSeenProficiencyAsk') ?? false,
  }
}

export function setSettings(partial: Partial<AppSettings>): AppSettings {
  if (partial.targetHardware !== undefined) store.set('targetHardware', partial.targetHardware)
  if (partial.defaultBpmMin !== undefined) store.set('defaultBpmMin', partial.defaultBpmMin)
  if (partial.defaultBpmMax !== undefined) store.set('defaultBpmMax', partial.defaultBpmMax)
  if (partial.harmonicMixingDefault !== undefined) store.set('harmonicMixingDefault', partial.harmonicMixingDefault)
  if (partial.youtubeApiKey !== undefined) store.set('youtubeApiKey', partial.youtubeApiKey)
  if (partial.favouriteArtists !== undefined) store.set('favouriteArtists', partial.favouriteArtists)
  if (partial.favouriteGenres !== undefined) store.set('favouriteGenres', partial.favouriteGenres)
  if (partial.followedDJs !== undefined) store.set('followedDJs', partial.followedDJs)
  if (partial.learnModeEnabled !== undefined) store.set('learnModeEnabled', partial.learnModeEnabled)
  if (partial.isPro !== undefined) store.set('isPro', partial.isPro)
  if (partial.hasSeenProficiencyAsk !== undefined) store.set('hasSeenProficiencyAsk', partial.hasSeenProficiencyAsk)
  return getSettings()
}
